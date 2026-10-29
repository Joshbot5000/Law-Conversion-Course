  /* ------------------------------------------------------------------
     M. ADD / EDIT FORM
     ------------------------------------------------------------------ */
  function fillTopicSuggestions(moduleId) {
    var set = {};
    (TOPIC_SUGGESTIONS[moduleId] || []).forEach(function (t) { set[t] = true; });
    state.entries.forEach(function (e) { if (e.module === moduleId && e.topic) set[e.topic] = true; });
    $('#topicList').innerHTML = Object.keys(set).sort().map(function (t) { return '<option value="' + esc(t) + '">'; }).join('');
  }
  function fillSourceSelect(selected) {
    $('#fSource').innerHTML = '<option value="">No source</option>' + state.sources.map(function (s) {
      return '<option value="' + esc(s.id) + '">' + esc(s.title) + '</option>';
    }).join('');
    $('#fSource').value = selected && sourceById(selected) ? selected : '';
  }
  function openForm(id) {
    var e = id ? byId(id) : null;
    state.editingId = e ? e.id : null;
    $('#entryModalTitle').textContent = e ? 'Edit card' : 'Add a card';
    $('#saveEntryBtn').textContent = e ? 'Save changes' : 'Save card';
    $('#fModule').value = e ? e.module : (state.filter !== 'all' ? state.filter : 'contract');
    $('#fTopic').value = e ? e.topic : '';
    var defType = e ? e.type : (state.settings.typeFilter !== 'all' ? state.settings.typeFilter : 'case');
    (defType === 'statute' ? $('#fTypeStatute') : defType === 'principle' ? $('#fTypePrinciple') : $('#fTypeCase')).checked = true;
    $('#fName').value = e ? e.name : '';
    $('#fCitation').value = e ? e.citation : '';
    rtSet($('#fFacts'), e ? e.facts : '', e && e.fmt && e.fmt.facts);
    rtSet($('#fRatio'), e ? e.ratio : '', e && e.fmt && e.fmt.ratio);
    rtSet($('#fStrategy'), e ? e.strategy : '', e && e.fmt && e.fmt.strategy);
    $('#fTags').value = e ? e.tags.map(function (t) { return '#' + t; }).join(' ') : '';
    $('#fMemorised').checked = e ? e.memorised : false;
    $('#fVerified').checked = e ? e.verified : false;
    fillSourceSelect(e ? e.sourceId : '');
    $('#fSourceRef').value = e ? e.sourceRef : '';
    $('#fSourceQuote').value = e ? e.sourceQuote : '';
    $('#nameField').classList.remove('invalid');
    updateFormLabels();
    fillTopicSuggestions($('#fModule').value);
    openModal($('#entryModal'));
    setTimeout(function () { $('#fName').focus(); }, 30);
  }
  function updateFormLabels() {
    var t = $('#fTypeStatute').checked ? 'statute' : $('#fTypePrinciple').checked ? 'principle' : 'case';
    $('#lblFacts').textContent = LABELS[t][0];
    $('#lblRatio').textContent = LABELS[t][1];
    $('#lblStrategy').textContent = LABELS[t][2];
    $('#lblCitation').textContent = t === 'principle' ? 'Key authorities' : 'Citation';
    $('#hintFacts').textContent = t === 'case' ? '— what happened?' : t === 'statute' ? '— background / purpose' : '— a short example of the rule in action';
  }
  function readForm() {
    var facts = rtGet($('#fFacts')), ratio = rtGet($('#fRatio')), strategy = rtGet($('#fStrategy'));
    return {
      module: $('#fModule').value, topic: $('#fTopic').value,
      type: $('#fTypeStatute').checked ? 'statute' : $('#fTypePrinciple').checked ? 'principle' : 'case',
      name: $('#fName').value, citation: $('#fCitation').value,
      facts: facts.text, ratio: ratio.text, strategy: strategy.text, tags: $('#fTags').value,
      fmt: { facts: facts.html, ratio: ratio.html, strategy: strategy.html },
      memorised: $('#fMemorised').checked, verified: $('#fVerified').checked,
      sourceId: $('#fSource').value, sourceRef: $('#fSourceRef').value, sourceQuote: $('#fSourceQuote').value
    };
  }
  function submitForm(ev) {
    ev.preventDefault();
    var data = readForm();
    if (!data.name.trim()) { $('#nameField').classList.add('invalid'); $('#fName').focus(); return; }
    var existing = state.editingId ? byId(state.editingId) : null;
    var save = function () {
      var now = nowISO();
      data.id = existing ? existing.id : uid();
      data.createdAt = existing ? existing.createdAt : now;
      data.updatedAt = now;
      var clean = sanitizeEntry(data);
      if (!clean) { toast('Something went wrong. Please check the form.', { type: 'error' }); return; }
      if (existing && existing.fmt && !clean.fmt) clean.fmt = { facts: '', ratio: '', strategy: '' };
      if (existing) state.entries = state.entries.map(function (x) { return x.id === clean.id ? clean : x; });
      else state.entries.push(clean);
      closeModal($('#entryModal'));
      commit();
      if (!$('#peekModal').hidden) openPeekRefresh(clean.id);
      if (!$('#reviewModal').hidden) renderReview();
      if (!$('#verifyModal').hidden) renderVerify();
      if (!$('#dupModal').hidden) { dupState = { groups: findDuplicateGroups(), keep: {} }; renderDuplicates(); }
      toast(existing ? 'Changes saved.' : '“' + clean.name + '” added to ' + MODULE_LABEL[clean.module] + '.', { type: 'success' });
    };
    var key = data.name.trim().toLowerCase();
    var dup = state.entries.filter(function (x) { return x.id !== state.editingId && x.module === data.module && x.name.trim().toLowerCase() === key; })[0];
    if (dup) {
      dialog({
        title: 'Possible duplicate',
        message: '“' + dup.name + '” already exists in ' + MODULE_LABEL[dup.module] + '. Save another copy anyway?',
        buttons: [{ label: 'Go back', value: false }, { label: 'Save anyway', value: true, style: 'btn-primary' }]
      }).then(function (ok) { if (ok) save(); });
    } else save();
  }
  function openPeekRefresh(id) {
    var e = byId(id);
    if (e) $('#peekBody').innerHTML = cardHTML(e).replace('class="card entry', 'class="card entry revealed');
  }

  /* ------------------------------------------------------------------
     N. DELETE (with Undo), MEMORISED and VERIFIED TOGGLES
     ------------------------------------------------------------------ */
  function deleteEntry(id) {
    var idx = -1;
    state.entries.forEach(function (x, i) { if (x.id === id) idx = i; });
    if (idx === -1) return;
    var removed = state.entries[idx], prog = state.progress[id];
    state.entries.splice(idx, 1);
    delete state.progress[id];
    delete state.revealed[id]; delete state.expanded[id];
    if (!$('#peekModal').hidden) closeModal($('#peekModal'));
    commit();
    toast('Deleted “' + removed.name + '”.', {
      actionLabel: 'Undo', timeout: 8000,
      onAction: function () {
        if (byId(removed.id)) return;
        state.entries.splice(Math.min(idx, state.entries.length), 0, removed);
        if (prog) state.progress[removed.id] = prog;
        commit();
        toast('Restored.', { type: 'success' });
      }
    });
  }
  function toggleField(id, field) {
    var e = byId(id);
    if (!e) return;
    e[field] = !e[field];
    e.updatedAt = nowISO();
    commit();
    if (!$('#peekModal').hidden) openPeekRefresh(id);
  }

  /* ------------------------------------------------------------------
     O. EXPORT / IMPORT
     ------------------------------------------------------------------ */
  function exportDatabase() {
    toast('Preparing your backup…');
    Promise.all(state.sources.map(function (s) {
      return loadSourceText(s.id).then(function (t) { return Object.assign({}, s, { text: t }); }, function () { return null; });
    })).then(function (sources) {
      var payload = {
        app: 'Law Revision Repository', format: 'law-revision-backup', version: SCHEMA_VERSION, exportedAt: nowISO(),
        count: state.entries.length, entries: state.entries, progress: state.progress, stats: state.stats, prefs: state.prefs,
        sources: sources.filter(Boolean),
        notes: state.notes.filter(function (n) { return !n._draft; }).map(noteForStorage)
      };
      var json = JSON.stringify(payload, null, 1);
      var d = new Date();
      var filename = 'law-revision-backup-' + d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + '.json';
      if (claudeCaps.downloads) {
        claudeCaps.downloads.save({ filename: filename, data: json }).then(markBackedUp, function (err) {
          if (err && err.code === 'declined') toast('Backup not saved.');
          else toast('This view can\'t save files. Open the app in claude.ai in a web browser to export.', { type: 'error', timeout: 7000 });
        });
        return;
      }
      var url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      markBackedUp();
    });
  }
  function markBackedUp() {
    state.settings.lastBackup = nowISO();
    state.settings.changedSinceBackup = false;
    saveUI();
    renderBackupStatus();
    toast('Backup saved (' + cardsWord(state.entries.length) + ', ' + plural(state.sources.length, 'source') + ', ' + plural(state.notes.length, 'note') + '). Keep it somewhere safe.', { type: 'success', timeout: 6000 });
  }

  function handleImportFile(file) {
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) { toast('That file is too large to be a backup from this app.', { type: 'error' }); return; }
    var reader = new FileReader();
    reader.onerror = function () { toast('Could not read that file.', { type: 'error' }); };
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result).replace(/^﻿/, '')); }
      catch (e) { toast('That file is not a valid backup (.json) file.', { type: 'error', timeout: 6000 }); return; }
      var rawList = Array.isArray(data) ? data : (data && Array.isArray(data.entries) ? data.entries : null);
      if (!rawList) { toast('No cards were found in that file.', { type: 'error', timeout: 6000 }); return; }
      var clean = rawList.map(sanitizeEntry).filter(Boolean);
      var skipped = rawList.length - clean.length;
      if (!clean.length) { toast('None of the records in that file could be read.', { type: 'error', timeout: 6000 }); return; }
      var prog = {};
      if (data.progress && typeof data.progress === 'object') Object.keys(data.progress).forEach(function (id) { var p = sanitizeProgress(data.progress[id]); if (p) prog[id] = p; });
      var importedNotes = Array.isArray(data.notes) ? data.notes : null;
      var srcs = Array.isArray(data.sources) ? data.sources.filter(function (s) { return s && s.id && typeof s.text === 'string'; }) : [];
      dialog({
        title: 'Import ' + cardsWord(clean.length) + '?',
        message: 'Merge adds them to your library. A card you already have is updated only if the imported copy is newer.\n\n' +
          'Replace deletes your current ' + cardsWord(state.entries.length) + ' and their review history, and keeps only the imported ones.' +
          (srcs.length ? '\n\nThe file also has ' + plural(srcs.length, 'source') + '; any you don\'t have yet will be added.' : '') +
          (skipped ? '\n\n(' + plural(skipped, 'unreadable record') + ' will be skipped.)' : ''),
        buttons: [
          { label: 'Cancel', value: null },
          { label: 'Replace everything', value: 'replace', style: 'btn-danger' },
          { label: 'Merge', value: 'merge', style: 'btn-primary' }
        ]
      }).then(function (choice) {
        if (!choice) return;
        if (importedNotes) { var nn = importNotes(importedNotes, choice); if (nn) setTimeout(function () { toast(plural(nn, 'lecture note') + ' imported.', { type: 'success' }); }, 600); }
        var seen = {};
        clean.forEach(function (e) { if (seen[e.id]) e.id = uid(); seen[e.id] = true; });
        if (choice === 'replace') {
          var before = state.entries.slice(), beforeP = state.progress;
          state.entries = clean;
          state.progress = {};
          clean.forEach(function (e) { if (prog[e.id]) state.progress[e.id] = prog[e.id]; });
          state.revealed = {}; state.expanded = {};
          commit();
          toast('Library replaced with ' + clean.length + ' imported.', {
            type: 'success', timeout: 9000, actionLabel: 'Undo',
            onAction: function () { state.entries = before; state.progress = beforeP; commit(); toast('Import undone.'); }
          });
        } else {
          var index = {};
          state.entries.forEach(function (e, i) { index[e.id] = i; });
          var added = 0, updated = 0, unchanged = 0;
          clean.forEach(function (e) {
            if (index.hasOwnProperty(e.id)) {
              if (e.updatedAt > state.entries[index[e.id]].updatedAt) { state.entries[index[e.id]] = e; updated++; } else unchanged++;
            } else { state.entries.push(e); index[e.id] = state.entries.length - 1; added++; }
          });
          Object.keys(prog).forEach(function (id) {
            if (index.hasOwnProperty(id) && (!state.progress[id] || prog[id].last > state.progress[id].last)) state.progress[id] = prog[id];
          });
          if (data.stats && data.stats.days) Object.keys(data.stats.days).forEach(function (k) {
            var a = state.stats.days[k] || [0, 0, 0], b = data.stats.days[k];
            if (Array.isArray(b)) { state.stats.days[k] = [Math.max(a[0], num(b[0], 0)), Math.max(a[1], num(b[1], 0)), Math.max(a[2], num(b[2], 0))]; persistStats(k); }
          });
          commit();
          toast('Import complete: ' + added + ' added, ' + updated + ' updated, ' + unchanged + ' already up to date.', { type: 'success', timeout: 7000 });
        }
        var missing = srcs.filter(function (s) { return !sourceById(s.id); });
        if (missing.length) {
          var chain = Promise.resolve(), ok = 0;
          missing.forEach(function (s) {
            chain = chain.then(function () { return saveSource(s, s.text).then(function () { ok++; }, function () { /* reported by status */ }); });
          });
          chain.then(function () { renderAll(); if (ok) toast(plural(ok, 'source') + ' added from the backup.', { type: 'success' }); });
        }
      });
    };
    reader.readAsText(file);
  }

  /* ------------------------------------------------------------------
     P. REVIEW SESSION
     ------------------------------------------------------------------ */
  var rv = null;

  function openReview(opts) {
    opts = opts || {};
    var module = opts.module || state.filter, type = opts.type || 'all';
    $('#rvModule').innerHTML = '<option value="all">All modules</option>' + MODULES.map(function (m) { return '<option value="' + m.id + '">' + esc(m.label) + '</option>'; }).join('');
    $('#rvModule').value = module;
    $('#rvType').value = type;
    $('#rvDirection').value = state.settings.direction;
    $('#rvNewPerDay').value = String(state.prefs.newPerDay);
    if (!$('#rvNewPerDay').value) { var o = document.createElement('option'); o.textContent = state.prefs.newPerDay; $('#rvNewPerDay').appendChild(o); $('#rvNewPerDay').value = String(state.prefs.newPerDay); }
    rv = { module: module, type: type, drill: opts.drillIds || null, label: opts.label || '', queue: [], done: 0, again: 0, learned: 0, dirFor: {}, revealed: false, changed: false };
    buildReviewQueue();
    $('#reviewTitle').textContent = rv.drill ? (rv.label || 'Practice') : 'Review';
    openModal($('#reviewModal'));
    renderReview();
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function buildReviewQueue() {
    if (rv.drill) { rv.queue = shuffle(rv.drill.filter(function (id) { return byId(id); }).slice()); return; }
    var due = dueCards(rv.module, rv.type).map(function (e) { return e.id; });
    var fresh = newCards(rv.module, rv.type).slice(0, newRemaining()).map(function (e) { return e.id; });
    var q = [], i = 0, j = 0;
    while (i < due.length || j < fresh.length) {
      for (var k = 0; k < 3 && i < due.length; k++) q.push(due[i++]);
      if (j < fresh.length) q.push(fresh[j++]);
    }
    rv.queue = q;
  }
  function maskNames(text, e) {
    var out = String(text);
    var parts = e.name.split(/\s+v\.?\s+|\s*[,;()]\s*|\s+and\s+/i).map(function (s) { return s.replace(/\b(Ltd|plc|Co|Inc|Council|Ltd\.)\b/gi, '').trim(); })
      .filter(function (s) { return s.length > 3; });
    parts.concat([e.name]).forEach(function (p) { out = out.replace(new RegExp(regexEscape(p), 'gi'), '▢▢▢'); });
    return out;
  }
  function frontFor(e) {
    var dir = state.settings.direction;
    if (dir === 'mixed') { if (!rv.dirFor[e.id]) rv.dirFor[e.id] = Math.random() < 0.5 ? 'name' : 'rule'; dir = rv.dirFor[e.id]; }
    if (dir === 'rule' && !e.ratio) dir = 'name';
    return dir;
  }
  var PROMPTS = {
    case: 'Recall the material facts, the ratio, and how you would use it in an answer.',
    statute: 'Recall what the provision says, when it applies and how you would use it.',
    principle: 'State the rule, its key authorities, and how you would apply it.'
  };
  function renderReview() {
    if (!rv) return;
    var body = $('#reviewBody');
    var total = rv.done + rv.queue.length;
    if (!rv.queue.length) { renderReviewDone(); return; }
    var e = byId(rv.queue[0]);
    if (!e) { rv.queue.shift(); renderReview(); return; }
    var p = state.progress[e.id], isNew = !p;
    var dueLeft = rv.queue.filter(function (id) { return state.progress[id]; }).length;
    var newLeft = rv.queue.length - dueLeft;
    var dir = frontFor(e);
    var front;
    if (dir === 'rule') {
      front = '<div class="card-meta">' + typeBadge(e) + (e.key ? '<span class="chip chip-key">★ Key authority</span>' : '') + '<span class="chip">' + esc(MODULE_LABEL[e.module]) + '</span>' + (e.topic ? '<span class="chip">' + esc(e.topic) + '</span>' : '') + (isNew ? '<span class="chip srs-new">New</span>' : '') + '</div>' +
        '<div class="field-label" style="margin-top:12px">' + esc(LABELS[e.type][1]) + '</div>' +
        '<p class="rv-rule">' + esc(maskNames(e.ratio, e)) + '</p>' +
        '<p class="rv-prompt">' + (e.type === 'principle' ? 'Name this principle and its key authorities.' : 'Which ' + (e.type === 'statute' ? 'provision' : 'case') + ' is this? Recall its facts too.') + '</p>';
    } else {
      front = '<div class="card-meta">' + typeBadge(e) + (e.key ? '<span class="chip chip-key">★ Key authority</span>' : '') + '<span class="chip">' + esc(MODULE_LABEL[e.module]) + '</span>' + (e.topic ? '<span class="chip">' + esc(e.topic) + '</span>' : '') + (isNew ? '<span class="chip srs-new">New</span>' : '') + '</div>' +
        '<h3 class="rv-title">' + esc(e.name) + '</h3>' +
        (e.citation && e.type !== 'principle' ? '<div class="card-citation">' + esc(e.citation) + '</div>' : '') +
        '<p class="rv-prompt">' + PROMPTS[e.type] + '</p>';
    }
    var answer = '';
    if (rv.revealed) {
      var yours = $('#rvRecall') ? $('#rvRecall').value : rv.recall || '';
      rv.recall = yours;
      answer = '<div class="rv-answer">' +
        (dir === 'rule' ? '<div><div class="field-label">Answer</div><h3 class="rv-title" style="font-size:21px;margin:2px 0 0">' + esc(e.name) + '</h3>' + (e.citation ? '<div class="card-citation">' + esc(e.citation) + '</div>' : '') + '</div>' : '') +
        (e.type === 'principle' && dir !== 'rule' && e.citation ? '<div><div class="field-label">Key authorities</div><div class="field-text">' + esc(e.citation.replace(/^Key authorities:\s*/i, '')) + '</div></div>' : '') +
        (e.facts ? '<div><div class="field-label">' + LABELS[e.type][0] + '</div><div class="field-text">' + (richFieldHTML(e, 'facts') || esc(e.facts)) + '</div></div>' : '') +
        (dir !== 'rule' && e.ratio ? '<div class="field-ratio"><div class="field-label">' + LABELS[e.type][1] + '</div><div class="field-text">' + (richFieldHTML(e, 'ratio') || esc(e.ratio)) + '</div></div>' : '') +
        (e.strategy ? '<div><div class="field-label">' + LABELS[e.type][2] + '</div><div class="field-text">' + (richFieldHTML(e, 'strategy') || esc(e.strategy)) + '</div></div>' : '') +
        (e.comments.length ? '<div><div class="field-label">💬 My comments</div>' + e.comments.map(function (c) { return '<div class="field-text">' + esc(c.text) + '</div>'; }).join('') + '</div>' : '') +
        (sourceLabel(e) ? sourceLine(e).replace('class="source-line"', 'class="source-line" style="padding:0"') : '') +
        (yours.trim() ? '<div><div class="field-label">What you wrote</div><div class="rv-yours">' + esc(yours) + '</div>' +
          (claudeCaps.sample ? '<div style="margin-top:8px"><button type="button" class="btn btn-sm btn-ask" id="rvCheck">✦ Check my recall against the card</button></div><div id="rvFeedback"></div>' : '') + '</div>' : '') +
        '</div>' +
        '<div class="rate-row" role="group" aria-label="How well did you remember it?">' +
        [[1, 'again', 'Again'], [2, 'hard', 'Hard'], [3, 'good', 'Good'], [4, 'easy', 'Easy']].map(function (r) {
          return '<button type="button" class="rate-btn ' + r[1] + '" data-rate="' + r[0] + '">' + r[2] + '<small>' + fmtIvl(schedule(p, r[0])) + '</small><kbd>' + r[0] + '</kbd></button>';
        }).join('') + '</div>';
    }
    body.innerHTML =
      '<div class="review-progress"><div class="bar"><i style="width:' + Math.round(rv.done / Math.max(1, total) * 100) + '%"></i></div>' +
      '<div class="review-counts">' + (rv.drill ? '<span><b>' + rv.queue.length + '</b> left</span>' : '<span><b class="d">' + dueLeft + '</b> due</span><span><b class="n">' + newLeft + '</b> new</span>') + '<span>' + rv.done + ' done</span></div></div>' +
      '<div class="review-card entry type-' + e.type + '" data-id="' + esc(e.id) + '">' + front +
      (!rv.revealed ? '<div class="rv-recall"><label class="sr-only" for="rvRecall">What you remember</label><textarea id="rvRecall" placeholder="Type what you remember (optional), or just say it in your head">' + esc(rv.recall || '') + '</textarea></div>' +
        '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button type="button" class="btn btn-review" id="rvShow">Show answer</button></div>' : answer) +
      '<div class="rv-tools"><button type="button" class="btn btn-sm btn-ask" data-rv="ask">? Ask about this</button><button type="button" class="btn btn-sm" data-rv="edit">Edit card</button>' +
      '<button type="button" class="btn btn-sm" data-rv="verify">' + (e.verified ? '✓ Verified' : 'Mark verified') + '</button>' +
      (rv.revealed ? '' : '<button type="button" class="btn btn-sm btn-ghost" data-rv="skip">Skip for now</button>') + '</div>' +
      '</div>';
  }
  function revealReview() {
    if (!rv || rv.revealed || !rv.queue.length) return;
    rv.recall = $('#rvRecall') ? $('#rvRecall').value : '';
    rv.revealed = true;
    renderReview();
    var first = $('#reviewBody .rate-btn.good');
    if (first) first.focus();
  }
  function rateCurrent(grade) {
    if (!rv || !rv.revealed || !rv.queue.length) return;
    var id = rv.queue.shift(), p = state.progress[id], now = Date.now();
    var wasNew = !p, wasDue = p && p.due <= now;
    // Practice sessions only move cards that were due/new, or that you forgot.
    if (!rv.drill || wasNew || wasDue || grade === 1) {
      state.progress[id] = schedule(p, grade, now);
      bumpStats(wasNew, grade);
      rv.changed = true;
      persist();
    }
    rv.done++;
    if (grade === 1) { rv.again++; rv.queue.splice(Math.min(3, rv.queue.length), 0, id); }
    else if (wasNew) rv.learned++;
    rv.revealed = false; rv.recall = '';
    renderReview();
    renderControls();
  }
  function renderReviewDone() {
    var body = $('#reviewBody');
    var tomorrow = 0, sod = startOfDay() + DAY;
    state.entries.forEach(function (e) { var p = state.progress[e.id]; if (p && inScope(e, rv.module, rv.type) && p.due >= sod && p.due < sod + DAY) tomorrow++; });
    var moreNew = newCards(rv.module, rv.type).length;
    var acc = rv.done ? Math.round((1 - rv.again / rv.done) * 100) : null;
    var weak = weakTopics(rv.module, 1)[0];
    body.innerHTML = '<div class="rv-done">' +
      (rv.done ? '<h3>Session complete</h3><p class="muted">Nice work. Little and often beats long sessions.</p>' : '<h3>Nothing due here</h3><p class="muted">You\'re all caught up for this selection.</p>') +
      '<div class="due-figures"><div><b>' + rv.done + '</b><span>reviewed</span></div><div class="new"><b>' + rv.learned + '</b><span>new learned</span></div>' +
      (acc != null ? '<div class="due"><b>' + acc + '%</b><span>remembered first time</span></div>' : '') + '<div><b>' + tomorrow + '</b><span>due tomorrow</span></div></div>' +
      '<div class="today-actions" style="justify-content:center">' +
      (moreNew && !rv.drill ? '<button type="button" class="btn" data-rv="more">Learn 10 more new</button>' : '') +
      (weak ? '<button type="button" class="btn" data-rv="weak">Drill weakest topic: ' + esc(weak.topic) + '</button>' : '') +
      '<button type="button" class="btn btn-primary" data-close>Done</button></div></div>';
    body._weak = weak;
  }
  function reviewTool(action) {
    var e = rv && rv.queue.length ? byId(rv.queue[0]) : null;
    if (action === 'ask' && e) openAsk(e.id);
    else if (action === 'edit' && e) openForm(e.id);
    else if (action === 'verify' && e) { toggleField(e.id, 'verified'); renderReview(); }
    else if (action === 'skip' && e) { rv.queue.push(rv.queue.shift()); rv.recall = ''; renderReview(); }
    else if (action === 'more') {
      var x = state.settings.extraNew;
      state.settings.extraNew = { day: dayKey(), n: (x && x.day === dayKey() ? x.n : 0) + 10 };
      saveUI();
      rv.drill = null;
      buildReviewQueue();
      renderReview();
    } else if (action === 'weak') {
      var w = $('#reviewBody')._weak;
      if (w) openReview({ module: w.module, drillIds: w.ids, label: 'Drill: ' + w.topic });
    }
  }
  function checkRecall() {
    var e = rv && rv.queue.length ? byId(rv.queue[0]) : null;
    var out = $('#rvFeedback'), btn = $('#rvCheck');
    if (!e || !out || !claudeCaps.sample) return;
    btn.disabled = true;
    out.innerHTML = '<div class="rv-feedback ask-text thinking" style="margin-top:8px">Comparing with the card…</div>';
    var box = out.firstChild;
    var prompt = 'You are checking a law student\'s recall against their own revision card. Judge ONLY against the card; do not add any law that is not on it.\n\n' +
      'CARD\n' + entryNotes(e) + '\n\nSTUDENT\'S RECALL\n' + rv.recall + '\n\n' +
      'Reply in 2-4 short "- " bullets: what they got right, and what they missed or got wrong compared with the card. ' +
      'Then one final line: "Suggested rating: Again / Hard / Good / Easy" (pick one). UK spelling. No headings.';
    claudeCaps.sample(prompt, { modelTier: 'quick', cache: false, onText: function (u) { box.classList.remove('thinking'); box.innerHTML = formatAnswer(u.text); } })
      .then(function (r) { box.classList.remove('thinking'); box.innerHTML = formatAnswer(r.text); }, function (err) {
        box.classList.remove('thinking');
        box.textContent = sampleErrorText(err);
        if (err && (err.code === 'not_granted' || err.code === 'sampling_disabled')) claudeCaps.sample = null;
      });
  }
