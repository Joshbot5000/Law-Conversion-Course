/* app.js: screens, timing, feedback and progress for the Watson Glaser trainer. */
(function () {
  'use strict';
  const WG = window.WG;
  const $app = document.getElementById('app');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- the real test (sources: TalentLens product listing; AllAboutLaw guides) ---------- */
  const REAL = { items: 40, minutes: 30 };
  const PER_Q = Math.round(REAL.minutes * 60 / REAL.items); // 45 seconds
  const MIX = { inference: 5, assumptions: 12, deduction: 5, interpretation: 6, arguments: 12 };
  const META = {
    inference: { red: 'Drawing conclusions', name: 'Inference', blurb: 'Rate how far a statement goes beyond the facts, on a five-point scale from True to False.', prompt: 'Proposed Inference:', tag: 'Statement:', color: '#29477a' },
    assumptions: { red: 'Recognising assumptions', name: 'Recognising assumptions', blurb: 'Spot what the speaker is taking for granted, and what they are not.', prompt: 'Proposed Assumption:', tag: 'Statement:', color: '#4f7cbd' },
    deduction: { red: 'Drawing conclusions', name: 'Deduction', blurb: 'Decide whether a conclusion must follow from the statements, even if it sounds odd.', prompt: 'Proposed Conclusion:', tag: 'Statement:', color: '#b23c66' },
    interpretation: { red: 'Drawing conclusions', name: 'Interpretation', blurb: 'Decide whether a conclusion follows beyond reasonable doubt from the evidence given.', prompt: 'Proposed Conclusion:', tag: 'Statement:', color: '#c27a92' },
    arguments: { red: 'Evaluating arguments', name: 'Evaluating arguments', blurb: 'Judge each argument strong or weak: is it important and directly about the question?', prompt: 'Proposed Argument:', tag: 'Statement:', color: '#8a96a8' }
  };
  // Taken from the CMS practice test (Pearson Watson-Glaser via Getfeedback).
  const CMS_NOTE = {
    inference: 'In the CMS practice test, an inference passage is a long, factual paragraph (about 100 words, written like a news report), followed by several statements, one per question. Some statements are settled by a single phrase, such as "the first in the French Alps", so read every word.',
    assumptions: 'In the CMS practice test, one statement is followed by several proposed assumptions, one per question. The statement is hedged ("improve your chances of living a satisfied life") and the proposed assumptions are abstract, with no obvious giveaway words.',
    deduction: 'In the CMS practice test, deduction passages are everyday reasoning that ends with "Therefore:". The traps turn on scope: a rule about loads over one ton tells you nothing about lighter loads.',
    interpretation: 'Your CMS screenshots did not reach this section, so these questions follow the standard Watson-Glaser format: a realistic passage, often a study or set of figures, with conclusions judged "beyond a reasonable doubt".',
    arguments: 'Your CMS screenshots did not reach this section, so these questions follow the standard Watson-Glaser format: a policy question with Yes and No arguments. Sets can contain any mix of strong and weak, including all strong or all weak.'
  };
  const MOCK_LAYOUTS = {
    cms: { name: 'CMS practice layout', per: { inference: 8, assumptions: 8, deduction: 8, interpretation: 8, arguments: 8 }, examples: 2,
      desc: 'Laid out like the CMS practice test: each section opens with worked examples (marked E1, E2 and so on, not scored), then 8 questions per section.' },
    reported: { name: 'Commonly reported mix', per: MIX, examples: 0,
      desc: 'The mix commonly reported for the 40-question test: 5 inference, 12 assumptions, 5 deduction, 6 interpretation and 12 arguments.' }
  };
  const INSTR = {
    inference: 'Treat the passage as true. Rate each statement: True, Probably true, Insufficient data, Probably false or False. You may use common knowledge almost everyone has.',
    assumptions: 'An assumption is something taken for granted. Decide whether the person speaking must be taking the proposed assumption for granted.',
    deduction: 'Take the statements as true, even if they seem unlikely. A conclusion follows only if it must be true. "Some" means at least one, possibly all.',
    interpretation: 'Assume everything in the passage is true. Decide whether each conclusion follows beyond a reasonable doubt.',
    arguments: 'Treat each argument as true. Strong means important AND directly related to the question. Otherwise it is weak.'
  };

  /* ---------- storage (per-browser; the page works without it) ---------- */
  const KEY = 'wg-trainer-v1';
  const blank = () => ({ settings: { pace: PER_Q, length: 10, level: 'mixed', mockLayout: 'cms', mockMinutes: 30 }, sections: {}, patterns: {}, mocks: [], total: 0, seen: {} });
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const d = JSON.parse(raw); const b = blank(); return Object.assign(b, d, { settings: Object.assign(b.settings, d.settings || {}) }); }
    } catch (e) { /* storage unavailable */ }
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
  function record(it, correct, ms) {
    const s = S.sections[it.section] || (S.sections[it.section] = { n: 0, c: 0, ms: 0, timed: 0 });
    s.n++; if (correct) s.c++;
    if (ms != null) { s.ms += ms; s.timed++; }
    const p = S.patterns[it.pattern] || (S.patterns[it.pattern] = { n: 0, c: 0 });
    p.n++; if (correct) p.c++;
    S.total++;
    save();
  }
  // A fresh scenario every time: skip every scenario already seen in this
  // section until the whole bank has been used, then start a new cycle.
  // accept(set) can reject a set (used when drilling one question type).
  // level: 'test' (hand-written, CMS-style), 'foundation' (generated) or
  // 'mixed' (about half and half). 'any' applies no filter.
  function levelFilter(level, sec, seen) {
    if (level === 'test') return k => WG.isTestKey(k);
    if (level === 'foundation') return k => !WG.isTestKey(k);
    if (level === 'any') return null;
    const freshTest = WG.poolKeys(sec).some(k => WG.isTestKey(k) && !seen.includes(k));
    return freshTest && Math.random() < 0.5 ? (k => WG.isTestKey(k)) : (k => !WG.isTestKey(k));
  }
  function nextSet(sec, opts, accept) {
    opts = opts || {};
    const keys = WG.poolKeys(sec);
    let seen = (S.seen && S.seen[sec]) || [];
    const filter = levelFilter(opts.level || S.settings.level || 'mixed', sec, seen);
    const pass = filter ? keys.filter(filter) : keys;
    // Every scenario at this level seen: start a new round for this level only.
    if (pass.every(k => seen.includes(k))) seen = seen.filter(k => !pass.includes(k));
    let set = null;
    for (let i = 0; i < 40; i++) {
      set = WG.generateSet(sec, Object.assign({ avoid: new Set(seen), filter: filter || undefined }, opts));
      if (!accept || accept(set)) break;
    }
    S.seen = S.seen || {};
    S.seen[sec] = seen.concat([set.key]);
    save();
    return set;
  }
  const pct = (c, n) => (n ? Math.round(100 * c / n) : 0);
  const secs = ms => Math.round(ms / 1000);
  const fmtClock = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------- timers ---------- */
  let tick = null;
  const stopTimer = () => { if (tick) { clearInterval(tick); tick = null; } };

  /* ---------- routing ---------- */
  let view = 'home';
  function setNav(h) {
    const key = h.startsWith('learn') ? 'learn' : h === 'practice' ? 'home' : h === 'mock-run' ? 'mock' : h;
    document.querySelectorAll('nav.top a').forEach(a => a.setAttribute('aria-current', a.dataset.nav === key ? 'page' : 'false'));
  }
  function route() {
    const h = (location.hash || '#home').slice(1);
    // Sessions own these addresses; arriving here from our own hash change keeps the session running.
    if (h === 'practice' && P && view === 'practice') return setNav('home');
    if (h === 'mock-run' && M && !M.finished && view === 'mock') return setNav('mock');
    stopTimer();
    setNav(h);
    window.scrollTo(0, 0);
    if (h.startsWith('learn')) return renderLearn(h.split('-')[1] || 'inference');
    if (h === 'mock' || h === 'mock-run') return renderMockIntro();
    if (h === 'practice') return P ? (P.results.length ? finishPractice() : renderHome()) : renderHome();
    if (h === 'progress') return renderProgress();
    return renderHome();
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href') === (location.hash || '#home')) { e.preventDefault(); route(); }
  });

  /* ---------- shared renderers ---------- */
  function passageHTML(it) {
    const m = META[it.section];
    const p = it.passage;
    let body;
    if (it.section === 'arguments') body = '<p class="question">' + esc(it.question) + '</p>';
    else if (typeof p === 'string') body = '<div class="text"><p>' + esc(p) + '</p></div>';
    else body = '<div class="text"><p>' + esc(p.intro) + '</p></div><ul class="premises">' + p.lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul><div class="text"><p>Therefore:</p></div>';
    return '<div class="paper"><div class="ptag">' + esc(m.tag) + '</div>' + body + '</div>';
  }
  function explHTML(it, chosen) {
    const e = it.expl;
    let h = '<p>' + esc(e.plain) + '</p>';
    if (chosen && chosen !== it.answer && e.contrast) h += '<p class="contrast">' + esc(e.contrast(chosen)) + '</p>';
    if (e.steps && e.steps.length) {
      if (e.checks) {
        h += '<ul>' + e.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul>';
        h += '<h4>Check it</h4><ul class="checks">' + e.checks.map(c => '<li class="' + (c.charAt(0) === '✘' ? 'x' : '') + '">' + esc(c) + '</li>').join('') + '</ul>';
      } else {
        h += '<h4>Step by step</h4><ol>' + e.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>';
      }
    }
    h += '<div class="rule"><b>Rule to remember</b>' + esc(e.rule) + '</div>';
    h += '<p class="pace">Skill: ' + esc(WG.PATTERNS[it.pattern] || '') + '</p>';
    return h;
  }
  function optsHTML(it, state) {
    // state: {chosen, reveal}
    return WG.OPTIONS[it.section].map((o, i) => {
      let cls = 'opt', tag = '';
      if (state.reveal) {
        if (o.k === it.answer) { cls += ' right'; tag = 'Correct answer'; }
        else if (o.k === state.chosen) { cls += ' wrong'; tag = 'Your answer'; }
      } else if (o.k === state.chosen) cls += ' sel';
      return '<button class="' + cls + '" data-k="' + o.k + '"' + (state.reveal ? ' disabled' : '') + '><kbd>' + (i + 1) + '</kbd>' + esc(o.label) + (tag ? '<span class="tag">' + tag + '</span>' : '') + '</button>';
    }).join('');
  }

  /* ======================================================================
   * HOME
   * ==================================================================== */
  function renderHome() {
    view = 'home';
    const mixBar = WG.SECTIONS.map(s => '<span style="width:' + (MIX[s] / REAL.items * 100) + '%;background:' + META[s].color + '"></span>').join('');
    const mixKey = WG.SECTIONS.map(s => '<span><i style="background:' + META[s].color + '"></i>' + esc(META[s].name) + ' ' + MIX[s] + '</span>').join('');
    const cards = WG.SECTIONS.map((s, i) => {
      const st = S.sections[s] || { n: 0, c: 0 };
      return '<div class="card"><div class="eyebrow">' + esc(META[s].red) + '</div><h3 style="margin-top:-4px"><span class="n">' + (i + 1) + '</span>' + esc(META[s].name) + '</h3><p>' + esc(META[s].blurb) + '</p>' +
        '<div class="stat"><div class="meter"><i style="width:' + pct(st.c, st.n) + '%"></i></div><span>' + (st.n ? pct(st.c, st.n) + '% of ' + st.n : 'Not started') + '</span></div>' +
        '<div class="acts"><button class="btn primary" data-go="section" data-arg="' + s + '">Practise</button><a class="btn" href="#learn-' + s + '">Learn</a></div></div>';
    }).join('');
    const seg = (name, vals) => '<span class="seg" role="group">' + vals.map(([v, l]) => '<button data-set="' + name + '" data-v="' + v + '" aria-pressed="' + (S.settings[name] === v) + '">' + l + '</button>').join('') + '</span>';
    $app.innerHTML =
      '<div class="hero"><div><div class="eyebrow">Practice for the Watson-Glaser critical thinking test</div>' +
      '<h1>Train each section until the right answer feels obvious.</h1>' +
      '<p class="lede">The bank holds ' + WG.SECTIONS.reduce((a, s) => a + WG.poolKeys(s).length, 0) + ' different scenarios, each with fresh names, numbers and statement mixes every time, and you will not meet the same scenario twice until you have been through them all. Every answer comes with a plain-English explanation, the rule behind it, and why the tempting wrong answer is wrong.</p></div>' +
      '<aside class="facts"><h2>The real test</h2><dl><dt>40</dt><dd>questions across five sections</dd><dt>30 min</dt><dd>typical time limit for law firms</dd><dt>' + PER_Q + ' s</dt><dd>average per question at that pace</dd></dl>' +
      '<div class="mixbar" aria-hidden="true">' + mixBar + '</div><div class="mixkey">' + mixKey + '</div>' +
      '<p>Mix as commonly reported for the 40-question version. Your invitation states your exact time limit, so check it.</p></aside></div>' +
      '<div class="settings"><div><span class="lbl">Time per question</span>' + seg('pace', [[PER_Q, PER_Q + 's (real pace)'], [60, '60s'], [30, '30s'], [0, 'Untimed']]) + '</div>' +
      '<div><span class="lbl">Session length</span>' + seg('length', [[10, '10'], [20, '20'], [40, '40'], [0, 'Endless']]) + '</div>' +
      '<div><span class="lbl">Question level</span>' + seg('level', [['test', 'Test level (CMS-style)'], ['mixed', 'Mixed'], ['foundation', 'Foundation']]) + '</div></div>' +
      '<div class="eyebrow" style="margin-bottom:10px">Practise one section</div><div class="sections">' + cards + '</div>' +
      '<div class="eyebrow" style="margin-bottom:10px">Or mix it up</div><div class="modes">' +
      '<div class="mode feature"><h3>Full mock test</h3><p>40 questions in the real order and mix, against a 30-minute clock. Answers and explanations at the end.</p><a class="btn primary" href="#mock">Set up mock</a></div>' +
      '<div class="mode"><h3>Weak-spot drill</h3><p>Leans towards the sections and question types you get wrong most, based on your history in this browser.</p><button class="btn" data-go="weak">Start drill</button></div>' +
      '<div class="mode"><h3>Mixed practice</h3><p>All five sections in random order, with feedback after each question.</p><button class="btn" data-go="mix">Start mixed</button></div></div>' +
      footHTML();
    $app.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.v; S.settings[b.dataset.set] = isNaN(Number(v)) ? v : Number(v); save(); renderHome();
    }));
    $app.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => startPractice(b.dataset.go, b.dataset.arg)));
  }
  function footHTML() {
    return '<p class="foot">Built as independent practice; not affiliated with Pearson TalentLens or any law firm. Deduction answers are decided by a logic checker that tests every possible situation, and number questions by exact arithmetic. Inference, assumption and argument answers follow the published test rules on hand-checked question patterns. You will not see the same scenario twice until you have worked through the whole bank. Once opened, the app works offline. Real-test facts: <a href="https://www.talentlens.com/watson-glaser.html" target="_blank" rel="noopener">TalentLens</a> (publisher), <a href="https://www.allaboutlaw.co.uk/watson-glaser" target="_blank" rel="noopener">AllAboutLaw</a>.</p>';
  }

  /* ======================================================================
   * PRACTICE
   * ==================================================================== */
  let P = null;
  const PRE = { inf: 'inference', asm: 'assumptions', ded: 'deduction', prop: 'deduction', int: 'interpretation', arg: 'arguments' };
  function startPractice(mode, arg) {
    stopTimer();
    P = { mode, arg, queue: [], done: 0, correct: 0, results: [], cur: null, answered: false, start: 0, chosen: null };
    nextItem();
    if (location.hash !== '#practice') location.hash = 'practice';
  }
  function pickSection() {
    if (P.mode === 'section') return P.arg;
    if (P.mode === 'pattern') return PRE[P.arg.split('-')[0]];
    if (P.mode === 'weak') {
      const w = WG.SECTIONS.map(s => { const st = S.sections[s] || { n: 0, c: 0 }; return 1.15 - (st.c + 1) / (st.n + 2); });
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return WG.SECTIONS[i]; }
    }
    return WG.SECTIONS[Math.floor(Math.random() * WG.SECTIONS.length)];
  }
  function weakPatterns() {
    return Object.entries(S.patterns).filter(([, v]) => v.n >= 2 && v.c / v.n < 0.8).map(([k]) => k);
  }
  function refill() {
    const sec = pickSection();
    const want = P.mode === 'pattern' ? [P.arg] : P.mode === 'weak' ? weakPatterns() : [];
    const set = nextSet(sec, { hard: Math.random() < 0.3, level: want.length ? 'any' : undefined }, want.length ? (st => st.items.some(x => want.includes(x.pattern))) : null);
    P.queue.push(...set.items);
  }
  function nextItem() {
    if (S.settings.length && P.done >= S.settings.length) return finishPractice();
    if (!P.queue.length) refill();
    P.cur = P.queue.shift(); P.answered = false; P.chosen = null; P.start = Date.now();
    renderPracticeQ();
    startQTimer();
  }
  function renderPracticeQ() {
    view = 'practice';
    const it = P.cur, m = META[it.section];
    const len = S.settings.length;
    $app.innerHTML =
      '<div class="qhead"><span class="chip">' + esc(m.name) + '</span><span class="qcount">Question ' + (P.done + 1) + (len ? ' of ' + len : '') + ' · ' + P.correct + ' correct</span>' +
      '<span class="timer" id="timer"><span class="clock" id="clock"></span></span><button class="btn ghost" id="quit">End session</button></div>' +
      '<div class="timebar" id="timebar"><i id="timefill" style="width:100%"></i></div>' +
      '<div class="qgrid">' + passageHTML(it) +
      '<div class="answer"><div class="ptag">' + esc(m.prompt) + '</div><p class="statement">' + esc(it.statement) + '</p>' +
      '<div class="opts n' + WG.OPTIONS[it.section].length + '" id="opts">' + optsHTML(it, {}) + '</div><div id="fb"></div></div></div>';
    $app.querySelector('#opts').addEventListener('click', e => { const b = e.target.closest('.opt'); if (b && !b.disabled) answer(b.dataset.k); });
    $app.querySelector('#quit').addEventListener('click', () => { if (P.done) finishPractice(); else location.hash = 'home'; });
  }
  function startQTimer() {
    stopTimer();
    const pace = S.settings.pace;
    const clock = document.getElementById('clock'), fillEl = document.getElementById('timefill'), bar = document.getElementById('timebar'), tw = document.getElementById('timer');
    const paint = () => {
      const el = (Date.now() - P.start) / 1000;
      if (!pace) { clock.textContent = fmtClock(el); fillEl.style.width = '0%'; return; }
      const left = pace - el;
      clock.textContent = fmtClock(left);
      fillEl.style.width = Math.max(0, left / pace * 100) + '%';
      const low = left <= 10;
      tw.classList.toggle('low', low); bar.classList.toggle('low', low);
      if (left <= 0) timeout();
    };
    paint();
    tick = setInterval(paint, 200);
  }
  function answer(k) {
    if (P.answered) return;
    conclude(k, false);
  }
  function timeout() { if (!P.answered) conclude(null, true); }
  function conclude(k, late) {
    P.answered = true; stopTimer();
    const it = P.cur, ms = Date.now() - P.start;
    const correct = !late && k === it.answer;
    record(it, correct, ms);
    P.done++; if (correct) P.correct++;
    P.results.push({ it, chosen: k, correct, ms, late });
    document.getElementById('opts').innerHTML = optsHTML(it, { chosen: k, reveal: true });
    const cls = correct ? 'ok' : late ? 'late' : 'bad';
    const head = correct ? 'Correct' : late ? 'Time’s up' : 'Not quite';
    const over = S.settings.pace && !late && secs(ms) > S.settings.pace;
    const fb = document.getElementById('fb');
    fb.innerHTML = '<div class="fb ' + cls + '"><div class="verdict">' + head + ' <span class="sub">Answer: ' + esc(WG.labelOf(it.section, it.answer)) + ' · ' + secs(ms) + 's' + (over ? ' (over pace)' : '') + '</span></div>' +
      '<div class="body">' + explHTML(it, k) + '<div class="next"><button class="btn primary" id="next">' + (S.settings.length && P.done >= S.settings.length ? 'See results' : 'Next question') + ' <kbd style="opacity:.7">Enter</kbd></button></div></div></div>';
    document.getElementById('next').addEventListener('click', nextItem);
    document.getElementById('next').focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 860px)').matches) fb.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function finishPractice() {
    stopTimer(); view = 'summary';
    const r = P.results;
    const n = r.length, c = r.filter(x => x.correct).length;
    const avg = n ? Math.round(r.reduce((a, x) => a + x.ms, 0) / n / 1000) : 0;
    const missed = {};
    r.filter(x => !x.correct).forEach(x => { missed[x.it.pattern] = (missed[x.it.pattern] || 0) + 1; });
    const missList = Object.entries(missed).sort((a, b) => b[1] - a[1]);
    $app.innerHTML = '<div class="eyebrow">Session complete</div><div class="score"><span class="big">' + c + '</span><span class="of">/ ' + n + ' · ' + pct(c, n) + '%</span><span class="of">average ' + avg + 's per question (real pace ' + PER_Q + 's)</span></div>' +
      (missList.length ? '<h3 style="margin-bottom:8px">What to work on</h3><div class="weak" style="margin-bottom:24px">' + missList.map(([p, k]) => '<div class="w"><span>' + esc(WG.PATTERNS[p]) + '</span><span class="pc">' + k + ' missed</span><button class="btn" data-drill="' + p + '">Drill this</button></div>').join('') + '</div>'
        : '<p class="lede" style="margin-bottom:24px">No mistakes this session.</p>') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px"><button class="btn primary" id="again">Practise again</button><a class="btn" href="#home">Home</a></div>' +
      '<h3 style="margin-bottom:8px">Review every question</h3>' + reviewHTML(r);
    $app.querySelector('#again').addEventListener('click', () => startPractice(P.mode, P.arg));
    bindDrill();
  }
  function reviewHTML(rs) {
    return '<div class="review">' + rs.map((x, i) => {
      const it = x.it;
      return '<details><summary><span class="mk ' + (x.correct ? 'y' : 'n') + '">' + (x.correct ? '✔' : '✘') + '</span><span class="st">' + (i + 1) + '. ' + esc(it.statement) + '</span></summary>' +
        '<div class="inner">' + passageHTML(it) + '<p><b>Your answer:</b> ' + (x.chosen ? esc(WG.labelOf(it.section, x.chosen)) : (x.late ? 'none (time ran out)' : 'none')) + ' · <b>Correct answer:</b> ' + esc(WG.labelOf(it.section, it.answer)) + '</p>' +
        '<div class="fb"><div class="body">' + explHTML(it, x.chosen) + '</div></div></div></details>';
    }).join('') + '</div>';
  }
  function bindDrill() {
    $app.querySelectorAll('[data-drill]').forEach(b => b.addEventListener('click', () => startPractice('pattern', b.dataset.drill)));
  }

  /* ======================================================================
   * MOCK TEST
   * ==================================================================== */
  let M = null;
  function mockLayout() { return MOCK_LAYOUTS[S.settings.mockLayout] || MOCK_LAYOUTS.cms; }
  function renderMockIntro() {
    view = 'mockintro';
    const last = S.mocks.slice(-1)[0];
    const L = mockLayout(), mins = S.settings.mockMinutes || 30;
    const nQ = WG.SECTIONS.reduce((a, s) => a + L.per[s], 0);
    const seg = (name, vals) => '<span class="seg" role="group">' + vals.map(([v, l]) => '<button data-mset="' + name + '" data-v="' + v + '" aria-pressed="' + (S.settings[name] === v) + '">' + l + '</button>').join('') + '</span>';
    $app.innerHTML = '<div class="eyebrow">Mock test</div><h1 style="font-family:var(--f-display);font-size:2rem;margin:6px 0 10px">' + nQ + ' questions, ' + mins + ' minutes.</h1>' +
      '<p class="lede">' + esc(L.desc) + ' Questions are drawn from the Test level bank first. No feedback until you finish. Like the CMS practice test, you can move back and forth with Previous and Next and change answers. When the clock reaches zero, the test submits itself.</p>' +
      '<div class="settings" style="margin-top:16px"><div><span class="lbl">Layout</span>' + seg('mockLayout', [['cms', 'CMS practice layout'], ['reported', 'Commonly reported mix']]) + '</div>' +
      '<div><span class="lbl">Time limit</span>' + seg('mockMinutes', [[30, '30 min'], [40, '40 min'], [50, '50 min'], [60, '60 min']]) + '</div></div>' +
      '<div class="rows" style="max-width:560px;margin-top:6px">' + WG.SECTIONS.map(s => '<div class="row"><span>' + esc(META[s].name) + '</span><div class="meter"><i style="width:' + (L.per[s] / 12 * 100) + '%;background:' + META[s].color + '"></i></div><span>' + L.per[s] + ' Q</span></div>').join('') + '</div>' +
      '<p class="lede">Check your CMS invitation for your actual time limit; law firms commonly give 30 minutes for 40 questions.</p>' +
      (last ? '<p class="lede">Last mock: ' + last.score + '/' + last.total + ' (' + pct(last.score, last.total) + '%) on ' + new Date(last.date).toLocaleDateString('en-GB') + '.</p>' : '') +
      '<p class="lede">Unanswered questions score nothing, so if you are running out of time, answer every remaining question.</p>' +
      '<div style="display:flex;gap:8px;margin-top:16px"><button class="btn primary" id="go">Start the clock</button><a class="btn" href="#home">Not now</a></div>';
    $app.querySelectorAll('[data-mset]').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.v; S.settings[b.dataset.mset] = isNaN(Number(v)) ? v : Number(v); save(); renderMockIntro();
    }));
    $app.querySelector('#go').addEventListener('click', startMock);
  }
  function buildMock() {
    const L = mockLayout(), out = [];
    WG.SECTIONS.forEach(sec => {
      if (L.examples) {
        // Worked examples, like E1, E2... in the CMS test. Taken from the foundation bank.
        const ex = WG.generateSet(sec, { filter: k => !WG.isTestKey(k) }).items.slice(0, L.examples);
        ex.forEach(it => out.push({ it, ex: true }));
      }
      const got = [];
      let guard = 0;
      while (got.length < L.per[sec] && guard++ < 50) {
        const fresh = WG.poolKeys(sec).some(k => WG.isTestKey(k) && !((S.seen || {})[sec] || []).includes(k));
        got.push(...nextSet(sec, { level: fresh ? 'test' : 'mixed', hard: true }).items);
      }
      got.slice(0, L.per[sec]).forEach(it => out.push({ it, ex: false }));
    });
    // Labels: E1, E2... for examples and Q1, Q2... for scored questions.
    let e = 0, q = 0;
    out.forEach(x => { x.label = x.ex ? 'E' + (++e) : 'Q' + (++q); });
    return out;
  }
  function startMock() {
    const entries = buildMock();
    const minutes = S.settings.mockMinutes || 30;
    const nQ = entries.filter(x => !x.ex).length;
    M = { entries, answers: entries.map(() => null), idx: 0, minutes, nQ, perQ: minutes * 60 / nQ, startedAt: Date.now(), end: Date.now() + minutes * 60000, confirm: false };
    renderMockQ();
    stopTimer();
    tick = setInterval(paintMockClock, 250);
    location.hash = 'mock-run';
  }
  function paintMockClock() {
    const left = (M.end - Date.now()) / 1000;
    const c = document.getElementById('mclock');
    if (c) c.textContent = fmtClock(left);
    const tw = document.getElementById('timer');
    if (tw) tw.classList.toggle('low', left <= 120);
    const pace = document.getElementById('mpace');
    if (pace) {
      const answered = M.answers.filter(Boolean).length;
      const used = (Date.now() - M.startedAt) / 1000;
      const ahead = answered * M.perQ - used;
      pace.textContent = answered + ' of ' + M.nQ + ' answered · ' + (ahead > -10 ? 'on pace' : Math.round(-ahead) + 's behind pace');
      pace.classList.toggle('behind', ahead < -30);
    }
    if (left <= 0) finishMock();
  }
  function renderMockQ() {
    view = 'mock';
    const en = M.entries[M.idx], it = en.it, m = META[it.section];
    const first = M.idx === 0 || M.entries[M.idx - 1].it.section !== it.section;
    const last = M.idx === M.entries.length - 1;
    const optBlock = en.ex
      ? '<div class="opts n' + WG.OPTIONS[it.section].length + '" id="opts">' + optsHTML(it, { reveal: true }) + '</div><div class="fb"><div class="verdict" style="background:var(--accent-soft);color:var(--accent)">Example, not scored. Answer: ' + esc(WG.labelOf(it.section, it.answer)) + '</div><div class="body">' + explHTML(it, null) + '</div></div>'
      : '<div class="opts n' + WG.OPTIONS[it.section].length + '" id="opts">' + optsHTML(it, { chosen: M.answers[M.idx] }) + '</div>';
    $app.innerHTML =
      '<div class="qhead"><span class="chip">' + esc(m.name) + '</span><span class="qcount">' + (en.ex ? 'Example ' + esc(en.label) : 'Question ' + esc(en.label.slice(1)) + ' of ' + M.nQ) + '</span>' +
      '<span class="timer" id="timer"><span class="pace" id="mpace"></span><span class="clock" id="mclock"></span></span></div>' +
      (first ? '<div class="banner"><b>Section: ' + esc(m.name) + '</b>' + esc(INSTR[it.section]) + '</div>' : '') +
      '<div class="qgrid">' + passageHTML(it) +
      '<div class="answer"><div class="ptag"><span class="qtag">' + esc(en.label) + '</span> ' + esc(m.prompt) + '</div><p class="statement">' + esc(it.statement) + '</p>' + optBlock +
      '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;justify-content:center"><button class="btn" id="prev"' + (M.idx === 0 ? ' disabled' : '') + '>Previous</button>' +
      (!last ? '<button class="btn primary" id="nextq">Next</button>' : '') +
      '<button class="btn' + (last ? ' primary' : '') + '" id="finish">' + (M.confirm ? 'Tap again to submit' : 'Finish test') + '</button></div>' +
      '<div class="palette" aria-label="Jump to question">' + M.entries.map((x, i) => '<button data-i="' + i + '" class="' + (x.ex ? 'ex' : '') + (M.answers[i] ? ' done' : '') + (i === M.idx ? ' cur' : '') + '" title="' + esc(META[x.it.section].name) + '">' + esc(x.label) + '</button>').join('') + '</div>' +
      '</div></div>';
    paintMockClock();
    if (!en.ex) $app.querySelector('#opts').addEventListener('click', e => {
      const b = e.target.closest('.opt'); if (!b) return;
      M.answers[M.idx] = b.dataset.k; M.confirm = false;
      if (!last) M.idx++;
      renderMockQ();
    });
    $app.querySelector('#prev').addEventListener('click', () => { if (M.idx > 0) { M.idx--; M.confirm = false; renderMockQ(); } });
    const nx = $app.querySelector('#nextq'); if (nx) nx.addEventListener('click', () => { M.idx++; M.confirm = false; renderMockQ(); });
    $app.querySelector('#finish').addEventListener('click', () => {
      const left = M.entries.filter((x, i) => !x.ex && !M.answers[i]).length;
      if (!M.confirm && left) { M.confirm = true; renderMockQ(); const f = $app.querySelector('#finish'); f.textContent = left + ' unanswered. Tap again to submit'; f.focus(); return; }
      finishMock();
    });
    $app.querySelectorAll('.palette button').forEach(b => b.addEventListener('click', () => { M.idx = Number(b.dataset.i); M.confirm = false; renderMockQ(); }));
  }
  function finishMock() {
    stopTimer();
    if (!M || M.finished) return;
    M.finished = true;
    const limit = M.minutes * 60;
    const used = Math.min(limit, Math.round((Date.now() - M.startedAt) / 1000));
    const res = M.entries.map((x, i) => ({ x, i })).filter(o => !o.x.ex).map(({ x, i }) => ({ it: x.it, chosen: M.answers[i], correct: M.answers[i] === x.it.answer, late: !M.answers[i] && used >= limit }));
    res.forEach(r => record(r.it, r.correct, null));
    const by = {};
    WG.SECTIONS.forEach(s => { const xs = res.filter(r => r.it.section === s); by[s] = { n: xs.length, c: xs.filter(r => r.correct).length }; });
    const score = res.filter(r => r.correct).length;
    S.mocks.push({ date: Date.now(), score, total: res.length, by, used });
    save();
    view = 'mockresults';
    window.scrollTo(0, 0);
    $app.innerHTML = '<div class="eyebrow">Mock test result</div><div class="score"><span class="big">' + score + '</span><span class="of">/ ' + res.length + ' · ' + pct(score, res.length) + '%</span><span class="of">time used ' + fmtClock(used) + ' of ' + M.minutes + ':00</span></div>' +
      '<div class="rows">' + WG.SECTIONS.map(s => '<div class="row"><span>' + esc(META[s].name) + '</span><div class="meter"><i style="width:' + pct(by[s].c, by[s].n) + '%"></i></div><span>' + by[s].c + '/' + by[s].n + '</span></div>').join('') + '</div>' +
      '<p class="lede">This is a raw score. The real test is scored against a comparison group, and each firm sets its own bar, so a raw percentage does not map directly onto a pass or fail.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 24px"><button class="btn primary" id="again">Take another mock</button><a class="btn" href="#progress">See progress</a></div>' +
      '<h3 style="margin-bottom:8px">Review every question</h3>' + reviewHTML(res);
    $app.querySelector('#again').addEventListener('click', renderMockIntro);
  }

  /* ======================================================================
   * LEARN
   * ==================================================================== */
  const GUIDE = {
    inference: {
      what: 'You get a short passage of facts, then several statements (inferences) someone might draw from it. You rate each one on a five-point scale. It tests whether you can tell what the facts prove, what they only suggest, and what they do not cover at all.',
      scale: true,
      method: [
        'Treat the passage as true. Judge each statement on its own.',
        'Find the sentence in the passage the statement is about.',
        'Is it settled for certain? If the facts force it, it is True. If the facts contradict it, it is False.',
        'Not certain? Ask which way the passage leans. Leans towards it: Probably true. Leans against it: Probably false.',
        'Nothing in the passage points either way: Insufficient data.',
        'Quick order: first ask whether it is True, Insufficient data or False. Only if none of those fits, decide between Probably true and Probably false.'
      ],
      traps: [
        'Using your own knowledge or opinions. You may only use common knowledge almost everyone has, never specialist knowledge or guesses about this situation.',
        'Picking True when the facts only make it likely. True needs certainty.',
        'Avoiding Insufficient data because it feels like giving up. It is often the right answer.',
        'Mixing up False (contradicts the facts) with Probably false (the facts make it unlikely).',
        'Treating what someone says (for example "the firm says it values X") as proof that it is true.'
      ]
    },
    assumptions: {
      what: 'You get a statement someone has made, then several proposed assumptions. An assumption is something presupposed or taken for granted. You decide whether the speaker must be taking each one for granted. You are not judging whether it is true, or whether you agree.',
      method: [
        'Work out what the speaker is claiming or recommending, and why.',
        'Apply the flip test: imagine the proposed assumption is false.',
        'If the speaker’s claim or recommendation now falls apart, it was an assumption made.',
        'If the claim still stands, the assumption was not made.'
      ],
      traps: [
        'Extreme words: "only", "every", "always", "never", "completely". Speakers rarely need to assume anything that strong.',
        'Comparisons the speaker never made ("X is better than Y").',
        'Statements that are probably true, or sensible, but that the speaker does not need.',
        'Forgetting the basics: recommending something takes for granted that it is possible, that it would help, and that the goal is worth reaching.'
      ]
    },
    deduction: {
      what: 'You get a few statements, then proposed conclusions. You decide whether each conclusion must follow from the statements. This is strict logic: "probably" is not enough, and real-world plausibility does not matter.',
      method: [
        'Take every statement as true, even if it sounds unlikely or you disagree.',
        'Reframe it: "If it is true that [the statements], is it then definitely true that [the conclusion]?"',
        'Try to break the conclusion: can you picture one situation where all the statements are true but the conclusion is false? If yes, it does not follow.',
        'For "all / no / some" statements, follow one member through the statements, or sketch overlapping circles.',
        'For "if / then" statements, mark the "if" part and the "then" part, and use the table below.',
        'Remember: "some" means at least one, and possibly all.'
      ],
      traps: [
        'Believing a conclusion because it sounds true in real life.',
        'Flipping "All A are B" into "All B are A".',
        'Reading "some" as "some but not all".',
        'Working an "if" rule backwards.'
      ],
      cheat: true
    },
    interpretation: {
      what: 'You get a passage, often with figures, then proposed conclusions. Assume everything in the passage is true, and decide whether each conclusion follows beyond a reasonable doubt. It tests whether you can read evidence without stretching it.',
      method: [
        'Pin down exactly what the passage says, including who and what it covers.',
        'For numbers, do the sums. Check whether the conclusion is about a number or a proportion, and which year or group.',
        'Ask whether the conclusion needs anything the passage does not give: a cause, a prediction, a wider group, or a "why".',
        'If it does, it does not follow. If the passage settles it, it follows.',
        'Beyond a reasonable doubt is a higher bar than "probably true", but lower than the strict "must be true" of deduction.'
      ],
      traps: [
        'A number and a proportion moving in opposite directions.',
        'Percentage change worked out from the end figure instead of the starting figure.',
        'Reading a cause into a link ("people who walk are less stressed" does not mean walking reduces stress).',
        'Stretching one survey, office or city to everyone.',
        'Treating "on average" as "every single one".'
      ],
      fallacies: [
        ['The reason fallacy', 'Giving a reason or cause for something when the passage never says why it happened.'],
        ['The indefinite pronoun fallacy', 'Using "all", "none", "every" or "always" where the passage only supports "some", "most" or "on average".'],
        ['The correlation-causation fallacy', 'Concluding that one thing causes another when the passage only shows they go together.'],
        ['Jumping to conclusions', 'Adding information that is not in the passage, such as predictions or claims about a wider group.']
      ]
    },
    arguments: {
      what: 'You get a question, then several arguments for or against it. You decide whether each argument is strong or weak. A strong argument must be both important and directly related to the question. An argument is weak if it is not directly related (however important the subject), if it is of minor importance, or if it is about a trivial side issue.',
      method: [
        'Treat the argument as true. Never argue with it.',
        'Is it directly about this question? If not, it is weak.',
        'Would it matter to a sensible person deciding this question? If it is minor or trivial, it is weak.',
        'Does the reason really support the Yes or No in front of it? If it points the other way, it is weak.',
        'Both tests passed: strong. Strong arguments can be on both sides at once.'
      ],
      should: 'When a question begins with "Should", it means: would the proposed action promote the general welfare of the people in the country? Judge each argument by how well it supports the side (Yes or No) it is given for.',
      traps: [
        'Letting your own opinion on the question decide.',
        'Marking an argument weak because you do not believe it. You must treat it as true.',
        'Attacks on the people involved, "we have always done it this way", or reasons that just repeat the answer. These are weak.',
        'Assuming only one side can have strong arguments.'
      ]
    }
  };
  /* Classic sample questions (from Josh's cheat sheet). Answers are the
   * cheat sheet's; the explanations were written and checked here. */
  const CLASSIC = {
    inference: {
      passage: 'Two hundred students in their early teens voluntarily attended a recent weekend student conference in a city in England. At this conference, the topics of race equality and means of achieving lasting world peace were discussed, since these were the problems the students selected as being most vital in today’s world.',
      items: [
        ['As a group, the students who attended this conference showed a keener interest in broad social problems than do most other students in their early teens.', 'PT', 'They gave up a weekend voluntarily and chose these topics themselves. That makes a keener-than-average interest likely, but the passage cannot prove it, so it is Probably true.'],
        ['The majority of the students had not previously discussed the conference topics in their schools.', 'PF', 'They picked these topics as the most vital problems in the world, which suggests they already knew about and had talked about them. That points against this statement without ruling it out, so it is Probably false.'],
        ['The students came from all parts of the country.', 'ID', 'The passage only says where the conference was held, not where the students came from. Nothing tips the balance, so it is Insufficient data.'],
        ['The students discussed mainly industrial relations problems.', 'F', 'The passage says the topics were race equality and world peace, chosen as the most vital problems. "Mainly industrial relations" contradicts that, so it is False.'],
        ['Some teenage students felt it worthwhile to discuss problems of race equality and ways of achieving world peace.', 'T', 'The students chose these topics as the most vital problems and discussed them at a conference they attended voluntarily. So at least some teenagers felt it worthwhile. This must be true.']
      ]
    },
    assumptions: {
      passage: '"We need to save time in getting there, so we’d better go by plane."',
      items: [
        ['Going by plane will take less time than going by some other means of transport.', 'made', 'Flip it: if the plane would NOT save time, choosing it "to save time" makes no sense. So it is assumed.'],
        ['There is a plane service available to us for at least part of the distance to the destination.', 'made', 'You cannot sensibly suggest going by plane unless you think a plane is available. Flip it and the suggestion collapses. Assumed.'],
        ['Travel by plane is more convenient than travel by train.', 'not', 'The speaker’s only reason is saving time, not convenience. Flip it ("the train is more convenient") and the plane can still be the faster choice. Not assumed.']
      ]
    },
    deduction: {
      passage: 'Some Sundays are rainy. All rainy days are boring.',
      items: [
        ['No clear days are boring.', 'not', 'The statements only tell you about rainy days. They say nothing about clear days, so clear days could be boring too. Not guaranteed, so it does not follow.'],
        ['Some Sundays are boring.', 'follows', 'At least one Sunday is rainy. Every rainy day is boring. So that Sunday is boring, which means at least one Sunday is boring. It follows.'],
        ['Some Sundays are not boring.', 'not', '"Some Sundays are rainy" allows that every Sunday is rainy (some can mean all). If they all are, every Sunday is boring. Not guaranteed, so it does not follow.']
      ]
    },
    interpretation: {
      passage: 'A study of vocabulary growth in children from ages eight months to six years old shows that the size of spoken vocabulary increases from zero words at age eight months to 2,562 words at age six years.',
      items: [
        ['None of the children in this study had learned to talk by the age of six months.', 'follows', 'Their spoken vocabulary was zero words at eight months. Children do not lose the ability to talk between six and eight months, so beyond reasonable doubt none could talk at six months. It follows.'],
        ['Vocabulary growth is slowest during the period when children are learning to walk.', 'not', 'The passage gives only the start and end figures. It says nothing about the rate in between, or about walking. This adds information the passage does not give, so it does not follow.']
      ]
    },
    arguments: {
      passage: 'Should all young adults in the United Kingdom go on to higher education at university?',
      items: [
        ['Yes; university provides an opportunity for them to wear university scarves.', 'weak', 'Even if true, wearing a scarf is a trivial reason for a decision this big. Not important, so weak.'],
        ['No; a large percentage of young adults do not have enough ability or interest to derive any benefit from university training.', 'strong', 'Treat it as true. If many would get no benefit, sending ALL of them is a serious problem for the general welfare. Important and directly about the question, so strong.'],
        ['No; excessive studying permanently warps an individual’s personality.', 'weak', 'Treat it as true. It is about excessive studying, but going to university does not require excessive studying. So it does not directly address whether everyone should go. Weak.']
      ]
    }
  };
  function classicHTML(sec) {
    const c = CLASSIC[sec];
    const it0 = { section: sec, passage: c.passage, question: c.passage };
    return '<h2>Classic example</h2><p class="lede" style="margin-bottom:12px">The sample from your cheat sheet, with each answer explained.</p><div class="example" style="margin-bottom:28px">' + passageHTML(it0) +
      c.items.map((x, i) => '<div class="stmt"><p>' + (i + 1) + '. ' + esc(x[0]) + '</p><details class="reveal"><summary>Show answer</summary><div class="fb"><div class="verdict" style="background:var(--accent-soft);color:var(--accent)">Answer: ' + esc(WG.labelOf(sec, x[1])) + '</div><div class="body"><p>' + esc(x[2]) + '</p></div></div></details></div>').join('') + '</div>';
  }
  function learnExample(sec) {
    const set = WG.generateSet(sec, { filter: WG.isTestKey });
    const it0 = set.items[0];
    return '<div class="example">' + passageHTML(it0) + set.items.map((it, i) =>
      '<div class="stmt"><p>' + (i + 1) + '. ' + esc(it.statement) + '</p><details class="reveal"><summary>Show answer and explanation</summary>' +
      '<div class="fb"><div class="verdict" style="background:var(--accent-soft);color:var(--accent)">Answer: ' + esc(WG.labelOf(sec, it.answer)) + '</div><div class="body">' + explHTML(it, null) + '</div></div></details></div>').join('') + '</div>';
  }
  function renderLearn(sec) {
    if (!META[sec]) sec = 'inference';
    view = 'learn';
    const g = GUIDE[sec];
    const tabs = WG.SECTIONS.map(s => '<a href="#learn-' + s + '"' + (s === sec ? ' aria-current="page"' : '') + '>' + esc(META[s].name) + '</a>').join('');
    let scale = '';
    if (g.scale) scale = '<h3>The five answers</h3><div class="scale">' + WG.OPTIONS.inference.map(o => '<div><b>' + esc(o.label) + '</b><span>' + esc(WG.INF_MEANING[o.k]) + '</span></div>').join('') + '</div>';
    let cheat = '';
    if (g.cheat) {
      cheat = '<h3>Cheat table</h3><div class="tablewrap"><table class="cheat"><thead><tr><th>You are told</th><th>You can conclude</th><th></th></tr></thead><tbody>' +
        [['All A are B', 'Nothing about whether all B are A (trap)', 'bad'],
          ['No A are B', 'No B are A', 'ok'],
          ['Some A are B', 'Some B are A. Never Some A are not B', 'ok'],
          ['Some A are not B', 'Nothing about whether some A are B, and never No A are B', 'bad'],
          ['All A are B, All B are C', 'All A are C', 'ok'],
          ['All A are B, No B are C', 'No A are C', 'ok'],
          ['Some A are B, All B are C', 'Some A are C', 'ok'],
          ['If P then Q; P', 'Q', 'ok'],
          ['If P then Q; not Q', 'Not P', 'ok'],
          ['If P then Q; Q', 'Nothing about P (trap)', 'bad'],
          ['If P then Q; not P', 'Nothing about Q (trap)', 'bad'],
          ['P only if Q', 'If P then Q (not "if Q then P")', 'ok'],
          ['P unless Q', 'If not Q then P', 'ok'],
          ['Either P or Q, or both; not P', 'Q', 'ok'],
          ['Either P or Q, or both; P', 'Nothing about Q (trap)', 'bad']
        ].map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td class="' + (r[2] === 'ok' ? 'ok-t' : 'bad-t') + '">' + (r[2] === 'ok' ? '✔' : '!') + '</td></tr>').join('') + '</tbody></table></div>';
    }
    const extra = (g.should ? '<h3>What "should" means</h3><p>' + esc(g.should) + '</p>' : '') +
      (g.fallacies ? '<h3>The four fallacies to watch for</h3><div class="scale">' + g.fallacies.map(f => '<div><b>' + esc(f[0]) + '</b><span>' + esc(f[1]) + '</span></div>').join('') + '</div>' : '');
    const st = S.sections[sec];
    $app.innerHTML = '<div class="eyebrow">Learn \u00B7 ' + esc(META[sec].red) + '</div><h1 style="font-family:var(--f-display);font-size:2rem;margin-top:6px">' + esc(META[sec].name) + '</h1><div class="tabs">' + tabs + '</div>' +
      '<div class="guide"><section><h2>How it works</h2><p>' + esc(g.what) + '</p><div class="banner" style="margin:12px 0 0"><b>In the CMS test</b>' + esc(CMS_NOTE[sec]) + '</div>' + scale +
      '<h3>Method</h3><ol>' + g.method.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' +
      '<h3>Traps</h3><ul>' + g.traps.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' + extra + cheat +
      '<div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap"><button class="btn primary" data-go="section" data-arg="' + sec + '">Practise ' + esc(META[sec].name.toLowerCase()) + '</button>' + (st ? '<span class="pace" style="align-self:center">Your accuracy: ' + pct(st.c, st.n) + '% of ' + st.n + '</span>' : '') + '</div></section>' +
      '<section>' + classicHTML(sec) + '<h2>Test-level example</h2><p class="lede" style="margin-bottom:12px">Written to match the CMS practice test. Try each one in your head first, then open the explanation.</p><div id="ex">' + learnExample(sec) + '</div><button class="btn" id="newex" style="margin-top:16px">New example</button></section></div>';
    $app.querySelector('[data-go]').addEventListener('click', () => startPractice('section', sec));
    $app.querySelector('#newex').addEventListener('click', () => { document.getElementById('ex').innerHTML = learnExample(sec); });
  }

  /* ======================================================================
   * PROGRESS
   * ==================================================================== */
  let resetArmed = false;
  function renderProgress() {
    view = 'progress';
    const rows = WG.SECTIONS.map(s => {
      const st = S.sections[s] || { n: 0, c: 0, ms: 0, timed: 0 };
      const avg = st.timed ? Math.round(st.ms / st.timed / 1000) : null;
      const bank = WG.poolKeys(s).length, seen = ((S.seen || {})[s] || []).length;
      return '<div class="row"><span>' + esc(META[s].name) + '</span><div class="meter"><i style="width:' + pct(st.c, st.n) + '%"></i></div><span>' + (st.n ? pct(st.c, st.n) + '%' : '–') + '</span></div>' +
        '<div class="pace" style="margin:-6px 0 4px">' + (st.n ? st.c + ' of ' + st.n + ' correct' + (avg != null ? ' · average ' + avg + 's per question' + (avg > PER_Q ? ' (slower than real pace)' : '') : '') + ' · ' : '') + seen + ' of ' + bank + ' scenarios seen this round</div>';
    }).join('');
    const weak = Object.entries(S.patterns).filter(([, v]) => v.n >= 2).sort((a, b) => a[1].c / a[1].n - b[1].c / b[1].n).slice(0, 10);
    const mocks = S.mocks.slice().reverse();
    $app.innerHTML = '<div class="eyebrow">Progress</div><h1 style="font-family:var(--f-display);font-size:2rem;margin:6px 0 4px">' + S.total + ' questions answered</h1>' +
      '<p class="lede" style="margin-bottom:20px">Saved in this browser only. Clearing site data, or using a different device, starts afresh.</p>' +
      '<div class="rows">' + rows + '</div>' +
      '<h3 style="margin-bottom:8px">Weakest question types</h3>' +
      (weak.length ? '<div class="weak" style="margin-bottom:26px">' + weak.map(([p, v]) => '<div class="w"><span>' + esc(WG.PATTERNS[p] || p) + '</span><span class="pc">' + pct(v.c, v.n) + '% of ' + v.n + '</span><button class="btn" data-drill="' + p + '">Drill</button></div>').join('') + '</div>'
        : '<div class="empty" style="margin-bottom:26px">Answer a few questions and your weakest question types will appear here, each with a button to drill it.</div>') +
      '<h3 style="margin-bottom:8px">Mock tests</h3>' +
      (mocks.length ? '<div class="rows">' + mocks.map(m => '<div class="row"><span>' + new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '</span><div class="meter"><i style="width:' + pct(m.score, m.total) + '%"></i></div><span>' + m.score + '/' + m.total + '</span></div>').join('') + '</div>'
        : '<div class="empty">No mock tests yet. <a href="#mock">Take your first one</a>.</div>') +
      '<div style="margin-top:28px"><button class="btn ghost" id="reset">' + (resetArmed ? 'Tap again to erase all progress' : 'Reset progress') + '</button></div>';
    bindDrill();
    $app.querySelector('#reset').addEventListener('click', () => {
      if (!resetArmed) { resetArmed = true; renderProgress(); return; }
      const keep = S.settings; S = blank(); S.settings = keep; save(); resetArmed = false; renderProgress();
    });
  }

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    const n = Number(e.key);
    if (view === 'practice' && P && P.cur) {
      if (!P.answered && n >= 1 && n <= WG.OPTIONS[P.cur.section].length) { e.preventDefault(); answer(WG.OPTIONS[P.cur.section][n - 1].k); }
      else if (P.answered && (e.key === 'Enter' || e.key === 'ArrowRight') && !(e.target.closest && e.target.closest('button, summary, a'))) { e.preventDefault(); nextItem(); }
    } else if (view === 'mock' && M && !M.finished) {
      const en = M.entries[M.idx], it = en.it, lastIdx = M.entries.length - 1;
      if (!en.ex && n >= 1 && n <= WG.OPTIONS[it.section].length) {
        e.preventDefault(); M.answers[M.idx] = WG.OPTIONS[it.section][n - 1].k; M.confirm = false;
        if (M.idx < lastIdx) M.idx++;
        renderMockQ();
      } else if (e.key === 'ArrowRight' && M.idx < lastIdx) { M.idx++; renderMockQ(); }
      else if (e.key === 'ArrowLeft' && M.idx > 0) { M.idx--; renderMockQ(); }
    }
  });

  // Offline support: cache the app so it opens without a connection.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* not available here */ }
  }

  route();
})();
