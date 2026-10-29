  /* ------------------------------------------------------------------
     V. EVENTS
     ------------------------------------------------------------------ */
  function closeSidebar() { document.body.classList.remove('sidebar-open'); }
  function setFab(open) { $('#fabMenu').hidden = !open; $('#fab').setAttribute('aria-expanded', String(open)); }

  function handleEntryClick(ev) {
    var actionEl = ev.target.closest('[data-action]');
    var entryEl = ev.target.closest('.entry');
    var id = entryEl ? entryEl.getAttribute('data-id') : null;
    if (actionEl) {
      var action = actionEl.getAttribute('data-action');
      ev.stopPropagation();
      if (action === 'edit') openForm(id);
      else if (action === 'ask') openAsk(id);
      else if (action === 'delete') deleteEntry(id);
      else if (action === 'memorise') toggleField(id, 'memorised');
      else if (action === 'verify') toggleField(id, 'verified');
      else if (action === 'source') openEntrySource(id);
      else if (action === 'related') openPeek(actionEl.getAttribute('data-rel'));
      else if (action === 'key') toggleField(id, 'key');
      else if (action === 'comment') addCommentTo(id);
      else if (action === 'del-comment') deleteComment(id, actionEl.getAttribute('data-cid'));
      else if (action === 'notes-for') openLectureNotes({ forEntry: id });
      else if (action === 'add') openForm(null);
      else if (action === 'add-notes') openNotes();
      else if (action === 'import') { $('#importFile').value = ''; $('#importFile').click(); }
      else if (action === 'more') { $('#entries')._limit = ($('#entries')._limit || 300) + 300; renderEntries(); }
      else if (action === 'clear-search') $('#clearSearch').click();
      else if (action === 'show-all') { state.filter = 'all'; renderAll(); }
      else if (action === 'show-all-types') { state.settings.typeFilter = 'all'; saveUI(); renderAll(); }
      else if (action === 'show-all-status') { state.settings.statusFilter = 'all'; saveUI(); renderAll(); }
      else if (action === 'tag') {
        var tag = '#' + actionEl.getAttribute('data-tag');
        if (!$('#peekModal').hidden) closeModal($('#peekModal'));
        $('#searchInput').value = tag; state.query = tag;
        renderAll();
      }
      return;
    }
    if (!entryEl || entryEl.closest('#peekBody')) return;
    if (window.getSelection && String(window.getSelection()).length > 0) return;
    if (state.settings.view === 'list') {
      if (!ev.target.closest('.row-main')) return;
      var willExpand = !state.expanded[id];
      if (willExpand) state.expanded[id] = true; else delete state.expanded[id];
      if (state.settings.cram) { if (willExpand) state.revealed[id] = true; else delete state.revealed[id]; }
      entryEl.classList.toggle('expanded', willExpand);
      entryEl.classList.toggle('revealed', !!state.revealed[id]);
    } else if (state.settings.cram) {
      if (state.revealed[id]) delete state.revealed[id]; else state.revealed[id] = true;
      entryEl.classList.toggle('revealed', !!state.revealed[id]);
    }
  }

  function bindEvents() {
    $('#moduleNav').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-filter]');
      if (!b) return;
      state.filter = b.getAttribute('data-filter');
      $('#entries')._limit = 0;
      renderAll();
      closeSidebar();
    });
    $('#typeNav').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-type]');
      if (!b) return;
      state.settings.typeFilter = b.getAttribute('data-type');
      $('#entries')._limit = 0;
      saveUI(); renderAll(); closeSidebar();
    });
    var searchTimer;
    $('#searchInput').addEventListener('input', function (ev) {
      clearTimeout(searchTimer);
      var v = ev.target.value;
      searchTimer = setTimeout(function () { state.query = v.trim(); $('#entries')._limit = 0; renderControls(); renderToday(); renderEntries(); }, 120);
    });
    $('#clearSearch').addEventListener('click', function () { $('#searchInput').value = ''; state.query = ''; renderAll(); $('#searchInput').focus(); });
    $('#viewCardBtn').addEventListener('click', function () { state.settings.view = 'card'; saveUI(); renderControls(); renderEntries(); });
    $('#viewListBtn').addEventListener('click', function () { state.settings.view = 'list'; saveUI(); renderControls(); renderEntries(); });
    $('#cramToggle').addEventListener('change', function (ev) {
      state.settings.cram = ev.target.checked; state.revealed = {};
      saveUI(); renderControls(); renderEntries();
      toast(state.settings.cram ? 'Cram Mode on: answers hidden. Click a card to reveal it.' : 'Cram Mode off: all answers visible.');
    });
    $('#sortSelect').addEventListener('change', function (ev) { state.settings.sort = ev.target.value; saveUI(); renderEntries(); });
    $('#statusSelect').addEventListener('change', function (ev) { state.settings.statusFilter = ev.target.value; $('#entries')._limit = 0; saveUI(); renderEntries(); });

    $('#entries').addEventListener('click', handleEntryClick);
    $('#peekBody').addEventListener('click', handleEntryClick);
    $('#today').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-today]');
      if (!b) return;
      var a = b.getAttribute('data-today');
      if (a === 'start') openReview({ module: state.filter });
      else if (a === 'practise') {
        var ids = shuffle(state.entries.filter(function (e) { return state.filter === 'all' || e.module === state.filter; }).map(function (e) { return e.id; })).slice(0, 20);
        openReview({ module: state.filter, drillIds: ids, label: 'Practice: 20 random cards' });
      } else if (a === 'more') {
        var x = state.settings.extraNew;
        state.settings.extraNew = { day: dayKey(), n: (x && x.day === dayKey() ? x.n : 0) + 10 };
        saveUI(); openReview({ module: state.filter });
      } else if (a === 'drill') {
        var w = ($('#today')._weak || [])[+b.getAttribute('data-i')];
        if (w) openReview({ module: w.module, drillIds: w.ids, label: 'Drill: ' + w.topic });
      } else if (a === 'plan') openPlan();
      else if (a === 'verifyq') openVerify(state.filter);
      else if (a === 'unverified') { state.settings.statusFilter = 'unverified'; saveUI(); renderAll(); $('#entries').scrollIntoView({ behavior: 'smooth' }); }
    });

    // Add
    $('#fab').addEventListener('click', function (ev) { ev.stopPropagation(); setFab($('#fabMenu').hidden); });
    $('#fabAddCard').addEventListener('click', function () { setFab(false); openForm(null); });
    $('#fabAddNotes').addEventListener('click', function () { setFab(false); openNotes(); });
    document.addEventListener('click', function (ev) { if (!$('#fabMenu').hidden && !ev.target.closest('.fab-wrap')) setFab(false); });
    $('#entryForm').addEventListener('submit', submitForm);
    $('#fName').addEventListener('input', function () { $('#nameField').classList.remove('invalid'); });
    $('#fModule').addEventListener('change', function (ev) { fillTopicSuggestions(ev.target.value); });
    document.querySelectorAll('input[name=fType]').forEach(function (r) { r.addEventListener('change', updateFormLabels); });

    // Data
    $('#exportBtn').addEventListener('click', exportDatabase);
    $('#importBtn').addEventListener('click', function () { $('#importFile').value = ''; $('#importFile').click(); });
    $('#importFile').addEventListener('change', function (ev) { handleImportFile(ev.target.files && ev.target.files[0]); });

    // Sources and notes
    $('#sourcesBtn').addEventListener('click', function () { closeSidebar(); openSources(); });
    $('#verifyBtn').addEventListener('click', function () { closeSidebar(); openVerify(state.filter); });
    $('#dupBtn').addEventListener('click', function () { closeSidebar(); openDuplicates(); });
    $('#planBtn').addEventListener('click', function () { closeSidebar(); openPlan(); });
    $('#planBody').addEventListener('change', planChange);
    $('#vqModule').addEventListener('change', function (ev) { vq.module = ev.target.value; buildVerifyQueue(); renderVerify(); });
    $('#verifyModal').addEventListener('click', function (ev) { var b = ev.target.closest('[data-vq]'); if (b) verifyAction(b.getAttribute('data-vq')); });
    $('#verifyModal')._onClose = function () { vq = null; renderAll(); };
    $('#dupBody').addEventListener('click', dupClick);
    bindNotes();
    bindRichText();
    $('#entryForm').addEventListener('click', function (ev) { var l = ev.target.closest('[data-focus]'); if (l) $('#' + l.getAttribute('data-focus')).focus(); });
    $('#fabQuickNote').addEventListener('click', function () { setFab(false); openLectureNotes({ newNote: true }); });
    $('#commentSave').addEventListener('click', saveComment);
    $('#commentText').addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); saveComment(); } });
    $('#addNotesSideBtn').addEventListener('click', function () { closeSidebar(); openNotes(); });
    $('#addNotesFromSources').addEventListener('click', function () { closeModal($('#sourcesModal')); openNotes(); });
    $('#sourceList').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-src]'); if (!b) return;
      sourceAction(b.closest('[data-sid]').getAttribute('data-sid'), b.getAttribute('data-src'));
    });
    var vTimer;
    $('#viewerSearch').addEventListener('input', function (ev) { clearTimeout(vTimer); var v = ev.target.value.trim(); vTimer = setTimeout(function () { viewerSearch(v); }, 200); });
    $('#viewerSearch').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); viewerStep(ev.shiftKey ? -1 : 1); } });
    $('#viewerPrev').addEventListener('click', function () { viewerStep(-1); });
    $('#viewerNext').addEventListener('click', function () { viewerStep(1); });
    $('#notesModal').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-nt]');
      if (b) { notesAction(b.getAttribute('data-nt')); return; }
      var c = ev.target.closest('[data-pon]');
      if (c) { nt.proposals[+c.getAttribute('data-pon')].on = c.checked; renderProposals(); return; }
      var o = ev.target.closest('[data-popen]');
      if (o) { var p = nt.proposals[+o.getAttribute('data-popen')]; p.open = !p.open; renderProposals(); }
    });
    $('#notesModal')._onClose = function () {
      if (nt && nt.running && nt.ctl) { nt.ctl.abort(); toast('Drafting stopped. Your source is saved; reopen Add notes to review what was drafted.'); }
    };

    // Review
    $('#reviewBtn').addEventListener('click', function () { openReview({ module: state.filter }); });
    $('#reviewBody').addEventListener('click', function (ev) {
      if (ev.target.closest('#rvShow')) return revealReview();
      if (ev.target.closest('#rvCheck')) return checkRecall();
      var r = ev.target.closest('[data-rate]');
      if (r) return rateCurrent(+r.getAttribute('data-rate'));
      var t = ev.target.closest('[data-rv]');
      if (t) return reviewTool(t.getAttribute('data-rv'));
      var s = ev.target.closest('[data-action="source"]');
      if (s) { var card = s.closest('[data-id]'); if (card) openEntrySource(card.getAttribute('data-id')); }
    });
    ['#rvModule', '#rvType'].forEach(function (sel) {
      $(sel).addEventListener('change', function () { rv.module = $('#rvModule').value; rv.type = $('#rvType').value; rv.drill = null; rv.revealed = false; buildReviewQueue(); $('#reviewTitle').textContent = 'Review'; renderReview(); });
    });
    $('#rvDirection').addEventListener('change', function (ev) { state.settings.direction = ev.target.value; saveUI(); rv.dirFor = {}; renderReview(); });
    $('#rvNewPerDay').addEventListener('change', function (ev) {
      state.prefs.newPerDay = +ev.target.value; persistPrefs();
      if (!rv.drill) { buildReviewQueue(); renderReview(); }
      renderControls();
    });
    $('#reviewModal')._onClose = function () { rv = null; renderAll(); };

    // Ask
    $('#askBtn').addEventListener('click', function () { openAsk(null); });
    $('#askSendBtn').addEventListener('click', function () { sendAsk($('#askInput').value); });
    $('#askStopBtn').addEventListener('click', stopAsk);
    $('#askClearBtn').addEventListener('click', function () { resetAsk(); $('#askInput').value = ''; $('#askInput').focus(); });
    $('#askPresets').addEventListener('click', function (ev) { var b = ev.target.closest('[data-preset]'); if (b) sendAsk(ASK_PRESETS[+b.getAttribute('data-preset')].q); });
    $('#askInput').addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); sendAsk($('#askInput').value); } });
    document.querySelectorAll('input[name=askMode]').forEach(function (r) {
      r.addEventListener('change', function () { state.settings.askMode = $('#askModeNotes').checked ? 'notes' : 'open'; saveUI(); refreshAskMode(); });
    });
    $('#askThread').addEventListener('click', function (ev) { var c = ev.target.closest('[data-cite]'); if (c) openCite(c.getAttribute('data-cite')); });

    // Quiz
    $('#quizBtn').addEventListener('click', openQuiz);
    $('#quizModal').addEventListener('click', function (ev) {
      var a = ev.target.closest('[data-qz]'); if (a) return quizAction(a.getAttribute('data-qz'));
      var o = ev.target.closest('[data-opt]'); if (o) return answerQuiz(+o.getAttribute('data-opt'));
      var p = ev.target.closest('[data-peek]'); if (p) return openPeek(p.getAttribute('data-peek'));
    });
    $('#quizModal').addEventListener('change', function (ev) {
      quizChange(ev);
    });

    // Mock exam
    $('#mockBtn').addEventListener('click', openMock);
    $('#newScenarioBtn').addEventListener('click', newScenario);
    $('#aiScenarioBtn').addEventListener('click', aiScenario);
    $('#mockModule').addEventListener('change', function (ev) { state.settings.mock.module = ev.target.value; saveUI(); newScenario(); });
    $('#libraryList').addEventListener('click', function (ev) { var p = ev.target.closest('[data-peek]'); if (p) openPeek(p.getAttribute('data-peek')); });
    var draftTimer;
    $('#mockAnswer').addEventListener('input', function () {
      updateWordCount();
      clearTimeout(draftTimer);
      draftTimer = setTimeout(function () { state.settings.mock.answer = $('#mockAnswer').value; saveUI(); }, 400);
    });
    $('#iracTemplateBtn').addEventListener('click', function () {
      var ta = $('#mockAnswer');
      var tpl = 'ISSUE:\n\n\nRULE:\n\n\nAPPLICATION:\n\n\nCONCLUSION:\n\n';
      ta.value = ta.value.trim() ? ta.value.replace(/\s*$/, '') + '\n\n' + tpl : tpl;
      ta.dispatchEvent(new Event('input'));
      ta.focus();
      var at = ta.value.lastIndexOf('ISSUE:') + 7;
      ta.setSelectionRange(at, at);
    });
    $('#gradeBtn').addEventListener('click', gradeAnswer);
    $('#mockModal')._onClose = function () { state.settings.mock.answer = $('#mockAnswer').value; saveUI(); };

    // Closing modals: ✕ / Cancel buttons and the dark backdrop
    document.querySelectorAll('.modal').forEach(function (m) {
      m.addEventListener('click', function (ev) {
        if (ev.target === m || ev.target.closest('[data-close]')) closeModal(m, true);
      });
    });

    // Mobile sidebar
    $('#menuBtn').addEventListener('click', function () { document.body.classList.add('sidebar-open'); });
    $('#scrim').addEventListener('click', closeSidebar);

    // Keyboard: "/" search, R review, Esc close, Ctrl/Cmd+Enter save; review keys
    document.addEventListener('keydown', function (ev) {
      var tag = (ev.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || ev.target.isContentEditable;
      var top = topModal();
      if (ev.key === 'Escape') {
        if (!$('#fabMenu').hidden) { setFab(false); return; }
        if (top) { closeModal(top, true); ev.preventDefault(); }
        else if (document.body.classList.contains('sidebar-open')) closeSidebar();
        else if (ev.target === $('#searchInput') && state.query) $('#clearSearch').click();
        return;
      }
      if (top && top.id === 'reviewModal' && rv && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        if (typing && ev.target.id === 'rvRecall') { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) revealReview(); return; }
        if (typing) return;
        if ((ev.key === ' ' || ev.key === 'Enter') && !rv.revealed) { ev.preventDefault(); revealReview(); return; }
        if (/^[1-4]$/.test(ev.key) && rv.revealed) { ev.preventDefault(); rateCurrent(+ev.key); return; }
        if (ev.key === 'a' || ev.key === 'A') { ev.preventDefault(); reviewTool('ask'); return; }
        if (ev.key === 'e' || ev.key === 'E') { ev.preventDefault(); reviewTool('edit'); return; }
        return;
      }
      if (top && top.id === 'verifyModal' && vq && !typing && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        var k = ev.key.toLowerCase();
        var map = { v: 'ok', e: 'edit', s: 'skip', arrowright: 'skip', arrowleft: 'back', o: 'source' };
        if (map[k]) { ev.preventDefault(); verifyAction(map[k]); }
        return;
      }
      if (top && top.id === 'reviewModal' && rv && ev.target.id === 'rvRecall' && ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); revealReview(); return; }
      if (top && top.id === 'quizModal' && qz && qz.step === 'play' && !typing && /^[1-5a-eA-E]$/.test(ev.key)) {
        var i = /[1-5]/.test(ev.key) ? +ev.key - 1 : 'abcde'.indexOf(ev.key.toLowerCase());
        answerQuiz(i); return;
      }
      if (top && top.id === 'quizModal' && qz && qz.step === 'play' && !typing && ev.key === 'Enter' && qz.answers[qz.idx] != null) { ev.preventDefault(); quizAction('next'); return; }
      if (!top && !typing && ev.key === '/') { ev.preventDefault(); $('#searchInput').focus(); $('#searchInput').select(); }
      if (!top && !typing && (ev.key === 'r' || ev.key === 'R') && !ev.metaKey && !ev.ctrlKey) { ev.preventDefault(); openReview({ module: state.filter }); }
      if (!top && !typing && (ev.key === 'n' || ev.key === 'N') && !ev.metaKey && !ev.ctrlKey && !ev.altKey) { ev.preventDefault(); openLectureNotes({}); }
      if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey) && top && top.id === 'entryModal') {
        ev.preventDefault();
        if ($('#entryForm').requestSubmit) $('#entryForm').requestSubmit(); else submitForm(ev);
      }
    });

    // Offline copy: keep several open tabs in step.
    window.addEventListener('storage', function (ev) {
      if (store.mode !== 'local' || ev.key !== STORAGE_KEY || !ev.newValue) return;
      try {
        var data = JSON.parse(ev.newValue);
        state.entries = (data.entries || []).map(sanitizeEntry).filter(Boolean);
        state.progress = {};
        Object.keys(data.progress || {}).forEach(function (id) { var p = sanitizeProgress(data.progress[id]); if (p) state.progress[id] = p; });
        if (data.stats && data.stats.days) state.stats = { days: data.stats.days };
        renderAll();
      } catch (e) { /* ignore */ }
    });
  }

  /* ------------------------------------------------------------------
     W. START THE APP
     ------------------------------------------------------------------ */
  function init() {
    $('#fModule').innerHTML = MODULES.map(function (m) { return '<option value="' + m.id + '">' + esc(m.label) + '</option>'; }).join('');
    loadUI();
    bindEvents();
    renderAll();
    if (window.claude && typeof window.claude.use === 'function') {
      window.claude.use('sample').then(function (fn) { claudeCaps.sample = fn || null; if (!$('#askModal').hidden) refreshAskMode(); }, function () {});
      window.claude.use('downloads').then(function (d) { claudeCaps.downloads = d || null; }, function () {});
    }
    initStorage();
  }

  init();
})();
