  /* ------------------------------------------------------------------
     U3. LECTURE NOTES: quick capture during lectures, a simple document
         editor, automatic topic detection, links to cards
     ------------------------------------------------------------------ */
  var NOTES_KEY = 'lawRevisionApp.v1.notes';
  var notesLoaded = false; // true once notes have arrived from claude.ai
  var NOTE_TAGS = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', H2: 'h3', H3: 'h3', H4: 'h3', UL: 'ul', OL: 'ol', LI: 'li', P: 'p', DIV: 'p', BR: 'br', MARK: 'mark', BLOCKQUOTE: 'blockquote' };
  var NOTE_DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, SVG: 1, MATH: 1, TEMPLATE: 1, HEAD: 1, META: 1, LINK: 1, TITLE: 1, IMG: 1, VIDEO: 1, AUDIO: 1, CANVAS: 1, FORM: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1 };
  // Keep only simple formatting tags, with no attributes, so stored notes can never run code.
  function cleanNoteHTML(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = String(html || '').slice(0, 300000);
    var out = document.createElement('div');
    (function walk(src, dst) {
      Array.prototype.forEach.call(src.childNodes, function (n) {
        if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1 || NOTE_DROP[n.tagName]) return;
        var tag = NOTE_TAGS[n.tagName];
        if (tag) { var el = document.createElement(tag); dst.appendChild(el); if (tag !== 'br') walk(n, el); }
        else walk(n, dst);
      });
    })(tpl.content, out);
    return out.innerHTML;
  }
  function noteTextFromHTML(html) {
    var d = document.createElement('div');
    d.innerHTML = String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h3|li|blockquote|ul|ol)>/gi, '$&\n');
    return d.textContent.replace(/\n{3,}/g, '\n\n').trim();
  }
  function sanitizeNote(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
    var id = raw.id.replace(/[^A-Za-z0-9_\-.~:@+]/g, '-').slice(0, 120);
    if (!id) return null;
    var html = cleanNoteHTML(raw.html);
    var created = raw.createdAt && !isNaN(new Date(raw.createdAt).getTime()) ? raw.createdAt : nowISO();
    return {
      id: id,
      module: MODULE_LABEL[raw.module] ? raw.module : '',
      topic: cleanString(raw.topic, 200).trim(),
      topicAuto: raw.topicAuto === true,
      title: cleanString(raw.title, 200).trim() || 'Untitled note',
      html: html,
      text: noteTextFromHTML(html).slice(0, 100000),
      linked: Array.isArray(raw.linked) ? raw.linked.filter(function (x) { return typeof x === 'string'; }).slice(0, 100) : [],
      createdAt: created,
      updatedAt: raw.updatedAt && !isNaN(new Date(raw.updatedAt).getTime()) ? raw.updatedAt : created
    };
  }
  function noteForStorage(n) {
    return { id: n.id, module: n.module, topic: n.topic, topicAuto: n.topicAuto, title: n.title, html: n.html, linked: n.linked, createdAt: n.createdAt, updatedAt: n.updatedAt };
  }
  function noteById(id) { for (var i = 0; i < state.notes.length; i++) if (state.notes[i].id === id) return state.notes[i]; return null; }

  /* ---- storage ---- */
  var notePending = {}, noteTimers = {}, noteSeq = {};
  function loadLocalNotes() {
    var list = [];
    try { list = JSON.parse(kvGet(NOTES_KEY) || '[]'); } catch (e) { list = []; }
    state.notes = (Array.isArray(list) ? list : []).map(sanitizeNote).filter(Boolean);
  }
  function writeLocalNotes() {
    try { kvSet(NOTES_KEY, JSON.stringify(state.notes.filter(function (n) { return !n._draft; }).map(noteForStorage))); return true; }
    catch (e) { toast('Browser storage is full, so your note was not saved. Export a backup now.', { type: 'error', timeout: 9000 }); return false; }
  }
  function startNotesCloud(db) {
    db.collection('notes').onSnapshot(function (snap) {
      var incoming = {};
      snap.docs.forEach(function (d) { var n = sanitizeNote(d.data()); if (n) incoming[n.id] = n; });
      var next = [];
      state.notes.forEach(function (n) {
        if (notePending[n.id] || n._draft) next.push(n);
        else if (incoming[n.id]) next.push(incoming[n.id]);
        delete incoming[n.id];
      });
      Object.keys(incoming).forEach(function (id) { next.push(incoming[id]); });
      var openId = ln && ln.noteId, first = !notesLoaded;
      notesLoaded = true;
      state.notes = next;
      // Notes opened before they had arrived: go to this lecture's note instead of the empty new one.
      var cur = first && ln && ln.autoPick && openId ? noteById(openId) : null;
      if (cur && cur._draft && !cur.text) {
        var recent = recentNote(ln.autoPick.module);
        if (recent) { discardEmptyDraft(); ln.noteId = openId = recent.id; if (!$('#lnModal').hidden) renderNoteEditor(); }
      }
      if (ln && !$('#lnModal').hidden) { renderNoteList(); if (openId && !noteById(openId)) { ln.noteId = null; renderNoteEditor(); } }
      renderAllSoon();
    }, function () { /* notes simply stay local for this session */ });
  }
  function persistNote(n, now) {
    if (n._draft) return;
    if (store.mode !== 'cloud') { writeLocalNotes(); return; }
    clearTimeout(noteTimers[n.id]);
    notePending[n.id] = true;
    var mySeq = noteSeq[n.id] = (noteSeq[n.id] || 0) + 1;
    setNoteStatus('Saving…');
    var go = function () {
      var body = noteForStorage(n);
      if (JSON.stringify(body).length > 240000) {
        notePending[n.id] = false; setNoteStatus('Too long to save');
        toast('This note is too long to save. Start a new note for the rest of the lecture.', { type: 'error', timeout: 8000 });
        return;
      }
      setSync('busy');
      claudeCaps.db.collection('notes').doc(n.id).set(body).then(function () {
        if (noteSeq[n.id] !== mySeq) return;
        notePending[n.id] = false; setNoteStatus('Saved'); if (!anyQueued()) setSync('ok');
      }, function (err) {
        if (noteSeq[n.id] !== mySeq) return;
        notePending[n.id] = false; setNoteStatus('Not saved');
        setSync('error', err && err.code === 'quota_exceeded' ? 'Your claude.ai storage is full' : 'A note could not be saved');
      });
    };
    if (now) go(); else noteTimers[n.id] = setTimeout(go, 700);
  }
  function deleteNoteStore(id) {
    if (store.mode !== 'cloud') { writeLocalNotes(); return Promise.resolve(); }
    clearTimeout(noteTimers[id]); notePending[id] = false;
    return claudeCaps.db.collection('notes').doc(id).delete();
  }
  function importNotes(list, mode) {
    if (!Array.isArray(list)) return 0;
    var clean = list.map(sanitizeNote).filter(Boolean), n = 0;
    if (mode === 'replace') {
      var keep = {}; clean.forEach(function (x) { keep[x.id] = true; });
      state.notes.filter(function (x) { return !keep[x.id] && !x._draft; }).forEach(function (x) { state.notes = state.notes.filter(function (y) { return y !== x; }); deleteNoteStore(x.id); });
    }
    clean.forEach(function (x) {
      var cur = noteById(x.id);
      if (!cur) { state.notes.push(x); persistNote(x, true); n++; }
      else if (x.updatedAt > cur.updatedAt) { state.notes[state.notes.indexOf(cur)] = x; persistNote(x, true); n++; }
    });
    if (store.mode !== 'cloud') writeLocalNotes();
    return n;
  }

  /* ---- automatic topic detection ---- */
  var detectCache = { sig: '', pats: [] };
  function detectionPatterns() {
    var sig = relSig();
    if (detectCache.sig === sig) return detectCache.pats;
    var pats = [];
    state.entries.forEach(function (e) {
      if (e.type === 'principle') return;
      var p = authorityPatterns(e);
      if (p.length) pats.push({ e: e, pats: p });
    });
    detectCache = { sig: sig, pats: pats };
    return pats;
  }
  function detectTopic(text, module) {
    var mentions = [], scores = {};
    if (!text || text.length < 3) return { mentions: [], best: null };
    var add = function (mod, topic, s) { if (!topic) return; var k = mod + '\u0001' + topic; scores[k] = (scores[k] || 0) + s; };
    detectionPatterns().forEach(function (x) {
      if (module && x.e.module !== module) return;
      var hit = x.pats.some(function (pat) { return pat.act ? pat.act.test(text) && (!pat.sec || pat.sec.test(text)) : pat.test(text); });
      if (hit) { mentions.push(x.e.id); add(x.e.module, x.e.topic, x.e.key ? 4 : 3); }
    });
    var words = {}; tokens(text).forEach(function (w) { words[w] = (words[w] || 0) + 1; });
    var topics = {};
    state.entries.forEach(function (e) {
      if (!e.topic || (module && e.module !== module)) return;
      var k = e.module + '\u0001' + e.topic;
      if (!topics[k]) topics[k] = { words: tokens(e.topic.replace(/[–-]/g, ' ')), tags: {} };
      e.tags.forEach(function (t) { t.split('-').forEach(function (w) { if (w.length > 3) topics[k].tags[w] = 1; }); });
    });
    Object.keys(topics).forEach(function (k) {
      var t = topics[k], s = 0;
      t.words.forEach(function (w) { if (words[w]) s += 1.5; });
      Object.keys(t.tags).forEach(function (w) { if (words[w]) s += 0.35; });
      if (s) scores[k] = (scores[k] || 0) + Math.min(s, 5);
    });
    var bestK = null;
    Object.keys(scores).forEach(function (k) { if (!bestK || scores[k] > scores[bestK]) bestK = k; });
    if (!bestK || scores[bestK] < 2) return { mentions: mentions, best: null };
    var parts = bestK.split('\u0001');
    return { mentions: mentions, best: { module: parts[0], topic: parts[1], score: scores[bestK] } };
  }

  /* ---- the notes panel ---- */
  var ln = null;
  function defaultNoteTitle() {
    var d = new Date();
    return 'Lecture notes – ' + d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function makeNote(module, topic) {
    var now = nowISO();
    var n = { id: uid('n'), module: module || '', topic: topic || '', topicAuto: !topic, title: defaultNoteTitle(), html: '', text: '', linked: [], createdAt: now, updatedAt: now, _draft: true };
    state.notes.push(n);
    return n;
  }
  function discardEmptyDraft() {
    if (!ln || !ln.noteId) return;
    var n = noteById(ln.noteId);
    if (n && n._draft) state.notes = state.notes.filter(function (x) { return x !== n; });
  }
  // The most recently edited note in a module from the last three hours (the same lecture).
  function recentNote(mod) {
    return state.notes.filter(function (n) {
      return !n._draft && (!mod || n.module === mod) && Date.now() - new Date(n.updatedAt).getTime() < 3 * 3600000;
    }).sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; })[0];
  }
  function openLectureNotes(opts) {
    opts = opts || {};
    var fresh = !ln;
    if (fresh) ln = { noteId: null, query: '', module: 'all', forEntry: null, showList: false };
    ln.forEntry = opts.forEntry || null;
    if (opts.noteId) ln.noteId = opts.noteId;
    else if (opts.forEntry) {
      var list = notesForEntry(byId(opts.forEntry));
      ln.noteId = list.length ? list[0].id : null;
    } else if (opts.newNote || fresh) {
      var mod = opts.module || (state.filter !== 'all' ? state.filter : '');
      var recent = opts.newNote ? null : recentNote(mod);
      discardEmptyDraft();
      ln.noteId = recent ? recent.id : makeNote(mod, opts.topic).id;
      ln.autoPick = opts.newNote || opts.topic ? null : { module: mod };
    }
    ln.module = 'all';
    ln.showList = false;
    $('#lnModuleFilter').innerHTML = '<option value="all">All modules</option>' + MODULES.map(function (m) { return '<option value="' + m.id + '">' + esc(m.label) + '</option>'; }).join('');
    $('#lnModuleFilter').value = 'all';
    $('#lnSearch').value = ln.query;
    openModal($('#lnModal'));
    renderNoteList();
    renderNoteEditor();
    var n = noteById(ln.noteId);
    setTimeout(function () { if (n && !n.text) $('#lnBody').focus(); else placeCaretAtEnd($('#lnBody')); }, 40);
  }
  function placeCaretAtEnd(el) {
    if (!el) return;
    el.focus();
    try { var r = document.createRange(); r.selectNodeContents(el); r.collapse(false); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* ignore */ }
  }
  function notesForEntry(e) {
    if (!e) return [];
    return state.notes.filter(function (n) { return !n._draft && (n.linked.indexOf(e.id) !== -1 || (n.module === e.module && n.topic && n.topic === e.topic)); })
      .sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });
  }
  function visibleNotes() {
    var terms = ln.query.toLowerCase().split(/\s+/).filter(Boolean);
    var base = ln.forEntry ? notesForEntry(byId(ln.forEntry)) : state.notes.filter(function (n) { return !n._draft || n.id === ln.noteId; });
    return base.filter(function (n) {
      if (ln.module !== 'all' && n.module !== ln.module) return false;
      var hay = (n.title + ' ' + n.topic + ' ' + n.text + ' ' + (MODULE_LABEL[n.module] || '')).toLowerCase();
      return terms.every(function (t) { return hay.indexOf(t) !== -1; });
    });
  }
  function renderNoteList() {
    if (!ln) return;
    var list = visibleNotes();
    var groups = {};
    list.forEach(function (n) {
      var k = (n.module ? MODULE_LABEL[n.module] : 'No module') + (n.topic ? ' › ' + n.topic : '');
      (groups[k] = groups[k] || []).push(n);
    });
    var keys = Object.keys(groups).sort(function (a, b) {
      var x = groups[a][0], y = groups[b][0];
      return (MOD_ORDER[x.module] == null ? 99 : MOD_ORDER[x.module]) - (MOD_ORDER[y.module] == null ? 99 : MOD_ORDER[y.module]) || a.localeCompare(b);
    });
    var forE = ln.forEntry ? byId(ln.forEntry) : null;
    $('#lnList').innerHTML = (forE ? '<div class="ln-filter">Notes for <b>' + esc(forE.name) + '</b> <button type="button" class="linklike" data-ln="clear-for">Show all</button></div>' : '') +
      (keys.length ? keys.map(function (k) {
        return '<div class="ln-group"><div class="ln-group-h">' + esc(k) + '</div>' +
          groups[k].sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; }).map(function (n) {
            return '<button type="button" class="ln-item' + (n.id === ln.noteId ? ' active' : '') + '" data-note="' + esc(n.id) + '"><b>' + esc(n.title) + '</b>' +
              '<small>' + formatDate(n.updatedAt) + (n.text ? ' · ' + esc(n.text.slice(0, 70)) : ' · empty') + '</small></button>';
          }).join('') + '</div>';
      }).join('') : '<p class="muted" style="padding:6px 4px">' + (state.notes.length ? 'No notes match.' : 'No notes yet. Start typing on the right.') + '</p>');
  }
  function renderNoteEditor() {
    var n = ln && noteById(ln.noteId);
    $('#lnModal').classList.toggle('show-list', !!(ln && (ln.showList || !n)));
    if (!n) {
      $('#lnEditor').innerHTML = '<div class="empty" style="margin:20px 0"><h3>No note open</h3><p>Choose a note on the left, or start a new one.</p><button type="button" class="btn btn-primary" data-ln="new">＋ New note</button></div>';
      return;
    }
    $('#lnEditor').innerHTML =
      '<div class="ln-head">' +
        '<label class="sr-only" for="lnTitle">Title</label><input class="input ln-title" id="lnTitle" value="' + esc(n.title) + '" maxlength="200">' +
        '<div class="ln-meta">' +
          '<label class="sr-only" for="lnModule">Module</label><select id="lnModule"><option value="">Module: detect automatically</option>' + MODULES.map(function (m) { return '<option value="' + m.id + '"' + (m.id === n.module ? ' selected' : '') + '>' + esc(m.label) + '</option>'; }).join('') + '</select>' +
          '<label class="sr-only" for="lnTopic">Topic</label><input class="input" id="lnTopic" list="lnTopicList" placeholder="Topic (detected as you type)" value="' + esc(n.topic) + '"><datalist id="lnTopicList"></datalist>' +
          '<span class="chip ln-auto" id="lnAuto"' + (n.topicAuto && n.topic ? '' : ' hidden') + ' title="Picked automatically from what you wrote. Type your own topic to override it.">✨ auto</span>' +
        '</div>' +
      '</div>' +
      '<div class="ln-toolbar" role="toolbar" aria-label="Formatting">' +
        [['bold', '<b>B</b>', 'Bold (Ctrl+B)'], ['italic', '<i>I</i>', 'Italic (Ctrl+I)'], ['underline', '<u>U</u>', 'Underline (Ctrl+U)'], ['h3', 'H', 'Heading'],
          ['ul', '• List', 'Bullet list'], ['ol', '1. List', 'Numbered list'], ['mark', '<mark>Highlight</mark>', 'Highlight'], ['clear', '⌫ Format', 'Clear formatting']].map(function (b) {
          return '<button type="button" data-cmd="' + b[0] + '" title="' + b[2] + '">' + b[1] + '</button>';
        }).join('') +
        '<span class="ln-status" id="lnStatus">' + (notePending[n.id] ? 'Saving…' : n._draft ? 'Start typing' : 'Saved') + '</span>' +
      '</div>' +
      '<div class="ln-body" id="lnBody" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Note" data-placeholder="Type as you listen… mention a case or statute and the topic is picked up automatically.">' + n.html + '</div>' +
      '<div class="ln-detect" id="lnDetect"></div>' +
      '<div class="ln-actions">' +
        '<button type="button" class="btn btn-sm" data-ln="card">＋ Make a card from this</button>' +
        '<button type="button" class="btn btn-sm" data-ln="ask">? Ask about this note</button>' +
        '<button type="button" class="btn btn-sm btn-ghost danger" data-ln="delete">Delete note</button>' +
      '</div>';
    fillNoteTopics(n.module);
    renderDetect(n);
  }
  function fillNoteTopics(mod) {
    var set = {};
    state.entries.forEach(function (e) { if ((!mod || e.module === mod) && e.topic) set[e.topic] = true; });
    (TOPIC_SUGGESTIONS[mod] || []).forEach(function (t) { set[t] = true; });
    var dl = $('#lnTopicList'); if (dl) dl.innerHTML = Object.keys(set).sort().map(function (t) { return '<option value="' + esc(t) + '">'; }).join('');
  }
  function renderDetect(n) {
    var box = $('#lnDetect'); if (!box) return;
    var linked = n.linked.map(byId).filter(Boolean);
    box.innerHTML = linked.length
      ? '<span>Mentions:</span>' + linked.slice(0, 10).map(function (e) { return '<button type="button" data-peek-card="' + esc(e.id) + '">' + (e.key ? '★ ' : '') + esc(e.name.split(' – ')[0]) + '</button>'; }).join('') + (linked.length > 10 ? '<span class="muted">+' + (linked.length - 10) + '</span>' : '')
      : '';
  }
  function setNoteStatus(t) { var s = $('#lnStatus'); if (s) s.textContent = t; }
  var detectTimer = null;
  function noteEdited(field) {
    var n = ln && noteById(ln.noteId); if (!n) return;
    if (field === 'body') { n.html = cleanNoteHTML($('#lnBody').innerHTML); n.text = noteTextFromHTML(n.html); }
    else if (field === 'title') n.title = $('#lnTitle').value.trim() || 'Untitled note';
    else if (field === 'module') { n.module = $('#lnModule').value; fillNoteTopics(n.module); }
    else if (field === 'topic') { n.topic = $('#lnTopic').value.trim(); n.topicAuto = false; $('#lnAuto').hidden = true; }
    if (n._draft) { if (!n.text && field !== 'title') return; delete n._draft; }
    n.updatedAt = nowISO();
    persistNote(n);
    clearTimeout(detectTimer);
    detectTimer = setTimeout(function () { runDetection(n); renderNoteList(); }, field === 'body' ? 600 : 0);
  }
  function runDetection(n) {
    var r = detectTopic(n.text + '\n' + n.title, n.module);
    var changed = JSON.stringify(r.mentions) !== JSON.stringify(n.linked);
    n.linked = r.mentions;
    if (r.best && (n.topicAuto || !n.topic)) {
      if (!n.module) { n.module = r.best.module; if (ln && ln.noteId === n.id && $('#lnModule')) { $('#lnModule').value = n.module; fillNoteTopics(n.module); } }
      if (r.best.module === n.module && n.topic !== r.best.topic) { n.topic = r.best.topic; n.topicAuto = true; changed = true; }
      if (ln && ln.noteId === n.id && $('#lnTopic')) { $('#lnTopic').value = n.topic; $('#lnAuto').hidden = !n.topicAuto; }
    }
    if (changed) { n.updatedAt = nowISO(); persistNote(n); }
    if (ln && ln.noteId === n.id) renderDetect(n);
  }
  function noteCommand(cmd) {
    var body = $('#lnBody'); if (!body) return;
    body.focus();
    try {
      if (cmd === 'h3') { var cur = (document.queryCommandValue('formatBlock') || '').toLowerCase(); document.execCommand('formatBlock', false, cur === 'h3' ? 'p' : 'h3'); }
      else if (cmd === 'ul') document.execCommand('insertUnorderedList');
      else if (cmd === 'ol') document.execCommand('insertOrderedList');
      else if (cmd === 'mark') {
        var sel = window.getSelection(), txt = sel ? String(sel) : '';
        if (txt) document.execCommand('insertHTML', false, '<mark>' + esc(txt).replace(/\n/g, '<br>') + '</mark>&#8203;');
      } else if (cmd === 'clear') { document.execCommand('removeFormat'); document.execCommand('formatBlock', false, 'p'); }
      else document.execCommand(cmd);
    } catch (e) { /* unsupported in this browser */ }
    noteEdited('body');
  }
  function noteAction(a) {
    var n = ln && noteById(ln.noteId);
    if (a === 'new') { discardEmptyDraft(); var mod = ln.module !== 'all' ? ln.module : (n ? n.module : (state.filter !== 'all' ? state.filter : '')); ln.noteId = makeNote(mod).id; ln.forEntry = null; ln.showList = false; renderNoteList(); renderNoteEditor(); setTimeout(function () { $('#lnBody').focus(); }, 30); return; }
    if (a === 'list') { ln.showList = !ln.showList; renderNoteEditor(); return; }
    if (a === 'clear-for') { ln.forEntry = null; renderNoteList(); return; }
    if (!n) return;
    if (a === 'card') {
      var sel = window.getSelection(), body = $('#lnBody');
      var text = sel && body && body.contains(sel.anchorNode) && String(sel).trim() ? String(sel).trim() : n.text;
      openForm(null);
      if (n.module) $('#fModule').value = n.module;
      fillTopicSuggestions($('#fModule').value);
      $('#fTopic').value = n.topic;
      rtSet($('#fFacts'), text.slice(0, 4000));
    } else if (a === 'ask') {
      openAsk(null);
      $('#askInput').value = 'Explain the key points from my lecture note "' + n.title + '"' + (n.topic ? ' on ' + n.topic : '') + ' and check them against my cards and sources.';
    } else if (a === 'delete') {
      dialog({ title: 'Delete this note?', message: '“' + n.title + '” will be deleted.', buttons: [{ label: 'Cancel', value: false }, { label: 'Delete', value: true, style: 'btn-danger' }] }).then(function (ok) {
        if (!ok) return;
        var copy = JSON.parse(JSON.stringify(noteForStorage(n))), wasDraft = n._draft;
        state.notes = state.notes.filter(function (x) { return x !== n; });
        if (!wasDraft) deleteNoteStore(n.id);
        ln.noteId = null; renderNoteList(); renderNoteEditor(); renderAll();
        if (!wasDraft) toast('Note deleted.', { actionLabel: 'Undo', timeout: 8000, onAction: function () { var r = sanitizeNote(copy); state.notes.push(r); persistNote(r, true); if (ln && !$('#lnModal').hidden) { ln.noteId = r.id; renderNoteList(); renderNoteEditor(); } renderAll(); } });
      });
    }
  }
  function bindNotes() {
    $('#notesBtn').addEventListener('click', function () { openLectureNotes({}); });
    $('#lnNewBtn').addEventListener('click', function () { noteAction('new'); });
    $('#lnListBtn').addEventListener('click', function () { noteAction('list'); });
    $('#lnSearch').addEventListener('input', function (ev) { ln.query = ev.target.value; renderNoteList(); });
    $('#lnModuleFilter').addEventListener('change', function (ev) { ln.module = ev.target.value; renderNoteList(); });
    $('#lnList').addEventListener('click', function (ev) {
      var it = ev.target.closest('[data-note]');
      if (it) { if (it.getAttribute('data-note') !== ln.noteId) discardEmptyDraft(); ln.noteId = it.getAttribute('data-note'); ln.showList = false; renderNoteList(); renderNoteEditor(); return; }
      var b = ev.target.closest('[data-ln]'); if (b) noteAction(b.getAttribute('data-ln'));
    });
    var ed = $('#lnEditor');
    ed.addEventListener('input', function (ev) {
      if (ev.target.id === 'lnBody') noteEdited('body');
      else if (ev.target.id === 'lnTitle') noteEdited('title');
      else if (ev.target.id === 'lnTopic') noteEdited('topic');
    });
    ed.addEventListener('change', function (ev) { if (ev.target.id === 'lnModule') noteEdited('module'); });
    ed.addEventListener('mousedown', function (ev) { if (ev.target.closest('[data-cmd]')) ev.preventDefault(); });
    ed.addEventListener('click', function (ev) {
      var c = ev.target.closest('[data-cmd]'); if (c) { noteCommand(c.getAttribute('data-cmd')); return; }
      var p = ev.target.closest('[data-peek-card]'); if (p) { openPeek(p.getAttribute('data-peek-card')); return; }
      var b = ev.target.closest('[data-ln]'); if (b) noteAction(b.getAttribute('data-ln'));
    });
    ed.addEventListener('paste', function (ev) {
      if (ev.target.closest('#lnBody') && ev.clipboardData) {
        ev.preventDefault();
        var t = ev.clipboardData.getData('text/plain');
        try { document.execCommand('insertText', false, t); } catch (e) { /* ignore */ }
      }
    });
    ed.addEventListener('keydown', function (ev) {
      if (ev.target.id !== 'lnBody') return;
      if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && (ev.key === 'h' || ev.key === 'H')) { ev.preventDefault(); noteCommand('mark'); }
      if (ev.key === 'Tab') { ev.preventDefault(); try { document.execCommand(ev.shiftKey ? 'outdent' : 'indent'); } catch (e) { /* ignore */ } }
    });
    $('#lnModal')._onClose = function () {
      var n = ln && noteById(ln.noteId);
      if (n && !n._draft) { if (notePending[n.id]) persistNote(n, true); runDetection(n); }
      discardEmptyDraft();
      renderAll();
    };
  }

  /* ---- comments and key authorities on cards ---- */
  function addCommentTo(id) {
    var e = byId(id); if (!e) return;
    state.commentFor = id;
    $('#commentCard').textContent = e.name;
    $('#commentText').value = '';
    openModal($('#commentModal'));
    setTimeout(function () { $('#commentText').focus(); }, 30);
  }
  function saveComment() {
    var e = byId(state.commentFor), t = $('#commentText').value.trim();
    if (!e || !t) { closeModal($('#commentModal')); return; }
    e.comments = (e.comments || []).concat([{ id: uid('c'), text: t.slice(0, 4000), at: nowISO() }]).slice(-50);
    e.updatedAt = nowISO();
    closeModal($('#commentModal'));
    commit();
    if (!$('#peekModal').hidden) openPeekRefresh(e.id);
    if (!$('#reviewModal').hidden) renderReview();
    toast('Comment added.', { type: 'success' });
  }
  function deleteComment(id, cid) {
    var e = byId(id); if (!e) return;
    var before = e.comments.slice();
    e.comments = e.comments.filter(function (c) { return c.id !== cid; });
    e.updatedAt = nowISO(); commit();
    if (!$('#peekModal').hidden) openPeekRefresh(id);
    toast('Comment deleted.', { actionLabel: 'Undo', onAction: function () { e.comments = before; e.updatedAt = nowISO(); commit(); if (!$('#peekModal').hidden) openPeekRefresh(id); } });
  }
  function commentsHTML(e) {
    if (!e.comments || !e.comments.length) return '';
    return '<div class="card-comments"><div class="field-label">💬 My comments</div>' + e.comments.map(function (c) {
      return '<div class="comment"><div class="field-text hideable">' + highlight(c.text) + '</div><small>' + formatDate(c.at) +
        ' · <button type="button" class="linklike" data-action="del-comment" data-cid="' + esc(c.id) + '">Delete</button></small></div>';
    }).join('') + '</div>';
  }
  function notesLine(e) {
    var n = notesForEntry(e).length;
    return n ? '<div class="related-line"><span>Lecture notes:</span><button type="button" data-action="notes-for">📝 ' + plural(n, 'note') + '</button></div>' : '';
  }

