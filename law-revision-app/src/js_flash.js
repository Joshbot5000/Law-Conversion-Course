  /* ------------------------------------------------------------------
     U7. QUICK TEST — "Generate a principle / case / statute": a random
         card from the topics you choose, shown flashcard-style. It picks
         from your own cards (never invents law), leaning towards the ones
         you find hard or haven't tested yet, and records how you did.
     ------------------------------------------------------------------ */
  var fl = null;
  var FL_TYPES = {
    principle: { label: 'principle', icon: '§', ask: 'State the rule as precisely as you can — and the key authorities for it.' },
    'case': { label: 'case', icon: '⚖', ask: 'What is the legal principle (ratio)? What were the material facts, and how would you use it in an exam?' },
    statute: { label: 'statute', icon: '📜', ask: 'What does this provision say, when does it apply, and what is its effect?' }
  };

  function openFlash(type) {
    if (!fl) fl = { module: state.filter, topics: [], type: null, card: null, revealed: false, recent: [], n: 0, r: 0, missed: [], seenTopics: {} };
    if (type) generateFlash(type); else { fl.card = null; renderFlash(); }
    openModal($('#flashModal'));
  }
  function flashPool(type) {
    var sel = {}; fl.topics.forEach(function (k) { sel[k] = true; });
    return state.entries.filter(function (e) {
      return e.type === type && (e.ratio || e.facts) && (fl.module === 'all' || e.module === fl.module) && (!fl.topics.length || sel[topicKey(e)]);
    });
  }
  function generateFlash(type) {
    var pool = flashPool(type);
    fl.type = type;
    if (!pool.length) { fl.card = null; renderFlash(); return; }
    var recent = {}; fl.recent.slice(-Math.min(15, pool.length - 1)).forEach(function (id) { recent[id] = true; });
    var cands = pool.filter(function (e) { return !recent[e.id]; });
    if (!cands.length) cands = pool;
    // Weighted pick: weaker and never-tested cards come up more often, but anything can appear.
    var weights = cands.map(function (e) {
      var a = state.perf.c[e.id];
      return 1 + 2 * cardWeakness(e) + (!a || !a[PC_FN] ? 0.8 : 0) + (e.key ? 0.6 : 0);
    });
    var sum = weights.reduce(function (x, y) { return x + y; }, 0), r = Math.random() * sum, i = 0;
    while (r > weights[i] && i < cands.length - 1) { r -= weights[i]; i++; }
    fl.card = cands[i].id; fl.revealed = false;
    fl.recent.push(fl.card);
    renderFlash();
    setTimeout(function () { var b = $('#flShow'); if (b) b.focus(); }, 30);
  }
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
    return '<div class="fl-gen">' + ['principle', 'case', 'statute'].map(function (t) {
      var n = flashPool(t).length;
      return '<button type="button" class="fl-gen-btn' + (fl.type === t && fl.card ? ' on' : '') + '" data-flgen="' + t + '"' + (n ? '' : ' disabled') + '>' +
        '<span class="fl-ico">' + FL_TYPES[t].icon + '</span><b>Generate a ' + FL_TYPES[t].label + '</b><small>' + (n ? 'from ' + cardsWord(n) : 'none in these topics') + '</small></button>';
    }).join('') + '</div>';
  }
  function renderFlash() {
    var body = $('#flashBody'), foot = $('#flashFoot');
    var scope = '<div class="fl-scope-row"><div class="form-field"><label class="lbl" for="flModule">Module</label><select id="flModule"><option value="all">All modules</option>' + moduleOptions(fl.module) + '</select></div></div>' + flashTopicsHTML();
    var e = fl.card ? byId(fl.card) : null;
    if (!e) {
      body.innerHTML = '<p class="muted" style="margin-top:0">A quick check of what you know. Pick what to test and a random card comes up from your own library — cards you find hard, or haven\'t tested yet, come up more often.</p>' +
        flashButtonsHTML() + scope +
        (fl.type && !flashPool(fl.type).length ? '<p class="step-note warn" style="margin-top:12px">There are no ' + FL_TYPES[fl.type].label + ' cards in those topics.</p>' : '');
      foot.innerHTML = (fl.n ? '<button type="button" class="btn spacer" data-fl="end">See how I did (' + fl.r + '/' + fl.n + ')</button>' : '<span class="spacer"></span>') + '<button type="button" class="btn" data-close>Close</button>';
      return;
    }
    var T = FL_TYPES[e.type] || FL_TYPES.principle, L = LABELS[e.type];
    var front = '<div class="fl-card"><div class="fl-meta"><span class="chip">' + T.icon + ' ' + esc(cap(T.label)) + '</span><span class="chip">' + esc(MODULE_LABEL[e.module]) + ' › ' + esc(e.topic || '—') + '</span>' +
        (e.key ? '<span class="chip chip-key">★ Key authority</span>' : '') + '</div>' +
      '<h3 class="fl-title">' + esc(e.name) + '</h3>' +
      (e.citation && e.type !== 'principle' ? '<div class="fl-cite">' + esc(e.citation) + '</div>' : '') +
      '<p class="fl-ask">' + T.ask + '</p>' +
      (!fl.revealed ? '<textarea id="flRecall" class="fl-recall" rows="3" placeholder="Optional: jot down your answer first, then show the card."></textarea>' : '') +
      '</div>';
    var back = '';
    if (fl.revealed) {
      var blk = function (label, k, cls) { return e[k] ? '<div class="' + (cls || '') + '"><div class="field-label">' + label + '</div><div class="field-text">' + (richFieldHTML(e, k) || esc(e[k])) + '</div></div>' : ''; };
      back = '<div class="fl-back">' +
        (fl.recallText ? '<div class="fl-yours"><div class="field-label">What you wrote</div><div class="field-text">' + esc(fl.recallText) + '</div></div>' : '') +
        blk(L[1], 'ratio', 'field-ratio') +
        (e.type === 'principle' && e.citation ? '<div><div class="field-label">Key authorities</div><div class="field-text">' + esc(e.citation) + '</div></div>' : '') +
        blk(L[0], 'facts') + blk(L[2], 'strategy') +
        '<div class="fl-links"><button type="button" class="linklike" data-peek="' + esc(e.id) + '">Open the full card</button></div></div>';
    }
    body.innerHTML = flashButtonsHTML() +
      '<div class="fl-progress">' + (fl.n ? 'This session: ' + fl.r + ' of ' + fl.n + ' known' : 'First card') + '</div>' + front + back;
    foot.innerHTML = !fl.revealed
      ? '<button type="button" class="btn spacer" data-fl="change">Change topics</button><button type="button" class="btn btn-primary" id="flShow" data-fl="show">Show answer <kbd>Space</kbd></button>'
      : '<span class="foot-note spacer">How did you do?</span>' +
        '<button type="button" class="btn rate-again" data-flrate="0">✗ Didn\'t know <kbd>1</kbd></button>' +
        '<button type="button" class="btn" data-flrate="0.5">~ Partly <kbd>2</kbd></button>' +
        '<button type="button" class="btn btn-primary" data-flrate="1">✓ Knew it <kbd>3</kbd></button>';
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function rateFlash(score) {
    var e = byId(fl.card); if (!e || !fl.revealed) return;
    memoryFlash(e.id, score);
    fl.n++; fl.r += score; fl.seenTopics[topicKey(e)] = true;
    if (score < 1 && fl.missed.indexOf(e.id) === -1) fl.missed.push(e.id);
    // Something you didn't know comes up in today's review (if you've started learning it).
    var p = state.progress[e.id];
    if (score === 0 && p && p.due > Date.now()) { p.due = Date.now(); commit(); }
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
    fl.ended = { missed: fl.missed.slice() };
    fl.n = 0; fl.r = 0; fl.missed = []; fl.seenTopics = {}; fl.card = null;
  }
  function flashAction(a) {
    if (a === 'show') { var ta = $('#flRecall'); fl.recallText = ta ? ta.value.trim() : ''; fl.revealed = true; renderFlash(); }
    else if (a === 'change') { fl.card = null; renderFlash(); }
    else if (a === 'all-topics') { fl.topics = quizTopicList(fl.module).map(function (t) { return t.key; }); renderFlash(); }
    else if (a === 'no-topics') { fl.topics = []; renderFlash(); }
    else if (a === 'end') endFlash();
    else if (a === 'restart') { fl.card = null; renderFlash(); }
    else if (a === 'drill') {
      var ids = (fl.ended && fl.ended.missed) || [];
      closeModal($('#flashModal'));
      if (ids.length) openReview({ module: 'all', drillIds: ids, label: 'Quick test: cards to go over' });
    }
  }
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
      if (t.id === 'flModule') { fl.module = t.value; fl.topics = []; fl.card = null; renderFlash(); }
      else if (t.matches('[data-fltopic]')) {
        var k = t.getAttribute('data-fltopic');
        fl.topics = fl.topics.filter(function (x) { return x !== k; });
        if (t.checked) fl.topics.push(k);
        var c = $('#flTopicCount'); if (c) c.textContent = '(' + (fl.topics.length ? fl.topics.length + ' selected' : 'all topics') + ')';
        var gen = $('#flashBody .fl-gen'); if (gen) gen.outerHTML = flashButtonsHTML();
      }
    });
    document.addEventListener('keydown', function (ev) {
      if (topModal() !== $('#flashModal') || !fl || !fl.card || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var tag = (ev.target.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input' || tag === 'select') return;
      if ((ev.key === ' ' || ev.key === 'Enter') && !fl.revealed) { ev.preventDefault(); flashAction('show'); }
      else if (fl.revealed && /^[123]$/.test(ev.key)) { ev.preventDefault(); rateFlash([0, 0.5, 1][+ev.key - 1]); }
    });
  }
