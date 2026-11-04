  /* ------------------------------------------------------------------
     U7. QUICK TEST — fast checks of what you know, all from your own cards
         (never invented law):
           · Generate a principle / case / statute — flashcard style; type
             an answer first and Claude checks it against the card.
           · Distinguish two cases — two cases from the same topic; explain
             the difference and Claude checks it against both cards.
           · Fill in the blank — key words of a rule blanked out, to lock in
             the exact wording you'll quote in exams.
         Cards you find hard, or haven't tested, come up more often, and every
         result goes into your study memory.
     ------------------------------------------------------------------ */
  var fl = null;
  var FL_TYPES = {
    principle: { label: 'principle', icon: '§', ask: 'State the rule as precisely as you can — and the key authorities for it.' },
    'case': { label: 'case', icon: '⚖', ask: 'What is the legal principle (ratio)? What were the material facts, and how would you use it in an exam?' },
    statute: { label: 'statute', icon: '📜', ask: 'What does this provision say, when does it apply, and what is its effect?' }
  };
  var FL_STOP = {};
  ('about above after again against also although among another because been before being below between both cannot could does doing during each either every from further have having here into itself just least less made make many might more most must much neither never only other ought over same shall should since some such than that their them then there these they this those though through thus under unless until upon very what when where whether which while whom whose will with within without would your'
  ).split(' ').forEach(function (w) { FL_STOP[w] = true; });

  function newFl() { return { module: state.filter, topics: [], type: null, card: null, pair: null, blank: null, revealed: false, recent: [], n: 0, r: 0, missed: [], seenTopics: {}, limit: 0 }; }
  function openFlash(type) {
    if (!fl) fl = newFl();
    if (type) generateFlash(type); else { clearFlashCard(); renderFlash(); }
    if ($('#flashModal').hidden) openModal($('#flashModal'));
  }
  function clearFlashCard() { fl.card = null; fl.pair = null; fl.blank = null; fl.check = null; fl.revealed = false; fl.recallText = ''; }
  function inFlashScope(e) {
    var sel = {}; fl.topics.forEach(function (k) { sel[k] = true; });
    return (fl.module === 'all' || e.module === fl.module) && (!fl.topics.length || sel[topicKey(e)]);
  }
  function flashPool(type) {
    if (type === 'pair') return pairTopics();
    if (type === 'blank') return state.entries.filter(function (e) { return inFlashScope(e) && blankable(e); });
    return state.entries.filter(function (e) { return e.type === type && (e.ratio || e.facts) && inFlashScope(e); });
  }
  // Topics (in scope) with at least two cases that have a rule.
  function pairTopics() {
    var by = {};
    state.entries.forEach(function (e) { if (e.type === 'case' && e.ratio && e.topic && inFlashScope(e)) (by[topicKey(e)] = by[topicKey(e)] || []).push(e); });
    return Object.keys(by).filter(function (k) { return by[k].length >= 2; }).map(function (k) { return { key: k, cards: by[k] }; });
  }
  function blankable(e) { return e.ratio && e.ratio.split(/\s+/).length >= 9; }
  function pickWeighted(cands) {
    var weights = cands.map(function (e) {
      var a = state.perf.c[e.id];
      return 1 + 2 * cardWeakness(e) + (!a || !a[PC_FN] ? 0.8 : 0) + (e.key ? 0.6 : 0);
    });
    var sum = weights.reduce(function (x, y) { return x + y; }, 0), r = Math.random() * sum, i = 0;
    while (r > weights[i] && i < cands.length - 1) { r -= weights[i]; i++; }
    return cands[i];
  }
  function notRecent(list) {
    var recent = {}; fl.recent.slice(-Math.min(15, list.length - 1)).forEach(function (id) { recent[id] = true; });
    var out = list.filter(function (e) { return !recent[e.id]; });
    return out.length ? out : list;
  }
  function generateFlash(type) {
    clearFlashCard();
    fl.type = type;
    if (type === 'pair') {
      var tops = pairTopics();
      if (tops.length) {
        // A weaker topic is more likely; then the weaker / less-tested case first, and a partner from the same topic.
        var tw = tops.map(function (t) { return t.cards.reduce(function (s, e) { return s + cardWeakness(e); }, 0) / t.cards.length + 1; });
        var sum = tw.reduce(function (x, y) { return x + y; }, 0), r = Math.random() * sum, i = 0;
        while (r > tw[i] && i < tops.length - 1) { r -= tw[i]; i++; }
        var a = pickWeighted(notRecent(tops[i].cards));
        var b = pickWeighted(tops[i].cards.filter(function (e) { return e !== a; }));
        fl.pair = [a.id, b.id]; fl.recent.push(a.id, b.id);
      }
    } else if (type === 'blank') {
      var pool = flashPool('blank');
      if (pool.length) { var c = pickWeighted(notRecent(pool)); fl.blank = makeBlanks(c); fl.card = c.id; fl.recent.push(c.id); }
    } else {
      var cands = flashPool(type);
      if (cands.length) { var e = pickWeighted(notRecent(cands)); fl.card = e.id; fl.recent.push(e.id); }
    }
    renderFlash();
    setTimeout(function () { var f = $('#flashBody [data-blank]') || $('#flRecall'); if (f && type !== 'blank') f = $('#flShow') || f; if (f) f.focus(); }, 30);
  }

  /* ---- fill in the blank ---- */
  function normWord(w) { return String(w || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function makeBlanks(e) {
    var parts = e.ratio.split(/(\s+)/), cands = [];
    var words = parts.filter(function (p, i) { return i % 2 === 0; }).length;
    var want = words >= 28 ? 3 : words >= 14 ? 2 : 1;
    parts.forEach(function (p, i) {
      if (i % 2 || i === 0) return;
      var w = normWord(p);
      // Skip short or common words, numbers, and capitalised names (parties, Acts).
      if (w.length < 5 || FL_STOP[w] || /^\d+$/.test(w) || /^[A-Z]/.test(p.replace(/^[^A-Za-z]+/, ''))) return;
      cands.push({ i: i, w: w, score: w.length + Math.random() * 3 + (/(ab|ib|ence|ance|ity|tion|ness|ment|able|ible|ous|ive)$/.test(w) ? 2 : 0) });
    });
    cands.sort(function (a, b) { return b.score - a.score; });
    var chosen = [];
    cands.forEach(function (c) { if (chosen.length < want && chosen.every(function (x) { return Math.abs(x.i - c.i) > 4; })) chosen.push(c); });
    chosen.sort(function (a, b) { return a.i - b.i; });
    return { parts: parts, blanks: chosen.map(function (c) { return { i: c.i, answer: parts[c.i].replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '') }; }), checked: false, results: [] };
  }
  function lev(a, b) {
    var m = [], i, j;
    for (i = 0; i <= a.length; i++) m[i] = [i];
    for (j = 0; j <= b.length; j++) m[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  }
  // Right if it matches, allowing a small typo in longer words.
  function blankRight(given, answer) {
    var g = normWord(given), a = normWord(answer);
    if (!g) return false;
    return g === a || (a.length >= 6 && lev(g, a) <= (a.length >= 10 ? 2 : 1));
  }
  function blankHTML(b) {
    return b.parts.map(function (p, i) {
      var k = -1; b.blanks.forEach(function (x, n) { if (x.i === i) k = n; });
      if (k === -1) return esc(p);
      var x = b.blanks[k], lead = p.match(/^[^A-Za-z0-9]*/)[0], trail = p.match(/[^A-Za-z0-9]*$/)[0];
      if (!b.checked) return esc(lead) + '<input class="fl-blank" data-blank="' + k + '" autocomplete="off" spellcheck="false" aria-label="Missing word ' + (k + 1) + '" style="width:' + Math.max(5, x.answer.length + 1) + 'ch">' + esc(trail);
      var ok = b.results[k];
      return esc(lead) + '<span class="fl-blank-res ' + (ok ? 'ok' : 'bad') + '">' + (ok ? esc(x.answer) : '<s>' + esc(b.given[k] || '…') + '</s> ' + esc(x.answer)) + '</span>' + esc(trail);
    }).join('');
  }
  function checkBlanks() {
    var b = fl.blank; if (!b || b.checked) return;
    b.given = b.blanks.map(function (x, k) { var inp = $('#flashBody [data-blank="' + k + '"]'); return inp ? inp.value.trim() : ''; });
    b.results = b.blanks.map(function (x, k) { return blankRight(b.given[k], x.answer); });
    b.checked = true; fl.revealed = true;
    var score = b.results.filter(Boolean).length / b.blanks.length;
    fl.suggest = score === 1 ? 1 : score > 0 ? 0.5 : 0;
    renderFlash();
  }

  /* ---- Claude checks what you wrote (against the card only) ---- */
  function checkAnswer() {
    var cards = fl.pair ? fl.pair.map(byId).filter(Boolean) : [byId(fl.card)].filter(Boolean);
    if (!cards.length || !claudeCaps.sample || !fl.recallText) return;
    var mine = fl.check = { busy: true };
    var task = fl.pair
      ? 'The student was asked to DISTINGUISH these two cases from the same topic: how they differ in facts and principle, and when each would be used.'
      : 'The student was asked to recall this ' + (cards[0].type === 'principle' ? 'principle (the rule and its key authorities)' : cards[0].type === 'statute' ? 'statutory provision (what it says, when it applies, its effect)' : 'case (its ratio, the material facts, and how to use it)') + ' from memory.';
    var prompt = [
      'You are checking a law student\'s quick test answer against their own revision card' + (fl.pair ? 's' : '') + '. Judge ONLY against the card' + (fl.pair ? 's' : '') + ' below: do not add, assume or correct law from anywhere else. UK spelling.',
      task,
      '',
      cards.map(function (c) { return 'CARD [' + c.id + ']\n' + entryNotes(c); }).join('\n\n'),
      '',
      'STUDENT\'S ANSWER\n' + fl.recallText,
      '',
      'Reply with ONLY JSON: {"verdict": "knew" | "partly" | "missed", "right": [short points they got right], "missed": [important points from the card' + (fl.pair ? 's' : '') + ' they left out], "wrong": [anything they said that contradicts the card' + (fl.pair ? 's' : '') + ']' +
        (fl.pair ? ', "model": "a model answer of 70-120 words distinguishing the two cases, using only what the cards say"' : '') + '}. Keep each point under 20 words; at most 4 per list.'
    ].join('\n');
    renderFlash();
    claudeCaps.sample.json(prompt, { modelTier: 'quick', cache: false }).then(function (r) {
      if (fl.check !== mine) return;
      var list = function (x) { return (Array.isArray(x) ? x : []).map(function (s) { return cleanString(s, 300); }).filter(Boolean).slice(0, 4); };
      var v = r && ['knew', 'partly', 'missed'].indexOf(r.verdict) !== -1 ? r.verdict : 'partly';
      fl.check = { verdict: v, right: list(r && r.right), missed: list(r && r.missed), wrong: list(r && r.wrong), model: fl.pair ? cleanString(r && r.model, 1500) : '' };
      fl.suggest = v === 'knew' ? 1 : v === 'partly' ? 0.5 : 0;
      renderFlash();
    }, function (err) {
      if (fl.check !== mine) return;
      if (err && (err.code === 'not_granted' || err.code === 'sampling_disabled')) claudeCaps.sample = null;
      fl.check = { error: sampleErrorText(err) };
      renderFlash();
    });
  }
  function checkHTML() {
    var c = fl.check; if (!c) return '';
    if (c.busy) return '<div class="fl-check"><span class="spinner"></span>Claude is comparing your answer with the card' + (fl.pair ? 's' : '') + '…</div>';
    if (c.error) return '<div class="fl-check warn">' + esc(c.error) + ' Mark yourself instead.</div>';
    var sec = function (cls, title, items) { return items.length ? '<div class="fl-check-sec ' + cls + '"><b>' + title + '</b><ul>' + items.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>' : ''; };
    var word = { knew: '✓ You knew it', partly: '~ Partly there', missed: '✗ Not yet' }[c.verdict];
    return '<div class="fl-check v-' + c.verdict + '"><div class="fl-check-head">Claude\'s check: <b>' + word + '</b> <small>(judged only against your card' + (fl.pair ? 's' : '') + ')</small></div>' +
      sec('ok', 'You got', c.right) + sec('miss', 'You missed', c.missed) + sec('bad', 'Not what the card says', c.wrong) +
      (c.model ? '<div class="fl-check-sec model"><b>Model answer (from your cards)</b><p>' + esc(c.model) + '</p></div>' : '') + '</div>';
  }

  /* ---- rendering ---- */
  function flashTopicsHTML() {
    var list = quizTopicList(fl.module), valid = {};
    list.forEach(function (t) { valid[t.key] = true; });
    fl.topics = fl.topics.filter(function (k) { return valid[k]; });
    var lastMod = null;
    return '<details class="qz-srcbox fl-scope"' + (fl.topics.length ? ' open' : '') + '><summary><span class="lbl">Topics</span> <span class="muted" id="flTopicCount">(' +
      (fl.topics.length ? fl.topics.length + ' selected' : 'all topics') + ')</span></summary>' +
      '<div class="qz-topics-head"><span></span><span><button type="button" class="linklike" data-fl="all-topics">Select all</button> · <button type="button" class="linklike" data-fl="no-topics">Clear</button></span></div>' +
      '<div class="qz-topics">' + list.map(function (t) {
        var head = fl.module === 'all' && t.module !== lastMod ? '<div class="qz-mod">' + esc(MODULE_LABEL[t.module]) + '</div>' : '';
        lastMod = t.module;
        return head + '<label class="qz-topic"><input type="checkbox" data-fltopic="' + esc(t.key) + '"' + (fl.topics.indexOf(t.key) !== -1 ? ' checked' : '') + '><span>' + esc(t.topic) + '</span><small>' + t.count + ' cards</small></label>';
      }).join('') + '</div></details>';
  }
  function flashButtonsHTML() {
    var gen = [
      ['principle', '§', 'Generate a principle'], ['case', '⚖', 'Generate a case'], ['statute', '📜', 'Generate a statute'],
      ['pair', '⇄', 'Distinguish two cases'], ['blank', '▭', 'Fill in the blank']
    ];
    var active = fl.card || fl.pair;
    return '<div class="fl-gen">' + gen.map(function (g) {
      var n = g[0] === 'pair' ? pairTopics().length : flashPool(g[0]).length;
      var sub = !n ? 'none in these topics' : g[0] === 'pair' ? 'from ' + plural(n, 'topic') : 'from ' + cardsWord(n);
      return '<button type="button" class="fl-gen-btn' + (fl.type === g[0] && active ? ' on' : '') + '" data-flgen="' + g[0] + '"' + (n ? '' : ' disabled') + '>' +
        '<span class="fl-ico">' + g[1] + '</span><b>' + g[2] + '</b><small>' + sub + '</small></button>';
    }).join('') + '</div>';
  }
  function fieldsHTML(e) {
    var L = LABELS[e.type];
    var blk = function (label, k, cls) { return e[k] ? '<div class="' + (cls || '') + '"><div class="field-label">' + label + '</div><div class="field-text">' + (richFieldHTML(e, k) || esc(e[k])) + '</div></div>' : ''; };
    return blk(L[1], 'ratio', 'field-ratio') +
      (e.type === 'principle' && e.citation ? '<div><div class="field-label">Key authorities</div><div class="field-text">' + esc(e.citation) + '</div></div>' : '') +
      blk(L[0], 'facts') + blk(L[2], 'strategy') +
      '<div class="fl-links"><button type="button" class="linklike" data-peek="' + esc(e.id) + '">Open the full card</button></div>';
  }
  function cardHead(e, T) {
    return '<div class="fl-meta"><span class="chip">' + T.icon + ' ' + esc(cap(T.label)) + '</span><span class="chip">' + esc(MODULE_LABEL[e.module]) + ' › ' + esc(e.topic || '—') + '</span>' +
      (e.key ? '<span class="chip chip-key">★ Key authority</span>' : '') + '</div>' +
      '<h3 class="fl-title">' + esc(e.name) + '</h3>' + (e.citation && e.type !== 'principle' ? '<div class="fl-cite">' + esc(e.citation) + '</div>' : '');
  }
  function recallBox(ph) {
    return !fl.revealed ? '<textarea id="flRecall" class="fl-recall" rows="3" placeholder="' + ph + '"></textarea>' : '';
  }
  function rateButtons() {
    var s = fl.suggest, b = function (v, cls, label, key) {
      return '<button type="button" class="btn ' + cls + (s === v ? ' suggested' : '') + '" data-flrate="' + v + '">' + label + ' <kbd>' + key + '</kbd></button>';
    };
    return '<span class="foot-note spacer">' + (s != null ? 'Suggested rating is highlighted — change it if you disagree.' : 'How did you do?') + '</span>' +
      b(0, 'rate-again', '✗ Didn\'t know', 1) + b(0.5, '', '~ Partly', 2) + b(1, 'btn-primary', '✓ Knew it', 3);
  }
  function renderFlash() {
    var body = $('#flashBody'), foot = $('#flashFoot');
    var scope = '<div class="fl-scope-row"><div class="form-field"><label class="lbl" for="flModule">Module</label><select id="flModule"><option value="all">All modules</option>' + moduleOptions(fl.module) + '</select></div></div>' + flashTopicsHTML();
    var e = fl.card ? byId(fl.card) : null;
    var prog = '<div class="fl-progress">' + (fl.n ? 'This session: ' + (Math.round(fl.r * 10) / 10) + ' of ' + fl.n + ' known' : 'First card') + (fl.limit ? ' · ' + Math.min(fl.n + 1, fl.limit) + ' of ' + fl.limit : '') + '</div>';
    var canCheck = !!claudeCaps.sample;
    if (fl.pair) {
      var a = byId(fl.pair[0]), b = byId(fl.pair[1]);
      if (!a || !b) { clearFlashCard(); return renderFlash(); }
      body.innerHTML = flashButtonsHTML() + prog +
        '<div class="fl-card"><div class="fl-meta"><span class="chip">⇄ Distinguish two cases</span><span class="chip">' + esc(MODULE_LABEL[a.module]) + ' › ' + esc(a.topic) + '</span></div>' +
        '<div class="fl-pair">' + [a, b].map(function (c) { return '<div class="fl-pair-card"><h3 class="fl-title">' + esc(c.name) + '</h3>' + (c.citation ? '<div class="fl-cite">' + esc(c.citation) + '</div>' : '') + '</div>'; }).join('<span class="fl-vs">v</span>') + '</div>' +
        '<p class="fl-ask">How would you distinguish these two cases? What is the key difference in their facts or principle — and when would you rely on each in a problem question?</p>' +
        recallBox(canCheck ? 'Write your answer, then press “Check my answer” — Claude compares it with both cards.' : 'Jot down your answer, then show both cards.') + '</div>' +
        (fl.revealed ? checkHTML() + '<div class="fl-pair-back">' + [a, b].map(function (c) { return '<div class="fl-back"><div class="fl-pair-name">' + esc(c.name) + '</div>' + fieldsHTML(c) + '</div>'; }).join('') + '</div>' : '');
      foot.innerHTML = !fl.revealed
        ? '<button type="button" class="btn spacer" data-fl="change">Change topics</button>' + (canCheck ? '<button type="button" class="btn" data-fl="show">Just show the cards</button><button type="button" class="btn btn-primary" id="flShow" data-fl="check">✦ Check my answer</button>' : '<button type="button" class="btn btn-primary" id="flShow" data-fl="show">Show both cards</button>')
        : rateButtons();
      return;
    }
    if (fl.blank && e) {
      body.innerHTML = flashButtonsHTML() + prog +
        '<div class="fl-card">' + cardHead(e, { icon: '▭', label: 'fill in the blank' }) +
        '<p class="fl-ask">Fill in the missing word' + (fl.blank.blanks.length > 1 ? 's' : '') + ' of the ' + esc(LABELS[e.type][1].toLowerCase()) + ':</p>' +
        '<div class="fl-blank-text">' + blankHTML(fl.blank) + '</div></div>' +
        (fl.blank.checked ? '<div class="fl-check v-' + (fl.suggest === 1 ? 'knew' : fl.suggest ? 'partly' : 'missed') + '"><div class="fl-check-head"><b>' + fl.blank.results.filter(Boolean).length + ' of ' + fl.blank.blanks.length + ' right</b> <small>(small typos are allowed)</small></div></div>' +
          '<div class="fl-back">' + fieldsHTML(e) + '</div>' : '');
      foot.innerHTML = !fl.blank.checked
        ? '<button type="button" class="btn spacer" data-fl="change">Change topics</button><button type="button" class="btn" data-fl="giveup">Show me</button><button type="button" class="btn btn-primary" id="flShow" data-fl="blanks">Check <kbd>Enter</kbd></button>'
        : rateButtons();
      return;
    }
    if (!e) {
      body.innerHTML = '<p class="muted" style="margin-top:0">Quick checks of what you know, all from your own library. Cards you find hard, or haven\'t tested yet, come up more often.</p>' +
        flashButtonsHTML() + scope +
        (fl.type && !(fl.type === 'pair' ? pairTopics().length : flashPool(fl.type).length) ? '<p class="step-note warn" style="margin-top:12px">There\'s nothing of that kind in those topics.</p>' : '');
      foot.innerHTML = (fl.n ? '<button type="button" class="btn spacer" data-fl="end">See how I did (' + (Math.round(fl.r * 10) / 10) + '/' + fl.n + ')</button>' : '<span class="spacer"></span>') + '<button type="button" class="btn" data-close>Close</button>';
      return;
    }
    var T = FL_TYPES[e.type] || FL_TYPES.principle;
    body.innerHTML = flashButtonsHTML() + prog +
      '<div class="fl-card">' + cardHead(e, T) + '<p class="fl-ask">' + T.ask + '</p>' +
      recallBox(canCheck ? 'Optional: type your answer and Claude will check it against the card when you press Show answer.' : 'Optional: jot down your answer first, then show the card.') + '</div>' +
      (fl.revealed ? (fl.recallText ? '<div class="fl-yours"><div class="field-label">What you wrote</div><div class="field-text">' + esc(fl.recallText) + '</div></div>' : '') +
        checkHTML() + '<div class="fl-back">' + fieldsHTML(e) + '</div>' : '');
    foot.innerHTML = !fl.revealed
      ? '<button type="button" class="btn spacer" data-fl="change">Change topics</button><button type="button" class="btn btn-primary" id="flShow" data-fl="show">Show answer <kbd>Space</kbd></button>'
      : rateButtons();
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function rateFlash(score) {
    if (!fl.revealed) return;
    var ids = fl.pair ? fl.pair.slice() : fl.card ? [fl.card] : [];
    if (!ids.length) return;
    ids.forEach(function (id) {
      var e = byId(id); if (!e) return;
      memoryFlash(id, score);
      fl.seenTopics[topicKey(e)] = true;
      if (score < 1 && fl.missed.indexOf(id) === -1) fl.missed.push(id);
      // Something you didn't know comes up in today's review (if you've started learning it).
      var p = state.progress[id];
      if (score === 0 && p && p.due > Date.now()) { p.due = Date.now(); commit(); }
    });
    fl.n++; fl.r += score; fl.suggest = null;
    if (fl.limit && fl.n >= fl.limit) { endFlash(); return; }
    generateFlash(fl.type);
  }
  function endFlash() {
    memorySession('flash', fl.n, fl.r, Object.keys(fl.seenTopics));
    var body = $('#flashBody'), foot = $('#flashFoot');
    body.innerHTML = '<div class="rv-done"><h3>' + (Math.round(fl.r * 10) / 10) + ' / ' + fl.n + '</h3><p class="muted">' +
      (fl.missed.length ? 'These are worth another look — they\'ll also show up in your suggestions.' : 'You knew them all. Nice.') + '</p></div>' +
      (fl.missed.length ? '<div class="quiz-cards">' + fl.missed.map(function (id) { var c = byId(id); return c ? '<button type="button" class="tag" data-peek="' + esc(id) + '">' + esc(c.name) + '</button>' : ''; }).join('') + '</div>' : '');
    foot.innerHTML = (fl.missed.length ? '<button type="button" class="btn spacer" data-fl="drill">Review these as flashcards now</button>' : '<span class="spacer"></span>') +
      '<button type="button" class="btn" data-fl="restart">Start again</button><button type="button" class="btn btn-primary" data-close>Done</button>';
    fl.ended = { missed: fl.missed.slice(), n: fl.n, r: fl.r };
    fl.n = 0; fl.r = 0; fl.missed = []; fl.seenTopics = {}; fl.limit = 0; clearFlashCard();
  }
  function flashAction(a) {
    if (a === 'show' || a === 'check') {
      var ta = $('#flRecall'); fl.recallText = ta ? ta.value.trim() : '';
      fl.revealed = true;
      if (fl.recallText.length >= 12 && claudeCaps.sample && (a === 'check' || !fl.pair)) checkAnswer();
      else renderFlash();
    }
    else if (a === 'blanks') checkBlanks();
    else if (a === 'giveup') { var bl = fl.blank; if (bl) { flBlankClear(); checkBlanks(); } }
    else if (a === 'change') { clearFlashCard(); renderFlash(); }
    else if (a === 'all-topics') { fl.topics = quizTopicList(fl.module).map(function (t) { return t.key; }); renderFlash(); }
    else if (a === 'no-topics') { fl.topics = []; renderFlash(); }
    else if (a === 'end') endFlash();
    else if (a === 'restart') { clearFlashCard(); renderFlash(); }
    else if (a === 'drill') {
      var ids = (fl.ended && fl.ended.missed) || [];
      closeModal($('#flashModal'));
      if (ids.length) openReview({ module: 'all', drillIds: ids, label: 'Quick test: cards to go over' });
    }
  }
  function flBlankClear() { document.querySelectorAll('#flashBody [data-blank]').forEach(function (i) { i.value = ''; }); }
  function bindFlash() {
    $('#flashBtn').addEventListener('click', function () { openFlash(); });
    $('#flashModal').addEventListener('click', function (ev) {
      var g = ev.target.closest('[data-flgen]'); if (g && !g.disabled) return generateFlash(g.getAttribute('data-flgen'));
      var r = ev.target.closest('[data-flrate]'); if (r) return rateFlash(+r.getAttribute('data-flrate'));
      var a = ev.target.closest('[data-fl]'); if (a) return flashAction(a.getAttribute('data-fl'));
      var p = ev.target.closest('[data-peek]'); if (p) return openPeek(p.getAttribute('data-peek'));
    });
    $('#flashModal').addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.id === 'flModule') { fl.module = t.value; fl.topics = []; clearFlashCard(); renderFlash(); }
      else if (t.matches('[data-fltopic]')) {
        var k = t.getAttribute('data-fltopic');
        fl.topics = fl.topics.filter(function (x) { return x !== k; });
        if (t.checked) fl.topics.push(k);
        var c = $('#flTopicCount'); if (c) c.textContent = '(' + (fl.topics.length ? fl.topics.length + ' selected' : 'all topics') + ')';
        var gen = $('#flashBody .fl-gen'); if (gen) gen.outerHTML = flashButtonsHTML();
      }
    });
    $('#flashModal').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && ev.target.matches('[data-blank]')) {
        ev.preventDefault();
        var next = $('#flashBody [data-blank="' + (+ev.target.getAttribute('data-blank') + 1) + '"]');
        if (next) next.focus(); else checkBlanks();
      }
    });
    document.addEventListener('keydown', function (ev) {
      if (topModal() !== $('#flashModal') || !fl || !(fl.card || fl.pair) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var tag = (ev.target.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input' || tag === 'select') return;
      if ((ev.key === ' ' || ev.key === 'Enter') && !fl.revealed && !fl.blank) { ev.preventDefault(); flashAction(fl.pair && claudeCaps.sample ? 'check' : 'show'); }
      else if (fl.revealed && /^[123]$/.test(ev.key) && !(fl.check && fl.check.busy)) { ev.preventDefault(); rateFlash([0, 0.5, 1][+ev.key - 1]); }
    });
  }
