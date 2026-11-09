/*
 * app.js: screens and the interview room.
 *
 * Pages (hash routes): #/ practise, #/interview, #/report/<id>, #/progress,
 * #/bank, #/firms, #/firm/<id>, #/learn, #/settings.
 * Part two (app-pages.js) holds the report, progress, bank, firms, learn and
 * settings pages; this file holds the shared helpers, the practise page and
 * the interview room.
 */
(function () {
  'use strict';
  const IT = window.IT;
  const store = IT.store;
  store.load();
  const S = () => store.state;

  /* ---------------- helpers ---------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const view = $('#view');
  const fmtTime = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const fmtDate = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtDateTime = t => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  function overlay(html, opts) {
    const root = $('#overlayRoot');
    root.innerHTML = '<div class="overlay" role="dialog" aria-modal="true"><div class="box">' + html + '</div></div>';
    const box = $('.box', root);
    const first = box.querySelector('button, [href], input, textarea, select');
    if (first) setTimeout(() => first.focus(), 30);
    if (opts && opts.dismiss) root.firstChild.addEventListener('click', e => { if (e.target === root.firstChild) closeOverlay(); });
    return box;
  }
  function closeOverlay() { $('#overlayRoot').innerHTML = ''; }

  function toast(msg, kind) {
    const t = document.createElement('div');
    t.className = 'notice ' + (kind || 'info');
    t.setAttribute('role', 'status');
    t.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:60;max-width:min(560px,calc(100vw - 32px));box-shadow:0 6px 24px rgba(0,0,0,.25)';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  function aiPill() {
    const p = $('#aiPill');
    if (IT.ai.available()) { const m = IT.MODELS.find(x => x.id === S().settings.model) || IT.MODELS[0]; p.className = 'aipill on'; p.textContent = 'AI on · ' + m.name.replace('Claude ', ''); p.title = 'The AI interviewer and marking are on.'; }
    else { p.className = 'aipill off'; p.textContent = 'AI off'; p.title = 'Add an API key in Settings for AI follow-ups and marking.'; }
  }

  /* ---------------- router ---------------- */
  let cleanup = null;
  let room = null;
  const pages = {};
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('/').map(decodeURIComponent);
    const name = parts[0] || '';
    if (room && room.active && name !== 'interview') {
      if (!confirm('Leave the interview? Answers so far are saved, but the interview will end.')) { history.replaceState(null, '', '#/interview'); return; }
      room.abandon();
    }
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    closeOverlay();
    const navName = { '': 'home', interview: 'home', report: 'progress', firm: 'firms' }[name] || name;
    $$('nav.top a').forEach(a => { if (a.dataset.nav === navName) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    aiPill();
    const fn = pages[name] || pages[''];
    fn(parts.slice(1));
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', e => { if (room && room.active) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------------- practise page ---------------- */
  function setupPrefs() {
    const st = S().settings;
    if (!st.last) st.last = {};
    const fmt = IT.formatById(st.last.formatId || 'adaptive');
    return Object.assign({ firmId: 'mishcon', customFirm: '', formatId: fmt.id, length: fmt.mains, depth: fmt.depth, prep: fmt.prep, answer: fmt.answer, focus: '' }, st.last);
  }
  function savePrefs(p) { S().settings.last = p; store.save(); }

  function firmOptions(sel) {
    const groups = {};
    IT.FIRMS.forEach(f => { (groups[f.group] = groups[f.group] || []).push(f); });
    const order = ['Generic', 'London independent', 'Magic Circle', 'Global', 'US', 'Transatlantic (formerly Taylor Wessing UK)', 'UK national and international', 'International', 'UK national'];
    const keys = Object.keys(groups).sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
    return keys.map(k => '<optgroup label="' + esc(k.replace(/ \(formerly.*\)/, '')) + '">' + groups[k].map(f => '<option value="' + f.id + '"' + (f.id === sel ? ' selected' : '') + '>' + esc(f.name) + '</option>').join('') + '</optgroup>').join('') +
      '<option value="custom"' + (sel === 'custom' ? ' selected' : '') + '>Another firm (type its name)…</option>';
  }

  const PREP_OPTS = [[-1, 'Untimed'], [0, 'None'], [5, '5 s'], [10, '10 s'], [15, '15 s'], [30, '30 s'], [45, '45 s']];
  const ANSWER_OPTS = [[60, '1 min'], [90, '1.5 min'], [120, '2 min'], [180, '3 min'], [240, '4 min'], [0, 'Untimed']];
  const opt = (pairs, v) => pairs.map(([k, l]) => '<option value="' + k + '"' + (String(k) === String(v) ? ' selected' : '') + '>' + l + '</option>').join('');

  function todayStats() {
    const sess = S().sessions;
    const today = dayKey(Date.now());
    const t = sess.filter(s => dayKey(s.started) === today);
    const answers = t.reduce((a, s) => a + s.threads.reduce((b, th) => b + th.turns.length, 0), 0);
    const secs = t.reduce((a, s) => a + s.threads.reduce((b, th) => b + th.turns.reduce((c, tu) => c + (tu.durationSec || 0), 0), 0), 0);
    return { sessions: t.length, answers, minutes: Math.round(secs / 60), streak: streak() };
  }
  function streak() {
    const days = new Set(S().sessions.map(s => dayKey(s.started)));
    let n = 0; const d = new Date();
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
    while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  pages[''] = function home() {
    const p = setupPrefs();
    const sup = IT.media.support();
    const st = S().settings;
    const last = S().sessions.find(s => s.summary);
    const ts = todayStats();
    const fmtBtns = IT.FORMATS.map(f => '<button type="button" class="fmt' + (f.id === 'replay' ? ' replay' : '') + '" data-fmt="' + f.id + '" aria-pressed="' + (f.id === p.formatId) + '"><b>' + esc(f.name) + '</b><span>' + esc(f.blurb) + '</span></button>').join('');
    const cats = Object.keys(IT.CATS).map(k => '<option value="' + k + '"' + (p.focus === k ? ' selected' : '') + '>' + esc(IT.CATS[k].label) + '</option>').join('');
    const warn = [];
    if (!IT.ai.available()) warn.push('<div class="notice">The AI interviewer is off, so follow-ups come from the question bank and scores are estimates. <a href="#/settings">Add your Claude API key</a> for follow-ups built from your own words and assessor-standard marking.</div>');
    if (!sup.stt) warn.push('<div class="notice">This browser cannot turn speech into text, so you will type your answers. Use <b>Chrome</b> or <b>Edge</b> on your laptop to speak them.</div>');
    if (!sup.secure) warn.push('<div class="notice bad">This page is not running from a secure address, so the camera and microphone are blocked. Open the published site (https) or run it from localhost.</div>');
    if (!store.persistent) warn.push('<div class="notice bad">This browser is not letting the app save (private window or blocked storage). Your progress will be lost when you close it.</div>');
    view.innerHTML = '<main class="wrap">' +
      '<div class="grid2"><div>' +
      '<p class="eyebrow">Practise</p><h1 class="page">Train for the interview you cannot predict.</h1>' +
      '<p class="lede">Pick a firm and a format. The interviewer asks, you answer out loud on camera, and it follows up on what you actually said. Marks come at the end, to the standard of a competitive City firm.</p>' +
      '<div class="stack" style="margin-top:16px">' + warn.join('') + '</div>' +
      '<div class="card" style="margin-top:18px">' +
      '<div class="opts" style="margin-top:0;grid-template-columns:minmax(0,1fr) minmax(0,1fr)">' +
      '<label class="f">Firm<select id="firm">' + firmOptions(p.firmId) + '</select></label>' +
      '<label class="f" id="customWrap"' + (p.firmId === 'custom' ? '' : ' hidden') + '>Firm name<input type="text" id="customFirm" value="' + esc(p.customFirm) + '" placeholder="e.g. Stephenson Harwood" maxlength="80"></label>' +
      '</div>' +
      '<h3 style="margin:16px 0 8px">Format</h3><div class="formats">' + fmtBtns + '</div>' +
      '<div class="opts">' +
      '<label class="f">Main questions<select id="length">' + [1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => '<option' + (n === +p.length ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
      '<label class="f">Follow-ups per question<select id="depth">' + [0, 1, 2, 3, 4].map(n => '<option' + (n === +p.depth ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
      '<label class="f">Thinking time<select id="prep">' + opt(PREP_OPTS, p.prep) + '</select></label>' +
      '<label class="f">Answer time<select id="answer">' + opt(ANSWER_OPTS, p.answer) + '</select></label>' +
      '<label class="f">Focus on<select id="focus"><option value="">A realistic mix</option>' + cats + '</select></label>' +
      '<label class="f">Pressure<select id="harsh">' + [['standard', 'Standard'], ['tough', 'Tough'], ['brutal', 'Brutal']].map(([k, l]) => '<option value="' + k + '"' + (st.harshness === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '</div>' +
      '<div class="toggles">' +
      '<label class="check"><input type="checkbox" id="tCam"' + (st.camera ? ' checked' : '') + '> Camera on</label>' +
      '<label class="check"><input type="checkbox" id="tRec"' + (st.record ? ' checked' : '') + '> Record my answers</label>' +
      '<label class="check"><input type="checkbox" id="tVoice"' + (st.voice ? ' checked' : '') + '> Interviewer speaks</label>' +
      '<label class="check"><input type="checkbox" id="tType"' + (st.answerMode === 'type' || !sup.stt ? ' checked' : '') + (sup.stt ? '' : ' disabled') + '> Type instead of speaking</label>' +
      '<label class="check"><input type="checkbox" id="tEach"' + (st.feedback === 'each' ? ' checked' : '') + '> Feedback after each question</label>' +
      '<label class="check"><input type="checkbox" id="tBreathe"' + (st.breathe ? ' checked' : '') + '> One minute to settle first</label>' +
      '</div>' +
      '<p class="small muted" id="fmtNote" style="margin:12px 0 0"></p>' +
      '<div class="row" style="margin-top:16px"><button class="btn primary big" id="go">Start interview</button><span class="small muted">You will check your camera and microphone first.</span></div>' +
      '</div></div>' +
      '<aside class="stack">' +
      '<div class="card"><h3>Today</h3><div class="today">' +
      '<div class="kpi"><div class="v">' + ts.sessions + '</div><div class="k">interviews</div></div>' +
      '<div class="kpi"><div class="v">' + ts.answers + '</div><div class="k">answers given</div></div>' +
      '<div class="kpi"><div class="v">' + ts.minutes + '</div><div class="k">minutes speaking</div></div>' +
      '<div class="kpi"><div class="v">' + ts.streak + '</div><div class="k">day streak</div></div>' +
      '</div></div>' +
      (last ? '<div class="card"><h3>Work on next</h3><p class="small muted" style="margin:0 0 8px">From your ' + esc(last.formatName) + ' at ' + esc(last.firmName) + ' on ' + fmtDate(last.started) + ' (' + (last.summary.overall || '–') + '/5).</p><ul class="next small" style="padding-left:1.1em;margin:0">' + (last.summary.priorities || []).slice(0, 3).map(x => '<li><b>' + esc(x.title) + '</b> ' + esc(x.how || '') + '</li>').join('') + '</ul><p style="margin:10px 0 0"><a href="#/report/' + esc(last.id) + '">Open that report</a></p></div>'
        : '<div class="card"><h3>Start with your replay</h3><p class="small" style="margin:0">Choose <b>Replay: Mishcon AI interview</b> to face today\'s questions again, then try the <b>AI adaptive interview</b> for questions you cannot predict.</p></div>') +
      '<div class="card"><h3>Real interviews</h3>' + (S().log.slice(0, 2).map(l => '<p class="small" style="margin:0 0 6px"><b>' + esc(l.firm) + '</b> · ' + esc(l.stage) + ' · ' + esc(l.date) + '<br><span class="muted">' + esc(l.outcome || '') + '</span></p>').join('') || '<p class="small muted">None logged yet.</p>') + '<a class="small" href="#/progress#log">Log a real interview</a></div>' +
      '</aside></div></main>';

    const read = () => ({
      firmId: $('#firm').value, customFirm: $('#customFirm').value.trim(), formatId: $('.fmt[aria-pressed="true"]').dataset.fmt,
      length: +$('#length').value, depth: +$('#depth').value, prep: +$('#prep').value, answer: +$('#answer').value, focus: $('#focus').value
    });
    const note = () => {
      const f = IT.formatById(read().formatId);
      const d = +$('#depth').value;
      $('#fmtNote').textContent = (f.id === 'replay' ? 'Replays the questions in the order you faced them, with the firm set to Mishcon de Reya. ' : '') +
        (d && !IT.ai.available() ? 'Without an API key, follow-ups come from the bank and from keywords in your answer. ' : '') +
        (d ? 'Up to ' + plural(d, 'follow-up') + ' per question, chosen from your answer. ' : 'No follow-ups: one question, one answer, like a one-way video interview. ');
      $('#length').disabled = f.id === 'replay';
    };
    $('#firm').addEventListener('change', () => { $('#customWrap').hidden = $('#firm').value !== 'custom'; savePrefs(read()); });
    $('#customFirm').addEventListener('input', () => savePrefs(read()));
    $$('.fmt').forEach(b => b.addEventListener('click', () => {
      $$('.fmt').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const f = IT.formatById(b.dataset.fmt);
      $('#length').value = String(f.mains);
      $('#depth').value = String(f.depth);
      $('#prep').value = String(f.prep);
      $('#answer').value = String(f.answer);
      if (f.id === 'replay') { $('#firm').value = 'mishcon'; $('#customWrap').hidden = true; $('#focus').value = ''; }
      savePrefs(read()); note();
    }));
    ['length', 'depth', 'prep', 'answer', 'focus'].forEach(id => $('#' + id).addEventListener('change', () => { savePrefs(read()); note(); }));
    $('#harsh').addEventListener('change', () => { st.harshness = $('#harsh').value; store.save(); });
    const tog = (id, fn) => $('#' + id).addEventListener('change', e => { fn(e.target.checked); store.save(); });
    tog('tCam', v => { st.camera = v; });
    tog('tRec', v => { st.record = v; });
    tog('tVoice', v => { st.voice = v; });
    tog('tType', v => { st.answerMode = v ? 'type' : 'speak'; });
    tog('tEach', v => { st.feedback = v ? 'each' : 'end'; });
    tog('tBreathe', v => { st.breathe = v; });
    note();
    $('#go').addEventListener('click', () => {
      const r = read();
      if (r.firmId === 'custom' && !r.customFirm) { $('#customFirm').focus(); toast('Type the firm\'s name first.', 'bad'); return; }
      savePrefs(r);
      startInterview(r);
    });
  };

  function startInterview(cfg) {
    const st = S().settings;
    const sup = IT.media.support();
    const fmt = IT.formatById(cfg.formatId);
    room = new Room({
      firmId: cfg.formatId === 'replay' ? 'mishcon' : cfg.firmId, customFirm: cfg.customFirm, formatId: cfg.formatId,
      length: cfg.formatId === 'replay' ? undefined : cfg.length, depth: cfg.depth, prep: cfg.prep, answer: cfg.answer, focus: cfg.focus || '',
      qids: cfg.qids, customQs: cfg.customQs,
      harshness: st.harshness, camera: st.camera, record: st.record && sup.recorder, voice: st.voice && sup.tts,
      mode: st.answerMode === 'type' || !sup.stt ? 'type' : 'speak', feedback: st.feedback, breathe: st.breathe, formatName: fmt.name
    });
    if (location.hash === '#/interview') route(); else location.hash = '#/interview';
  }
  IT.startInterview = startInterview;

  /* ---------------- the interview room ---------------- */
  class Room {
    constructor(cfg) {
      this.cfg = cfg;
      this.iv = new IT.Interview({ firmId: cfg.firmId, customFirm: cfg.customFirm, formatId: cfg.formatId, length: cfg.length, depth: cfg.depth, prep: cfg.prep, answer: cfg.answer, focus: cfg.focus, qids: cfg.qids, customQs: cfg.customQs, harshness: cfg.harshness });
      this.active = true;
      this.phase = 'ready';
      this.mode = cfg.mode;
      this.timer = 0;
      this.noticesShown = 0;
      this.notes = [];
      this.token = 0; // bumps on every phase change so stale async work stops
    }

    render() {
      view.innerHTML = '<section class="room" aria-label="Interview room"><div class="wrap">' +
        '<div><div class="stage" id="stage"><video id="selfv" autoplay muted playsinline></video><div class="novideo" id="novideo" hidden></div>' +
        '<div class="badge" id="recBadge" hidden><span class="dot"></span><span id="recLabel">Recording</span></div><div class="clock" id="clock" hidden>0:00</div><div class="meter" id="mic" title="Microphone level"><i></i></div></div>' +
        '<p class="small" style="color:var(--room-muted);margin:10px 2px 0">Look at the camera lens, not at your own face. Sit square on, light in front of you, and pause before you answer.</p></div>' +
        '<div class="panel" id="panel" aria-live="polite"></div></div></section>';
      this.attachVideo();
      if (this.phase === 'ready') this.renderReady();
      else this.renderPhase();
    }

    attachVideo() {
      const v = $('#selfv');
      if (!v) return;
      const s = IT.media.stream;
      const hasVideo = s && s.getVideoTracks().length > 0;
      if (hasVideo) { v.srcObject = s; v.hidden = false; $('#novideo').hidden = true; v.play().catch(() => {}); }
      else { v.hidden = true; const nv = $('#novideo'); nv.hidden = false; nv.innerHTML = this.cfg.camera ? 'Camera not connected yet' : 'Camera off<br><span class="small">Turn it on in the practise settings for the real feel.</span>'; }
      if (s) IT.media.level(l => { const i = $('#mic i'); if (i) i.style.width = Math.round(l * 100) + '%'; });
      else { const m = $('#mic'); if (m) m.hidden = true; }
    }

    panel(html) { const p = $('#panel'); if (p) p.innerHTML = html; return p; }

    who(talking) {
      const f = this.iv.firm;
      return '<div class="who"><div class="avatar' + (talking ? ' talking' : '') + '" id="avatar">' + esc((f.name.replace(/^A /, '')[0] || 'I').toUpperCase()) + '</div><div><b>Interviewer · ' + esc(f.name) + '</b><small>' + esc(this.cfg.formatName) + (this.iv.aiOff ? ' · offline follow-ups' : ' · AI interviewer') + '</small></div></div>';
    }

    /* ---- before you start ---- */
    async renderReady() {
      const sup = IT.media.support();
      const c = this.cfg;
      const ai = IT.ai.available();
      this.panel(this.who(false) +
        '<h2 style="font-family:var(--f-display);font-size:1.3rem">Before you start</h2>' +
        '<div class="checks">' +
        '<div><span class="st w" id="ckCam">…</span><span>' + (c.camera ? 'Camera and microphone' : 'Microphone') + '</span></div>' +
        '<div><span class="st ' + (c.mode === 'speak' ? 'w' : 'y') + '" id="ckStt">' + (c.mode === 'speak' ? '…' : 'Type') + '</span><span>' + (c.mode === 'speak' ? 'Speech to text: say a sentence and check it appears below' : 'You will type your answers') + '</span></div>' +
        '<div><span class="st ' + (c.record ? 'y' : 'w') + '">' + (c.record ? 'On' : 'Off') + '</span><span>Recording your answers' + (c.record ? ' (saved on this device only)' : '') + '</span></div>' +
        '<div><span class="st ' + (c.voice ? 'y' : 'w') + '">' + (c.voice ? 'On' : 'Off') + '</span><span>Interviewer reads questions aloud ' + (c.voice ? '<button class="btn ghost small" id="testVoice" style="min-height:0;padding:2px 6px">Test</button>' : '') + '</span></div>' +
        '<div><span class="st ' + (ai ? 'y' : 'w') + '">' + (ai ? 'On' : 'Off') + '</span><span>' + (ai ? 'AI interviewer and marking' : 'AI off: bank follow-ups and estimated scores') + '</span></div>' +
        '</div>' +
        (c.mode === 'speak' ? '<div class="live empty" id="testLive" data-empty="Your words will appear here as you speak…"></div>' : '') +
        '<div id="readyMsg"></div>' +
        '<p class="small" style="color:var(--room-muted);margin:0">' + esc(this.iv.plan.length + ' main question' + (this.iv.plan.length === 1 ? '' : 's')) + ', up to ' + plural(this.iv.depth, 'follow-up') + ' each. Thinking time: ' + (this.iv.prep < 0 ? 'untimed' : this.iv.prep + ' s') + '. Answer time: ' + (this.iv.limit ? fmtTime(this.iv.limit) : 'untimed') + '. No retakes.</p>' +
        '<div class="row"><button class="btn primary big" id="begin">Begin interview</button><button class="btn ghost" id="cancel">Cancel</button></div>');
      $('#cancel').addEventListener('click', () => { this.abandon(true); location.hash = '#/'; });
      $('#begin').addEventListener('click', () => this.begin());
      const tv = $('#testVoice');
      if (tv) tv.addEventListener('click', () => IT.media.speak('Good morning. Thank you for joining us today. Let us begin.', S().settings.voiceName));
      const needMedia = c.camera || c.mode === 'speak' || c.record;
      if (!needMedia) { $('#ckCam').textContent = 'Off'; return; }
      try {
        const r = await IT.media.open(c.camera);
        if (!this.active) return;
        const ck = $('#ckCam');
        if (ck) { ck.className = 'st ' + (c.camera && r.kind !== 'av' ? 'w' : 'y'); ck.textContent = c.camera && r.kind !== 'av' ? 'Mic' : 'OK'; }
        if (c.camera && r.kind !== 'av') this.readyMsg('No camera was found, so only your voice will be recorded.', '');
        this.attachVideo();
        if (c.mode === 'speak') this.testSpeech();
      } catch (e) {
        if (!this.active) return;
        const ck = $('#ckCam');
        if (ck) { ck.className = 'st n'; ck.textContent = 'No'; }
        this.readyMsg(e.message + ' You can still continue: answers will be typed and not recorded.', 'bad');
        this.cfg.record = false; this.cfg.camera = false;
        if (this.mode === 'speak') { this.mode = 'type'; const s = $('#ckStt'); if (s) { s.className = 'st w'; s.textContent = 'Type'; } const tl = $('#testLive'); if (tl) tl.remove(); }
        this.attachVideo();
      }
    }

    readyMsg(msg, kind) { const m = $('#readyMsg'); if (m) m.innerHTML = '<div class="notice ' + (kind || '') + '">' + esc(msg) + '</div>'; }

    testSpeech() {
      const box = $('#testLive');
      const ck = $('#ckStt');
      this.testListener = new IT.media.Listener({
        onUpdate: (text) => { if (!box) return; box.classList.toggle('empty', !text); box.textContent = text; if (ck && text) { ck.className = 'st y'; ck.textContent = 'OK'; } },
        onIssue: issue => {
          if (ck) { ck.className = 'st n'; ck.textContent = 'No'; }
          const why = { 'not-allowed': 'Speech recognition was blocked by the browser.', network: 'Speech recognition could not reach its service (it needs the internet).', 'audio-capture': 'Speech recognition could not hear the microphone.', unsupported: 'This browser has no speech recognition.' }[issue] || 'Speech recognition failed.';
          this.readyMsg(why + ' Your answers will be typed instead.', 'bad');
          this.mode = 'type';
        }
      });
      this.testListener.start();
    }

    async begin() {
      if (this.testListener) { this.testListener.abort(); this.testListener = null; }
      const b = $('#begin'); if (b) b.disabled = true;
      IT.store.askPersist();
      if (this.cfg.breathe) await this.breathe();
      if (!this.active) return;
      this.loadNext();
    }

    breathe() {
      return new Promise(resolve => {
        const tok = ++this.token;
        this.phase = 'breathe';
        this.panel(this.who(false) + '<div class="breathe"><div class="ball" id="ball"></div><div id="bText" style="font-size:1.2rem;font-weight:600">Breathe in</div><p class="small" style="color:var(--room-muted);margin:0;max-width:40ch">Box breathing: in for four, hold for four, out for four, hold for four. Nerves are normal; the interviewer is marking your thinking, not your heart rate.</p><button class="btn ghost" id="skipB">Skip</button></div>');
        const steps = [['Breathe in', true], ['Hold', true], ['Breathe out', false], ['Hold', false]];
        let i = 0;
        const step = () => {
          if (tok !== this.token) return;
          if (i >= 12) { resolve(); return; }
          const [label, big] = steps[i % 4];
          const t = $('#bText'); const ball = $('#ball');
          if (t) t.textContent = label;
          if (ball) ball.classList.toggle('in', big);
          i++;
          this.btimer = setTimeout(step, 4000);
        };
        step();
        $('#skipB').addEventListener('click', () => { clearTimeout(this.btimer); this.token++; resolve(); });
      });
    }

    /* ---- the question cycle ---- */
    async loadNext() {
      const tok = ++this.token;
      this.phase = 'waiting';
      this.renderPhase();
      const before = this.iv.threads.length;
      let q;
      try { q = await this.iv.next(); } catch (e) { q = null; this.notes.push({ msg: 'Something went wrong choosing the next question: ' + e.message, kind: 'bad' }); }
      if (tok !== this.token || !this.active) return;
      this.flushNotices();
      if (this.cfg.feedback === 'each' && before > 0 && (q === null || q.kind === 'main')) {
        await this.coachFeedback(before - 1);
        if (!this.active) return;
      }
      if (q) this.ask(q); else this.end();
    }

    flushNotices() {
      while (this.noticesShown < this.iv.notices.length) this.notes.push({ msg: this.iv.notices[this.noticesShown++], kind: '' });
    }

    async ask(q) {
      const tok = ++this.token;
      this.q = q;
      this.shownAt = Date.now();
      this.phase = 'speaking';
      this.renderPhase();
      if (this.cfg.voice) {
        await IT.media.speak(q.text, S().settings.voiceName);
        if (tok !== this.token || !this.active) return;
      }
      const av = $('#avatar'); if (av) av.classList.remove('talking');
      if (q.prep < 0) { this.phase = 'prep-open'; this.renderPhase(); return; }
      if (q.prep === 0) { this.startAnswer(); return; }
      this.phase = 'prep';
      this.phaseEnds = Date.now() + q.prep * 1000;
      this.renderPhase();
      this.tick(tok, q.prep, () => this.startAnswer());
    }

    tick(tok, total, onEnd) {
      clearInterval(this.timer);
      const upd = () => {
        if (tok !== this.token) { clearInterval(this.timer); return; }
        const left = (this.phaseEnds - Date.now()) / 1000;
        const clock = $('#clock'); const bar = $('#tbar');
        if (total > 0) {
          if (clock) { clock.hidden = false; clock.textContent = fmtTime(Math.ceil(left)); clock.classList.toggle('low', left <= 10 && this.phase === 'answer'); }
          if (bar) { bar.firstChild.style.width = Math.max(0, Math.min(100, left / total * 100)) + '%'; bar.classList.toggle('low', left <= 10); }
          const pl = $('#phaseLeft'); if (pl) pl.textContent = fmtTime(Math.ceil(left));
          if (left <= 0) { clearInterval(this.timer); onEnd(); }
        } else {
          const el = (Date.now() - this.answerStart) / 1000;
          if (clock) { clock.hidden = false; clock.textContent = fmtTime(el); }
          if (el >= 600) { clearInterval(this.timer); onEnd(); } // hard stop at 10 minutes
        }
      };
      upd();
      this.timer = setInterval(upd, 200);
    }

    startAnswer() {
      if (!this.active || !this.q) return;
      const tok = ++this.token;
      clearInterval(this.timer);
      this.phase = 'answer';
      this.answerStart = Date.now();
      this.prepSec = (this.answerStart - this.shownAt) / 1000;
      this.typedFallback = false;
      this.renderPhase();
      this.rec = this.cfg.record && IT.media.stream ? IT.media.record() : null;
      if (this.rec) { $('#recBadge').hidden = false; $('#recLabel').textContent = this.rec.video ? 'Recording' : 'Recording audio'; }
      if (this.mode === 'speak') {
        this.listener = new IT.media.Listener({
          onUpdate: () => this.showLive(),
          onIssue: issue => this.speechFailed(issue)
        });
        if (!this.listener.start()) this.speechFailed('unsupported');
      }
      const limit = this.q.limit || 0;
      this.phaseEnds = this.answerStart + limit * 1000;
      this.tick(tok, limit, () => this.finishAnswer(true));
    }

    showLive() {
      const box = $('#live');
      if (!box || !this.listener) return;
      const finals = this.listener.finals.join(' ');
      const interim = this.listener.interim;
      box.classList.toggle('empty', !finals && !interim);
      box.innerHTML = esc(finals) + (interim ? ' <span class="interim">' + esc(interim) + '</span>' : '');
      box.scrollTop = box.scrollHeight;
    }

    speechFailed(issue) {
      if (this.typedFallback || this.phase !== 'answer') return;
      this.typedFallback = true;
      const why = { 'not-allowed': 'Speech recognition was blocked.', network: 'Speech recognition lost its connection.', 'audio-capture': 'Speech recognition cannot hear your microphone.', unsupported: 'Speech recognition is not available.' }[issue] || 'Speech recognition stopped.';
      const sofar = this.listener ? this.listener.text() : '';
      const box = $('#live');
      if (box) {
        const ta = document.createElement('textarea');
        ta.id = 'typed'; ta.value = sofar; ta.setAttribute('aria-label', 'Type your answer');
        box.replaceWith(ta);
        ta.focus();
      }
      this.noteNow(why + ' Type the rest of your answer; the clock is still running.', 'bad');
      this.mode = 'type';
    }

    noteNow(msg, kind) {
      const n = $('#notes');
      if (n) n.insertAdjacentHTML('beforeend', '<div class="notice ' + (kind || '') + '">' + esc(msg) + '</div>');
    }

    async finishAnswer(timeUp) {
      if (this.phase !== 'answer' || this.finishing) return;
      this.finishing = true;
      const tok = ++this.token;
      clearInterval(this.timer);
      const durationSec = (Date.now() - this.answerStart) / 1000;
      this.phase = 'saving';
      const btn = $('#done'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
      let heard = { text: '', firstWordSec: null, longPauses: 0 };
      if (this.listener) { heard = await this.listener.stop(); this.listener = null; }
      const ta = $('#typed');
      let transcript = ta ? ta.value.trim() : heard.text;
      const typed = !!ta;
      let clipId = null, clipType = '';
      if (this.rec) {
        const blob = await this.rec.stop();
        this.rec = null;
        const rb = $('#recBadge'); if (rb) rb.hidden = true;
        if (blob && blob.size) {
          clipId = store.uid('clip');
          try { await store.clips.put(clipId, blob); clipType = blob.type; }
          catch (e) { clipId = null; this.notes.push({ msg: 'This answer\'s recording could not be saved (the device may be out of space). The transcript is safe.', kind: 'bad' }); }
        }
      }
      if (!this.active) { this.finishing = false; return; }
      if (!transcript) {
        const choice = await this.emptyAnswer(timeUp);
        if (!this.active) { this.finishing = false; return; }
        if (choice && choice.text) { transcript = choice.text; }
      }
      this.iv.answer({ transcript, typed: typed || !!(transcript && !heard.text), durationSec, prepSec: this.prepSec, firstWordSec: heard.firstWordSec, longPauses: heard.longPauses, clipId, clipType });
      this.finishing = false;
      if (tok !== this.token) return;
      this.loadNext();
    }

    emptyAnswer(timeUp) {
      return new Promise(resolve => {
        const box = overlay('<h2 style="font-family:var(--f-display);font-size:1.3rem;margin-bottom:8px">' + (timeUp ? 'Time is up, and no answer was captured' : 'No answer was captured') + '</h2>' +
          '<p class="muted">' + (this.cfg.mode === 'speak' ? 'The speech-to-text heard nothing. Check the microphone level bar moves when you talk. If you did answer, type a summary so it can be marked.' : 'Nothing was typed.') + '</p>' +
          '<textarea id="rescue" rows="5" placeholder="Type what you said…"></textarea>' +
          '<div class="row" style="margin-top:12px"><button class="btn primary" id="useTyped">Submit this</button><button class="btn" id="noAns">Move on with no answer</button></div>');
        $('#useTyped', box).addEventListener('click', () => { const t = $('#rescue', box).value.trim(); if (!t) { $('#rescue', box).focus(); return; } closeOverlay(); resolve({ text: t }); });
        $('#noAns', box).addEventListener('click', () => { closeOverlay(); resolve(null); });
      });
    }

    async coachFeedback(i) {
      const t = this.iv.threads[i];
      if (!t || !t.turns.length) return;
      this.phase = 'feedback';
      const box = overlay('<p class="eyebrow">Feedback</p><h2 style="font-family:var(--f-display);font-size:1.25rem">' + esc(t.turns[0].q) + '</h2><div class="row" style="margin-top:14px"><span class="phase" style="background:var(--sunk)"><span class="spin"></span> Marking this answer…</span></div>');
      let g;
      try {
        if (IT.ai.available() && t.turns.some(x => x.transcript)) { g = await IT.ai.grade({ firm: this.iv.firm, format: this.iv.format, harshness: this.iv.harshness }, t, null); g._final = true; }
        else g = IT.coach.grade(t, this.iv.firm.name);
      } catch (e) { g = IT.coach.grade(t, this.iv.firm.name); g.error = 'AI marking failed (' + e.message + '). This is the offline estimate.'; }
      t.grade = g;
      this.iv._save();
      if (!this.active) { closeOverlay(); return; }
      await new Promise(resolve => {
        box.innerHTML = '<p class="eyebrow">Feedback on question ' + (i + 1) + '</p><h2 style="font-family:var(--f-display);font-size:1.2rem;margin-bottom:10px">' + esc(t.turns[0].q) + '</h2>' +
          '<div class="row" style="margin-bottom:10px"><span class="num" style="font-size:1.6rem">' + (g.overall || '–') + '/5</span><span class="vtag ' + esc(g.verdict) + '">' + esc(g.verdict) + '</span></div>' +
          (g.error ? '<div class="notice">' + esc(g.error) + '</div>' : '') +
          '<p><b>' + esc(g.headline) + '</b></p>' +
          (g.weaknesses.length ? '<div class="box badl"><h4>Fix</h4><ul>' + g.weaknesses.slice(0, 4).map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></div>' : '') +
          (g.rewrite ? '<div class="box rewrite" style="margin-top:10px"><h4>Stronger version</h4><p>' + esc(g.rewrite) + '</p></div>' : '') +
          '<div class="row" style="margin-top:14px"><button class="btn primary" id="cont">Continue the interview</button></div>';
        $('#cont', box).addEventListener('click', () => { closeOverlay(); resolve(); });
      });
    }

    renderPhase() {
      const q = this.q;
      const ph = this.phase;
      if (ph === 'waiting' || !q) {
        this.panel(this.who(false) + '<div class="phase"><span class="spin"></span>' + (this.iv.threads.length ? 'The interviewer is considering your answer…' : 'Preparing your first question…') + '</div>' + this.notesHtml());
        return;
      }
      const head = this.who(ph === 'speaking') +
        '<div class="qmeta"><span class="chip' + (q.kind === 'follow' ? ' follow' : '') + '">' + (q.kind === 'follow' ? 'Follow-up' : 'Question ' + q.number + ' of ' + q.total) + '</span><span>' + esc(q.label || '') + '</span></div>' +
        '<div class="qtext" id="qtext">' + esc(q.text) + '</div>';
      let body = '';
      if (ph === 'speaking') body = '<div class="phase"><span class="spin"></span>The interviewer is asking…</div><div class="row"><button class="btn" id="skipVoice">Skip to answering</button></div>';
      else if (ph === 'prep') body = '<div class="phase prep">Thinking time · <span class="num" id="phaseLeft">' + fmtTime(q.prep) + '</span></div><div class="tbar" id="tbar"><i style="width:100%"></i></div><div class="row"><button class="btn primary" id="startNow">Start answering now</button>' + (this.cfg.voice ? '<button class="btn ghost" id="repeat">Hear it again</button>' : '') + '</div><p class="small" style="color:var(--room-muted);margin:0">Plan in three parts: your point, your evidence, why it matters. Recording starts automatically.</p>';
      else if (ph === 'prep-open') body = '<div class="phase prep">Take a moment. Start when you are ready.</div><div class="row"><button class="btn primary" id="startNow">Start answering</button>' + (this.cfg.voice ? '<button class="btn ghost" id="repeat">Hear it again</button>' : '') + '</div>';
      else if (ph === 'answer' || ph === 'saving') {
        const input = this.mode === 'speak'
          ? '<div class="live empty" id="live" data-empty="Listening… start speaking."></div>'
          : '<textarea id="typed" aria-label="Type your answer" placeholder="Type your answer…"></textarea>';
        body = '<div class="phase rec"><span class="dot" style="width:10px;height:10px;border-radius:50%;background:#e5484d;animation:pulse 1.2s infinite"></span>' + (this.q.limit ? 'Answer now · <span class="num" id="phaseLeft">' + fmtTime(this.q.limit) + '</span> left' : 'Answer now · untimed') + '</div>' +
          (this.q.limit ? '<div class="tbar" id="tbar"><i style="width:100%"></i></div>' : '') + input +
          '<div class="row"><button class="btn rec" id="done">Finish answer</button></div>';
      }
      this.panel(head + body + '<div id="notes" class="stack">' + this.notesHtml(true) + '</div><div class="row" style="justify-content:flex-end"><button class="btn ghost small" id="endEarly">End interview</button></div>');
      const on = (id, fn) => { const el = $('#' + id); if (el) el.addEventListener('click', fn); };
      on('skipVoice', () => { IT.media.cancelSpeech(); });
      on('startNow', () => this.startAnswer());
      on('repeat', () => IT.media.speak(q.text, S().settings.voiceName));
      on('done', () => this.finishAnswer(false));
      on('endEarly', () => this.endEarly());
      if (ph === 'answer' && this.mode === 'type') { const ta = $('#typed'); if (ta) ta.focus(); }
      if (ph === 'answer' && this.mode === 'speak') this.showLive();
    }

    notesHtml(inner) {
      const html = this.notes.slice(-3).map(n => '<div class="notice ' + n.kind + '">' + esc(n.msg) + '</div>').join('');
      return inner ? html : (html ? '<div class="stack">' + html + '</div>' : '');
    }

    endEarly() {
      if (!confirm('End the interview now? Your answers so far will be marked.')) return;
      this.token++;
      clearInterval(this.timer);
      IT.media.cancelSpeech();
      const finish = async () => {
        if (this.phase === 'answer') await this.finishAnswerQuiet();
        this.iv.stop();
        this.end();
      };
      finish();
    }

    /* Save a half-finished answer when the interview is ended mid-answer. */
    async finishAnswerQuiet() {
      const durationSec = (Date.now() - this.answerStart) / 1000;
      let heard = { text: '' };
      if (this.listener) { heard = await this.listener.stop(); this.listener = null; }
      const ta = $('#typed');
      const transcript = ta ? ta.value.trim() : heard.text;
      let clipId = null, clipType = '';
      if (this.rec) { const blob = await this.rec.stop(); this.rec = null; if (blob && blob.size) { clipId = store.uid('clip'); try { await store.clips.put(clipId, blob); clipType = blob.type; } catch (e) { clipId = null; } } }
      if (transcript && this.iv.current) this.iv.answer({ transcript, typed: !!ta, durationSec, prepSec: this.prepSec, firstWordSec: heard.firstWordSec, longPauses: heard.longPauses || 0, clipId, clipType });
    }

    end() {
      this.token++;
      clearInterval(this.timer);
      this.active = false;
      this.release();
      const rec = this.iv.record;
      const answered = rec.threads.some(t => t.turns.length);
      this.panel(this.who(false) + '<h2 style="font-family:var(--f-display);font-size:1.3rem">' + esc(this.iv.closing || 'Thank you. That is the end of the interview.') + '</h2>' +
        (answered ? '<p style="color:var(--room-muted)">Marking starts now. It usually takes under a minute with AI.</p><div class="row"><button class="btn primary big" id="toReport">See my marks</button></div>'
          : '<p style="color:var(--room-muted)">No answers were given, so there is nothing to mark.</p><div class="row"><a class="btn primary" href="#/">Back to practise</a></div>'));
      if (this.cfg.voice && this.iv.closing) IT.media.speak(this.iv.closing, S().settings.voiceName);
      if (answered) {
        IT.startMarking(rec.id);
        $('#toReport').addEventListener('click', () => { location.hash = '#/report/' + encodeURIComponent(rec.id); });
      }
      room = null;
    }

    release() {
      clearInterval(this.timer);
      clearTimeout(this.btimer);
      if (this.testListener) { this.testListener.abort(); this.testListener = null; }
      if (this.listener) { this.listener.abort(); this.listener = null; }
      if (this.rec) { this.rec.stop(); this.rec = null; }
      IT.media.cancelSpeech();
      IT.media.close();
    }

    abandon(silent) {
      this.token++;
      const wasActive = this.active;
      this.active = false;
      const p = this.phase === 'answer' ? this.finishAnswerQuiet().catch(() => {}) : Promise.resolve();
      p.then(() => { this.release(); if (wasActive) this.iv.stop(); });
      if (!silent && wasActive) toast('Interview ended. Answers given so far are saved under Progress.', 'info');
      room = null;
    }
  }

  pages.interview = function () {
    if (!room) {
      view.innerHTML = '<main class="wrap"><h1 class="page">No interview is running</h1><p class="lede">Interviews in progress end if the page is closed or reloaded. Anything you answered is saved under <a href="#/progress">Progress</a>.</p><p><a class="btn primary" href="#/">Start a new interview</a></p></main>';
      return;
    }
    room.render();
  };

  /* ---------------- marking jobs ---------------- */
  const jobs = {};
  function ctxFor(rec) {
    const firm = rec.firmId && rec.firmId.indexOf('custom-') === 0 ? IT.resolveFirm('custom', rec.firmName) : (IT.firmById(rec.firmId) || IT.resolveFirm('custom', rec.firmName));
    return { firm, format: IT.formatById(rec.formatId), harshness: rec.harshness || 'tough' };
  }
  IT.startMarking = function (id, force) {
    if (jobs[id] && !force) return jobs[id];
    const rec = S().sessions.find(s => s.id === id);
    if (!rec) return null;
    if (force) rec.threads.forEach(t => { if (t.grade && t.grade.source !== 'ai') t.grade = null; });
    const job = { id, progress: { done: 0, total: 1, label: 'Starting' }, error: null, listeners: new Set() };
    jobs[id] = job;
    job.promise = IT.markSession(rec, ctxFor(rec), store, IT.ai, pr => { job.progress = pr; job.listeners.forEach(fn => fn(pr)); })
      .then(r => { job.done = true; job.listeners.forEach(fn => fn(job.progress, true)); return r; })
      .catch(e => { job.error = e; job.done = true; job.listeners.forEach(fn => fn(job.progress, true)); })
      .finally(() => { setTimeout(() => { if (jobs[id] === job) delete jobs[id]; }, 500); });
    return job;
  };
  IT.markingJob = id => jobs[id] || null;

  /* Shared with app-pages.js */
  IT.ui = { $, $$, esc, view, fmtTime, fmtDate, fmtDateTime, plural, dayKey, overlay, closeOverlay, toast, pages, route, aiPill, setCleanup: fn => { cleanup = fn; }, ctxFor, streak, firmOptions, setupPrefs, savePrefs };

  // Voices load late in Chrome; the settings page refreshes its list when they arrive.
  if (window.speechSynthesis) { try { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => { if (IT.ui.refreshVoices) IT.ui.refreshVoices(); }; } catch (e) { /* ignore */ } }
  window.addEventListener('load', () => { if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {}); });
  // Start once part two has registered its pages.
  IT.boot = route;
})();
