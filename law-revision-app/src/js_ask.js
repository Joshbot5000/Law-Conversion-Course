  /* ------------------------------------------------------------------
     S. ASK — answers from your notes, with citations
     Works inside claude.ai ("sample" capability, on your own plan).
     As a plain file, it copies a ready-made prompt instead.
     ------------------------------------------------------------------ */
  function sampleErrorText(err) {
    var code = err && err.code;
    if (code === 'cancelled') return 'Stopped.';
    if (code === 'rate_limited') return 'You\'ve reached a usage limit for now. Try again in a little while.';
    if (code === 'session_expired') return 'Your claude.ai sign-in has expired. Sign in again, then reopen the app.';
    if (code === 'refused') return 'Claude couldn\'t answer that. Try rewording it.';
    if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed')
      return 'Using Claude isn\'t allowed in this view.';
    if (code === 'invalid_json') return 'Claude\'s reply couldn\'t be read. Try again.';
    if (code === 'prompt_too_large') return 'That was too much text to send at once.';
    return 'Something went wrong reaching Claude. Try again.';
  }
  function entryNotes(e) {
    var L = LABELS[e.type];
    return [
      e.type.charAt(0).toUpperCase() + e.type.slice(1) + ' · ' + MODULE_LABEL[e.module] + (e.topic ? ' · ' + e.topic : ''),
      'Name: ' + e.name + (e.citation ? '\n' + (e.type === 'principle' ? '' : 'Citation: ') + e.citation : ''),
      e.facts ? L[0] + ': ' + e.facts : '',
      e.ratio ? L[1] + ': ' + e.ratio : '',
      e.strategy ? L[2] + ': ' + e.strategy : '',
      e.key ? 'Marked by the student as a KEY AUTHORITY.' : '',
      e.comments && e.comments.length ? 'Student\'s comments: ' + e.comments.map(function (c) { return c.text; }).join(' | ') : ''
    ].filter(Boolean).join('\n');
  }

  // Tiny, safe formatter: escape everything, then allow **bold**, bullets and [C1]/[S2] citations.
  function formatAnswer(text, refs) {
    var out = [], list = null;
    var inline = function (t) {
      var h = esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
      return h.replace(/\[((?:[CS]\d+)(?:\s*[,;]\s*[CS]\d+)*)\]/g, function (m, ids) {
        return ids.split(/\s*[,;]\s*/).map(function (id) {
          var known = refs && refs[id];
          return known ? '<button type="button" class="cite' + (id.charAt(0) === 'S' ? ' s' : '') + '" data-cite="' + id + '" title="' + esc(known.label) + '">' + id + '</button>' : '<span class="cite">' + id + '</span>';
        }).join('');
      });
    };
    String(text).split(/\n/).forEach(function (line) {
      var m = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
      if (m) { (list = list || []).push('<li>' + inline(m[1]) + '</li>'); return; }
      if (list) { out.push('<ul>' + list.join('') + '</ul>'); list = null; }
      if (line.trim()) out.push('<p>' + inline(line.replace(/^#+\s*/, '')) + '</p>');
    });
    if (list) out.push('<ul>' + list.join('') + '</ul>');
    return out.join('');
  }

  /* ---------- retrieval: plain keyword scoring (BM25-style) ---------- */
  var STOP = {};
  ('the a an and or of to in on for by with as at is are was were be been it its this that these those from which who whom whose what when where how why not no but if then than so such can could may might must shall should will would do does did has have had there their they them he she his her you your i we our us me my about into over under also any all each other more most only same own very just between because while during before after above below again further once here both few some nor too out up down off per via upon within without whether either neither').split(' ').forEach(function (w) { STOP[w] = 1; });
  function tokens(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2 && !STOP[w]; })
      .map(function (w) { return w.length > 4 ? w.replace(/(ies|es|s)$/, function (x) { return x === 'ies' ? 'y' : ''; }) : w; });
  }
  var passageIndex = { bySource: {} };
  function indexSource(sid, text) {
    if (passageIndex.bySource[sid]) return passageIndex.bySource[sid];
    var out = [], pages = text.split('\f');
    pages.forEach(function (pg, pi) {
      var buf = '';
      var flush = function () {
        if (buf.trim().length > 40) {
          var tf = {}, toks = tokens(buf);
          toks.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
          out.push({ sid: sid, page: pages.length > 1 ? pi + 1 : 0, text: buf.trim(), tf: tf, len: toks.length });
        }
        buf = '';
      };
      pg.split(/\n\s*\n|\n(?=[A-Z0-9(•\-])/).forEach(function (para) {
        if (buf.length + para.length > 1100) flush();
        buf += para + '\n';
        if (buf.length > 1400) flush();
      });
      flush();
    });
    passageIndex.bySource[sid] = out;
    return out;
  }
  function rankItems(items, query, getTf, getLen, limit) {
    var q = tokens(query);
    if (!q.length || !items.length) return [];
    var df = {}, N = items.length, avg = 0;
    items.forEach(function (it) { avg += getLen(it); var tf = getTf(it); q.forEach(function (t) { if (tf[t]) df[t] = (df[t] || 0) + 1; }); });
    avg = avg / N || 1;
    return items.map(function (it) {
      var tf = getTf(it), len = getLen(it), s = 0;
      q.forEach(function (t) {
        if (!tf[t]) return;
        var idf = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
        s += idf * (tf[t] * 2.2) / (tf[t] + 1.2 * (0.25 + 0.75 * len / avg));
      });
      return { it: it, s: s };
    }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, limit).map(function (x) { return x.it; });
  }
  var cardTfCache = {};
  function cardTf(e) {
    var key = e.id + '|' + e.updatedAt;
    if (cardTfCache[e.id] && cardTfCache[e.id].key === key) return cardTfCache[e.id];
    var tf = {}, toks = tokens([e.name, e.name, e.topic, e.citation, e.ratio, e.facts, e.strategy, e.tags.join(' ')].join(' '));
    toks.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
    cardTfCache[e.id] = { key: key, tf: tf, len: toks.length };
    return cardTfCache[e.id];
  }
  function loadAllSources(module) {
    var list = state.sources.filter(function (s) { return !module || module === 'all' || !s.module || s.module === module; });
    return Promise.all(list.map(function (s) {
      return loadSourceText(s.id).then(function (t) { return indexSource(s.id, t); }, function () { return []; });
    })).then(function (lists) { return [].concat.apply([], lists); });
  }

  var ask = { entryId: null, turns: [], ctl: null, busy: false, refs: {}, refOrder: [], nextC: 1, nextS: 1 };
  var ASK_PRESETS = [
    { label: 'Explain like I\'m 5', q: 'Explain this like I\'m 5: very simple words and an everyday analogy, then one sentence saying how the real legal rule maps onto the analogy.' },
    { label: 'Plain English', q: 'Explain this in plain English, as a friendly tutor would, in a few short paragraphs.' },
    { label: 'Give me an example', q: 'Give me a simple example scenario showing this rule in action, then say why the rule applies to it.' },
    { label: 'How do I use it in an exam?', q: 'How would I use this in a problem question answer? Show a short model IRAC paragraph applying it.' },
    { label: 'Common mistakes', q: 'What might a student confuse or get wrong about this, and how do I avoid it?' },
    { label: 'Test me', q: 'Ask me 3 short questions to check I understand this. Put the answers at the end under "Answers".' }
  ];
  function askEntry() { return ask.entryId ? byId(ask.entryId) : null; }
  function addRef(kind, key, data) {
    for (var id in ask.refs) if (ask.refs[id].key === key) return id;
    var id2 = kind + (kind === 'C' ? ask.nextC++ : ask.nextS++);
    data.key = key;
    ask.refs[id2] = data;
    ask.refOrder.push(id2);
    return id2;
  }
  // Pick the cards and source passages most relevant to this question.
  function gatherContext(question) {
    var e = askEntry();
    var module = e ? e.module : state.filter;
    var query = question + (e ? ' ' + e.name + ' ' + e.topic + ' ' + e.ratio : '');
    if (e) addRef('C', 'c:' + e.id, { type: 'card', id: e.id, label: e.name });
    var pool = state.entries.filter(function (x) { return module === 'all' || x.module === module; });
    rankItems(pool, query, function (x) { return cardTf(x).tf; }, function (x) { return cardTf(x).len; }, 6)
      .forEach(function (x) { addRef('C', 'c:' + x.id, { type: 'card', id: x.id, label: x.name }); });
    return loadAllSources(module).then(function (passages) {
      if (e && e.sourceQuote && e.sourceId) {
        var own = (passageIndex.bySource[e.sourceId] || []).filter(function (p) { return findQuote(p.text, e.sourceQuote); })[0];
        if (own) addRef('S', 's:' + own.sid + ':' + own.text.slice(0, 40), { type: 'passage', p: own, label: sourceById(own.sid).title + (own.page ? ', p. ' + own.page : '') });
      }
      rankItems(passages, query, function (p) { return p.tf; }, function (p) { return p.len; }, 6).forEach(function (p) {
        var s = sourceById(p.sid);
        addRef('S', 's:' + p.sid + ':' + p.text.slice(0, 40), { type: 'passage', p: p, label: (s ? s.title : 'Source') + (p.page ? ', p. ' + p.page : '') });
      });
      var notePassages = [];
      state.notes.forEach(function (n) {
        if (n._draft || !n.text || (module !== 'all' && n.module && n.module !== module)) return;
        n.text.split(/\n\s*\n/).reduce(function (acc, para) {
          if (acc.length && acc[acc.length - 1].length + para.length < 900) acc[acc.length - 1] += '\n\n' + para; else acc.push(para);
          return acc;
        }, []).forEach(function (chunk, i) {
          var toks = tokens(chunk + ' ' + n.topic), tf = {};
          toks.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
          notePassages.push({ noteId: n.id, i: i, text: chunk, tf: tf, len: toks.length || 1, title: n.title });
        });
      });
      rankItems(notePassages, query, function (p) { return p.tf; }, function (p) { return p.len; }, 4).forEach(function (p) {
        addRef('S', 'n:' + p.noteId + ':' + p.i, { type: 'note', p: p, label: 'Lecture note: ' + p.title });
      });
      // Keep the material to a sensible size: newest 10 cards and 10 passages.
      var cs = ask.refOrder.filter(function (id) { return id.charAt(0) === 'C'; }).slice(-10);
      var ss = ask.refOrder.filter(function (id) { return id.charAt(0) === 'S'; }).slice(-10);
      return cs.concat(ss);
    });
  }
  function materialText(ids) {
    return ids.map(function (id) {
      var r = ask.refs[id];
      if (r.type === 'card') { var c = byId(r.id); return c ? '[' + id + '] CARD\n' + entryNotes(c) : ''; }
      if (r.type === 'note') return '[' + id + '] THE STUDENT\'S OWN LECTURE NOTE — ' + r.p.title + '\n"' + r.p.text.slice(0, 1500) + '"';
      return '[' + id + '] SOURCE EXTRACT — ' + r.label + '\n"' + r.p.text.slice(0, 1500) + '"';
    }).filter(Boolean).join('\n\n');
  }
  function askRules(mode) {
    var common = 'You are a patient, encouraging tutor for a law student on an English and Welsh law conversion course (PGDL/SQE). UK spelling. Keep answers to roughly 120-300 words unless asked for more. Plain text: short paragraphs, "- " bullets and **bold** allowed; no headings or tables.';
    if (mode === 'notes') return common + '\n\nAnswer using ONLY the material below: the student\'s own cards [C#] and extracts from their own sources and lecture notes [S#]. Lecture notes are the student\'s own jottings and may contain mistakes; if one conflicts with a card or source, say so. After each sentence or bullet that states law, cite where it comes from in square brackets, e.g. [C2] or [S1]. You may explain simply (analogies, plain words) but every legal point must come from the material. If the material does not answer the question, say "Your notes don\'t cover this." and suggest what to look up; do not answer from general knowledge. If a card and a source disagree, point it out.';
    return common + '\n\nUse the material below first and cite it in square brackets ([C2], [S1]). You may add general knowledge of English and Welsh law where the material is silent, but end each such sentence with "(general knowledge — check)". Only mention cases or statutes you are certain exist, and never invent citations, years or quotations. If a card looks wrong, say so.';
  }

  function refreshAskMode() {
    var live = !!claudeCaps.sample;
    $('#askSendBtn').textContent = live ? 'Ask' : 'Copy question for Claude';
    $('#askHint').innerHTML = live
      ? (state.settings.askMode === 'notes' ? 'Answers come only from your cards and sources, with references you can click. ' : 'Answers may add general knowledge, marked for you to check. ') + '<b>Ctrl/⌘ + Enter</b> to send.'
      : 'Live answers work when this app is opened in claude.ai. Here, your question is copied with the relevant notes so you can paste it into a Claude chat.';
    $('#askModeNotes').checked = state.settings.askMode === 'notes';
    $('#askModeOpen').checked = state.settings.askMode === 'open';
  }
  function resetAsk() {
    stopAsk();
    ask.turns = []; ask.refs = {}; ask.refOrder = []; ask.nextC = 1; ask.nextS = 1;
    $('#askThread').innerHTML = '';
  }
  function openAsk(id) {
    if (ask.entryId !== (id || null)) resetAsk();
    ask.entryId = id || null;
    var e = askEntry();
    $('#askModalTitle').textContent = e ? 'Ask about this' : 'Ask about a concept';
    $('#askContext').innerHTML = e
      ? typeBadge(e) + '<b>' + esc(e.name) + '</b>' + (e.topic ? '<span>' + esc(e.topic) + '</span>' : '')
      : '<span>Ask anything you\'re unsure about' + (state.filter !== 'all' ? ' in <b>' + esc(MODULE_LABEL[state.filter]) + '</b>' : '') + '. The most relevant cards and source passages are found for you.</span>';
    $('#askPresets').innerHTML = ASK_PRESETS.map(function (p, i) { return '<button type="button" class="btn btn-sm" data-preset="' + i + '">' + esc(p.label) + '</button>'; }).join('');
    $('#askPresets').hidden = !e;
    refreshAskMode();
    openModal($('#askModal'));
    setTimeout(function () { $('#askInput').focus(); }, 30);
  }
  function stopAsk() { if (ask.ctl) { ask.ctl.abort(); ask.ctl = null; } }
  function setAskBusy(b) { ask.busy = b; $('#askSendBtn').disabled = b; $('#askStopBtn').hidden = !b; }

  function sendAsk(question) {
    question = (question || '').trim();
    if (!question) { toast('Type a question first, or pick one of the buttons.', { type: 'error' }); $('#askInput').focus(); return; }
    if (ask.busy) return;
    var mode = state.settings.askMode;
    setAskBusy(true);
    var thread = $('#askThread');
    var q = document.createElement('div'); q.className = 'ask-q'; q.textContent = question;
    var a = document.createElement('div'); a.className = 'ask-a';
    a.innerHTML = '<div class="ask-mode-tag">' + (mode === 'notes' ? 'From your notes' : 'Notes + general knowledge') + '</div><div class="ask-text thinking">Finding the relevant parts of your notes…</div>';
    if (claudeCaps.sample) { $('#askInput').value = ''; thread.appendChild(q); thread.appendChild(a); a.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    var textEl = a.querySelector('.ask-text');
    gatherContext(question).then(function (ids) {
      var material = materialText(ids);
      var lead = askRules(mode) + '\n\n=== MATERIAL ===\n' + (material || '(none found)');
      var turns = [{ role: 'user', content: lead }].concat(ask.turns.slice(-8)).concat([{ role: 'user', content: question }]);
      if (!claudeCaps.sample) {
        setAskBusy(false);
        copyOrShow(turns.map(function (t) { return (t.role === 'assistant' ? 'CLAUDE (earlier): ' : '') + t.content; }).join('\n\n'), 'Copied. Paste it into a Claude chat.');
        return;
      }
      textEl.textContent = 'Thinking…';
      var ctl = new AbortController();
      ask.ctl = ctl;
      var refsNow = {}; ids.forEach(function (id) { refsNow[id] = ask.refs[id]; });
      return claudeCaps.sample(turns, {
        cache: false, signal: ctl.signal,
        onText: function (u) { textEl.classList.remove('thinking'); textEl.innerHTML = formatAnswer(u.text, refsNow); }
      }).then(function (res) {
        textEl.innerHTML = formatAnswer(res.text, refsNow);
        ask.turns.push({ role: 'user', content: question }, { role: 'assistant', content: res.text });
        if (res.truncated) addAskNote(a, 'The answer was cut short. Ask for a shorter version or one part at a time.');
        addCiteList(a, res.text, refsNow);
        addAnswerActions(a, question, res.text);
      }, function (err) {
        var code = err && err.code;
        if (err && err.text && code !== 'refused') { textEl.classList.remove('thinking'); textEl.innerHTML = formatAnswer(err.text, refsNow); }
        else textEl.hidden = true;
        addAskNote(a, sampleErrorText(err));
        if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].indexOf(code) !== -1) { claudeCaps.sample = null; refreshAskMode(); }
        if (code !== 'cancelled') $('#askInput').value = $('#askInput').value || question;
      }).then(function () { if (ask.ctl === ctl) ask.ctl = null; });
    }).then(function () { setAskBusy(false); }, function () { setAskBusy(false); textEl.textContent = 'Couldn\'t load your sources. Try again.'; });
  }
  function addAskNote(a, msg) { var n = document.createElement('div'); n.className = 'ask-note'; n.textContent = msg; a.appendChild(n); }
  function addCiteList(a, text, refs) {
    var used = {}, re = /\[((?:[CS]\d+)(?:\s*[,;]\s*[CS]\d+)*)\]/g, m;
    while ((m = re.exec(text))) m[1].split(/\s*[,;]\s*/).forEach(function (id) { if (refs[id]) used[id] = true; });
    var ids = Object.keys(used).sort(function (x, y) { return x.charAt(0) === y.charAt(0) ? +x.slice(1) - +y.slice(1) : x < y ? -1 : 1; });
    if (!ids.length) return;
    var box = document.createElement('div'); box.className = 'cite-list';
    box.innerHTML = '<div class="field-label">References</div>' + ids.map(function (id) {
      return '<button type="button" data-cite="' + id + '"><span class="cite' + (id.charAt(0) === 'S' ? ' s' : '') + '">' + id + '</span><span>' + esc(refs[id].label) + '</span></button>';
    }).join('');
    a.appendChild(box);
  }
  function openCite(id) {
    var r = ask.refs[id];
    if (!r) return;
    if (r.type === 'card') openPeek(r.id);
    else if (r.type === 'note') openLectureNotes({ noteId: r.p.noteId });
    else openViewer(r.p.sid, { quote: r.p.text.slice(0, 160), page: r.p.page });
  }
  function addAnswerActions(a, question, text) {
    var e = askEntry();
    var row = document.createElement('div'); row.className = 'ask-actions';
    var copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn btn-sm'; copy.textContent = 'Copy';
    copy.onclick = function () { copyToClipboard(text).then(function (ok) { toast(ok ? 'Copied.' : 'Couldn\'t copy. Select the text instead.', { type: ok ? 'success' : 'error' }); }); };
    row.appendChild(copy);
    if (e) {
      var save = document.createElement('button'); save.type = 'button'; save.className = 'btn btn-sm'; save.textContent = '＋ Save to card';
      save.title = 'Add this explanation to the end of the card\'s "' + LABELS[e.type][2] + '" section';
      save.onclick = function () {
        var target = askEntry();
        if (!target) return;
        var stamp = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        var clean = text.trim().replace(/\s*\[(?:[CS]\d+)(?:\s*[,;]\s*[CS]\d+)*\]/g, '');
        target.strategy = (target.strategy ? target.strategy + '\n\n' : '') + 'My clarification (' + stamp + ') — Q: ' + question + '\n' + clean;
        target.updatedAt = nowISO();
        commit();
        save.disabled = true; save.textContent = '✓ Saved to card';
        toast('Added to “' + target.name + '”.', { type: 'success' });
      };
      row.appendChild(save);
    }
    a.appendChild(row);
  }
