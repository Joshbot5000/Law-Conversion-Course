  /* ------------------------------------------------------------------
     U12c. PHONE VOICE — a natural neural voice (Kokoro-82M, Apache-2.0)
           that runs on the viewer's own device, for where claude.ai's
           Claude voice isn't offered (iPhone, Safari, the phone apps).
           The model files are published next to the page under tts/
           (the page may only download from its own address); the
           speech engine (onnxruntime-web) and the text-to-phoneme step
           (phonemizer / eSpeak NG) load from jsDelivr as scripts.
           Everything runs in a background worker. The download (~105 MB)
           is kept in the browser's cache, and made audio is kept per
           video in IndexedDB, so replays start at once.
     ------------------------------------------------------------------ */
  var PV_BASE = 'tts/';
  var PV_ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
  var PV_PHON = 'https://cdn.jsdelivr.net/npm/phonemizer@1.2.1/dist/phonemizer.js';
  var PV_VOICES = { bf_emma: 'Emma (British)', bm_george: 'George (British)', af_heart: 'Heart (American)' };
  var pv = { state: 'off', pct: 0, err: '', worker: null, jobs: {}, seq: 0, ctx: null, mem: {}, pending: {}, queue: [], busy: false };

  function pvAvailable() { return /^https?:$/.test(location.protocol) && typeof WebAssembly === 'object' && typeof Worker === 'function' && !!(window.AudioContext || window.webkitAudioContext); }

  // Fetch one of the voice files from the page's own address, keeping a copy in the browser's cache.
  function pvGet(path) {
    var url = new URL(PV_BASE + path, location.href).href;
    var fromNet = function () { return fetch(url).then(function (r) { if (!r.ok) throw new Error('The voice files are missing (' + r.status + ').'); return r; }); };
    if (!window.caches) return fromNet().then(function (r) { return r.arrayBuffer(); });
    return caches.open('lr-phone-voice-v1').then(function (c) {
      return c.match(url).then(function (hit) {
        if (hit) return hit.arrayBuffer();
        return fromNet().then(function (r) { var copy = r.clone(); return c.put(url, copy).then(null, function () {}).then(function () { return r.arrayBuffer(); }); });
      });
    }, function () { return fromNet().then(function (r) { return r.arrayBuffer(); }); });
  }

  // The worker: text → phonemes (eSpeak NG, the same clean-up rules as kokoro-js) → token ids → Kokoro → 24 kHz audio.
  var PV_WORKER = [
    'let ort, sess, phonemize, vocab, voices = {};',
    'const norm = (t) => t.replace(/[‘’]/g, "\'").replace(/[“”«»]/g, \'"\').replace(/\\(/g, "«").replace(/\\)/g, "»").replace(/[^\\S \\n]/g, " ").replace(/  +/g, " ")',
    '  .replace(/\\bD[Rr]\\.(?= [A-Z])/g, "Doctor").replace(/\\b(?:Mr\\.|MR\\.(?= [A-Z]))/g, "Mister").replace(/\\b(?:Ms\\.|MS\\.(?= [A-Z]))/g, "Miss").replace(/\\b(?:Mrs\\.|MRS\\.(?= [A-Z]))/g, "Mrs")',
    '  .replace(/\\betc\\.(?! [A-Z])/gi, "etc").replace(/\\bv\\.? (?=[A-Z])/g, "versus ").replace(/\\bs ?(\\d+)/g, "section $1").replace(/(?<=\\d),(?=\\d)/g, "").replace(/(?<=\\d)-(?=\\d)/g, " to ")',
    '  .replace(/£(\\d+)/g, "$1 pounds").replace(/\\$(\\d+)/g, "$1 dollars").trim();',
    'const PUNCT = /(\\s*[;:,.!?¡¿—…"«»“”(){}\\[\\]]+\\s*)+/g;',
    'async function phon(text, lang) {',
    '  const parts = []; let last = 0;',
    '  for (const m of text.matchAll(PUNCT)) { if (last < m.index) parts.push([false, text.slice(last, m.index)]); parts.push([true, m[0]]); last = m.index + m[0].length; }',
    '  if (last < text.length) parts.push([false, text.slice(last)]);',
    '  const out = (await Promise.all(parts.map(async ([p, t]) => p ? t : (await phonemize(t, lang)).join(" ")))).join("");',
    '  return out.replace(/ʲ/g, "j").replace(/r/g, "ɹ").replace(/x/g, "k").replace(/ɬ/g, "l").replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ").replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, "z").trim();',
    '}',
    'async function run(ids, voice, speed) {',
    '  const v = voices[voice], row = Math.min(ids.length, 509) * 256;',
    '  const feeds = { tokens: new ort.Tensor("int64", BigInt64Array.from([0, ...ids, 0].map(BigInt)), [1, ids.length + 2]), style: new ort.Tensor("float32", v.slice(row, row + 256), [1, 256]), speed: new ort.Tensor("float32", [speed], [1]) };',
    '  const out = await sess.run(feeds); return out[sess.outputNames[0]].data;',
    '}',
    'onmessage = async (e) => {',
    '  const m = e.data;',
    '  if (m.type === "init") {',
    '    try {',
    '      ort = await import(m.ort + "ort.wasm.min.mjs");',
    '      ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false; ort.env.wasm.wasmPaths = { mjs: m.ort + "ort-wasm-simd-threaded.mjs" }; ort.env.wasm.wasmBinary = m.wasm;',
    '      sess = await ort.InferenceSession.create(new Uint8Array(m.model), { executionProviders: ["wasm"], graphOptimizationLevel: "all" });',
    '      phonemize = (await import(m.phon)).phonemize; vocab = m.vocab;',
    '      for (const k in m.voices) voices[k] = new Float32Array(m.voices[k]);',
    '      await run([vocab["ə"] || 1], Object.keys(voices)[0], 1);',
    '      postMessage({ type: "ready" });',
    '    } catch (err) { postMessage({ type: "error", message: String(err && err.message || err) }); }',
    '  } else if (m.type === "say") {',
    '    try {',
    '      const ph = await phon(norm(m.text), m.voice[0] === "b" ? "en" : "en-us");',
    '      const ids = [...ph].map((c) => vocab[c]).filter((x) => x !== undefined);',
    '      const pieces = []; for (let i = 0; i < ids.length; i += 500) pieces.push(ids.slice(i, i + 500));',
    '      const outs = []; for (const p of pieces) outs.push(await run(p, m.voice, m.speed));',
    '      const n = outs.reduce((a, o) => a + o.length, 0), audio = new Float32Array(n); let at = 0; for (const o of outs) { audio.set(o, at); at += o.length; }',
    '      postMessage({ type: "audio", id: m.id, audio }, [audio.buffer]);',
    '    } catch (err) { postMessage({ type: "audio", id: m.id, error: String(err && err.message || err) }); }',
    '  }',
    '};'
  ].join('\n');

  // Download (or take from the cache) and start the voice. onStep(text, percent) reports progress.
  function pvStart(onStep) {
    if (pv.state === 'ready') return Promise.resolve();
    if (pv.starting) return pv.starting;
    pv.state = 'loading'; pv.pct = 0; pv.err = '';
    var step = function (t, p) { if (p != null) pv.pct = p; if (onStep) onStep(t, pv.pct); };
    pv.starting = pvGet('manifest.json').then(function (buf) {
      var man = JSON.parse(new TextDecoder().decode(buf)), total = man.bytes || 1, done = 0;
      var count = function (b) { done += b.byteLength; step('Downloading the phone voice (once)…', Math.min(95, Math.round(done / total * 95))); return b; };
      step('Downloading the phone voice (once)…', 0);
      var getAll = function (list) { return list.reduce(function (p, f) { return p.then(function (acc) { return pvGet(f).then(count).then(function (b) { acc.push(b); return acc; }); }); }, Promise.resolve([])); };
      return getAll(man.model).then(function (parts) {
        var model = new Uint8Array(parts.reduce(function (n, b) { return n + b.byteLength; }, 0)), at = 0;
        parts.forEach(function (b) { model.set(new Uint8Array(b), at); at += b.byteLength; });
        return pvGet(man.wasm).then(count).then(function (wasm) {
          var names = Object.keys(PV_VOICES);
          return Promise.all(names.map(function (n) { return pvGet(man.voices[n]).then(count); })).then(function (vbufs) {
            var voices = {}; names.forEach(function (n, i) { voices[n] = vbufs[i]; });
            step('Getting the voice ready…', 96);
            return new Promise(function (resolve, reject) {
              var w = new Worker(URL.createObjectURL(new Blob([PV_WORKER], { type: 'text/javascript' })), { type: 'module' });
              w.onmessage = function (e) {
                var m = e.data;
                if (m.type === 'ready') { pv.worker = w; pv.state = 'ready'; step('Ready', 100); resolve(); }
                else if (m.type === 'error') reject(new Error(m.message));
                else if (m.type === 'audio') { var j = pv.jobs[m.id]; delete pv.jobs[m.id]; if (j) { if (m.error) j.reject(new Error(m.error)); else j.resolve(m.audio); } }
              };
              w.onerror = function (e) { reject(new Error(e.message || 'The voice could not start on this device.')); };
              w.postMessage({ type: 'init', model: model.buffer, wasm: wasm, voices: voices, vocab: man.vocab, ort: PV_ORT, phon: PV_PHON }, [model.buffer, wasm].concat(names.map(function (n) { return voices[n]; })));
            });
          });
        });
      });
    }).then(function () { pv.starting = null; }, function (err) { pv.starting = null; pv.state = 'error'; pv.err = (err && err.message) || 'The voice could not start.'; throw err; });
    return pv.starting;
  }
  // Make the audio for one piece of text (cached in memory and in this browser).
  function pvSay(key, text, voice, speed, urgent) {
    if (pv.mem[key]) return Promise.resolve(pv.mem[key]);
    var job = pv.pending[key];
    if (!job) {
      job = pv.pending[key] = { key: key, text: text, voice: voice, speed: speed };
      job.promise = new Promise(function (resolve, reject) { job.resolve = resolve; job.reject = reject; });
      job.promise.then(null, function () {});
      pv.queue.push(job);
    }
    if (urgent) { var at = pv.queue.indexOf(job); if (at > 0) { pv.queue.splice(at, 1); pv.queue.unshift(job); } }
    pvPump();
    return job.promise;
  }
  // Put these (key, text, voice, speed) first, in this order, ahead of anything else waiting.
  function pvPrepare(items) {
    var front = [];
    items.forEach(function (it) {
      if (pv.mem[it.key]) return;
      var job = pv.pending[it.key];
      if (!job) { pvSay(it.key, it.text, it.voice, it.speed); job = pv.pending[it.key]; }
      if (job && pv.queue.indexOf(job) !== -1) front.push(job);
    });
    pv.queue = front.concat(pv.queue.filter(function (j) { return front.indexOf(j) === -1; }));
    pvPump();
  }
  function pvDrop() { pv.queue.forEach(function (j) { delete pv.pending[j.key]; j.reject({ code: 'stopped' }); }); pv.queue = []; }
  function pvPump() {
    if (pv.busy || !pv.queue.length) return;
    var job = pv.queue.shift(); pv.busy = true;
    var done = function () { pv.busy = false; delete pv.pending[job.key]; pvPump(); if (pv.onMade) pv.onMade(); };
    pvIdb('get', job.key).then(function (hit) {
      if (hit) return new Float32Array(hit);
      if (pv.state !== 'ready') throw new Error('The phone voice is not ready.');
      var id = ++pv.seq;
      return new Promise(function (resolve, reject) { pv.jobs[id] = { resolve: resolve, reject: reject }; pv.worker.postMessage({ type: 'say', id: id, text: job.text, voice: job.voice, speed: job.speed }); })
        .then(function (audio) { pvIdb('put', job.key, audio.buffer.slice(0)); return audio; });
    }).then(function (audio) { pv.mem[job.key] = audio; job.resolve(audio); done(); }, function (err) { job.reject(err); done(); });
  }
  // A tiny IndexedDB store for made audio (per video, line, voice and pace). Failures are ignored.
  function pvIdb(op, key, val) {
    return new Promise(function (resolve) {
      try {
        var rq = indexedDB.open('lr-phone-voice', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('a'); };
        rq.onerror = function () { resolve(null); };
        rq.onsuccess = function () {
          try {
            var tx = rq.result.transaction('a', op === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('a');
            var r = op === 'get' ? st.get(key) : st.put(val, key);
            r.onsuccess = function () { resolve(op === 'get' ? r.result || null : true); };
            r.onerror = function () { resolve(null); };
          } catch (e) { resolve(null); }
        };
      } catch (e) { resolve(null); }
    });
  }
  // Play a Float32Array of 24 kHz audio; resolves when it has finished (or was stopped).
  function pvCtx() {
    if (!pv.ctx) { var AC = window.AudioContext || window.webkitAudioContext; pv.ctx = new AC(); }
    return pv.ctx;
  }
  function pvPlay(audio) {
    var ctx = pvCtx(), buf = ctx.createBuffer(1, audio.length, 24000);
    buf.getChannelData(0).set(audio);
    var src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination);
    return new Promise(function (resolve) { src.onended = function () { if (pv.src === src) pv.src = null; resolve(); }; pv.src = src; src.start(); });
  }
  function pvHalt() { if (pv.src) { try { pv.src.onended = null; pv.src.stop(); } catch (e) { /* ignore */ } pv.src = null; } }
