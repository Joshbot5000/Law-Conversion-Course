  /* ------------------------------------------------------------------
     T. QUIZ — single best answer questions written from your cards.
        Several topics per quiz, up to 40 questions written in batches,
        difficulty that follows how you are doing in each topic, varied
        question styles, and checks that the right answer never stands out.
     ------------------------------------------------------------------ */
  var qz = null;
  var QZ_BATCH = 5;
  var QZ_LEVELS = {
    1: { name: 'Foundation', brief: 'Foundation: straightforward facts that clearly trigger one rule from the card; tests whether the student knows and can recognise the rule. Distractors are rules from neighbouring areas or common misconceptions.' },
    2: { name: 'Developing', brief: 'Developing: apply one rule to clear facts and reach the right conclusion; one distractor should be the right rule reaching the wrong conclusion.' },
    3: { name: 'Standard', brief: 'Standard (SQE1 level): the facts include an irrelevant or misleading detail, and the student must choose between closely related rules or outcomes. Every distractor is a plausible conclusion a weaker student would reach.' },
    4: { name: 'Hard', brief: 'Hard: two rules, or a rule and its exception, interact; the decisive point turns on a subtle fact in the scenario. Distractors include correct statements of law that do not apply on these facts, and the right outcome for the wrong reason.' },
    5: { name: 'Expert', brief: 'Expert: multi-step reasoning (eg rule → exception → limit on the exception); every option is partly right and only careful analysis of one decisive fact identifies the best answer. Distractors reflect the mistakes a strong student makes under time pressure.' }
  };
  var QZ_TYPES = [
    'What is the most likely outcome?',
    'What is the best advice to give one of the parties?',
    'Which statement best explains WHY the outcome is as it is (the correct legal reasoning)?',
    'Which additional fact, if proved, would most strengthen or change one party\'s position?',
    'What is one party\'s strongest argument?',
    'Which statement most accurately describes one party\'s legal position?',
    'A trainee has reached a conclusion on these facts (state it in the stem); which option best identifies whether, and why, the trainee is right or wrong?',
    'Which remedy or consequence is the party most likely to obtain or face?'
  ];
  var QZ_SETTINGS = ['a small family business', 'an online sale', 'a construction project', 'a sports club', 'a technology start-up', 'farming', 'a charity', 'a landlord and tenant', 'an art dealer', 'a car sale between private individuals', 'a catering company', 'a music festival', 'a university student', 'a shipping or logistics firm', 'a care home', 'a wedding supplier', 'a local council', 'a bakery chain', 'a vintage clothes shop', 'a removals company'];
  var QZ_HIST_KEY = 'lawRevisionApp.quizHistory';

  function qzHistory() {
    var h = null;
    try { h = JSON.parse(window.localStorage.getItem(QZ_HIST_KEY) || 'null'); } catch (e) { h = null; }
    if (!h || typeof h !== 'object') h = {};
    if (!h.cards || typeof h.cards !== 'object') h.cards = {};
    if (!Array.isArray(h.stems)) h.stems = [];
    return h;
  }
  function saveQzHistory(h) {
    h.stems = h.stems.slice(-80);
    var ids = Object.keys(h.cards);
    if (ids.length > 1500) ids.sort(function (a, b) { return h.cards[a].last < h.cards[b].last ? -1 : 1; }).slice(0, ids.length - 1500).forEach(function (id) { delete h.cards[id]; });
    try { window.localStorage.setItem(QZ_HIST_KEY, JSON.stringify(h)); } catch (e) { /* not critical */ }
  }
  function topicKey(e) { return e.module + '|' + e.topic; }
  function topicLabel(key) { var p = key.split('|'); return (state.filter === 'all' || !qz || qz.module === 'all' ? MODULE_LABEL[p[0]] + ' › ' : '') + p.slice(1).join('|'); }
  function quizTopicList(module) {
    var counts = {};
    state.entries.forEach(function (e) {
      if ((module === 'all' || e.module === module) && e.topic && e.ratio) { var k = topicKey(e); counts[k] = (counts[k] || 0) + 1; }
    });
    return Object.keys(counts).filter(function (k) { return counts[k] >= 2; }).map(function (k) { var p = k.split('|'); return { key: k, module: p[0], topic: p.slice(1).join('|'), count: counts[k] }; })
      .sort(function (a, b) { return (MOD_ORDER[a.module] - MOD_ORDER[b.module]) || a.topic.localeCompare(b.topic); });
  }
  // A starting level for a topic from your review history, until quiz results take over.
  function topicLevel(key) {
    var s = state.prefs.qstats[key];
    if (s) return s.lv;
    var cards = state.entries.filter(function (e) { return topicKey(e) === key; });
    var seen = cards.filter(function (e) { return state.progress[e.id]; });
    if (!seen.length) return 2;
    var lapses = 0, strong = 0;
    seen.forEach(function (e) { var p = state.progress[e.id]; lapses += p.lapses; if (p.ivl >= 21) strong++; });
    var lv = 2.5 - Math.min(1, lapses / seen.length) + 1.5 * strong / seen.length;
    return Math.max(1, Math.min(5, lv));
  }
  function levelName(lv) { return QZ_LEVELS[Math.max(1, Math.min(5, Math.round(lv)))].name; }

  function openQuiz() {
    if (!qz || qz.finished || !qz.questions || !qz.questions.length) {
      var prev = qz || {};
      qz = { step: 'setup', module: prev.module || state.filter, topics: prev.topics || [], focus: prev.focus || 'mixed', n: prev.n || 10, diff: prev.diff || 'adaptive' };
    }
    renderQuiz();
    openModal($('#quizModal'));
  }
  function renderQuiz() {
    var body = $('#quizBody'), foot = $('#quizFoot');
    if (qz.step === 'setup') {
      var list = quizTopicList(qz.module), valid = {};
      list.forEach(function (t) { valid[t.key] = true; });
      qz.topics = qz.topics.filter(function (k) { return valid[k]; });
      var lastMod = null;
      var topicsHtml = list.map(function (t) {
        var head = qz.module === 'all' && t.module !== lastMod ? '<div class="qz-mod">' + esc(MODULE_LABEL[t.module]) + '</div>' : '';
        lastMod = t.module;
        var s = state.prefs.qstats[t.key];
        return head + '<label class="qz-topic"><input type="checkbox" data-topic="' + esc(t.key) + '"' + (qz.topics.indexOf(t.key) !== -1 ? ' checked' : '') + '>' +
          '<span>' + esc(t.topic) + '</span><small>' + t.count + ' cards' + (s ? ' · ' + s.r + '/' + s.n + ' right · ' + levelName(s.lv) : '') + '</small></label>';
      }).join('');
      var ns = [5, 10, 15, 20, 30, 40];
      body.innerHTML = '<p class="muted" style="margin-top:0">Exam-style single best answer questions that test whether you can <b>apply</b> your cards. Every question is built only from the law on your cards, and each answer links back to them.</p>' +
        '<div class="form-grid">' +
        '<div class="form-field"><label class="lbl" for="qzModule">Module</label><select id="qzModule"><option value="all">All modules</option>' + moduleOptions(qz.module) + '</select></div>' +
        '<div class="form-field"><label class="lbl" for="qzN">Questions</label><select id="qzN">' + ns.map(function (n) { return '<option' + (qz.n === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
        '<div class="form-field"><label class="lbl" for="qzFocus">Cards to draw on</label><select id="qzFocus"><option value="mixed">A rotating mix</option><option value="weak"' + (qz.focus === 'weak' ? ' selected' : '') + '>Ones I find hard or are due</option><option value="key"' + (qz.focus === 'key' ? ' selected' : '') + '>★ Key authorities first</option></select></div>' +
        '<div class="form-field"><label class="lbl" for="qzDiff">Difficulty</label><select id="qzDiff"><option value="adaptive">Adaptive – follows how I\'m doing</option>' +
          [1, 2, 3, 4, 5].map(function (l) { return '<option value="' + l + '"' + (String(qz.diff) === String(l) ? ' selected' : '') + '>' + QZ_LEVELS[l].name + ' only</option>'; }).join('') + '</select></div>' +
        '</div>' +
        '<div class="qz-topics-head"><span class="lbl">Topics <span class="muted">(' + (qz.topics.length ? qz.topics.length + ' selected' : 'none ticked = every topic') + ')</span></span>' +
          '<span><button type="button" class="linklike" data-qz="all-topics">Select all</button> · <button type="button" class="linklike" data-qz="no-topics">Clear</button></span></div>' +
        '<div class="qz-topics">' + (topicsHtml || '<p class="muted">Add cards with topics to choose from.</p>') + '</div>' +
        (qz.error ? '<p class="step-note warn" style="margin-top:12px">' + esc(qz.error) + '</p>' : '') +
        (claudeCaps.sample ? '' : '<p class="step-note warn" style="margin-top:12px">Quizzes are written by Claude, which works when the app is opened in claude.ai.</p>');
      foot.innerHTML = '<span class="foot-note spacer">Written five at a time, so you can start straight away.</span><button type="button" class="btn" data-close>Close</button><button type="button" class="btn btn-primary" data-qz="go"' + (claudeCaps.sample ? '' : ' disabled') + '>✦ Start quiz</button>';
    } else if (qz.step === 'play') {
      var letters = 'ABCDE';
      if (qz.idx >= qz.questions.length) {
        body.innerHTML = '<div class="review-progress"><div class="bar"><i style="width:' + Math.round(qz.idx / qz.total * 100) + '%"></i></div><span>' + qz.idx + ' of ' + qz.total + ' done · ' + qz.score + ' right</span></div>' +
          (qz.batchError
            ? '<p class="step-note warn">' + esc(qz.batchError) + '</p>'
            : '<p style="margin:24px 0"><span class="spinner"></span>Writing your next questions, pitched to how you\'re doing…</p>');
        foot.innerHTML = qz.batchError ? '<button type="button" class="btn" data-qz="finish">Finish here</button><button type="button" class="btn btn-primary" data-qz="retry">Try again</button>' : '<button type="button" class="btn" data-qz="finish">Finish here</button>';
        return;
      }
      var q = qz.questions[qz.idx], chosen = qz.answers[qz.idx];
      body.innerHTML = '<div class="review-progress"><div class="bar"><i style="width:' + Math.round(qz.idx / qz.total * 100) + '%"></i></div><span>Question ' + (qz.idx + 1) + ' of ' + qz.total + ' · ' + qz.score + ' right</span></div>' +
        '<div class="qz-meta"><span class="chip">' + esc(topicLabel(q.topic)) + '</span><span class="chip qz-lv lv' + q.level + '">' + QZ_LEVELS[q.level].name + '</span></div>' +
        '<div class="quiz-stem">' + esc(q.stem) + '</div><p class="quiz-q">' + esc(q.question) + '</p>' +
        '<div class="quiz-opts">' + q.options.map(function (o, i) {
          var cls = chosen == null ? '' : i === q.answer ? ' right' : i === chosen ? ' wrong' : '';
          return '<button type="button" class="quiz-opt' + cls + '" data-opt="' + i + '"' + (chosen == null ? '' : ' disabled') + '><span class="letter">' + letters[i] + '</span><span>' + esc(o) + '</span></button>';
        }).join('') + '</div>' +
        (chosen != null ? '<div class="quiz-expl"><b>' + (chosen === q.answer ? '✓ Correct.' : '✗ The best answer is ' + letters[q.answer] + '.') + '</b> ' + esc(q.explanation) +
          (q.lvChange ? '<div class="qz-lvchange">' + esc(q.lvChange) + '</div>' : '') +
          '<div class="quiz-cards">' + q.cards.map(function (id) { var c = byId(id); return c ? '<button type="button" class="tag" data-peek="' + esc(id) + '">' + esc(c.name) + '</button>' : ''; }).join('') + '</div></div>' : '');
      foot.innerHTML = '<span class="foot-note spacer">Built only from your cards. If something looks wrong, check the card.</span>' +
        (chosen != null ? '<button type="button" class="btn btn-primary" data-qz="next">' + (qz.idx + 1 < qz.total ? 'Next question' : 'See results') + '</button>' : '');
    } else if (qz.step === 'done') {
      var missed = [], byTopic = {};
      qz.questions.forEach(function (q, i) {
        if (qz.answers[i] == null) return;
        var t = byTopic[q.topic] = byTopic[q.topic] || { n: 0, r: 0 };
        t.n++; if (qz.answers[i] === q.answer) t.r++;
        else q.cards.forEach(function (id) { if (byId(id) && missed.indexOf(id) === -1) missed.push(id); });
      });
      var answered = qz.answers.filter(function (a) { return a != null; }).length;
      body.innerHTML = '<div class="rv-done"><h3>' + qz.score + ' / ' + answered + '</h3><p class="muted">' +
        (answered && qz.score === answered ? 'Perfect score.' : answered && qz.score / answered >= 0.6 ? 'Good work. Review the ones you missed below.' : 'Worth another look at these cards.') + '</p></div>' +
        '<div class="qz-results">' + Object.keys(byTopic).map(function (k) {
          var t = byTopic[k], s = state.prefs.qstats[k];
          return '<div class="qz-res"><span>' + esc(topicLabel(k)) + '</span><b>' + t.r + '/' + t.n + '</b><small>' + (s ? 'now ' + levelName(s.lv) : '') + '</small></div>';
        }).join('') + '</div>' +
        (missed.length ? '<div class="field-label" style="margin-top:14px">Cards behind the questions you missed</div><div class="quiz-cards">' +
          missed.map(function (id) { return '<button type="button" class="tag" data-peek="' + esc(id) + '">' + esc(byId(id).name) + '</button>'; }).join('') + '</div>' : '');
      qz.missed = missed;
      foot.innerHTML = (missed.length ? '<button type="button" class="btn spacer" data-qz="due">Add missed cards to today\'s review</button>' : '<span class="spacer"></span>') +
        '<button type="button" class="btn" data-qz="again">New quiz</button><button type="button" class="btn btn-primary" data-close>Done</button>';
    }
  }

  /* ---- choosing what each question tests ---- */
  function quizPool() {
    var sel = {}; qz.topics.forEach(function (k) { sel[k] = true; });
    return state.entries.filter(function (e) { return e.ratio && e.topic && (qz.module === 'all' || e.module === qz.module) && (!qz.topics.length || sel[topicKey(e)]); });
  }
  function cardPriority(e, hist) {
    var h = hist.cards[e.id], p = state.progress[e.id], now = Date.now();
    var s = Math.random() * 2;
    s -= (qz.used[e.id] || 0) * 6;
    if (h) s -= Math.max(0, 3 - (now - new Date(h.last).getTime()) / (3 * DAY)) + Math.min(3, h.n * 0.4);
    if (qz.focus === 'weak' && p) s += p.lapses * 1.5 + (p.due <= now ? 2 : 0) + (2.5 - p.ease) * 2;
    if (qz.focus === 'weak' && !p) s += 0.5;
    if (qz.focus === 'key' && e.key) s += 5;
    if (e.key) s += 0.5;
    return s;
  }
  function planBatch(size) {
    var hist = qzHistory(), pool = quizPool(), byT = {};
    pool.forEach(function (e) { (byT[topicKey(e)] = byT[topicKey(e)] || []).push(e); });
    var topics = Object.keys(byT);
    var slots = [], lastT = null, typesLeft = shuffle(QZ_TYPES.slice()), settingsLeft = shuffle(QZ_SETTINGS.slice());
    for (var i = 0; i < size; i++) {
      // Weaker topics come up more often, but every chosen topic keeps appearing.
      var weights = topics.map(function (t) {
        var w = 6 - topicLevel(t) + 1.5 / (1 + (qz.topicCount[t] || 0));
        if (!qz.topicCount[t]) w += 4; // make sure every ticked topic comes up
        if (t === lastT && topics.length > 1) w *= 0.25;
        return Math.max(0.2, w);
      });
      var sum = weights.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * sum, ti = 0;
      while (r > weights[ti] && ti < topics.length - 1) { r -= weights[ti]; ti++; }
      var t = topics[ti]; lastT = t;
      qz.topicCount[t] = (qz.topicCount[t] || 0) + 1;
      var cards = byT[t].slice().sort(function (a, b) { return cardPriority(b, hist) - cardPriority(a, hist); });
      var main = cards[0];
      qz.used[main.id] = (qz.used[main.id] || 0) + 1;
      var support = cards.slice(1).filter(function (c) { return c.id !== main.id; }).slice(0, 2);
      var lv = qz.diff === 'adaptive' ? topicLevel(t) + (Math.random() - 0.5) : +qz.diff;
      lv = Math.max(1, Math.min(5, Math.round(lv)));
      if (!typesLeft.length) typesLeft = shuffle(QZ_TYPES.slice());
      if (!settingsLeft.length) settingsLeft = shuffle(QZ_SETTINGS.slice());
      slots.push({ topic: t, main: main, support: support, level: lv, type: typesLeft.pop(), setting: settingsLeft.pop() });
    }
    return slots;
  }
  function quizPrompt(slots) {
    var hist = qzHistory();
    var cards = {}; slots.forEach(function (s) { cards[s.main.id] = s.main; s.support.forEach(function (c) { cards[c.id] = c; }); });
    var avoid = qz.questions.map(function (q) { return q.stem.split(/\s+/).slice(0, 18).join(' '); }).concat(hist.stems.slice(-15)).slice(-25);
    return [
      'Write ' + slots.length + ' single-best-answer (SBA) multiple-choice questions in the style of the SQE1 and PGDL exams, testing APPLICATION of the law on the revision cards below.',
      '',
      'Follow this plan exactly, one question per line, in this order:',
      slots.map(function (s, i) {
        return 'Q' + (i + 1) + ': mainly tests card [' + s.main.id + ']' + (s.support.length ? ' (you may also draw on ' + s.support.map(function (c) { return '[' + c.id + ']'; }).join(', ') + ', e.g. for plausible distractors)' : '') +
          '. Difficulty ' + s.level + ' – ' + QZ_LEVELS[s.level].brief + ' Question style: ' + s.type + ' Setting, if it suits the law: ' + s.setting + '.';
      }).join('\n'),
      '',
      'Rules for every question:',
      '- Use ONLY the law stated on the cards. Do not introduce other cases, statutes or rules, and never invent citations. You may name an authority only if it appears on the cards.',
      '- A fresh fictional scenario (50-110 words) with new names, then a one-sentence question. Vary names, settings and structure; never reuse or closely imitate these recent scenarios:',
      avoid.length ? avoid.map(function (a) { return '  · ' + a; }).join('\n') : '  · (none yet)',
      '- Exactly 5 options, and exactly one is the best answer according to the cards. The other four must be genuinely tempting: the right rule wrongly applied, the right outcome for the wrong reason, a neighbouring rule that does not apply, an exception whose conditions are not met, or a common misconception.',
      '- THE RIGHT ANSWER MUST NOT STAND OUT. All five options must be about the same length (within a few words of each other), use the same grammatical structure, give the same level of detail and the same kind of brief reason, and use similar hedging ("likely", "unless", etc.). Do not make the right answer the longest, the most qualified, the most precise, or the only one that repeats words from the scenario. No "all/none of the above", no absurd options, no options that are obviously the odd one out.',
      '- Before replying, check each question: could a student who does not know the law pick the answer from length, detail, tone or wording alone? If so, rewrite the options.',
      '- explanation (up to 110 words): why the best answer is right and why the most tempting wrong option is wrong, naming the card(s) relied on. UK spelling.',
      '- cards: the ids of the cards each question relies on.',
      'Reply with ONLY a JSON array: [{"stem": string, "question": string, "options": [5 strings], "answer": index 0-4, "explanation": string, "cards": [id strings]}]',
      '',
      'CARDS:',
      Object.keys(cards).map(function (id) { return '[' + id + ']\n' + entryNotes(cards[id]); }).join('\n\n')
    ].join('\n');
  }
  // True if the right answer could be spotted from how the options look.
  function giveaway(q) {
    var w = q.options.map(function (o) { return o.split(/\s+/).filter(Boolean).length; });
    var c = w[q.answer], others = w.filter(function (x, i) { return i !== q.answer; });
    var mean = others.reduce(function (a, b) { return a + b; }, 0) / others.length;
    var maxO = Math.max.apply(null, others), minO = Math.min.apply(null, others);
    if (c > maxO && c >= mean * 1.25 + 2) return true;
    if (c < minO && c <= mean * 0.7 - 2) return true;
    if (Math.max.apply(null, w) > 2.2 * Math.max(3, Math.min.apply(null, w))) return true;
    var low = q.options.map(function (o) { return o.trim().toLowerCase(); });
    return low.some(function (o, i) { return low.indexOf(o) !== i; });
  }
  function repairOptions(list, signal) {
    var prompt = [
      'These single-best-answer law questions have option sets where the right answer can be spotted from its length, detail or wording rather than from legal knowledge.',
      'Rewrite ONLY the options of each question so that all five are about the same length (within a few words), share the same structure and level of detail, and give the same kind of brief reason. Keep exactly the same meaning for each option and keep the same correct answer index. Do not add new law.',
      'Reply with ONLY a JSON array in the same order: [{"options": [5 strings], "answer": index 0-4}]',
      '',
      JSON.stringify(list.map(function (q) { return { stem: q.stem, question: q.question, options: q.options, answer: q.answer }; }))
    ].join('\n');
    return claudeCaps.sample.json(prompt, { signal: signal, cache: false, modelTier: 'quick' });
  }
  function cleanQuestion(q, slot) {
    if (!q || !Array.isArray(q.options) || q.options.length !== 5) return null;
    var ans = Math.round(num(q.answer, -1));
    if (ans < 0 || ans > 4) return null;
    var out = {
      stem: cleanString(q.stem, 2000), question: cleanString(q.question, 600),
      options: q.options.map(function (o) { return cleanString(o, 400).trim(); }), answer: ans,
      explanation: cleanString(q.explanation, 1500),
      cards: (Array.isArray(q.cards) ? q.cards : []).map(String).filter(function (id) { return byId(id); }),
      topic: slot.topic, level: slot.level
    };
    if (!out.stem || !out.question || out.options.some(function (o) { return !o; })) return null;
    if (!out.cards.length) out.cards = [slot.main.id];
    return out;
  }
  function shuffleOptions(q) {
    var order = shuffle([0, 1, 2, 3, 4]);
    q.options = order.map(function (i) { return q.options[i]; });
    q.answer = order.indexOf(q.answer);
    return q;
  }
  function requestBatch() {
    if (qz.writing) return;
    var need = qz.total - qz.questions.length;
    if (need <= 0) return;
    var size = Math.min(QZ_BATCH, need), mine = qz, ctl = new AbortController();
    qz.writing = true; qz.batchError = ''; qz.ctl = ctl;
    var slots = planBatch(size);
    claudeCaps.sample.json(quizPrompt(slots), { signal: ctl.signal, cache: false }).then(function (arr) {
      var qs = (Array.isArray(arr) ? arr : []).slice(0, slots.length).map(function (q, i) { return cleanQuestion(q, slots[i]); }).filter(Boolean);
      var bad = qs.filter(giveaway);
      if (!bad.length) return qs;
      return repairOptions(bad, ctl.signal).then(function (fixed) {
        (Array.isArray(fixed) ? fixed : []).forEach(function (f, i) {
          var q = bad[i];
          if (!q || !f || !Array.isArray(f.options) || f.options.length !== 5) return;
          var a = Math.round(num(f.answer, q.answer));
          if (a !== q.answer) return;
          q.options = f.options.map(function (o) { return cleanString(o, 400).trim(); });
        });
        return qs;
      }, function () { return qs; });
    }).then(function (qs) {
      if (qz !== mine) return;
      var kept = qs.filter(function (q) { return !giveaway(q); });
      qz.dropped += qs.length - kept.length + (slots.length - qs.length);
      kept.forEach(function (q) { qz.questions.push(shuffleOptions(q)); });
      qz.questions = qz.questions.slice(0, qz.total);
      qz.writing = false;
      // If too many have had to be thrown away, end the quiz at what's been written rather than waiting forever.
      if (qz.questions.length && qz.questions.length < qz.total && qz.dropped >= Math.ceil(qz.total / 3) + 4) {
        qz.total = qz.questions.length;
        if (qz.step === 'play' && qz.idx >= qz.total) { qz.step = 'done'; qz.finished = true; }
      }
      if (!qz.questions.length && qz.dropped >= 6) { qz.step = 'setup'; qz.error = 'The questions couldn\'t be written well enough. Try again, perhaps with more topics.'; }
      else if (qz.step === 'writing') { qz.step = 'play'; qz.idx = 0; }
      renderQuiz();
      maybeRequestMore();
    }, function (err) {
      if (qz !== mine) return;
      qz.writing = false;
      if (err && err.code === 'cancelled') return;
      if (err && (err.code === 'not_granted' || err.code === 'sampling_disabled')) claudeCaps.sample = null;
      if (qz.step === 'writing') { qz.step = 'setup'; qz.error = sampleErrorText(err); }
      else qz.batchError = sampleErrorText(err) + ' You can try again or finish here.';
      renderQuiz();
    });
  }
  // Keep about three questions ready ahead of you, written from your latest results.
  function maybeRequestMore() {
    if (!qz || qz.step !== 'play' || qz.writing || qz.batchError) return;
    if (qz.questions.length < qz.total && qz.questions.length - qz.idx <= 3) requestBatch();
  }
  function startQuiz() {
    qz.module = $('#qzModule').value; qz.focus = $('#qzFocus').value; qz.n = +$('#qzN').value;
    qz.diff = $('#qzDiff').value === 'adaptive' ? 'adaptive' : +$('#qzDiff').value;
    var pool = quizPool();
    qz.error = '';
    if (pool.length < 3) { qz.error = 'There aren\'t enough cards with rules in this selection. Tick more topics.'; renderQuiz(); return; }
    qz.total = qz.n; qz.questions = []; qz.answers = []; qz.idx = 0; qz.score = 0; qz.dropped = 0; qz.used = {}; qz.topicCount = {}; qz.finished = false;
    qz.step = 'writing';
    $('#quizBody').innerHTML = '<p style="margin:20px 0"><span class="spinner"></span>Writing your first ' + Math.min(QZ_BATCH, qz.total) + ' questions from ' + cardsWord(pool.length) + '… the rest are written while you answer.</p>';
    $('#quizFoot').innerHTML = '<button type="button" class="btn" data-qz="cancel">Cancel</button>';
    requestBatch();
  }
  function recordAnswer(q, right) {
    var key = q.topic, s = state.prefs.qstats[key] || { lv: topicLevel(key), n: 0, r: 0 };
    var before = s.lv;
    if (right) s.lv += q.level >= s.lv ? 0.5 : 0.25;
    else s.lv -= q.level <= s.lv ? 0.6 : 0.3;
    s.lv = Math.round(Math.max(1, Math.min(5, s.lv)) * 100) / 100;
    s.n++; if (right) s.r++;
    s.at = nowISO();
    state.prefs.qstats[key] = s;
    persistPrefs();
    if (levelName(before) !== levelName(s.lv)) q.lvChange = (right ? '▲ ' : '▼ ') + topicLabel(key) + ': questions will now be ' + levelName(s.lv) + ' level.';
    var hist = qzHistory();
    q.cards.forEach(function (id) { var h = hist.cards[id] || { n: 0 }; h.n++; h.last = nowISO(); hist.cards[id] = h; });
    hist.stems.push(q.stem.split(/\s+/).slice(0, 18).join(' '));
    saveQzHistory(hist);
  }
  function quizAction(a) {
    if (a === 'go') startQuiz();
    else if (a === 'cancel') { if (qz.ctl) qz.ctl.abort(); qz.step = 'setup'; qz.writing = false; renderQuiz(); }
    else if (a === 'all-topics') { qz.topics = quizTopicList(qz.module).map(function (t) { return t.key; }); renderQuiz(); }
    else if (a === 'no-topics') { qz.topics = []; renderQuiz(); }
    else if (a === 'next') {
      if (qz.idx + 1 < qz.total) { qz.idx++; renderQuiz(); maybeRequestMore(); }
      else { qz.step = 'done'; qz.finished = true; renderQuiz(); }
    } else if (a === 'retry') { qz.batchError = ''; renderQuiz(); requestBatch(); }
    else if (a === 'finish') { if (qz.ctl) qz.ctl.abort(); qz.writing = false; qz.step = 'done'; qz.finished = true; renderQuiz(); }
    else if (a === 'again') { qz = { step: 'setup', module: qz.module, topics: qz.topics, focus: qz.focus, n: qz.n, diff: qz.diff }; renderQuiz(); }
    else if (a === 'due') {
      var now = Date.now(), n = 0;
      (qz.missed || []).forEach(function (id) { var p = state.progress[id]; if (p && p.due > now) { p.due = now; n++; } });
      commit();
      toast(n ? cardsWord(n) + ' added to today\'s review.' : 'Those cards are already due or not started yet.', { type: 'success' });
    }
  }
  function quizChange(ev) {
    var t = ev.target;
    if (t.id === 'qzModule') { qz.module = t.value; qz.topics = []; renderQuiz(); }
    else if (t.id === 'qzN') qz.n = +t.value;
    else if (t.id === 'qzFocus') qz.focus = t.value;
    else if (t.id === 'qzDiff') qz.diff = t.value === 'adaptive' ? 'adaptive' : +t.value;
    else if (t.matches('[data-topic]')) {
      var k = t.getAttribute('data-topic');
      qz.topics = qz.topics.filter(function (x) { return x !== k; });
      if (t.checked) qz.topics.push(k);
      var h = $('.qz-topics-head .muted'); if (h) h.textContent = '(' + (qz.topics.length ? qz.topics.length + ' selected' : 'none ticked = every topic') + ')';
    }
  }
  function answerQuiz(i) {
    var q = qz.questions[qz.idx];
    if (!q || qz.answers[qz.idx] != null) return;
    qz.answers[qz.idx] = i;
    var right = i === q.answer;
    if (right) qz.score++;
    recordAnswer(q, right);
    renderQuiz();
  }

