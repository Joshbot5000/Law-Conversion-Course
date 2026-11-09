/*
 * media.js: camera, microphone, recording, speech-to-text and the interviewer's voice.
 *
 * Speech-to-text uses the browser's built-in recogniser (Chrome and Edge; it
 * sends audio to the browser maker's service to transcribe). Chrome stops
 * listening after a silence or about a minute, so the listener restarts itself
 * until the answer ends. When the browser has no recogniser, answers are typed.
 */
(function (g) {
  'use strict';
  const IT = g.IT = g.IT || {};
  const nav = g.navigator || {};
  const SR = g.SpeechRecognition || g.webkitSpeechRecognition || null;

  function support() {
    return {
      secure: g.isSecureContext !== false,
      camera: !!(nav.mediaDevices && nav.mediaDevices.getUserMedia),
      recorder: typeof g.MediaRecorder === 'function',
      stt: !!SR,
      tts: !!g.speechSynthesis && typeof g.SpeechSynthesisUtterance === 'function'
    };
  }

  /* ---------------- camera and microphone ---------------- */
  let stream = null;
  let streamKind = '';

  async function open(wantVideo) {
    if (stream && stream.active && (!wantVideo || streamKind === 'av')) return { stream, kind: streamKind };
    close();
    if (!support().camera) throw mediaError('unsupported');
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    if (wantVideo) {
      try {
        stream = await nav.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' }, audio });
        streamKind = 'av';
        return { stream, kind: streamKind };
      } catch (e) {
        if (e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError' || e.name === 'NotReadableError')) {
          // No usable camera: fall back to microphone only.
        } else throw mediaError(e && e.name, e);
      }
    }
    try {
      stream = await nav.mediaDevices.getUserMedia({ audio });
      streamKind = 'a';
      return { stream, kind: streamKind };
    } catch (e) { throw mediaError(e && e.name, e); }
  }

  function close() {
    if (stream) stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { /* already stopped */ } });
    stream = null; streamKind = '';
    stopLevel();
  }

  function mediaError(name, cause) {
    const msgs = {
      unsupported: 'This browser cannot use a camera or microphone here. Use Chrome or Edge, opened from the published site (https) or localhost.',
      NotAllowedError: 'Camera or microphone permission was refused. Click the camera icon in the address bar, allow both, then try again.',
      SecurityError: 'The browser blocked the camera because the page is not secure. Open the published site (https) instead of the file.',
      NotFoundError: 'No microphone was found. Plug one in or check your sound settings.',
      NotReadableError: 'Your camera or microphone is being used by another app (Teams, Zoom?). Close it and try again.',
      AbortError: 'The camera could not start. Try again.'
    };
    const err = new Error(msgs[name] || ('The camera or microphone could not start' + (cause && cause.message ? ': ' + cause.message : '.')));
    err.code = name || 'unknown';
    return err;
  }

  /* ---------------- microphone level ---------------- */
  let levelCtx = null, levelRaf = 0;
  function level(cb) {
    stopLevel();
    if (!stream || !stream.getAudioTracks().length) return;
    const AC = g.AudioContext || g.webkitAudioContext;
    if (!AC) return;
    try {
      levelCtx = new AC();
      const src = levelCtx.createMediaStreamSource(stream);
      const an = levelCtx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        cb(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        levelRaf = g.requestAnimationFrame(tick);
      };
      if (levelCtx.state === 'suspended') levelCtx.resume().catch(() => {});
      tick();
    } catch (e) { stopLevel(); }
  }
  function stopLevel() {
    if (levelRaf) g.cancelAnimationFrame(levelRaf);
    levelRaf = 0;
    if (levelCtx) { levelCtx.close().catch(() => {}); levelCtx = null; }
  }

  /* ---------------- recording ---------------- */
  function pickType(video) {
    if (!support().recorder) return '';
    const types = video
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a', 'video/mp4']
      : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    for (const t of types) { try { if (g.MediaRecorder.isTypeSupported(t)) return t; } catch (e) { /* ignore */ } }
    return '';
  }

  function record() {
    if (!stream || !support().recorder) return null;
    const video = stream.getVideoTracks().length > 0;
    const type = pickType(video);
    let rec;
    try {
      rec = new g.MediaRecorder(stream, Object.assign({ audioBitsPerSecond: 64000 }, video ? { videoBitsPerSecond: 700000 } : {}, type ? { mimeType: type } : {}));
    } catch (e) {
      try { rec = new g.MediaRecorder(stream); } catch (e2) { return null; }
    }
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    try { rec.start(1000); } catch (e) { return null; }
    return {
      video,
      stop: () => new Promise(resolve => {
        if (rec.state === 'inactive') { resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType || type }) : null); return; }
        const done = () => resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType || type || (video ? 'video/webm' : 'audio/webm') }) : null);
        rec.onstop = done;
        setTimeout(done, 3000); // never hang if onstop does not fire
        try { rec.stop(); } catch (e) { done(); }
      })
    };
  }

  /* ---------------- speech to text ---------------- */
  function Listener(opts) {
    this.onUpdate = opts.onUpdate || (() => {});
    this.onIssue = opts.onIssue || (() => {});
    this.finals = [];
    this.interim = '';
    this.active = false;
    this.rec = null;
    this.startedAt = 0;
    this.firstAt = 0;
    this.lastAt = 0;
    this.longPauses = 0;
    this.fatal = '';
    this.restarts = 0;
  }
  Listener.prototype.start = function () {
    if (!SR) { this.fatal = 'unsupported'; return false; }
    this.active = true;
    this.startedAt = Date.now();
    this._spawn();
    return true;
  };
  Listener.prototype._spawn = function () {
    if (!this.active) return;
    let rec;
    try { rec = new SR(); } catch (e) { this.fatal = 'unsupported'; this.onIssue('unsupported'); return; }
    rec.lang = 'en-GB';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = ev => {
      const now = Date.now();
      if (!this.firstAt) this.firstAt = now;
      if (this.lastAt && now - this.lastAt > 4000) this.longPauses++;
      this.lastAt = now;
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const t = (r[0] && r[0].transcript || '').trim();
        if (!t) continue;
        if (r.isFinal) this.finals.push(t); else interim += (interim ? ' ' : '') + t;
      }
      this.interim = interim;
      this.onUpdate(this.text(), interim);
    };
    rec.onerror = ev => {
      const e = ev && ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed') { this.fatal = 'not-allowed'; this.active = false; this.onIssue('not-allowed'); }
      else if (e === 'network') { this.fatal = 'network'; this.active = false; this.onIssue('network'); }
      else if (e === 'audio-capture') { this.fatal = 'audio-capture'; this.active = false; this.onIssue('audio-capture'); }
      // 'no-speech' and 'aborted' are routine: onend restarts.
    };
    rec.onend = () => {
      if (this.interim) { this.finals.push(this.interim); this.interim = ''; }
      if (this.active && this.restarts < 200) {
        this.restarts++;
        setTimeout(() => this._spawn(), 120);
      } else if (this._resolveStop) this._resolveStop();
    };
    this.rec = rec;
    try { rec.start(); } catch (e) { setTimeout(() => this._spawn(), 300); }
  };
  Listener.prototype.text = function () {
    return this.finals.concat(this.interim ? [this.interim] : []).join(' ').replace(/\s+/g, ' ').trim();
  };
  Listener.prototype.stop = function () {
    return new Promise(resolve => {
      const finish = () => {
        this._resolveStop = null;
        resolve({ text: this.text(), firstWordSec: this.firstAt ? (this.firstAt - this.startedAt) / 1000 : null, longPauses: this.longPauses, fatal: this.fatal });
      };
      if (!this.active || !this.rec) { this.active = false; finish(); return; }
      this.active = false;
      this._resolveStop = finish;
      try { this.rec.stop(); } catch (e) { finish(); return; }
      setTimeout(() => { if (this._resolveStop) finish(); }, 1500); // wait briefly for the last words
    });
  };
  Listener.prototype.abort = function () {
    this.active = false;
    try { if (this.rec) this.rec.abort(); } catch (e) { /* ignore */ }
  };

  /* ---------------- interviewer voice ---------------- */
  function voices() {
    if (!support().tts) return [];
    try { return g.speechSynthesis.getVoices() || []; } catch (e) { return []; }
  }
  function bestVoice(name) {
    const vs = voices();
    if (!vs.length) return null;
    if (name) { const v = vs.find(x => x.name === name); if (v) return v; }
    const pref = [/en-GB/i, /en_GB/i];
    const gb = vs.filter(v => pref.some(p => p.test(v.lang)));
    const natural = gb.find(v => /natural|neural|online|premium|enhanced/i.test(v.name)) || gb.find(v => /google uk english/i.test(v.name));
    return natural || gb[0] || vs.find(v => /^en/i.test(v.lang)) || vs[0];
  }
  let speakToken = 0;
  let speakResolve = null;
  function speak(text, name) {
    if (!support().tts || !text) return Promise.resolve();
    cancelSpeech();
    const token = ++speakToken;
    const parts = String(text).match(/[^.!?]+[.!?]*\s*/g) || [String(text)];
    const voice = bestVoice(name);
    return new Promise(resolve => {
      speakResolve = resolve;
      let i = 0;
      const next = () => {
        if (token !== speakToken || i >= parts.length) { if (speakResolve === resolve) speakResolve = null; resolve(); return; }
        const u = new g.SpeechSynthesisUtterance(parts[i++].trim());
        if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-GB';
        u.rate = 1; u.pitch = 1;
        let ended = false;
        const go = () => { if (ended) return; ended = true; clearTimeout(guard); next(); };
        u.onend = go; u.onerror = go;
        // Some browsers never fire onend; move on after a generous estimate.
        const guard = setTimeout(go, 1500 + u.text.split(/\s+/).length * 600);
        try { g.speechSynthesis.speak(u); } catch (e) { go(); }
      };
      next();
    });
  }
  function cancelSpeech() {
    speakToken++;
    if (speakResolve) { const r = speakResolve; speakResolve = null; r(); }
    try { if (support().tts) g.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  }

  IT.media = { support, open, close, level, stopLevel, record, Listener, voices, speak, cancelSpeech, get stream() { return stream; }, get kind() { return streamKind; } };
})(typeof window !== 'undefined' ? window : globalThis);
