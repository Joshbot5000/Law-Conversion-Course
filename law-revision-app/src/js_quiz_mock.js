  /* ------------------------------------------------------------------
     U. MOCK EXAM
     ------------------------------------------------------------------ */
  function scenarioById(id) {
    var c = state.settings.mock.custom;
    if (c && c.id === id) return c;
    return SCENARIOS.filter(function (s) { return s.id === id; })[0] || null;
  }
  function relevance(entry, scenario) {
    if (scenario.cardIds && scenario.cardIds.indexOf(entry.id) !== -1) return 10;
    var text = (entry.name + ' ' + entry.topic + ' ' + entry.tags.join(' ') + ' ' + entry.ratio).toLowerCase();
    var score = 0;
    (scenario.keywords || []).forEach(function (k) { if (text.indexOf(k) !== -1) score++; });
    var shortName = entry.name.split(/,| v /i)[0].trim().toLowerCase();
    if (shortName.length > 3 && scenario.issues.join(' ').toLowerCase().indexOf(shortName) !== -1) score += 3;
    return score;
  }
  function pickScenario(moduleChoice) {
    var pool;
    if (moduleChoice && moduleChoice !== 'random') pool = SCENARIOS.filter(function (s) { return s.module === moduleChoice; });
    else {
      var mods = {};
      state.entries.forEach(function (e) { mods[e.module] = true; });
      pool = SCENARIOS.filter(function (s) { return mods[s.module]; });
      if (!pool.length) pool = SCENARIOS.slice();
    }
    var current = state.settings.mock.scenarioId;
    if (pool.length > 1) pool = pool.filter(function (s) { return s.id !== current; });
    var weights = pool.map(function (s) {
      var w = 1;
      state.entries.forEach(function (e) { if (e.module === s.module) w += Math.min(relevance(e, s), 3); });
      return w;
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  function relatedAuthorities(scenario) {
    var inModule = state.entries.filter(function (e) { return e.module === scenario.module; });
    var scored = inModule.map(function (e) { return { e: e, s: relevance(e, scenario) }; })
      .sort(function (a, b) { return b.s - a.s || a.e.name.localeCompare(b.e.name); });
    return {
      matched: scored.filter(function (x) { return x.s > 0; }).map(function (x) { return x.e; }),
      others: scored.filter(function (x) { return x.s === 0; }).map(function (x) { return x.e; })
    };
  }
  function renderScenario() {
    var s = scenarioById(state.settings.mock.scenarioId);
    if (!s) return;
    $('#scenarioTitle').textContent = s.title;
    $('#scenarioModule').textContent = MODULE_LABEL[s.module];
    $('#scenarioTopic').textContent = s.cardIds ? '✦ From your notes' : s.topic;
    $('#scenarioText').textContent = s.text;
    $('#issuesList').innerHTML = s.issues.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('');
    var rel = relatedAuthorities(s);
    var item = function (e) {
      return '<div class="lib-item">' + typeBadge(e) + '<div><button type="button" data-peek="' + esc(e.id) + '">' + esc(e.name) + '</button>' +
        (e.citation && e.type !== 'principle' ? ' <i class="muted">' + esc(e.citation) + '</i>' : '') +
        (e.topic ? '<div class="muted" style="font-size:12.5px">' + esc(e.topic) + '</div>' : '') + '</div></div>';
    };
    var html = rel.matched.length ? rel.matched.slice(0, 40).map(item).join('') : '<p class="muted" style="margin:4px 0 8px">None of your cards obviously match this topic yet.</p>';
    if (rel.others.length) html += '<div class="field-label" style="margin-top:10px">Other ' + esc(MODULE_LABEL[s.module]) + ' cards</div>' + rel.others.slice(0, 60).map(item).join('');
    $('#libraryList').innerHTML = html;
    $('#libraryCount').textContent = rel.matched.length;
    $('#gradeNote').hidden = true;
  }
  function openMock() {
    var sel = $('#mockModule');
    sel.innerHTML = '<option value="random">Random (from my modules)</option>' + moduleOptions(state.settings.mock.module);
    sel.value = state.settings.mock.module || 'random';
    if (!scenarioById(state.settings.mock.scenarioId)) {
      state.settings.mock.scenarioId = pickScenario(sel.value).id;
      state.settings.mock.answer = '';
      saveUI();
    }
    $('#mockAnswer').value = state.settings.mock.answer || '';
    $('#aiScenarioBtn').disabled = !claudeCaps.sample;
    $('#aiScenarioBtn').title = claudeCaps.sample ? 'Claude writes a new problem question that tests the law on your cards' : 'Open the app in claude.ai to use this';
    updateWordCount();
    renderScenario();
    openModal($('#mockModal'));
  }
  function confirmClearAnswer() {
    if (!$('#mockAnswer').value.trim()) return Promise.resolve(true);
    return dialog({
      title: 'Start a new question?', message: 'Your current answer will be cleared. (Tip: grade it first if you want feedback.)',
      buttons: [{ label: 'Keep working', value: false }, { label: 'New question', value: true, style: 'btn-danger' }]
    });
  }
  function setScenario(s) {
    state.settings.mock.scenarioId = s.id;
    state.settings.mock.answer = '';
    $('#mockAnswer').value = '';
    updateWordCount();
    saveUI();
    renderScenario();
    $('#scenarioText').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function newScenario() { confirmClearAnswer().then(function (ok) { if (ok) setScenario(pickScenario($('#mockModule').value)); }); }
  function aiScenario() {
    confirmClearAnswer().then(function (ok) {
      if (!ok) return;
      var choice = $('#mockModule').value, module = choice;
      if (choice === 'random') {
        var counts = {};
        state.entries.forEach(function (e) { counts[e.module] = (counts[e.module] || 0) + 1; });
        var mods = Object.keys(counts);
        module = mods.length ? mods[Math.floor(Math.random() * mods.length)] : 'contract';
      }
      var byTopic = {};
      state.entries.forEach(function (e) { if (e.module === module && e.ratio) (byTopic[e.topic || 'General'] = byTopic[e.topic || 'General'] || []).push(e); });
      var topics = Object.keys(byTopic).filter(function (t) { return byTopic[t].length >= 2; });
      if (!topics.length) { toast('Add a few more ' + MODULE_LABEL[module] + ' cards first.', { type: 'error' }); return; }
      var t1 = topics[Math.floor(Math.random() * topics.length)];
      var t2 = topics.length > 1 ? shuffle(topics.filter(function (t) { return t !== t1; }))[0] : null;
      var cards = shuffle(byTopic[t1].slice()).slice(0, 6).concat(t2 ? shuffle(byTopic[t2].slice()).slice(0, 3) : []);
      var btn = $('#aiScenarioBtn');
      btn.disabled = true; btn.textContent = 'Writing…';
      $('#scenarioText').innerHTML = '<span class="spinner"></span>Writing a problem question from your ' + esc(MODULE_LABEL[module]) + ' cards…';
      var prompt = [
        'Write an exam problem question (PGDL/SQE style, 250-400 words) for ' + MODULE_LABEL[module] + ' that tests the law on the revision cards below.',
        'Use fictional people and realistic facts that raise 3-5 issues answered by these cards, and end with an instruction such as "Advise X."',
        'Use ONLY law that appears on the cards. Do not rely on any other cases or statutes.',
        'Reply with ONLY JSON: {"title": short title, "topic": short topic label, "text": the problem question, "issues": [each issue in one sentence, naming the card(s) that answer it]}',
        '',
        'CARDS:',
        cards.map(function (e) { return '[' + e.id + ']\n' + entryNotes(e); }).join('\n\n')
      ].join('\n');
      claudeCaps.sample.json(prompt, { cache: false, modelTier: 'complex' }).then(function (r) {
        if (!r || !r.text || !Array.isArray(r.issues)) throw { code: 'invalid_json' };
        var kw = {};
        cards.forEach(function (c) { c.tags.forEach(function (t) { kw[t] = true; }); });
        var s = {
          id: 'custom-' + Date.now().toString(36), module: module, topic: cleanString(r.topic, 120) || t1,
          title: cleanString(r.title, 120) || 'Problem question', text: cleanString(r.text, 6000),
          issues: r.issues.map(function (x) { return cleanString(x, 400); }).filter(Boolean), keywords: Object.keys(kw),
          cardIds: cards.map(function (c) { return c.id; })
        };
        state.settings.mock.custom = s;
        setScenario(s);
      }).catch(function (err) {
        toast(sampleErrorText(err), { type: 'error' });
        renderScenario();
      }).then(function () { btn.disabled = !claudeCaps.sample; btn.textContent = '✦ Write one from my notes'; });
    });
  }
  function updateWordCount() {
    var words = ($('#mockAnswer').value.trim().match(/\S+/g) || []).length;
    $('#wordCount').textContent = plural(words, 'word');
  }
  function buildGradingPrompt(s, answer) {
    var rel = relatedAuthorities(s);
    var notes = rel.matched.concat(rel.others).slice(0, 14).map(function (e) {
      return '- ' + e.name + (e.citation ? ' ' + e.citation : '') + (e.ratio ? ': ' + e.ratio.replace(/\s+/g, ' ') : '');
    }).join('\n');
    return [
      'Please act as a strict UK law examiner (PGDL / GDL / SQE standard) and mark my answer to the problem question below.',
      '', '=== MODULE ===', MODULE_LABEL[s.module] + ' — ' + s.topic,
      '', '=== PROBLEM QUESTION ===', s.text,
      '', '=== ISSUES THE QUESTION WAS WRITTEN TO TEST ===', s.issues.map(function (i) { return '- ' + i; }).join('\n'),
      '', '=== MY ANSWER ===', answer.trim(),
      '', '=== MY REVISION NOTES FOR THIS MODULE (use these as the main reference; flag anything in them that looks wrong) ===', notes || '(none saved)',
      '', '=== HOW TO MARK ===',
      '1. Mark against IRAC (Issue, Rule, Application, Conclusion) for each issue raised by the facts.',
      '2. List every issue I identified, every issue I missed, and anything irrelevant I included.',
      '3. Check each authority I cited: is it correctly named and used for the right proposition? Flag errors clearly.',
      '4. Only cite real English and Welsh authorities. If you are not certain an authority exists or says what you claim, say so rather than guessing.',
      '5. Comment on the quality of my application to the facts and whether I argued both sides.',
      '6. Give an indicative mark out of 100 using UK bands (70+ First, 60–69 2:1, 50–59 2:2, 40–49 Third, below 40 Fail), with a one-line justification.',
      '7. Finish with the 3 most important things to improve, and a short model outline answer.'
    ].join('\n');
  }
  var gradeCtl = null;
  function gradeAnswer() {
    var s = scenarioById(state.settings.mock.scenarioId);
    var answer = $('#mockAnswer').value;
    if (!s) return;
    if (!answer.trim()) { toast('Type your answer first, then click Grade my answer.', { type: 'error' }); $('#mockAnswer').focus(); return; }
    var prompt = buildGradingPrompt(s, answer);
    var note = $('#gradeNote');
    if (!claudeCaps.sample) {
      copyToClipboard(prompt).then(function (ok) {
        if (!ok) { copyOrShow(prompt); return; }
        note.innerHTML = '<b>✓ Copied.</b> Paste it into a Claude chat (<b>Ctrl + V</b> or <b>⌘ + V</b>) and press Enter for strict IRAC marking. Marking happens inside the app when it\'s opened in claude.ai.';
        note.hidden = false;
        note.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      return;
    }
    if (gradeCtl) gradeCtl.abort();
    var ctl = new AbortController(); gradeCtl = ctl;
    note.hidden = false;
    note.innerHTML = '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:6px"><b>Feedback from Claude</b>' +
      '<button type="button" class="btn btn-sm" id="gradeStopBtn">■ Stop</button></div><div class="ask-text thinking">Marking your answer… this can take up to a minute.</div>';
    var textEl = note.querySelector('.ask-text');
    $('#gradeStopBtn').onclick = function () { ctl.abort(); };
    $('#gradeBtn').disabled = true;
    note.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    claudeCaps.sample(prompt, { cache: false, signal: ctl.signal, modelTier: 'complex', onText: function (u) { textEl.classList.remove('thinking'); textEl.innerHTML = formatAnswer(u.text); } })
      .then(function (res) { textEl.innerHTML = formatAnswer(res.text); }, function (err) {
        textEl.classList.remove('thinking');
        textEl.innerHTML = (err && err.text && err.code !== 'refused' ? formatAnswer(err.text) : '') + '<p style="color:var(--warn)">' + esc(sampleErrorText(err)) + '</p>';
        if (err && (err.code === 'not_granted' || err.code === 'sampling_disabled')) claudeCaps.sample = null;
      }).then(function () {
        var stop = $('#gradeStopBtn'); if (stop) stop.remove();
        if (gradeCtl === ctl) gradeCtl = null;
        $('#gradeBtn').disabled = false;
      });
  }
