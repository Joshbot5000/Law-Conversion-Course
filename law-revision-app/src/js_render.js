  /* ------------------------------------------------------------------
     J. SPACED REPETITION
     A simple, well-tested scheme (SM-2 style): each card has an
     interval in days and an "ease". Again = see it again in 10 minutes;
     Hard / Good / Easy push the next review further out.
     ------------------------------------------------------------------ */
  var LEARN_MS = 10 * 60000;
  function srsStatus(id, now) {
    var p = state.progress[id];
    if (!p) return 'new';
    if (p.due <= (now || Date.now())) return 'due';
    return p.ivl >= 21 ? 'strong' : 'learning';
  }
  function dueAt(ivlDays, now) { return startOfDay(now) + ivlDays * DAY + 4 * 3600000; }
  function schedule(p, grade, now) {
    now = now || Date.now();
    var q = p ? Object.assign({}, p) : { ivl: 0, ease: 2.5, reps: 0, lapses: 0 };
    if (grade === 1) {
      if (q.reps > 0) q.lapses++;
      q.reps = 0; q.ivl = 0; q.ease = Math.max(1.3, q.ease - 0.2); q.due = now + LEARN_MS;
    } else {
      var ivl;
      if (q.reps === 0) ivl = grade === 4 ? 4 : 1;
      else if (q.reps === 1) ivl = grade === 2 ? 2 : grade === 3 ? 3 : 6;
      else if (grade === 2) ivl = Math.max(q.ivl + 1, Math.round(q.ivl * 1.2));
      else if (grade === 3) ivl = Math.max(q.ivl + 1, Math.round(q.ivl * q.ease));
      else ivl = Math.max(q.ivl + 2, Math.round(q.ivl * q.ease * 1.3));
      if (grade === 2) q.ease = Math.max(1.3, q.ease - 0.15);
      if (grade === 4) q.ease = Math.min(3.5, q.ease + 0.15);
      q.ivl = Math.min(365, ivl); q.reps++; q.due = dueAt(q.ivl, now);
    }
    q.last = now;
    return q;
  }
  function fmtIvl(p) {
    if (!p.ivl) return '10 min';
    var d = p.ivl;
    if (d < 1.5) return '1 day';
    if (d < 14) return d + ' days';
    if (d < 60) return Math.round(d / 7) + ' wk';
    if (d < 365) return Math.round(d / 30) + ' mo';
    return '1 yr';
  }
  function todayRow() { return state.stats.days[dayKey()] || [0, 0, 0]; }
  function bumpStats(wasNew, grade) {
    var k = dayKey(), row = (state.stats.days[k] || [0, 0, 0]).slice();
    row[0]++; if (grade === 1) row[1]++; if (wasNew) row[2]++;
    state.stats.days[k] = row;
    persistStats(k);
  }
  function extraNewToday() { var x = state.settings.extraNew; return x && x.day === dayKey() ? x.n : 0; }
  function newRemaining() { return Math.max(0, effectiveNewPerDay() + extraNewToday() - todayRow()[2]); }
  function inScope(e, module, type) {
    return (module === 'all' || e.module === module) && (type === 'all' || e.type === type || (type === 'key' && e.key));
  }
  var MOD_ORDER = {};
  MODULES.forEach(function (m, i) { MOD_ORDER[m.id] = i; });
  // New cards are introduced in roughly the order your course teaches them:
  // module, chapter, then page in the source; answer structures come last in each chapter.
  function studyKey(e) {
    var ch = /-ch(\d+)-/.exec(e.id), pg = /(\d+)/.exec(e.sourceRef || '');
    return [examRank(e.module), MOD_ORDER[e.module], ch ? +ch[1] : 99, /^(answer structure|worked example)/i.test(e.name) ? 1 : 0, e.sourceId || '~', pg ? +pg[1] : 9999];
  }
  function textbookOrder(a, b) {
    var x = studyKey(a), y = studyKey(b);
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  }
  function dueCards(module, type, now) {
    now = now || Date.now();
    return state.entries.filter(function (e) { var p = state.progress[e.id]; return p && p.due <= now && inScope(e, module, type); })
      .sort(function (a, b) { return state.progress[a.id].due - state.progress[b.id].due; });
  }
  function newCards(module, type) {
    return state.entries.filter(function (e) { return !state.progress[e.id] && inScope(e, module, type); }).sort(textbookOrder);
  }
  function streakDays() {
    var n = 0, t = Date.now();
    if (!(state.stats.days[dayKey(t)] || [0])[0]) t -= DAY;
    while ((state.stats.days[dayKey(t)] || [0])[0] > 0) { n++; t -= DAY; }
    return n;
  }
  function recall7() {
    var rev = 0, again = 0;
    for (var i = 0; i < 7; i++) { var r = state.stats.days[dayKey(Date.now() - i * DAY)]; if (r) { rev += r[0]; again += r[1]; } }
    return rev ? Math.round((1 - again / rev) * 100) : null;
  }
  function weakTopics(module, limit) {
    var groups = {};
    state.entries.forEach(function (e) {
      if (module !== 'all' && e.module !== module) return;
      var p = state.progress[e.id]; if (!p) return;
      var key = e.module + '|' + (e.topic || '(no topic)');
      var g = groups[key] || (groups[key] = { module: e.module, topic: e.topic || '(no topic)', cards: 0, lapses: 0, ease: 0, ids: [] });
      g.cards++; g.lapses += p.lapses; g.ease += p.ease; g.ids.push(e.id);
    });
    return Object.keys(groups).map(function (k) { var g = groups[k]; g.score = g.lapses / g.cards + (2.5 - g.ease / g.cards); return g; })
      .filter(function (g) { return g.lapses > 0; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, limit || 3);
  }

  /* ------------------------------------------------------------------
     K. FILTERING, SEARCHING, SORTING
     ------------------------------------------------------------------ */
  function searchTerms() { return state.query.toLowerCase().split(/\s+/).filter(Boolean); }
  function matchesSearch(e, terms) {
    if (!terms.length) return true;
    var hay = [e.name, e.citation, e.topic, e.facts, e.ratio, e.strategy, MODULE_LABEL[e.module], e.tags.join(' '), e.comments.map(function (c) { return c.text; }).join(' '), e.key ? 'key authority' : ''].join(' \u0001 ').toLowerCase();
    return terms.every(function (t) {
      if (t.charAt(0) === '#') {
        var tag = t.replace(/^#+/, '');
        return !tag || e.tags.some(function (x) { return x.indexOf(tag) !== -1; });
      }
      return hay.indexOf(t) !== -1;
    });
  }
  function matchesStatus(e, now) {
    var f = state.settings.statusFilter, p = state.progress[e.id];
    switch (f) {
      case 'due': return !!p && p.due <= now;
      case 'new': return !p;
      case 'learning': return !!p && p.ivl < 21;
      case 'strong': return !!p && p.ivl >= 21;
      case 'weak': return !!p && p.lapses >= 2;
      case 'unverified': return !e.verified;
      case 'verified': return e.verified;
      case 'memorised': return e.memorised;
      case 'key': return e.key;
      default: return true;
    }
  }
  function visibleEntries() {
    var terms = searchTerms(), now = Date.now();
    var list = state.entries.filter(function (e) {
      return (state.filter === 'all' || e.module === state.filter) &&
        (state.settings.typeFilter === 'all' || e.type === state.settings.typeFilter) &&
        matchesStatus(e, now) && matchesSearch(e, terms);
    });
    var byName = function (a, b) { return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }); };
    var P = state.progress;
    var sorters = {
      recent: function (a, b) { return b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0; },
      updated: function (a, b) { return b.updatedAt < a.updatedAt ? -1 : b.updatedAt > a.updatedAt ? 1 : 0; },
      az: byName,
      module: function (a, b) { return (MOD_ORDER[a.module] - MOD_ORDER[b.module]) || a.topic.localeCompare(b.topic, 'en', { sensitivity: 'base' }) || byName(a, b); },
      due: function (a, b) { var x = P[a.id] ? P[a.id].due : Infinity, y = P[b.id] ? P[b.id].due : Infinity; return (x - y) || byName(a, b); },
      weak: function (a, b) {
        var x = P[a.id], y = P[b.id];
        return ((y ? y.lapses : -1) - (x ? x.lapses : -1)) || ((x ? x.ease : 9) - (y ? y.ease : 9)) || byName(a, b);
      }
    };
    return list.sort(sorters[state.settings.sort] || sorters.module);
  }
  function highlight(text) {
    var terms = searchTerms().filter(function (t) { return t.charAt(0) !== '#'; }).sort(function (a, b) { return b.length - a.length; });
    if (!terms.length || !text) return esc(text);
    var re = new RegExp('(' + terms.map(regexEscape).join('|') + ')', 'gi');
    return String(text).split(re).map(function (part, i) { return i % 2 === 1 ? '<mark>' + esc(part) + '</mark>' : esc(part); }).join('');
  }
  function tagIsHit(tag) {
    return searchTerms().some(function (t) { var q = t.replace(/^#+/, ''); return q && tag.indexOf(q) !== -1; });
  }

  /* ------------------------------------------------------------------
     L. RENDERING
     ------------------------------------------------------------------ */
  var renderQueued = false;
  function renderAllSoon() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () { renderQueued = false; renderAll(); });
  }
  function renderAll() {
    renderSidebar();
    renderAnalytics();
    renderBackupStatus();
    renderSyncStatus();
    renderControls();
    renderToday();
    renderEntries();
    maybeNudgeBackup();
  }

  var TYPE_FILTERS = [
    { id: 'all', label: 'Everything' },
    { id: 'case', label: '⚖ Cases' },
    { id: 'statute', label: '§ Statutes' },
    { id: 'principle', label: '◆ Principles' }
  ];
  var TYPE_TITLE = { case: 'Cases', statute: 'Statutes', principle: 'Principles' };

  function renderSidebar() {
    var counts = { all: state.entries.length };
    MODULES.forEach(function (m) { counts[m.id] = 0; });
    state.entries.forEach(function (e) { counts[e.module]++; });
    var items = [{ id: 'all', label: 'All' }].concat(MODULES);
    $('#moduleNav').innerHTML = items.map(function (m) {
      return '<button type="button" class="nav-item' + (state.filter === m.id ? ' active' : '') + '" data-filter="' + m.id + '" aria-pressed="' + (state.filter === m.id) + '">' +
        '<span>' + esc(m.label) + '</span><span class="count">' + counts[m.id] + '</span></button>';
    }).join('');
    var inModule = state.entries.filter(function (e) { return state.filter === 'all' || e.module === state.filter; });
    var tcount = { all: inModule.length, case: 0, statute: 0, principle: 0 };
    inModule.forEach(function (e) { tcount[e.type]++; });
    $('#typeNav').innerHTML = TYPE_FILTERS.map(function (t) {
      var on = state.settings.typeFilter === t.id;
      return '<button type="button" class="nav-item' + (on ? ' active' : '') + '" data-type="' + t.id + '" aria-pressed="' + on + '">' +
        '<span>' + t.label + '</span><span class="count">' + tcount[t.id] + '</span></button>';
    }).join('');
    $('#sourceCount').textContent = state.sources.length;
  }

  function renderAnalytics() {
    var count = function (fn) { return state.entries.filter(fn).length; };
    $('#statTotal').textContent = state.entries.length;
    $('#statStrong').textContent = count(function (e) { var p = state.progress[e.id]; return p && p.ivl >= 21; });
    $('#statCases').textContent = count(function (e) { return e.type === 'case'; });
    $('#statStatutes').textContent = count(function (e) { return e.type === 'statute'; });
    $('#statPrinciples').textContent = count(function (e) { return e.type === 'principle'; });
    $('#moduleProgress').innerHTML = MODULES.map(function (m) {
      var inMod = state.entries.filter(function (e) { return e.module === m.id; });
      if (!inMod.length) return '';
      var seen = inMod.filter(function (e) { return state.progress[e.id]; }).length;
      var ver = inMod.filter(function (e) { return e.verified; }).length;
      var pct = Math.round(seen / inMod.length * 100), vpct = Math.round(ver / inMod.length * 100);
      return '<div class="mod-progress-row" title="' + esc(m.label) + ': ' + seen + ' reviewed, ' + ver + ' verified, of ' + inMod.length + '">' +
        '<div class="label"><span>' + esc(m.label) + '</span><span>' + seen + ' / ' + inMod.length + '</span></div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="bar" style="height:4px"><i class="v" style="width:' + vpct + '%"></i></div></div>';
    }).join('') || '<p class="muted" style="margin:0;font-size:12.5px">Add cards to see progress by module.</p>';
  }

  function renderBackupStatus() {
    var el = $('#lastBackup');
    if (!state.settings.lastBackup) {
      el.textContent = 'No backup exported from this device yet.';
      el.className = 'last-backup' + (store.mode === 'local' && state.settings.changedSinceBackup ? ' stale' : '');
    } else {
      el.textContent = 'Last backup: ' + formatDate(state.settings.lastBackup);
      var old = Date.now() - new Date(state.settings.lastBackup).getTime() > 14 * DAY;
      el.className = 'last-backup' + (old && state.settings.changedSinceBackup ? ' stale' : '');
      if (old && state.settings.changedSinceBackup) el.textContent += ' — time for a fresh one.';
    }
  }

  function renderSyncStatus() {
    var line = $('#syncLine'), text = $('#syncText'), note = $('#dataNote');
    if (!line) return;
    line.className = 'sync-line';
    if (store.mode === 'pending') { text.textContent = 'Loading…'; note.textContent = ''; return; }
    if (store.mode === 'cloud') {
      if (store.status === 'error') { line.classList.add('bad'); text.textContent = 'Not saved: ' + store.error; }
      else if (store.status === 'busy') { line.classList.add('busy'); text.textContent = state.loaded ? 'Saving…' : 'Loading your library…'; }
      else { line.classList.add('ok'); text.textContent = 'Saved to your claude.ai account'; }
      note.textContent = 'Your cards, progress and sources sync wherever you open this page in claude.ai. Export a backup now and then for safekeeping.';
    } else {
      if (store.status === 'error') { line.classList.add('bad'); text.textContent = 'Not saved: ' + store.error; }
      else { line.classList.add('ok'); text.textContent = EDITION === 'friends' ? 'Saved in this browser' : 'Saved in this browser only'; }
      note.textContent = EDITION === 'friends'
        ? 'Your library is kept in this browser on this device. Export a backup now and then — it keeps your work safe and moves it to another device (use Import there).'
        : (store.localReason ? store.localReason + ' ' : '') +
          'This copy keeps everything in this browser. Use Export and Import to move data between it and your claude.ai version.';
    }
  }

  function renderControls() {
    $('#viewCardBtn').classList.toggle('active', state.settings.view === 'card');
    $('#viewListBtn').classList.toggle('active', state.settings.view === 'list');
    $('#viewCardBtn').setAttribute('aria-pressed', state.settings.view === 'card');
    $('#viewListBtn').setAttribute('aria-pressed', state.settings.view === 'list');
    $('#cramToggle').checked = state.settings.cram;
    document.body.classList.toggle('cram', state.settings.cram);
    $('#cramBanner').hidden = !state.settings.cram;
    $('#sortSelect').value = state.settings.sort;
    $('#statusSelect').value = state.settings.statusFilter;
    var banner = $('#storageBanner');
    banner.hidden = !(store.mode === 'local' && store.localOK === false);
    banner.innerHTML = '⚠ Your browser is blocking storage, so changes will <b>not</b> be saved. Use <b>Export</b> before closing this page.';
    $('#clearSearch').hidden = !state.query;
    $('#searchKbd').hidden = !!state.query;
    var due = dueCards(state.filter, 'all').length;
    var fresh = Math.min(newRemaining(), newCards(state.filter, 'all').length);
    $('#reviewPill').textContent = due + fresh;
  }

  function renderToday() {
    var box = $('#today');
    if (!state.loaded || !state.entries.length || state.query) { box.hidden = true; return; }
    box.hidden = false;
    var mod = state.filter, label = mod === 'all' ? 'All modules' : MODULE_LABEL[mod];
    var due = dueCards(mod, 'all').length;
    var newAvail = newCards(mod, 'all').length;
    var fresh = Math.min(newRemaining(), newAvail);
    var row = todayRow(), streak = streakDays(), acc = recall7();
    var main = '<section class="today-main"><h3>Today · ' + esc(label) + '</h3>' +
      '<div class="due-figures"><div class="due"><b>' + due + '</b><span>due for review</span></div>' +
      '<div class="new"><b>' + fresh + '</b><span>new to learn</span></div>' +
      '<div><b>' + row[0] + '</b><span>reviewed today</span></div></div>' +
      '<div class="today-actions">' +
      (due + fresh > 0
        ? '<button type="button" class="btn btn-review" data-today="start">▶ Start review</button>'
        : '<span style="font-weight:600;color:var(--good)">✓ All caught up</span><button type="button" class="btn btn-sm" data-today="practise">Practise anyway</button>') +
      (newAvail > fresh && fresh === 0 && newAvail ? '<button type="button" class="btn btn-sm" data-today="more">Learn 10 more new</button>' : '') +
      '</div>' +
      '<div class="today-meta">' + (streak ? '🔥 ' + plural(streak, 'day') + ' streak · ' : '') +
      (acc != null ? 'Recall this week: ' + acc + '% · ' : '') + plural(effectiveNewPerDay(), 'new card') + ' a day' + (state.prefs.autoPace && effectiveNewPerDay() > state.prefs.newPerDay ? ' (auto-paced)' : '') +
      (newAvail ? ' · ' + newAvail + ' not started yet' : '') + '</div>' + examLine(mod) + '</section>';

    // Next 7 days
    var counts = [0, 0, 0, 0, 0, 0, 0], sod = startOfDay();
    state.entries.forEach(function (e) {
      if (mod !== 'all' && e.module !== mod) return;
      var p = state.progress[e.id]; if (!p) return;
      var d = Math.max(0, Math.floor((p.due - sod) / DAY));
      if (d < 7) counts[d]++;
    });
    var max = Math.max.apply(null, counts.concat([1]));
    var days = ['Today', 'Tmrw'];
    for (var i = 2; i < 7; i++) days.push(new Date(sod + i * DAY).toLocaleDateString('en-GB', { weekday: 'short' }));
    var forecast = '<section><h3>Next 7 days</h3>' + (max === 1 && !counts.some(Boolean) ? '<p class="muted" style="margin:0 0 8px;font-size:13px">Your upcoming reviews will show here once you start.</p>' : '') +
      '<div class="forecast" role="img" aria-label="Cards due over the next 7 days: ' + counts.join(', ') + '">' +
      counts.map(function (c, i) {
        return '<div class="col' + (i === 0 ? ' today' : '') + '"><em>' + c + '</em><i style="height:' + Math.round(c / max * 52) + 'px"></i><small>' + days[i] + '</small></div>';
      }).join('') + '</div></section>';

    var weak = weakTopics(mod, 3);
    var inMod = state.entries.filter(function (e) { return mod === 'all' || e.module === mod; });
    var ver = inMod.filter(function (e) { return e.verified; }).length;
    var weakHtml = '<section><h3>Weak spots</h3>' + (weak.length
      ? '<div class="weak-list">' + weak.map(function (g, i) {
        return '<div class="weak-item"><div><b title="' + esc(g.topic) + '">' + esc(g.topic) + '</b><span>' + (mod === 'all' ? esc(MODULE_LABEL[g.module]) + ' · ' : '') +
          plural(g.lapses, 'slip') + ' across ' + cardsWord(g.cards) + '</span></div><button type="button" class="btn btn-sm" data-today="drill" data-i="' + i + '">Drill</button></div>';
      }).join('') + '</div>'
      : '<p class="muted" style="margin:0;font-size:13px">Topics you keep forgetting will show here after a few reviews.</p>') +
      '<div class="verify-line"><span>Verified against your sources: <b>' + ver + '</b> of ' + inMod.length + '</span>' +
      (ver < inMod.length ? '<span><button type="button" class="btn btn-sm" data-today="verifyq">✓ Check cards</button> <button type="button" class="linklike" data-today="unverified">Show unchecked</button></span>' : '') + '</div></section>';
    box.innerHTML = main + forecast + weakHtml;
    box._weak = weak;
  }

  function renderEntries() {
    var container = $('#entries');
    var title = state.filter === 'all' ? 'All cards' : MODULE_LABEL[state.filter];
    if (state.settings.typeFilter !== 'all') title = (state.filter === 'all' ? 'All ' : MODULE_LABEL[state.filter] + ' – ') + TYPE_TITLE[state.settings.typeFilter];
    $('#viewTitle').textContent = title;
    if (!state.loaded) {
      $('#viewSubtitle').textContent = '';
      container.innerHTML = '<div class="loading"><span class="spinner"></span>Loading your library…</div>';
      return;
    }
    var list = visibleEntries();
    var noun = { case: 'case', statute: 'statute', principle: 'principle' }[state.settings.typeFilter] || 'card';
    var sub = plural(list.length, noun);
    var statusLabel = $('#statusSelect').selectedOptions[0];
    if (state.settings.statusFilter !== 'all' && statusLabel) sub += ' · ' + statusLabel.textContent.toLowerCase();
    if (state.query) sub += ' matching “' + state.query + '”';
    $('#viewSubtitle').textContent = sub;

    if (!state.entries.length) {
      container.innerHTML = '<div class="empty"><h3>Your library is empty</h3>' +
        '<p>Upload a chapter or your notes and approve the cards drafted from it, type a card in yourself, or import a backup.</p>' +
        '<button class="btn btn-primary" type="button" data-action="add-notes">＋ Add notes or a chapter</button> ' +
        '<button class="btn" type="button" data-action="add">Add a card</button> ' +
        '<button class="btn" type="button" data-action="import">Import a backup</button></div>';
      return;
    }
    if (!list.length) {
      container.innerHTML = '<div class="empty"><h3>No matches</h3><p>' +
        (state.query ? 'Nothing in ' + esc(title) + ' matches “' + esc(state.query) + '”.' : 'No cards here with these filters.') +
        '</p>' + (state.query ? '<button class="btn" type="button" data-action="clear-search">Clear search</button>' : '') +
        (state.settings.statusFilter !== 'all' ? ' <button class="btn" type="button" data-action="show-all-status">Show all cards</button>' : '') +
        (state.filter !== 'all' ? ' <button class="btn" type="button" data-action="show-all">Show all modules</button>' : '') +
        (state.settings.typeFilter !== 'all' ? ' <button class="btn" type="button" data-action="show-all-types">Show every type</button>' : '') +
        '</div>';
      return;
    }
    // Very large result sets: render the first 300 and offer the rest.
    var limit = container._limit || 300;
    var shown = list.slice(0, limit);
    var more = list.length > limit ? '<div style="text-align:center;margin-top:18px"><button class="btn" type="button" data-action="more">Show ' + Math.min(300, list.length - limit) + ' more (' + (list.length - limit) + ' hidden)</button></div>' : '';
    if (state.settings.view === 'list') {
      container.innerHTML = '<div class="list" role="table" aria-label="Cards">' +
        '<div class="list-head" role="row"><span>Type</span><span>Authority</span><span>Module · Topic</span><span>Principle</span><span style="text-align:right">Actions</span></div>' +
        shown.map(rowHTML).join('') + '</div>' + more;
    } else {
      container.innerHTML = '<div class="cards">' + shown.map(cardHTML).join('') + '</div>' + more;
    }
  }

  var LABELS = {
    case: ['Material Facts', 'Legal Ratio / Principle', 'Exam Application Strategy'],
    statute: ['Context', 'What the Provision Says', 'Exam Application Strategy'],
    principle: ['Example / Application', 'The Rule', 'How to Use It']
  };
  function typeBadge(e) {
    if (e.type === 'statute') return '<span class="badge badge-statute">Statute</span>';
    if (e.type === 'principle') return '<span class="badge badge-principle">Principle</span>';
    return '<span class="badge badge-case">Case</span>';
  }
  function srsChip(e) {
    var p = state.progress[e.id], st = srsStatus(e.id);
    if (st === 'new') return '<span class="chip srs-new" title="Not reviewed yet">New</span>';
    if (st === 'due') return '<span class="chip srs-due" title="Due for review">Due</span>';
    var when = Math.max(1, Math.round((p.due - Date.now()) / DAY));
    if (st === 'strong') return '<span class="chip srs-strong" title="Next review in ' + plural(when, 'day') + '">Strong</span>';
    return '<span class="chip srs-learning" title="Next review in ' + plural(when, 'day') + '">Next in ' + when + 'd</span>';
  }
  function fieldBlock(label, e, k, extraClass) {
    var text = e[k];
    return '<div class="' + (extraClass || '') + '"><div class="field-label">' + label + '</div>' +
      '<div class="field-text hideable' + (text ? '' : ' is-empty') + '">' + (text ? fieldTextHTML(e, k) : 'Not added yet') + '</div></div>';
  }
  function tagsHTML(e) {
    return e.tags.map(function (t) {
      return '<button type="button" class="tag" data-action="tag" data-tag="' + esc(t) + '" title="Show everything tagged #' + esc(t) + '">' +
        (tagIsHit(t) ? '<mark>#' + esc(t) + '</mark>' : '#' + esc(t)) + '</button>';
    }).join('');
  }
  function sourceLabel(e) {
    var s = e.sourceId ? sourceById(e.sourceId) : null;
    var parts = [];
    if (s) parts.push(s.title);
    if (e.sourceRef) parts.push(e.sourceRef);
    return parts.join(', ');
  }
  function sourceLine(e) {
    var label = sourceLabel(e);
    if (!label) return '';
    var s = e.sourceId ? sourceById(e.sourceId) : null;
    return '<div class="source-line"><span>Source:</span>' +
      (s ? '<button type="button" data-action="source" title="Open the source at this passage">' + esc(label) + '</button>' : '<span>' + esc(label) + '</span>') + '</div>';
  }
  var ICON_ASK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/><path d="M9.8 9.5a2.3 2.3 0 0 1 4.4.8c0 1.5-2.2 2-2.2 3.2"/><path d="M12 16.5h.01"/></svg>';
  var ICON_COMMENT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4Z"/><path d="M8 9h8M8 12h5"/></svg>';
  var ICON_EDIT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  var ICON_DELETE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';
  function actionButtons(e) {
    return '<button type="button" class="icon-btn ask" data-action="ask" title="Ask about this" aria-label="Ask about ' + esc(e.name) + '">' + ICON_ASK + '</button>' +
      '<button type="button" class="icon-btn" data-action="comment" title="Add a comment" aria-label="Add a comment to ' + esc(e.name) + '">' + ICON_COMMENT + '</button>' +
      '<button type="button" class="icon-btn" data-action="edit" title="Edit" aria-label="Edit ' + esc(e.name) + '">' + ICON_EDIT + '</button>' +
      '<button type="button" class="icon-btn danger" data-action="delete" title="Delete" aria-label="Delete ' + esc(e.name) + '">' + ICON_DELETE + '</button>';
  }

  function cardHTML(e) {
    var revealed = state.revealed[e.id] ? ' revealed' : '';
    return '<article class="card entry type-' + e.type + revealed + (e.key ? ' is-key' : '') + '" data-id="' + esc(e.id) + '">' +
      '<div class="card-head">' +
        '<div class="card-meta">' + typeBadge(e) + '<span class="chip">' + esc(MODULE_LABEL[e.module]) + '</span>' + srsChip(e) + '</div>' +
        '<h3 class="card-title">' + (e.key ? '<span class="key-star" title="Key authority">★</span> ' : '') + highlight(e.name) + '</h3>' +
        (e.citation ? '<div class="card-citation">' + highlight(e.citation) + '</div>' : '') +
        (e.topic ? '<div class="card-topic"><b>Topic</b>' + highlight(e.topic) + '</div>' : '') +
      '</div>' +
      '<span class="reveal-hint">👁 Click to reveal</span>' +
      '<div class="card-body">' +
        fieldBlock(LABELS[e.type][0], e, 'facts') +
        fieldBlock(LABELS[e.type][1], e, 'ratio', 'field-ratio') +
        fieldBlock(LABELS[e.type][2], e, 'strategy') +
      '</div>' +
      commentsHTML(e) + sourceLine(e) + relatedLine(e) + notesLine(e) +
      (e.tags.length ? '<div class="card-tags">' + tagsHTML(e) + '</div>' : '') +
      '<div class="card-foot">' +
        '<div class="foot-toggles">' +
          '<button type="button" class="memo-toggle keyauth' + (e.key ? ' on' : '') + '" data-action="key" aria-pressed="' + e.key + '" title="Mark as a key authority you must refer to">' +
            '<span class="tick">★</span>' + (e.key ? 'Key' : 'Key?') + '</button>' +
          '<button type="button" class="memo-toggle verify' + (e.verified ? ' on' : '') + '" data-action="verify" aria-pressed="' + e.verified + '" title="Tick once you have checked this card against your source">' +
            '<span class="tick">✓</span>' + (e.verified ? 'Verified' : 'Verify') + '</button>' +
          '<button type="button" class="memo-toggle' + (e.memorised ? ' on' : '') + '" data-action="memorise" aria-pressed="' + e.memorised + '">' +
            '<span class="tick">✓</span>' + (e.memorised ? 'Memorised' : 'Memorise') + '</button>' +
        '</div>' +
        '<div class="actions">' + actionButtons(e) + '</div>' +
      '</div>' +
    '</article>';
  }

  function rowHTML(e) {
    var cls = 'row entry' + (state.revealed[e.id] ? ' revealed' : '') + (state.expanded[e.id] ? ' expanded' : '') + (e.key ? ' is-key' : '');
    return '<div class="' + cls + '" data-id="' + esc(e.id) + '" role="row">' +
      '<div class="row-main" title="Click to expand">' +
        '<div>' + typeBadge(e) + '</div>' +
        '<div class="row-name">' + (e.key ? '<span class="key-star" title="Key authority">★</span> ' : '') + highlight(e.name) + (e.citation ? '<small>' + highlight(e.citation) + '</small>' : '') + '</div>' +
        '<div class="row-mod">' + esc(MODULE_LABEL[e.module]) + (e.topic ? '<span>' + highlight(e.topic) + '</span>' : '') + '</div>' +
        '<div><div class="row-ratio hideable">' + (e.ratio ? fieldTextHTML(e, 'ratio') : '<i class="muted">No rule added</i>') + '</div>' +
          '<span class="reveal-hint">👁 Click to reveal</span></div>' +
        '<div class="row-actions">' +
          '<button type="button" class="icon-btn" data-action="verify" title="' + (e.verified ? 'Verified — click to unmark' : 'Mark as verified') + '" aria-pressed="' + e.verified + '">' +
            '<span class="memo-dot' + (e.verified ? ' on' : '') + '" style="' + (e.verified ? 'background:var(--statute);border-color:var(--statute)' : '') + '">✓</span></button>' +
          actionButtons(e) +
        '</div>' +
      '</div>' +
      '<div class="row-detail">' +
        fieldBlock(LABELS[e.type][0], e, 'facts') +
        fieldBlock(LABELS[e.type][1], e, 'ratio', 'field-ratio') +
        fieldBlock(LABELS[e.type][2], e, 'strategy') +
        commentsHTML(e) + '<div class="row-src">' + srsChip(e) + sourceLine(e) + '</div>' + relatedLine(e) + notesLine(e) +
        (e.tags.length ? '<div class="row-tags">' + tagsHTML(e) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  function openPeek(id) {
    var e = byId(id);
    if (!e) { toast('That card is no longer in your library.', { type: 'error' }); return; }
    $('#peekBody').innerHTML = cardHTML(e).replace('class="card entry', 'class="card entry revealed');
    openModal($('#peekModal'));
  }
