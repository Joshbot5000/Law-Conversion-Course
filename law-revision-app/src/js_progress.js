  /* ------------------------------------------------------------------
     U8. SUGGESTIONS & PROGRESS — "Work on next" on the home screen, and a
         My progress window: suggestions, the mistakes log, every topic at
         a glance, and recent activity.
     ------------------------------------------------------------------ */
  var pg = { tab: 'suggest', module: 'all', mFilter: 'open', mTopic: '', sort: 'need' };

  function suggestionHTML(g, i, where) {
    var d = where === 'today' ? 'data-today' : 'data-pg';
    return '<div class="sg-item"><div class="sg-text"><b title="' + esc(g.topic) + '">' + esc(g.topic) + '</b>' +
      '<span>' + esc(MODULE_LABEL[g.module]) + ' · ' + esc(g.reasons.slice(0, where === 'today' ? 2 : 4).join(' · ')) + '</span></div>' +
      '<div class="sg-actions"><button type="button" class="btn btn-sm btn-primary" ' + d + '="sg-practise" data-i="' + i + '" title="Quiz questions on this topic' + (g.mistakes.length ? ', aimed at your mistakes' : '') + '">✦ Practise</button>' +
      '<button type="button" class="btn btn-sm" ' + d + '="sg-flash" data-i="' + i + '" title="Quick-test flashcards from this topic">⚡ Flashcards</button>' +
      (where !== 'today' && g.reviewed ? '<button type="button" class="btn btn-sm" ' + d + '="sg-review" data-i="' + i + '">Review cards</button>' : '') + '</div></div>';
  }
  // The home screen's "Work on next" panel.
  function workOnNextHTML(mod) {
    var list = suggestions(mod, 3);
    $('#today')._sugg = list;
    var hasData = state.mistakes.length || Object.keys(state.perf.c).length || Object.keys(state.prefs.qstats).length || Object.keys(state.progress).length;
    return '<h3>Work on next <button type="button" class="linklike sg-all" data-today="progress">My progress →</button></h3>' + (list.length
      ? '<div class="sg-list">' + list.map(function (g, i) { return suggestionHTML(g, i, 'today'); }).join('') + '</div>'
      : '<p class="muted" style="margin:0;font-size:13px">' + (hasData ? 'Nothing stands out right now — keep going. Topics you struggle with in quizzes, quick tests and reviews will show here.' :
        'As you do quizzes, quick tests and reviews, the topics most worth working on will show here.') + '</p>');
  }
  function suggestionAction(a, g) {
    if (!g) return;
    if (a === 'sg-practise') {
      if (!claudeCaps.sample) { openFlashForTopic(g.key); return; }
      if (!$('#progressModal').hidden) closeModal($('#progressModal'));
      startPractice(g.mistakes.map(function (m) { return m.id; }), { topics: [g.key], n: 10 });
    } else if (a === 'sg-flash') {
      if (!$('#progressModal').hidden) closeModal($('#progressModal'));
      openFlashForTopic(g.key);
    } else if (a === 'sg-review') {
      if (!$('#progressModal').hidden) closeModal($('#progressModal'));
      var ids = g.ids.map(byId).filter(Boolean).sort(function (x, y) { return cardWeakness(y) - cardWeakness(x); }).slice(0, 20).map(function (e) { return e.id; });
      openReview({ module: g.module, drillIds: ids, label: 'Work on: ' + g.topic });
    }
  }
  function openFlashForTopic(key) {
    var mod = key.split('|')[0];
    if (!fl) fl = newFl();
    fl.module = mod; fl.topics = [key]; clearFlashCard();
    var best = ['case', 'principle', 'statute'].filter(function (t) { return flashPool(t).length; })[0];
    openFlash(best || null);
  }

  /* ---- My progress window ---- */
  function openProgress(tab) {
    if (tab) pg.tab = tab;
    pg.module = state.filter;
    renderProgress();
    openModal($('#progressModal'));
  }
  function renderProgress() {
    var body = $('#progressBody');
    var open = state.mistakes.filter(function (m) { return !m.resolved; }).length;
    var tabs = [['suggest', 'Suggestions'], ['week', 'This week'], ['mistakes', 'Mistakes' + (open ? ' (' + open + ')' : '')], ['topics', 'By topic'], ['activity', 'Activity']];
    var head = '<div class="pg-top"><div class="seg" role="tablist">' + tabs.map(function (t) {
        return '<button type="button" role="tab" class="seg-btn' + (pg.tab === t[0] ? ' on' : '') + '" aria-selected="' + (pg.tab === t[0]) + '" data-pgtab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<select id="pgModule" aria-label="Module"><option value="all">All modules</option>' + moduleOptions(pg.module) + '</select></div>';
    var html = '';
    if (pg.tab === 'suggest') {
      var list = suggestions(pg.module, 8);
      pg.list = list;
      html = '<p class="muted pg-intro">Worked out from your quiz answers, quick tests, saved mistakes and reviews' + (Object.keys(state.prefs.exams).length ? ', with topics for upcoming exams pushed up' : '') + '.</p>' +
        (list.length ? '<div class="sg-list">' + list.map(function (g, i) { return suggestionHTML(g, i, 'progress'); }).join('') + '</div>'
          : '<div class="empty" style="padding:24px 12px"><h3>Nothing stands out yet</h3><p>Do a few quizzes and quick tests — the topics you find hardest will be suggested here, with a reason for each.</p></div>');
    } else if (pg.tab === 'week') {
      html = weekHTML();
    } else if (pg.tab === 'mistakes') {
      html = mistakesHTML();
    } else if (pg.tab === 'topics') {
      var rows = topicInsights(pg.module).filter(function (g) { return g.qn || g.fn || g.reviewed || g.mistakes.length; });
      if (pg.sort === 'az') rows.sort(function (a, b) { return (MOD_ORDER[a.module] - MOD_ORDER[b.module]) || a.topic.localeCompare(b.topic); });
      var max = Math.max.apply(null, rows.map(function (g) { return g.score; }).concat([1]));
      html = '<div class="pg-sortrow"><span class="muted">' + plural(rows.length, 'topic') + ' you\'ve worked on</span><select id="pgSort" aria-label="Sort"><option value="need">Needs most work first</option><option value="az"' + (pg.sort === 'az' ? ' selected' : '') + '>A–Z</option></select></div>' +
        (rows.length ? '<div class="pg-table" role="table"><div class="pg-tr pg-th" role="row"><span>Topic</span><span>Quizzes</span><span>Quick tests</span><span>Review slips</span><span>Mistakes</span><span>Needs work</span></div>' +
          rows.map(function (g) {
            return '<div class="pg-tr" role="row"><span class="pg-topic"><b>' + esc(g.topic) + '</b><small>' + esc(MODULE_LABEL[g.module]) + (g.last ? ' · last practised ' + ago(g.last) : '') + '</small></span>' +
              '<span>' + (g.qn ? g.qr + '/' + g.qn + (g.level ? ' <small>' + levelName(g.level) + '</small>' : '') : '—') + '</span>' +
              '<span>' + (g.fn ? Math.round(g.fr * 10) / 10 + '/' + g.fn : '—') + '</span>' +
              '<span>' + (g.reviewed ? g.lapses : '—') + '</span>' +
              '<span>' + (g.mistakes.length || '—') + '</span>' +
              '<span><i class="pg-bar"><i style="width:' + Math.round(g.score / max * 100) + '%"></i></i></span></div>';
          }).join('') + '</div>' : '<p class="muted">Topics appear here once you\'ve quizzed, tested or reviewed them.</p>');
    } else {
      var sess = state.perf.s.slice().reverse();
      var qn = 0, qr = 0; Object.keys(state.prefs.qstats).forEach(function (k) { qn += state.prefs.qstats[k].n; qr += state.prefs.qstats[k].r; });
      var fn = 0; Object.keys(state.perf.c).forEach(function (id) { fn += state.perf.c[id][PC_FN]; });
      var mastered = state.mistakes.filter(function (m) { return m.resolved; }).length;
      var kinds = { quiz: 'Quiz', practice: 'Practice on mistakes', flash: 'Quick test' };
      html = '<div class="pg-stats"><div class="stat"><b>' + qn + '</b><span>quiz questions answered</span></div><div class="stat"><b>' + (qn ? Math.round(qr / qn * 100) + '%' : '—') + '</b><span>quiz accuracy</span></div>' +
        '<div class="stat"><b>' + fn + '</b><span>quick-test cards</span></div><div class="stat"><b>' + mastered + '</b><span>mistakes mastered</span></div></div>' +
        (sess.length ? '<div class="pg-sess">' + sess.map(function (s) {
          return '<div class="pg-sess-row"><span>' + new Date(s.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '</span><b>' + kinds[s.kind] + '</b><span>' + (Math.round(s.r * 10) / 10) + '/' + s.n + '</span>' +
            '<small>' + esc(s.topics.map(function (k) { return k.split('|').slice(1).join('|'); }).slice(0, 4).join(', ') + (s.topics.length > 4 ? '…' : '')) + '</small></div>';
        }).join('') + '</div>' : '<p class="muted">Your quizzes and quick tests will be listed here.</p>');
    }
    body.innerHTML = head + '<div class="pg-pane">' + html + '</div>';
  }
  function ago(t) {
    var d = Math.floor((Date.now() - t) / DAY);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
  }
  function mistakesHTML() {
    var inMod = state.mistakes.filter(function (m) { return pg.module === 'all' || m.topic.split('|')[0] === pg.module; });
    var openL = inMod.filter(function (m) { return !m.resolved; }), doneL = inMod.filter(function (m) { return m.resolved; });
    var list = (pg.mFilter === 'done' ? doneL : openL).slice();
    var topics = {}; list.forEach(function (m) { topics[m.topic] = (topics[m.topic] || 0) + 1; });
    if (pg.mTopic && !topics[pg.mTopic]) pg.mTopic = '';
    if (pg.mTopic) list = list.filter(function (m) { return m.topic === pg.mTopic; });
    list.sort(function (a, b) { return b.at - a.at; });
    pg.shownMistakes = list.map(function (m) { return m.id; });
    return '<p class="muted pg-intro">Every quiz question you got wrong is kept here until you\'ve mastered it — get the point right twice in practice, or tick it off yourself.</p>' +
      '<div class="pg-sortrow"><div class="seg"><button type="button" class="seg-btn' + (pg.mFilter !== 'done' ? ' on' : '') + '" data-pg="m-open">To master (' + openL.length + ')</button>' +
        '<button type="button" class="seg-btn' + (pg.mFilter === 'done' ? ' on' : '') + '" data-pg="m-done">Mastered (' + doneL.length + ')</button></div>' +
        '<select id="pgMTopic" aria-label="Topic"><option value="">All topics</option>' + Object.keys(topics).sort().map(function (k) {
          return '<option value="' + esc(k) + '"' + (pg.mTopic === k ? ' selected' : '') + '>' + esc(k.split('|').slice(1).join('|')) + ' (' + topics[k] + ')</option>';
        }).join('') + '</select></div>' +
      (pg.mFilter !== 'done' && list.length ? '<div class="qz-practise-all"><div><b>Practise ' + (list.length === 1 ? 'this mistake' : 'these ' + list.length + ' mistakes') + '</b><span>Fresh questions on the same points, from new angles.</span></div>' +
        '<button type="button" class="btn btn-primary" data-pg="m-practise-all">✦ Practise</button></div>' : '') +
      (list.length ? '<div class="qr-list">' + list.map(function (m) {
        var item = reviewItemHTML(m, m.chosen, null, false);
        var extra = '<div class="qr-actions"><span class="muted">' + ago(m.at) + (m.tries ? ' · practised ' + plural(m.tries, 'time') + ', ' + m.wins + ' right' : '') + '</span>' +
          (m.resolved ? '<button type="button" class="btn btn-sm" data-pg="m-reopen" data-id="' + esc(m.id) + '">Move back to “to master”</button>'
            : '<button type="button" class="btn btn-sm" data-pg="m-practise" data-id="' + esc(m.id) + '">✦ Practise similar</button><button type="button" class="btn btn-sm" data-pg="m-resolve" data-id="' + esc(m.id) + '">✓ I\'ve got it now</button>') +
          '<button type="button" class="linklike qr-del" data-pg="m-delete" data-id="' + esc(m.id) + '">Delete</button></div>';
        return item.replace(/<\/div><\/details>$/, extra + '</div></details>');
      }).join('') + '</div>' : '<div class="empty" style="padding:24px 12px"><h3>' + (pg.mFilter === 'done' ? 'Nothing mastered yet' : 'No mistakes to master') + '</h3><p>' +
        (pg.mFilter === 'done' ? 'Mistakes you master will move here.' : 'Questions you get wrong in quizzes will be saved here so you can go over them.') + '</p></div>');
  }
  function progressAction(a, el) {
    var id = el.getAttribute('data-id');
    if (a === 'sg-practise' || a === 'sg-flash' || a === 'sg-review') return suggestionAction(a, (pg.list || [])[+el.getAttribute('data-i')]);
    if (a === 'm-open' || a === 'm-done') { pg.mFilter = a === 'm-done' ? 'done' : 'open'; pg.mTopic = ''; renderProgress(); return; }
    if (a === 'm-practise' || a === 'm-practise-all') {
      if (!claudeCaps.sample) { toast('Practice questions are written by Claude, which works when the app is opened in claude.ai.', { type: 'error' }); return; }
      closeModal($('#progressModal'));
      startPractice(a === 'm-practise' ? [id] : (pg.shownMistakes || []).slice(0, 12), a === 'm-practise' ? { n: 5 } : null);
      return;
    }
    if (a === 'm-resolve') { resolveMistake(id, true); toast('Marked as mastered.', { type: 'success' }); }
    else if (a === 'm-reopen') resolveMistake(id, false);
    else if (a === 'm-delete') {
      var m = mistakeById(id); if (!m) return;
      removeMistake(id);
      toast('Mistake deleted.', { actionLabel: 'Undo', timeout: 7000, onAction: function () { state.mistakes.push(m); persistMistake(m); renderProgress(); renderAll(); } });
    }
    renderProgress(); renderAll();
  }
  function bindProgress() {
    $('#progressBtn').addEventListener('click', function () { openProgress('suggest'); });
    $('#progressModal').addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-pgtab]'); if (t) { pg.tab = t.getAttribute('data-pgtab'); renderProgress(); return; }
      var a = ev.target.closest('[data-pg]'); if (a) return progressAction(a.getAttribute('data-pg'), a);
      var p = ev.target.closest('[data-peek]'); if (p) return openPeek(p.getAttribute('data-peek'));
    });
    $('#progressModal').addEventListener('change', function (ev) {
      if (ev.target.id === 'pgModule') { pg.module = ev.target.value; pg.mTopic = ''; renderProgress(); }
      else if (ev.target.id === 'pgSort') { pg.sort = ev.target.value; renderProgress(); }
      else if (ev.target.id === 'pgMTopic') { pg.mTopic = ev.target.value; renderProgress(); }
    });
  }

  function weekTiles(r) {
    var tile = function (v, label) { return '<div class="stat"><b>' + v + '</b><span>' + label + '</span></div>'; };
    return '<div class="pg-stats">' +
      tile(r.reviews, 'cards reviewed' + (r.reviews ? ' · ' + Math.round((1 - r.again / r.reviews) * 100) + '% recalled' : '')) +
      tile(r.qn ? r.qr + '/' + r.qn : '—', 'quiz questions right' + (r.qn ? ' (' + Math.round(r.qr / r.qn * 100) + '%)' : '')) +
      tile(r.fn ? Math.round(r.fr * 10) / 10 + '/' + r.fn : '—', 'quick-test cards known') +
      tile(r.mastered + ' / ' + r.made, 'mistakes mastered / new') + '</div>';
  }
  function weekHTML() {
    var w = state.perf.w, prev = state.perf.wPrev;
    var fmt = function (t) { return new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); };
    var name = function (k) { var p = k.split('|'); return esc(p.slice(1).join('|')) + ' <small>' + esc(MODULE_LABEL[p[0]] || '') + '</small>'; };
    var html = '';
    if (prev && w) {
      var end = keyTime(w.wk), r = weekReport(prev.wk, end), mv = weekMovers(prev, w);
      var weeks = Math.round((end - keyTime(prev.wk)) / (7 * DAY));
      html += '<h4 class="pg-h">' + (weeks > 1 ? 'Since ' + fmt(keyTime(prev.wk)) : 'Last week · ' + fmt(keyTime(prev.wk)) + ' – ' + fmt(end - DAY)) + '</h4>' + weekTiles(r) +
        '<div class="pg-movers"><div><b class="pg-up">▲ Improved</b>' + (mv.improved.length ? '<ul>' + mv.improved.map(function (x) { return '<li>' + name(x.key) + '</li>'; }).join('') + '</ul>' : '<p class="muted">No clear change yet.</p>') + '</div>' +
        '<div><b class="pg-down">▼ Needs attention</b>' + (mv.slipped.length ? '<ul>' + mv.slipped.map(function (x) { return '<li>' + name(x.key) + '</li>'; }).join('') + '</ul>' : '<p class="muted">Nothing slipped.</p>') + '</div></div>';
    } else {
      html += '<p class="muted pg-intro">Your first weekly summary appears next Monday: what you reviewed, how your quizzes went, what you mastered, and which topics improved or slipped.</p>';
    }
    var list = suggestions('all', 3);
    pg.list = list;
    html += '<h4 class="pg-h">Focus for this week</h4>' + (list.length ? '<div class="sg-list">' + list.map(function (g, i) { return suggestionHTML(g, i, 'progress'); }).join('') + '</div>' : '<p class="muted">Nothing stands out — keep your reviews ticking over.</p>');
    if (w) html += '<h4 class="pg-h">This week so far</h4>' + weekTiles(weekReport(w.wk));
    return html;
  }
