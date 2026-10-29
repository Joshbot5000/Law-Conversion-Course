  /* ------------------------------------------------------------------
     Q. SOURCES: list, viewer, page numbers
     Page breaks inside a source's text are form feeds (\f), so the page
     of any passage is "number of \f before it + 1".
     ------------------------------------------------------------------ */
  function pageAt(text, pos) {
    var n = 1;
    for (var i = text.indexOf('\f'); i !== -1 && i < pos; i = text.indexOf('\f', i + 1)) n++;
    return n;
  }
  // Find a quote in the raw text even if spacing, line breaks or quote marks differ.
  function findQuote(text, quote) {
    if (!quote) return null;
    var words = normText(quote).replace(/["'.,;:!?()[\]]/g, ' ').split(/\s+/).filter(function (w) { return /[a-z0-9]/.test(w); });
    if (!words.length) return null;
    var tryLen = [Math.min(words.length, 14), Math.min(words.length, 8), Math.min(words.length, 5)];
    for (var t = 0; t < tryLen.length; t++) {
      var n = tryLen[t];
      if (n < 4 && words.length >= 4) continue;
      var pattern = words.slice(0, n).map(function (w) {
        return w.split('').map(function (ch) { return /[a-z0-9]/.test(ch) ? regexEscape(ch) : '\\W?'; }).join('(?:-\\s*)?');
      }).join('[\\W_]+');
      try {
        var m = new RegExp(pattern, 'i').exec(text);
        if (m) return { start: m.index, end: m.index + m[0].length, exact: n === words.length || n >= 14 };
      } catch (e) { /* ignore bad pattern */ }
    }
    return null;
  }
  function sourceKindLabel(s) { return s.kind === 'pdf' ? 'PDF' : s.kind === 'docx' ? 'Word' : 'Text'; }

  function openSources() {
    renderSourceList();
    openModal($('#sourcesModal'));
  }
  function renderSourceList() {
    var box = $('#sourceList');
    if (!state.sources.length) {
      box.innerHTML = '<div class="empty" style="padding:30px 16px"><h3>No sources yet</h3><p>Add a textbook chapter, lecture notes or a revision sheet. It\'s kept with your library, and "Ask" can answer from it.</p></div>';
      return;
    }
    var linked = {};
    state.entries.forEach(function (e) { if (e.sourceId) linked[e.sourceId] = (linked[e.sourceId] || 0) + 1; });
    box.innerHTML = state.sources.map(function (s) {
      return '<div class="src-item" data-sid="' + esc(s.id) + '"><div><b>' + esc(s.title) + '</b><span>' +
        (s.module ? esc(MODULE_LABEL[s.module]) + ' · ' : '') + sourceKindLabel(s) + (s.pages ? ' · ' + plural(s.pages, 'page') : '') +
        ' · ' + Math.max(1, Math.round(s.chars / 6000)) + 'k words · ' + cardsWord(linked[s.id] || 0) + ' linked</span></div>' +
        '<div class="src-tools"><button type="button" class="btn btn-sm" data-src="view">Read</button>' +
        '<button type="button" class="btn btn-sm btn-ask" data-src="draft"' + (claudeCaps.sample ? '' : ' disabled title="Open the app in claude.ai to draft cards"') + '>✦ Draft cards</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-src="delete" aria-label="Delete ' + esc(s.title) + '">Delete</button></div></div>';
    }).join('');
  }
  function sourceAction(sid, action) {
    var s = sourceById(sid);
    if (!s) return;
    if (action === 'view') openViewer(sid);
    else if (action === 'draft') {
      loadSourceText(sid).then(function (text) {
        closeModal($('#sourcesModal'));
        nt = newNotesState();
        nt.title = s.title; nt.module = s.module || 'contract'; nt.kind = s.kind; nt.text = text; nt.pages = s.pages; nt.sourceId = s.id; nt.saved = true;
        openModal($('#notesModal'));
        startDrafting();
      }, function () { toast('Couldn\'t load that source.', { type: 'error' }); });
    } else if (action === 'delete') {
      var n = state.entries.filter(function (e) { return e.sourceId === sid; }).length;
      dialog({
        title: 'Delete “' + s.title + '”?',
        message: 'The source text will be removed.' + (n ? ' Your ' + cardsWord(n) + ' made from it stay in your library, but lose the link to it.' : ''),
        buttons: [{ label: 'Cancel', value: false }, { label: 'Delete source', value: true, style: 'btn-danger' }]
      }).then(function (ok) {
        if (!ok) return;
        removeSource(sid).then(function () { renderSourceList(); renderAll(); toast('Source deleted.'); }, function () { toast('Couldn\'t delete that source.', { type: 'error' }); });
        renderSourceList(); renderAll();
      });
    }
  }

  var viewer = { sid: null, text: '', hits: [], cur: -1, focus: null };
  function openViewer(sid, opts) {
    opts = opts || {};
    var s = sourceById(sid);
    if (!s) { toast('That source is no longer in your library.', { type: 'error' }); return; }
    $('#viewerTitle').textContent = s.title;
    $('#viewerText').innerHTML = '<div class="loading"><span class="spinner"></span>Loading…</div>';
    $('#viewerSearch').value = '';
    $('#viewerCount').textContent = '';
    openModal($('#viewerModal'));
    loadSourceText(sid).then(function (text) {
      viewer = { sid: sid, text: text, hits: [], cur: -1, focus: null };
      if (opts.quote) viewer.focus = findQuote(text, opts.quote);
      if (!viewer.focus && opts.term) {
        var i = text.toLowerCase().indexOf(String(opts.term).toLowerCase());
        if (i !== -1) viewer.focus = { start: i, end: i + opts.term.length };
      }
      renderViewer();
      var target = $('#viewerText mark.focus') || (opts.page ? $('#viewerText .pg[data-p="' + opts.page + '"]') : null);
      if (target) target.scrollIntoView({ block: 'center' });
      else if (opts.quote) toast('Couldn\'t find the exact quote in this source. It may have been reworded.', { timeout: 5000 });
    }, function () { $('#viewerText').textContent = 'Couldn\'t load this source.'; });
  }
  function renderViewer() {
    var text = viewer.text, ranges = [];
    if (viewer.focus) ranges.push({ s: viewer.focus.start, e: viewer.focus.end, cls: 'focus' });
    viewer.hits.forEach(function (h, i) { ranges.push({ s: h, e: h + viewer.term.length, cls: i === viewer.cur ? 'focus' : '' }); });
    ranges.sort(function (a, b) { return a.s - b.s; });
    var out = [], pos = 0, page = 1;
    var emit = function (to) {
      var chunk = text.slice(pos, to);
      var parts = chunk.split('\f');
      parts.forEach(function (p, i) {
        if (i > 0) { page++; out.push('<span class="pg" data-p="' + page + '">Page ' + page + '</span>'); }
        out.push(esc(p));
      });
      pos = to;
    };
    if (text.indexOf('\f') !== -1) out.push('<span class="pg" data-p="1" style="margin-top:0;border-top:0;padding-top:0">Page 1</span>');
    ranges.forEach(function (r) {
      if (r.s < pos) return;
      emit(r.s);
      out.push('<mark class="' + r.cls + '">');
      emit(r.e);
      out.push('</mark>');
    });
    emit(text.length);
    $('#viewerText').innerHTML = out.join('') || '<i class="muted">This source has no text.</i>';
  }
  function viewerSearch(term) {
    viewer.term = term;
    viewer.hits = [];
    viewer.cur = -1;
    if (term && term.length >= 2) {
      var low = viewer.text.toLowerCase(), t = term.toLowerCase();
      for (var i = low.indexOf(t); i !== -1 && viewer.hits.length < 500; i = low.indexOf(t, i + t.length)) viewer.hits.push(i);
      if (viewer.hits.length) viewer.cur = 0;
    }
    viewer.focus = null;
    renderViewer();
    $('#viewerCount').textContent = term && term.length >= 2 ? (viewer.hits.length ? (viewer.cur + 1) + ' of ' + viewer.hits.length : 'No matches') : '';
    var m = $('#viewerText mark.focus');
    if (m) m.scrollIntoView({ block: 'center' });
  }
  function viewerStep(d) {
    if (!viewer.hits.length) return;
    viewer.cur = (viewer.cur + d + viewer.hits.length) % viewer.hits.length;
    renderViewer();
    $('#viewerCount').textContent = (viewer.cur + 1) + ' of ' + viewer.hits.length;
    var m = $('#viewerText mark.focus');
    if (m) m.scrollIntoView({ block: 'center' });
  }
  function openEntrySource(id) {
    var e = byId(id);
    if (!e || !e.sourceId) return;
    var page = (/(\d+)/.exec(e.sourceRef || '') || [])[1];
    openViewer(e.sourceId, { quote: e.sourceQuote, page: page, term: e.sourceQuote ? '' : e.name });
  }

  /* ------------------------------------------------------------------
     R. ADD NOTES: read a file → save it as a source → Claude drafts
        cards from it in parts → you approve each card.
     ------------------------------------------------------------------ */
  var LIBS = {
    pdfWorker: ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'],
    pdf: ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'],
    mammoth: ['https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js']
  };
  var loadedLibs = {};
  function loadScript(urls) {
    var key = urls[0];
    if (loadedLibs[key]) return loadedLibs[key];
    loadedLibs[key] = new Promise(function (resolve, reject) {
      var i = 0;
      var next = function () {
        if (i >= urls.length) { delete loadedLibs[key]; reject(new Error('Could not load a helper library. Check your internet connection.')); return; }
        var s = document.createElement('script');
        s.src = urls[i++];
        s.onload = function () { resolve(); };
        s.onerror = function () { s.remove(); next(); };
        document.head.appendChild(s);
      };
      next();
    });
    return loadedLibs[key];
  }
  function readPdf(buf, onProgress) {
    // Loading the worker as a normal script lets pdf.js run on the page itself.
    return loadScript(LIBS.pdfWorker).then(function () { return loadScript(LIBS.pdf); }).then(function () {
      return window.pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    }).then(function (pdf) {
      var pages = [], n = pdf.numPages, i = 0;
      var step = function () {
        if (i >= n) return Promise.resolve({ text: pages.join('\f'), pages: n });
        i++;
        onProgress('Reading page ' + i + ' of ' + n + '…', i / n);
        return pdf.getPage(i).then(function (page) { return page.getTextContent(); }).then(function (tc) {
          var line = '';
          tc.items.forEach(function (it) { line += it.str + (it.hasEOL ? '\n' : (it.str && !/\s$/.test(it.str) ? ' ' : '')); });
          pages.push(line.replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').trim());
          return step();
        });
      };
      return step();
    });
  }
  function readDocx(buf) {
    return loadScript(LIBS.mammoth).then(function () { return window.mammoth.extractRawText({ arrayBuffer: buf }); })
      .then(function (r) { return { text: String(r.value || '').replace(/\n{3,}/g, '\n\n').trim(), pages: 0 }; });
  }

  var nt = null;
  function newNotesState() {
    return { step: 'pick', title: '', module: state.filter !== 'all' ? state.filter : 'contract', kind: 'text', text: '', pages: 0, sourceId: null, saved: false, proposals: [], ctl: null, running: false, progress: 0, note: '', parts: 0, partDone: 0, errors: 0 };
  }
  function openNotes() {
    if (!nt || (nt.step !== 'review' && !nt.running)) nt = newNotesState();
    renderNotes();
    openModal($('#notesModal'));
  }
  function moduleOptions(sel) {
    return MODULES.map(function (m) { return '<option value="' + m.id + '"' + (m.id === sel ? ' selected' : '') + '>' + esc(m.label) + '</option>'; }).join('');
  }
  function renderNotes() {
    var body = $('#notesBody'), foot = $('#notesFoot');
    if (nt.step === 'pick') {
      body.innerHTML =
        '<div class="dropzone" id="dropzone"><b>Drop a PDF, Word (.docx) or text file here</b>or <button type="button" class="linklike" id="pickFile">choose a file</button>' +
        '<input type="file" id="notesFile" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" hidden></div>' +
        '<div class="form-grid" style="margin-top:16px">' +
        '<div class="form-field"><label class="lbl" for="ntTitle">Title</label><input class="input" id="ntTitle" maxlength="200" placeholder="e.g. Contract – Chapter 6: Misrepresentation" value="' + esc(nt.title) + '"></div>' +
        '<div class="form-field"><label class="lbl" for="ntModule">Module</label><select id="ntModule">' + moduleOptions(nt.module) + '</select></div>' +
        '<div class="form-field full"><label class="lbl" for="ntPaste">…or paste your notes <span class="hint">(optional, instead of a file)</span></label><textarea id="ntPaste" rows="5" placeholder="Paste text here">' + esc(nt.kind === 'text' ? nt.text : '') + '</textarea></div></div>' +
        (nt.note ? '<p class="step-note warn" style="margin-top:12px">' + esc(nt.note) + '</p>' : '');
      foot.innerHTML = '<span class="foot-note spacer">Nothing is added to your library until you approve it.</span><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn btn-primary" data-nt="continue">Continue</button>';
      bindDropzone();
    } else if (nt.step === 'reading') {
      body.innerHTML = '<p><span class="spinner"></span>' + esc(nt.note || 'Reading…') + '</p><div class="bar big-progress"><i style="width:' + Math.round(nt.progress * 100) + '%"></i></div>';
      foot.innerHTML = '<button type="button" class="btn" data-close>Cancel</button>';
    } else if (nt.step === 'check') {
      var words = (nt.text.match(/\S+/g) || []).length;
      var thin = nt.text.replace(/\s/g, '').length < Math.max(300, (nt.pages || 1) * 120);
      var nParts = chunkText(nt.text).length;
      body.innerHTML = '<div class="form-grid" style="margin-bottom:12px">' +
        '<div class="form-field"><label class="lbl" for="ntTitle">Title</label><input class="input" id="ntTitle" maxlength="200" value="' + esc(nt.title) + '"></div>' +
        '<div class="form-field"><label class="lbl" for="ntModule">Module</label><select id="ntModule">' + moduleOptions(nt.module) + '</select></div></div>' +
        '<div class="step-note">' + (nt.pages ? plural(nt.pages, 'page') + ' · ' : '') + words.toLocaleString('en-GB') + ' words</div>' +
        (thin ? '<p class="step-note warn" style="margin-top:10px">Very little text came out of this file. If it\'s a scanned PDF (pictures of pages), run it through OCR first or paste the text instead.</p>' : '') +
        (nParts > 15 && claudeCaps.sample ? '<p class="step-note warn" style="margin-top:10px">This is long: drafting would take ' + nParts + ' rounds (roughly ' + Math.max(5, Math.round(nParts * 0.35)) + ' minutes) and use a fair amount of your Claude allowance. Adding one chapter or unit at a time gives better cards and is easier to check.</p>' : '') +
        '<div class="preview-text">' + esc(nt.text.slice(0, 2000)) + (nt.text.length > 2000 ? '…' : '') + '</div>' +
        '<p class="foot-note" style="margin-top:12px">' + (claudeCaps.sample
          ? 'Claude will read it in ' + plural(chunkText(nt.text).length, 'part') + ' and draft case, statute and principle cards using only what this text says. Each card includes the sentence it relies on, and you approve every card before it\'s added.'
          : 'Drafting cards needs Claude, which works when the app is opened in claude.ai. You can still save this as a source and add cards yourself.') + '</p>';
      foot.innerHTML = '<button type="button" class="btn spacer" data-nt="back">Back</button><button type="button" class="btn" data-nt="save-only">Save as a source only</button>' +
        '<button type="button" class="btn btn-primary" data-nt="draft"' + (claudeCaps.sample && !thin ? '' : ' disabled') + '>✦ Save and draft cards</button>';
    } else if (nt.step === 'drafting') {
      body.innerHTML = '<p style="margin-top:0"><span class="spinner"></span>Drafting cards from <b>' + esc(nt.title) + '</b>…</p>' +
        '<div class="bar big-progress"><i style="width:' + Math.round(nt.partDone / Math.max(1, nt.parts) * 100) + '%"></i></div>' +
        '<p class="foot-note">Part ' + Math.min(nt.parts, nt.partDone + 1) + ' of ' + nt.parts + ' · ' + cardsWord(nt.proposals.length) + ' drafted so far' + (nt.errors ? ' · ' + plural(nt.errors, 'part') + ' failed' : '') + '</p>' +
        '<p class="foot-note">This usually takes 20–60 seconds a part. You can leave this window open and keep revising; closing it stops drafting.</p>';
      foot.innerHTML = '<button type="button" class="btn" data-nt="stop">■ Stop and review what\'s drafted</button>';
    } else if (nt.step === 'review') {
      renderProposals();
    }
  }
  function bindDropzone() {
    var dz = $('#dropzone'), input = $('#notesFile');
    $('#pickFile').onclick = function () { input.value = ''; input.click(); };
    input.onchange = function () { if (input.files && input.files[0]) readNotesFile(input.files[0]); };
    dz.ondragover = function (ev) { ev.preventDefault(); dz.classList.add('over'); };
    dz.ondragleave = function () { dz.classList.remove('over'); };
    dz.ondrop = function (ev) { ev.preventDefault(); dz.classList.remove('over'); var f = ev.dataTransfer.files && ev.dataTransfer.files[0]; if (f) readNotesFile(f); };
  }
  function captureNotesForm() {
    if ($('#ntTitle')) nt.title = $('#ntTitle').value.trim();
    if ($('#ntModule')) nt.module = $('#ntModule').value;
  }
  function readNotesFile(file) {
    captureNotesForm();
    var name = file.name || 'Notes';
    var ext = (name.split('.').pop() || '').toLowerCase();
    if (!nt.title) nt.title = name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (file.size > 40 * 1024 * 1024) { nt.note = 'That file is over 40 MB. Split it into chapters and add them one at a time.'; renderNotes(); return; }
    nt.step = 'reading'; nt.note = 'Opening ' + name + '…'; nt.progress = 0; nt.note2 = '';
    renderNotes();
    var reader = new FileReader();
    reader.onerror = function () { nt.step = 'pick'; nt.note = 'Couldn\'t read that file.'; renderNotes(); };
    reader.onload = function () {
      var p;
      if (ext === 'pdf') { nt.kind = 'pdf'; p = readPdf(reader.result, function (msg, frac) { nt.note = msg; nt.progress = frac; if (nt.step === 'reading') renderNotes(); }); }
      else if (ext === 'docx') { nt.kind = 'docx'; p = readDocx(reader.result); }
      else if (ext === 'txt' || ext === 'md' || /^text\//.test(file.type)) { nt.kind = 'text'; p = Promise.resolve({ text: new TextDecoder().decode(reader.result), pages: 0 }); }
      else { p = Promise.reject(new Error('Use a PDF, a Word .docx file, or a .txt file. (Older .doc files: save as .docx first.)')); }
      p.then(function (r) {
        if (nt.step !== 'reading') return;
        nt.text = r.text.replace(/\r\n?/g, '\n'); nt.pages = r.pages; nt.step = 'check'; nt.note = '';
        renderNotes();
      }, function (err) { nt.step = 'pick'; nt.note = (err && err.message) || 'Couldn\'t read that file.'; renderNotes(); });
    };
    reader.readAsArrayBuffer(file);
  }
  function notesAction(a) {
    if (a === 'continue') {
      captureNotesForm();
      var pasted = $('#ntPaste') ? $('#ntPaste').value.trim() : '';
      if (!pasted) { nt.note = 'Choose a file or paste some text first.'; renderNotes(); return; }
      nt.kind = 'text'; nt.text = pasted; nt.pages = 0;
      if (!nt.title) nt.title = (pasted.split('\n')[0] || 'Notes').slice(0, 80);
      nt.step = 'check'; nt.note = ''; renderNotes();
    } else if (a === 'back') { nt.step = 'pick'; renderNotes(); }
    else if (a === 'save-only' || a === 'draft') captureNotesForm();
    if (a === 'save-only') { saveNotesSource().then(function (meta) { if (!meta) return; closeModal($('#notesModal')); nt = null; toast('Saved “' + meta.title + '” to your sources.', { type: 'success' }); renderAll(); }); }
    else if (a === 'draft') { if (!nt.title) nt.title = 'Untitled notes'; saveNotesSource().then(function (meta) { if (meta) startDrafting(); }); }
    else if (a === 'stop') { if (nt.ctl) nt.ctl.abort(); }
    else if (a === 'add') addProposals();
    else if (a === 'discard') {
      dialog({ title: 'Discard the drafted cards?', message: 'The source stays saved; you can draft cards from it again later.', buttons: [{ label: 'Keep reviewing', value: false }, { label: 'Discard', value: true, style: 'btn-danger' }] })
        .then(function (ok) { if (ok) { closeModal($('#notesModal')); nt = null; } });
    } else if (a === 'all' || a === 'none') { nt.proposals.forEach(function (p) { p.on = a === 'all'; }); renderProposals(); }
  }
  function slug(s) { return normText(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'item'; }
  function saveNotesSource() {
    if (nt.saved && nt.sourceId) return Promise.resolve(sourceById(nt.sourceId) || { id: nt.sourceId, title: nt.title });
    var meta = { id: 'src-' + slug(nt.title).slice(0, 40) + '-' + Date.now().toString(36), title: nt.title || 'Untitled notes', module: nt.module, kind: nt.kind, pages: nt.pages, chars: nt.text.length, createdAt: nowISO() };
    $('#notesFoot').querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    return saveSource(meta, nt.text).then(function (m) {
      nt.sourceId = m.id; nt.saved = true; renderSidebar(); return m;
    }, function (err) {
      toast(err && err.code === 'quota_exceeded' ? 'Storage is full, so the source couldn\'t be saved.' : 'Couldn\'t save the source. Try again.', { type: 'error', timeout: 7000 });
      renderNotes();
      return null;
    });
  }

  // Split into parts of whole pages (about 9,000 characters each), marking page numbers.
  function chunkText(text) {
    var pages = text.indexOf('\f') !== -1 ? text.split('\f') : null, chunks = [], cur = '', LIMIT = 9000;
    var push = function () { if (cur.trim()) chunks.push(cur); cur = ''; };
    if (pages) {
      pages.forEach(function (p, i) {
        var block = '[[p.' + (i + 1) + ']]\n' + p + '\n';
        if (cur && cur.length + block.length > LIMIT) push();
        if (block.length > LIMIT * 1.5) {
          p.split(/\n\s*\n/).forEach(function (para) {
            if (cur.length + para.length > LIMIT) { push(); cur = '[[p.' + (i + 1) + ']]\n'; }
            cur += para + '\n\n';
          });
        } else cur += block;
      });
    } else {
      text.split(/\n\s*\n/).forEach(function (para) {
        if (cur.length + para.length > LIMIT) push();
        if (para.length > LIMIT) { for (var k = 0; k < para.length; k += LIMIT) { cur = para.slice(k, k + LIMIT); push(); } }
        else cur += para + '\n\n';
      });
    }
    push();
    return chunks;
  }
  function draftPrompt(part, n, total) {
    var topics = {};
    state.entries.forEach(function (e) { if (e.module === nt.module && e.topic) topics[e.topic] = true; });
    var topicList = Object.keys(topics).slice(0, 80).join('; ') || '(none yet)';
    return [
      'You are helping a law student (English and Welsh law, PGDL/SQE level) turn THEIR OWN study material into revision cards.',
      '',
      'Use ONLY the text inside <material>. Never add facts, cases, statutes, citations, dates or explanations that are not in the text. If the text only mentions a case in passing without explaining it, do not make a card for it.',
      '',
      'Card types:',
      '- "case": a case the text explains. name = the case name as written. citation = exactly as written in the text, or "" if none. facts = the material facts as the text gives them ("" if not given). ratio = the rule or decision the text attributes to the case. strategy = how to use it in an exam answer, based on what the text says it is authority for.',
      '- "statute": a statutory provision the text explains. name = Act and section as written. ratio = what the provision says or does, per the text. facts = its context or purpose if the text gives it.',
      '- "principle": a rule, test or doctrine the text states. name = a short label for the rule (e.g. "Revocation must be communicated"). ratio = the rule in full. facts = an example from the text, if any. citation = "Key authorities: " followed by the authorities the text gives for it ("" if none). strategy = how to apply it.',
      '',
      'For every card also give:',
      '- topic: reuse one of these existing topics if it fits: ' + topicList + '. Otherwise a short new topic in the same style.',
      '- tags: 3 to 6 short lowercase keywords (hyphens, no #).',
      '- page: the number in the nearest [[p.N]] marker before the passage, or null if there are no markers.',
      '- quote: ONE sentence copied EXACTLY, word for word, from the text that best supports the card (at most 300 characters).',
      '',
      'Keep fields concise: facts up to 70 words, ratio up to 80 words, strategy up to 50 words. UK spelling. Skip headings, questions to the reader and passing mentions.',
      'Reply with ONLY a JSON array of objects with keys: type, name, citation, topic, facts, ratio, strategy, tags, page, quote. Reply [] if nothing is suitable.',
      '',
      'Module: ' + MODULE_LABEL[nt.module] + '. Source: ' + nt.title + '. This is part ' + n + ' of ' + total + '.',
      '<material>',
      part,
      '</material>'
    ].join('\n');
  }
  function startDrafting() {
    var chunks = chunkText(nt.text);
    nt.step = 'drafting'; nt.parts = chunks.length; nt.partDone = 0; nt.errors = 0; nt.proposals = []; nt.running = true;
    nt.ctl = new AbortController();
    var ctl = nt.ctl, next = 0, mine = nt;
    renderNotes();
    var worker = function () {
      if (ctl.signal.aborted || next >= chunks.length) return Promise.resolve();
      var i = next++;
      return claudeCaps.sample.json(draftPrompt(chunks[i], i + 1, chunks.length), { signal: ctl.signal })
        .then(function (arr) { addDrafts(mine, arr); }, function (err) {
          if (err && err.code === 'cancelled') return;
          mine.errors++;
          if (err && (err.code === 'not_granted' || err.code === 'sampling_disabled' || err.code === 'rate_limited')) { mine.fatal = sampleErrorText(err); ctl.abort(); }
        })
        .then(function () { mine.partDone++; if (nt === mine && mine.step === 'drafting') renderNotes(); return worker(); });
    };
    Promise.all([worker(), worker()]).then(function () {
      mine.running = false;
      if (nt !== mine) return;
      if (mine.fatal) toast(mine.fatal, { type: 'error', timeout: 8000 });
      finaliseDrafts();
      nt.step = 'review';
      renderNotes();
    });
  }
  function addDrafts(mine, arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach(function (raw) {
      if (!raw || typeof raw !== 'object') return;
      var e = sanitizeEntry({
        module: mine.module, type: raw.type, name: raw.name, citation: raw.citation, topic: raw.topic,
        facts: raw.facts, ratio: raw.ratio, strategy: raw.strategy, tags: Array.isArray(raw.tags) ? raw.tags : [],
        sourceQuote: typeof raw.quote === 'string' ? raw.quote : ''
      });
      if (!e || !e.ratio) return;
      var key = nameKey(e.name);
      var same = mine.proposals.filter(function (p) { return nameKey(p.e.name) === key && p.e.type === e.type; })[0];
      if (same) {
        ['facts', 'ratio', 'strategy', 'citation'].forEach(function (f) { if (e[f].length > same.e[f].length) same.e[f] = e[f]; });
        same.e.tags = parseTags(same.e.tags.concat(e.tags).join(' ')).slice(0, 8);
        return;
      }
      mine.proposals.push({ e: e, page: num(raw.page, 0) || 0, on: true });
    });
  }
  function finaliseDrafts() {
    var text = nt.text;
    var lib = {};
    state.entries.forEach(function (x) { if (x.module === nt.module) lib[nameKey(x.name) + '|' + x.type] = x; });
    nt.proposals.forEach(function (p, i) {
      var hit = p.e.sourceQuote ? findQuote(text, p.e.sourceQuote) : null;
      p.quoteOK = !!(hit && hit.exact !== false);
      p.quoteNear = !!hit;
      if (hit && text.indexOf('\f') !== -1) p.page = pageAt(text, hit.start);
      if (hit) p.e.sourceQuote = text.slice(hit.start, Math.min(text.length, hit.start + Math.max(p.e.sourceQuote.length, hit.end - hit.start))).replace(/\s+/g, ' ').trim();
      p.dup = lib[nameKey(p.e.name) + '|' + p.e.type] || null;
      p.on = !p.dup;
      p.open = false;
      p.i = i;
    });
    var order = { case: 0, statute: 1, principle: 2 };
    nt.proposals.sort(function (a, b) { return (a.page || 9999) - (b.page || 9999) || order[a.e.type] - order[b.e.type]; });
  }
  function renderProposals() {
    var body = $('#notesBody'), foot = $('#notesFoot');
    var list = nt.proposals, on = list.filter(function (p) { return p.on; }).length;
    if (!list.length) {
      body.innerHTML = '<div class="empty" style="padding:30px 16px"><h3>No cards drafted</h3><p>' +
        (nt.errors ? 'Claude couldn\'t process this text (' + plural(nt.errors, 'part') + ' failed). Try again in a moment.' : 'This text didn\'t seem to explain any cases, statutes or rules.') +
        '</p><p>Your source is saved, so you can read it or try drafting again from <b>Sources</b>.</p></div>';
      foot.innerHTML = '<button type="button" class="btn btn-primary" data-close>Close</button>';
      return;
    }
    var counts = { case: 0, statute: 0, principle: 0 };
    list.forEach(function (p) { counts[p.e.type]++; });
    body.innerHTML = '<div class="prop-tools"><span>' + plural(counts.case, 'case') + ', ' + plural(counts.statute, 'statute') + ', ' + plural(counts.principle, 'principle') +
      ' drafted from <b>' + esc(nt.title) + '</b>' + (nt.errors ? ' · ' + plural(nt.errors, 'part') + ' couldn\'t be read' : '') + '</span>' +
      '<span><button type="button" class="linklike" data-nt="all">Select all</button> · <button type="button" class="linklike" data-nt="none">Select none</button></span></div>' +
      '<p class="step-note" style="margin:0 0 10px">Check each card against the quote before adding it. ✓ means the supporting quote was found word for word in your source; ⚠ means it wasn\'t, so look closely.</p>' +
      '<div class="prop-list">' + list.map(function (p, idx) {
        var e = p.e;
        return '<div class="prop' + (p.on ? '' : ' off') + '" data-p="' + idx + '"><div class="prop-head">' +
          '<input type="checkbox" data-pon="' + idx + '"' + (p.on ? ' checked' : '') + ' aria-label="Add ' + esc(e.name) + '">' +
          '<div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' + typeBadge(e) + '<b>' + esc(e.name) + '</b></div>' +
          '<div class="prop-sub">' + (e.citation ? esc(e.citation) + ' · ' : '') + esc(e.topic || 'No topic') + (p.page ? ' · p. ' + p.page : '') + '</div>' +
          '<div class="prop-flags">' + (p.quoteOK ? '<span class="flag ok">✓ Quote found in source</span>' : p.quoteNear ? '<span class="flag bad">⚠ Quote only partly matched</span>' : '<span class="flag bad">⚠ Quote not found — check this card</span>') +
          (p.dup ? '<span class="flag dup">Already in your library: ' + esc(p.dup.name) + '</span>' : '') + '</div></div>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-popen="' + idx + '">' + (p.open ? 'Hide' : 'Show') + '</button></div>' +
          (p.open ? '<div class="prop-body">' +
            (e.facts ? '<div><div class="field-label">' + LABELS[e.type][0] + '</div><div class="field-text">' + esc(e.facts) + '</div></div>' : '') +
            '<div class="field-ratio"><div class="field-label">' + LABELS[e.type][1] + '</div><div class="field-text">' + esc(e.ratio) + '</div></div>' +
            (e.strategy ? '<div><div class="field-label">' + LABELS[e.type][2] + '</div><div class="field-text">' + esc(e.strategy) + '</div></div>' : '') +
            (e.sourceQuote ? '<div><div class="field-label">Supporting quote</div><div class="field-text" style="font-style:italic">“' + esc(e.sourceQuote) + '”</div></div>' : '') +
            '</div>' : '') +
          '</div>';
      }).join('') + '</div>';
    foot.innerHTML = '<button type="button" class="btn spacer" data-nt="discard">Discard all</button>' +
      '<span class="foot-note">New cards start as unverified.</span>' +
      '<button type="button" class="btn btn-primary" data-nt="add"' + (on ? '' : ' disabled') + '>Add ' + cardsWord(on) + '</button>';
  }
  function addProposals() {
    var chosen = nt.proposals.filter(function (p) { return p.on; });
    if (!chosen.length) return;
    var now = Date.now(), used = {};
    state.entries.forEach(function (e) { used[e.id] = true; });
    chosen.forEach(function (p, i) {
      var e = Object.assign({}, p.e);
      var id = nt.module + '-' + slug(e.name);
      while (used[id]) id = nt.module + '-' + slug(e.name) + '-' + Math.random().toString(36).slice(2, 6);
      used[id] = true;
      e.id = id;
      e.sourceId = nt.sourceId || '';
      e.sourceRef = p.page ? 'p. ' + p.page : '';
      e.verified = false;
      e.createdAt = e.updatedAt = new Date(now + i).toISOString();
      var clean = sanitizeEntry(e);
      if (clean) state.entries.push(clean);
    });
    var mod = nt.module, title = nt.title;
    closeModal($('#notesModal'));
    nt = null;
    state.filter = mod;
    state.settings.statusFilter = 'new';
    state.settings.sort = 'recent';
    commit();
    toast('Added ' + cardsWord(chosen.length) + ' from “' + title + '”. They\'re in today\'s new cards.', { type: 'success', timeout: 7000 });
  }
