  /* ------------------------------------------------------------------
     U9. TODAY'S SESSION — one button for a well-rounded study session:
         reviews due → a short quiz on your weakest topic → practice on
         mistakes → a few quick-test cards. A bar at the bottom shows where
         you are; each step can be skipped.
     ------------------------------------------------------------------ */
  var ts = null;
  var TS_MODALS = { review: 'reviewModal', quiz: 'quizModal', mistakes: 'quizModal', flash: 'flashModal' };

  function planSession() {
    var steps = [], mod = 'all';
    var due = dueCards(mod, 'all').length, fresh = Math.min(newRemaining(), newCards(mod, 'all').length);
    if (due + fresh > 0) steps.push({ kind: 'review', label: 'Reviews', detail: due + ' due' + (fresh ? ' + ' + fresh + ' new' : '') });
    var sugg = suggestions('all', 3);
    var weakest = sugg[0] || topicInsights('all').filter(function (g) { return g.ids.length >= 3; })[0];
    var openM = state.mistakes.filter(function (m) { return !m.resolved; }).sort(function (a, b) { return b.at - a.at; });
    if (claudeCaps.sample && weakest) steps.push({ kind: 'quiz', label: 'Quiz', detail: '5 questions on ' + weakest.topic, key: weakest.key });
    if (claudeCaps.sample && openM.length) steps.push({ kind: 'mistakes', label: 'Mistakes', detail: 'practise ' + plural(Math.min(5, openM.length), 'mistake'), ids: openM.slice(0, 5).map(function (m) { return m.id; }) });
    steps.push({ kind: 'flash', label: 'Quick test', detail: '5 cards' + (sugg.length ? ' from your weakest topics' : ''), topics: sugg.map(function (g) { return g.key; }) });
    return steps;
  }
  function openSession() {
    var steps = planSession();
    dialog({
      title: 'Today\'s session',
      message: 'A balanced session, about 20–30 minutes:\n\n' + steps.map(function (s, i) { return (i + 1) + '. ' + s.label + ' — ' + s.detail; }).join('\n') +
        '\n\nYou can skip any step. A bar at the bottom shows where you are.' + (claudeCaps.sample ? '' : '\n\n(The quiz steps need the app opened in claude.ai.)'),
      buttons: [{ label: 'Not now', value: false }, { label: '▶ Start', value: true, style: 'btn-primary' }]
    }).then(function (go) {
      if (!go) return;
      ts = { steps: steps, i: 0, start: Date.now(), done: [], reviewsBefore: todayRow()[0] };
      runStep();
    });
  }
  function runStep() {
    if (!ts) return;
    var s = ts.steps[ts.i];
    if (!s) return finishSession();
    s.running = true;
    renderSessionBar();
    var ok = true;
    if (s.kind === 'review') openReview({ module: 'all' });
    else if (s.kind === 'quiz') ok = startTopicQuiz([s.key], 5);
    else if (s.kind === 'mistakes') startPractice(s.ids, { n: 5 });
    else if (s.kind === 'flash') {
      if (!fl) fl = newFl();
      fl.module = 'all'; fl.topics = s.topics.slice(); fl.n = 0; fl.r = 0; fl.missed = []; fl.seenTopics = {}; fl.limit = 5;
      var best = ['case', 'principle', 'statute'].filter(function (t) { return flashPool(t).length; })[0];
      if (!best) { fl.topics = []; best = ['case', 'principle', 'statute'].filter(function (t) { return flashPool(t).length; })[0]; }
      if (best) openFlash(best); else ok = false;
    }
    if (ok === false) nextStep(true);
  }
  // Called whenever a window closes: closing a step's window ends that step.
  function sessionModalClosed(m) {
    if (!ts) return;
    var s = ts.steps[ts.i];
    if (!s || !s.running || m.id !== TS_MODALS[s.kind]) return;
    setTimeout(function () {
      if (!ts || ts.steps[ts.i] !== s || !s.running) return;
      if (topModal() && topModal().id === TS_MODALS[s.kind]) return; // reopened straight away (e.g. practice from the quiz)
      s.running = false; s.finished = true;
      renderSessionBar();
    }, 60);
  }
  function nextStep(skipped) {
    if (!ts) return;
    var s = ts.steps[ts.i];
    if (s) { s.running = false; if (skipped && !s.finished) s.skipped = true; }
    ts.i++;
    if (ts.i >= ts.steps.length) finishSession(); else runStep();
  }
  function finishSession() {
    var t = ts; ts = null; renderSessionBar();
    if (!t) return;
    var reviews = Math.max(0, todayRow()[0] - t.reviewsBefore);
    var sess = state.perf.s.filter(function (x) { return x.at >= t.start; });
    var q = sess.filter(function (x) { return x.kind !== 'flash'; }), f = sess.filter(function (x) { return x.kind === 'flash'; });
    var sum = function (l, k) { return l.reduce(function (a, x) { return a + x[k]; }, 0); };
    var lines = [];
    if (reviews) lines.push('• ' + plural(reviews, 'card') + ' reviewed');
    if (q.length) lines.push('• ' + sum(q, 'r') + ' of ' + sum(q, 'n') + ' quiz questions right');
    if (f.length) lines.push('• ' + Math.round(sum(f, 'r') * 10) / 10 + ' of ' + sum(f, 'n') + ' quick-test cards known');
    var skipped = t.steps.filter(function (s) { return s.skipped; }).length;
    state.settings.lastSession = dayKey(); saveUI();
    renderAll();
    dialog({
      title: 'Session complete',
      message: (lines.length ? lines.join('\n') : 'Nothing was recorded this time.') + (skipped ? '\n\n(' + plural(skipped, 'step') + ' skipped.)' : '') + '\n\nYour suggestions have been updated from today\'s results.',
      buttons: [{ label: 'See my progress', value: 'progress' }, { label: 'Done', value: null, style: 'btn-primary' }]
    }).then(function (v) { if (v === 'progress') openProgress('suggest'); });
  }
  function renderSessionBar() {
    var bar = $('#sessionBar');
    if (!bar) return;
    document.body.classList.toggle('ts-on', !!ts);
    if (!ts) { bar.hidden = true; return; }
    var s = ts.steps[ts.i];
    bar.hidden = false;
    bar.innerHTML = '<div class="ts-steps">' + ts.steps.map(function (x, i) {
        return '<span class="ts-dot' + (i < ts.i || x.finished ? ' done' : '') + (i === ts.i ? ' now' : '') + (x.skipped ? ' skipped' : '') + '" title="' + esc(x.label + ' — ' + x.detail) + '"></span>';
      }).join('') + '</div>' +
      '<div class="ts-text"><b>Today\'s session · step ' + (ts.i + 1) + ' of ' + ts.steps.length + '</b><span>' + esc(s.label + ' — ' + s.detail) + (s.finished ? ' · done' : '') + '</span></div>' +
      '<div class="ts-actions">' + (s.finished
        ? '<button type="button" class="btn btn-sm btn-primary" data-ts="next">' + (ts.i + 1 < ts.steps.length ? 'Next: ' + esc(ts.steps[ts.i + 1].label) + ' →' : 'Finish') + '</button>'
        : '<button type="button" class="btn btn-sm" data-ts="resume">Open this step</button><button type="button" class="btn btn-sm" data-ts="skip">Skip</button>') +
      '<button type="button" class="linklike" data-ts="end">End session</button></div>';
  }
  function bindSession() {
    $('#sessionBar').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ts]'); if (!b || !ts) return;
      var a = b.getAttribute('data-ts');
      if (a === 'next') nextStep(false);
      else if (a === 'skip') { var m = $('#' + TS_MODALS[ts.steps[ts.i].kind]); if (m && !m.hidden) { ts.steps[ts.i].running = false; closeModal(m); } nextStep(true); }
      else if (a === 'resume') { var s = ts.steps[ts.i]; var mm = $('#' + TS_MODALS[s.kind]); if (mm && mm.hidden) runStep(); }
      else if (a === 'end') finishSession();
    });
  }
