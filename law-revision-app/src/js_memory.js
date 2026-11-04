  /* ------------------------------------------------------------------
     U6. STUDY MEMORY — a long-term record of how you do: quiz and
         quick-test results per card, a log of every quiz question you got
         wrong (kept until you've mastered it), and recent sessions.
         Saved to claude.ai (memory/perf, mistakes/<id>) or, in the offline
         copy and friends' edition, in this browser.
     ------------------------------------------------------------------ */
  var MEMORY_KEY = 'lawRevisionApp.v1.memory';
  var MIST_MAX = 250;          // most mistakes kept (oldest mastered ones go first)
  var SESS_MAX = 60;           // recent sessions kept
  // Per-card record: [quiz answers, quiz right, quick tests, quick-test score, last wrong (ms), last seen (ms)]
  var PC_QN = 0, PC_QR = 1, PC_FN = 2, PC_FR = 3, PC_WRONG = 4, PC_LAST = 5;
  var perfTimer = null, mistPending = {};

  function emptyPerf() { return { c: {}, s: [] }; }
  function sanitizePerf(v) {
    var out = emptyPerf();
    if (!v || typeof v !== 'object') return out;
    if (v.c && typeof v.c === 'object') Object.keys(v.c).slice(0, 5000).forEach(function (id) {
      var a = v.c[id];
      if (Array.isArray(a) && id.length <= 120) out.c[id] = [0, 1, 2, 3, 4, 5].map(function (i) { return Math.max(0, num(a[i], 0)); });
    });
    if (Array.isArray(v.s)) out.s = v.s.filter(function (s) { return s && typeof s === 'object'; }).slice(-SESS_MAX).map(function (s) {
      return { at: Math.max(0, num(s.at, 0)), kind: ['quiz', 'practice', 'flash'].indexOf(s.kind) !== -1 ? s.kind : 'quiz',
        n: Math.max(0, Math.round(num(s.n, 0))), r: Math.max(0, num(s.r, 0)),
        topics: Array.isArray(s.topics) ? s.topics.filter(function (t) { return typeof t === 'string'; }).slice(0, 12).map(function (t) { return t.slice(0, 220); }) : [] };
    });
    ['w', 'wPrev'].forEach(function (k) {
      var x = v[k];
      if (!x || typeof x !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(x.wk || '')) return;
      var sc = {};
      if (x.sc && typeof x.sc === 'object') Object.keys(x.sc).slice(0, 400).forEach(function (t) { if (t.length <= 220) sc[t] = Math.max(0, num(x.sc[t], 0)); });
      out[k] = { wk: x.wk, sc: sc };
    });
    return out;
  }
  function sanitizeMistake(m) {
    if (!m || typeof m !== 'object' || typeof m.id !== 'string') return null;
    var opts = Array.isArray(m.options) ? m.options.slice(0, 5).map(function (o) { return cleanString(o, 400); }) : [];
    if (opts.length !== 5) return null;
    var ans = Math.round(num(m.answer, -1)), ch = Math.round(num(m.chosen, -1));
    if (ans < 0 || ans > 4 || ch < 0 || ch > 4) return null;
    return {
      id: m.id.replace(/[^A-Za-z0-9_\-.~:@+]/g, '-').slice(0, 60),
      at: Math.max(0, num(m.at, Date.now())),
      topic: cleanString(m.topic, 220),
      cards: Array.isArray(m.cards) ? m.cards.filter(function (x) { return typeof x === 'string'; }).slice(0, 6) : [],
      stem: cleanString(m.stem, 2000), question: cleanString(m.question, 600), options: opts, answer: ans, chosen: ch,
      explanation: cleanString(m.explanation, 1500), level: Math.max(1, Math.min(5, Math.round(num(m.level, 3)))),
      tries: Math.max(0, Math.round(num(m.tries, 0))), wins: Math.max(0, Math.round(num(m.wins, 0))),
      resolved: m.resolved === true, resolvedAt: Math.max(0, num(m.resolvedAt, 0))
    };
  }
  function mistakeById(id) { return state.mistakes.filter(function (m) { return m.id === id; })[0]; }

  /* ---- loading ---- */
  var memoryReady = false, weekRolled = false;
  function loadLocalMemory() {
    memoryReady = true;
    var d = null;
    try { d = JSON.parse(kvGet(MEMORY_KEY) || 'null'); } catch (e) { d = null; }
    state.perf = sanitizePerf(d && d.perf);
    state.mistakes = (d && Array.isArray(d.mistakes) ? d.mistakes : []).map(sanitizeMistake).filter(Boolean);
  }
  function writeLocalMemory() {
    try { kvSet(MEMORY_KEY, JSON.stringify({ perf: state.perf, mistakes: state.mistakes })); return true; }
    catch (e) { toast('Your study record couldn\'t be saved in this browser. Export a backup.', { type: 'error', timeout: 8000 }); return false; }
  }
  function startMemoryCloud(db) {
    db.collection('memory').onSnapshot(function (snap) {
      memoryReady = true;
      snap.docs.forEach(function (d) {
        store.docs['memory/' + d.id] = true;
        if (d.id === 'perf' && !queueBusy('memory/perf') && !perfTimer) state.perf = sanitizePerf(d.data());
      });
      renderAllSoon();
    }, function () { /* the record simply stays in memory for this visit */ });
    db.collection('mistakes').onSnapshot(function (snap) {
      var incoming = {};
      snap.docs.forEach(function (d) { var m = sanitizeMistake(d.data()); if (m) incoming[m.id] = m; });
      var next = [];
      state.mistakes.forEach(function (m) {
        if (mistPending[m.id]) next.push(m);
        else if (incoming[m.id]) next.push(incoming[m.id]);
        delete incoming[m.id];
      });
      Object.keys(incoming).forEach(function (id) { next.push(incoming[id]); });
      state.mistakes = next;
      renderAllSoon();
      if (!$('#progressModal').hidden) renderProgress();
    }, function () { /* as above */ });
  }

  /* ---- saving ---- */
  function persistPerf() {
    if (store.mode === 'local') { writeLocalMemory(); return; }
    if (store.mode !== 'cloud') return;
    clearTimeout(perfTimer);
    perfTimer = setTimeout(function () {
      perfTimer = null;
      queueDoc('memory', 'perf', null, {}, true, function () { return JSON.parse(JSON.stringify(state.perf)); });
    }, 1200);
  }
  function persistMistake(m) {
    if (store.mode === 'local') { writeLocalMemory(); return; }
    if (store.mode !== 'cloud' || !claudeCaps.db) return;
    mistPending[m.id] = true;
    setSync('busy');
    claudeCaps.db.collection('mistakes').doc(m.id).set(JSON.parse(JSON.stringify(m))).then(function () {
      mistPending[m.id] = false; if (!anyQueued()) setSync('ok');
    }, function (err) {
      mistPending[m.id] = false;
      setSync('error', err && err.code === 'quota_exceeded' ? 'Your claude.ai storage is full' : 'A mistake couldn\'t be saved');
    });
  }
  function deleteMistakeStore(id) {
    if (store.mode === 'local') { writeLocalMemory(); return; }
    if (store.mode === 'cloud' && claudeCaps.db) claudeCaps.db.collection('mistakes').doc(id).delete().then(null, function () { /* tidy-up only */ });
  }
  // Keep the log to MIST_MAX: drop mastered mistakes first, then the oldest.
  function pruneMistakes() {
    if (state.mistakes.length <= MIST_MAX) return;
    var order = state.mistakes.slice().sort(function (a, b) { return (b.resolved ? 1 : 0) - (a.resolved ? 1 : 0) || a.at - b.at; });
    order.slice(0, state.mistakes.length - MIST_MAX).forEach(function (m) {
      state.mistakes = state.mistakes.filter(function (x) { return x !== m; });
      deleteMistakeStore(m.id);
    });
  }

  /* ---- recording ---- */
  function perfCard(id) { return state.perf.c[id] || (state.perf.c[id] = [0, 0, 0, 0, 0, 0]); }
  // A quiz answer: updates each card it relied on, and logs or clears the mistake.
  function memoryQuizAnswer(q, chosen, right) {
    var now = Date.now();
    q.cards.forEach(function (id) {
      var a = perfCard(id);
      a[PC_QN]++; if (right) a[PC_QR]++; else a[PC_WRONG] = now;
      a[PC_LAST] = now;
    });
    if (q.target) {
      var m = mistakeById(q.target);
      if (m && !m.resolved) {
        m.tries++; if (right) m.wins++;
        // Two right answers on fresh questions about the same point counts as mastered.
        if (m.wins >= 2) { m.resolved = true; m.resolvedAt = now; q.mastered = true; }
        persistMistake(m);
      }
    }
    if (!right) {
      var mis = sanitizeMistake({
        id: uid('m'), at: now, topic: q.topic, cards: q.cards, stem: q.stem, question: q.question,
        options: q.options, answer: q.answer, chosen: chosen, explanation: q.explanation, level: q.level
      });
      if (mis) { state.mistakes.push(mis); q.mistakeId = mis.id; persistMistake(mis); pruneMistakes(); }
    }
    persistPerf();
  }
  // A quick-test flashcard: score 1 (knew it), 0.5 (partly) or 0 (didn't know).
  function memoryFlash(id, score) {
    var a = perfCard(id), now = Date.now();
    a[PC_FN]++; a[PC_FR] += score; a[PC_LAST] = now;
    if (score < 1) a[PC_WRONG] = now;
    persistPerf();
  }
  function memorySession(kind, n, r, topics) {
    if (!n) return;
    state.perf.s.push({ at: Date.now(), kind: kind, n: n, r: r, topics: (topics || []).slice(0, 12) });
    state.perf.s = state.perf.s.slice(-SESS_MAX);
    persistPerf();
  }
  function resolveMistake(id, done) {
    var m = mistakeById(id); if (!m) return;
    m.resolved = done !== false; m.resolvedAt = m.resolved ? Date.now() : 0;
    persistMistake(m);
  }
  function removeMistake(id) {
    state.mistakes = state.mistakes.filter(function (m) { return m.id !== id; });
    deleteMistakeStore(id);
  }
  function importMemory(data, mode) {
    if (!data || typeof data !== 'object') return;
    var perf = sanitizePerf(data.perf);
    if (mode === 'replace') state.perf = perf;
    else {
      Object.keys(perf.c).forEach(function (id) { if (!state.perf.c[id]) state.perf.c[id] = perf.c[id]; });
      state.perf.s = state.perf.s.concat(perf.s).sort(function (a, b) { return a.at - b.at; }).slice(-SESS_MAX);
    }
    persistPerf();
    (Array.isArray(data.mistakes) ? data.mistakes : []).map(sanitizeMistake).filter(Boolean).forEach(function (m) {
      if (!mistakeById(m.id)) { state.mistakes.push(m); persistMistake(m); }
    });
    pruneMistakes();
  }

  /* ---- reading: how you're doing ---- */
  // Weakness of one card from everything known about it: 0 (solid) upwards.
  function cardWeakness(e) {
    var a = state.perf.c[e.id], p = state.progress[e.id], w = 0;
    if (a) {
      if (a[PC_QN]) w += (1 - (a[PC_QR] + 1) / (a[PC_QN] + 2)) * Math.min(1, a[PC_QN] / 3) * 2;
      if (a[PC_FN]) w += (1 - (a[PC_FR] + 0.5) / (a[PC_FN] + 1)) * Math.min(1, a[PC_FN] / 2) * 1.5;
      if (a[PC_WRONG]) w += Math.max(0, 1 - (Date.now() - a[PC_WRONG]) / (21 * DAY)) * 0.8;
    }
    if (p) w += Math.min(2, p.lapses * 0.4) + Math.max(0, 2.5 - p.ease);
    return w;
  }
  // Everything known about each topic, with a score and plain-English reasons, weakest first.
  function topicInsights(module) {
    var groups = {}, now = Date.now();
    state.entries.forEach(function (e) {
      if (!e.topic || (module && module !== 'all' && e.module !== module)) return;
      var k = topicKey(e);
      var g = groups[k] || (groups[k] = { key: k, module: e.module, topic: e.topic, ids: [], qn: 0, qr: 0, fn: 0, fr: 0, lapses: 0, reviewed: 0, last: 0, mistakes: [], weak: 0 });
      g.ids.push(e.id);
      var a = state.perf.c[e.id], p = state.progress[e.id];
      if (a) { g.fn += a[PC_FN]; g.fr += a[PC_FR]; g.last = Math.max(g.last, a[PC_LAST]); }
      if (p) { g.lapses += p.lapses; g.reviewed++; }
      g.weak += cardWeakness(e);
    });
    state.mistakes.forEach(function (m) { if (!m.resolved && groups[m.topic]) groups[m.topic].mistakes.push(m); });
    return Object.keys(groups).map(function (k) {
      var g = groups[k], qs = state.prefs.qstats[k];
      if (qs) { g.qn = qs.n; g.qr = qs.r; g.level = qs.lv; g.last = Math.max(g.last, qs.at ? new Date(qs.at).getTime() : 0); }
      var reasons = [], score = 0;
      if (g.qn) {
        var acc = (g.qr + 1) / (g.qn + 2);
        score += (1 - acc) * Math.min(1, g.qn / 4) * 4;
        if (g.qn >= 3 && g.qr / g.qn < 0.7) reasons.push(g.qr + ' of ' + g.qn + ' right in quizzes');
      }
      if (g.mistakes.length) {
        score += g.mistakes.reduce(function (s, m) { return s + 0.6 + 0.6 * Math.max(0, 1 - (now - m.at) / (21 * DAY)); }, 0);
        reasons.push(plural(g.mistakes.length, 'quiz mistake') + ' still to master');
      }
      if (g.fn) {
        var miss = g.fn - g.fr;
        score += (miss / (g.fn + 1)) * 2;
        if (miss >= 1) reasons.push(Math.round(miss * 10) / 10 + ' of ' + g.fn + ' quick-test cards not known');
      }
      if (g.reviewed) {
        score += Math.min(2.5, g.lapses / g.reviewed * 1.5);
        if (g.lapses >= 2) reasons.push('forgotten ' + plural(g.lapses, 'time') + ' in review');
      }
      var days = examDays(g.module);
      if (score > 0 && days != null && days >= 0 && days <= 30) { score *= 1.3; reasons.push('exam in ' + plural(days, 'day')); }
      if (score > 0.8 && g.last && now - g.last > 14 * DAY) reasons.push('not practised for ' + plural(Math.floor((now - g.last) / DAY), 'day'));
      g.score = Math.round(score * 100) / 100;
      g.reasons = reasons;
      return g;
    }).sort(function (a, b) { return b.score - a.score; });
  }
  // The things most worth working on next (only where there's real evidence).
  function suggestions(module, limit) {
    return topicInsights(module).filter(function (g) { return g.score >= 0.9 && g.reasons.length; }).slice(0, limit || 5);
  }

  /* ---- weekly summary ---- */
  function mondayKey(t) {
    var d = new Date(t == null ? Date.now() : t);
    d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return dayKey(d.getTime());
  }
  function keyTime(k) { return new Date(k + 'T00:00:00').getTime(); }
  // Once per week (on the first visit), keep a snapshot of how every topic stands, to compare against next week.
  function maybeWeeklyRoll() {
    if (weekRolled || !memoryReady || !state.loaded || store.mode === 'pending') return;
    weekRolled = true;
    var wk = mondayKey();
    if (state.perf.w && state.perf.w.wk === wk) return;
    var sc = {};
    topicInsights('all').forEach(function (g) { if (g.score > 0) sc[g.key] = g.score; });
    var prev = state.perf.w || null;
    state.perf.wPrev = prev;
    state.perf.w = { wk: wk, sc: sc };
    persistPerf();
    if (prev) {
      var r = weekReport(prev.wk, keyTime(wk));
      if (r.active) setTimeout(function () {
        toast('Your weekly summary is ready: ' + r.headline, { timeout: 12000, actionLabel: 'Open', onAction: function () { openProgress('week'); } });
      }, 1500);
    }
  }
  // What happened between two dates: reviews, quiz and quick-test results, and mistakes made and mastered.
  function weekReport(fromKey, endMs) {
    var start = keyTime(fromKey), end = endMs || Date.now();
    var rep = { from: start, to: end, reviews: 0, again: 0, qn: 0, qr: 0, fn: 0, fr: 0, made: 0, mastered: 0, days: 0 };
    for (var t = start; t < end; t += DAY) { var d = state.stats.days[dayKey(t)]; if (d && d[0]) { rep.reviews += d[0]; rep.again += d[1] || 0; rep.days++; } }
    state.perf.s.forEach(function (x) {
      if (x.at < start || x.at >= end) return;
      if (x.kind === 'flash') { rep.fn += x.n; rep.fr += x.r; } else { rep.qn += x.n; rep.qr += x.r; }
    });
    state.mistakes.forEach(function (m) {
      if (m.at >= start && m.at < end) rep.made++;
      if (m.resolved && m.resolvedAt >= start && m.resolvedAt < end) rep.mastered++;
    });
    rep.active = !!(rep.reviews || rep.qn || rep.fn);
    var bits = [];
    if (rep.reviews) bits.push(plural(rep.reviews, 'review'));
    if (rep.qn) bits.push(rep.qr + '/' + rep.qn + ' quiz questions right');
    if (rep.mastered) bits.push(plural(rep.mastered, 'mistake') + ' mastered');
    rep.headline = bits.join(', ') || 'a quiet week';
    return rep;
  }
  // Topics whose "needs work" score moved by a clear margin between two snapshots.
  function weekMovers(a, b) {
    var up = [], down = [];
    var keys = {}; Object.keys(a.sc).concat(Object.keys(b.sc)).forEach(function (k) { keys[k] = true; });
    Object.keys(keys).forEach(function (k) {
      var d = (b.sc[k] || 0) - (a.sc[k] || 0);
      if (d <= -0.8 && a.sc[k]) up.push({ key: k, d: -d });
      else if (d >= 0.8) down.push({ key: k, d: d });
    });
    up.sort(function (x, y) { return y.d - x.d; }); down.sort(function (x, y) { return y.d - x.d; });
    return { improved: up.slice(0, 6), slipped: down.slice(0, 6) };
  }
