  /* ------------------------------------------------------------------
     T. QUIZ — single best answer questions written from your cards.
        Several topics per quiz, up to 40 questions written in batches,
        difficulty that follows how you are doing in each topic, varied
        question styles, and checks that the right answer never stands out.
     ------------------------------------------------------------------ */
  var qz = null;
  var QZ_BATCH = 5;
  // Every level is written in the law-school / SQE1 single-best-answer style (see SBA_STYLE below);
  // the levels differ in how many issues interact and how close the distractors are.
  var QZ_LEVELS = {
    1: { name: 'Foundation', brief: 'Foundation: one clear issue on the facts. The best answer states the rule and applies it; distractors are neighbouring doctrines a weaker student confuses it with (e.g. fraud for theft, consent for contributory negligence).' },
    2: { name: 'Developing', brief: 'Developing: one issue, but the student must apply the rule to the facts to reach the outcome; include the right conclusion for the wrong reason, and a true statement of law that does not answer the question.' },
    3: { name: 'Standard', brief: 'Standard (law-school / SQE1 level): the facts include a detail that decides the outcome and at least one that is irrelevant or misleading; the options are reasoned "Yes, because… / No, because…" style statements, two of which share the same conclusion and differ only in the legal reason; one distractor is true but incomplete, and the best answer is the most complete and precise.' },
    4: { name: 'Hard', brief: 'Hard: two rules, or a rule and its exception or limit, interact (or two parties with different positions); the decisive point turns on one subtle fact. Several options begin with identical wording and differ in one clause; distractors include correct law that does not apply on these facts and the right outcome for the wrong reason.' },
    5: { name: 'Expert', brief: 'Expert: multi-step reasoning (rule → exception → limit, or several items or parties each failing for a different reason); every option is partly right and only careful analysis of the decisive fact identifies the best answer. Distractors are the mistakes a strong student makes under time pressure.' }
  };
  // Question shapes seen in law-school and SQE1 papers; rotated so every batch varies.
  var QZ_TYPES = [
    'Reasoned outcome: "Which of the following statements best explains whether [party] will succeed / be liable / be able to rely on [defence]?" — options start "Yes, because…" or "No, because…" (at least two of each), each giving a different legal reason.',
    'Correct statement: "Which one of the following statements is correct in relation to [party]\'s liability / position?" — five full statements of the legal position, only one accurate on these facts.',
    'Several items: the scenario describes several items, acts or events (four or five); the question asks which ONE satisfies a legal requirement (e.g. which item has the actus reus been satisfied for) — each option names one item, and each wrong item fails for a DIFFERENT legal reason.',
    'Two parties: the scenario involves two potential claimants (or defendants) with different positions; options say who succeeds and why (e.g. "Only the first… because…", "Neither… because…", "Both… because…"), with near-identical openings differing in the reason.',
    'Concept answer: "Which [measure of damages / remedy / defence / type of term / ground] is a court most likely to award / find?" — options are short legal terms or concepts of similar length (2-6 words each).',
    'Calculation: "What damages / sum can the client recover?" — options are different figures, each with a short reason reflecting a different (mis)application of the rule. Use ONLY if the card\'s rule genuinely involves working out a sum; otherwise use the reasoned-outcome shape.',
    'Advice: "You have been asked to advise [client]. Which of the following best describes the legal position?" — options are statements of the position, including one absolute statement ("never", "always", "any") that overstates the law.',
    'Does it satisfy / breach the rule: "Does [conduct] breach / satisfy [the doctrine or rule]?" — options "Yes, because…" / "No, because…", with one correct reason; for constitutional or statutory points the scenario may describe a fictitious Act, saying it is fictitious.'
  ];
  // How law-school / SQE1 single-best-answer questions read (the owner's examples, described in our own words).
  var SBA_STYLE = [
    'STYLE — write like a law-school / SQE1 paper:',
    '- Describe people by role, not by name: "a client", "a solicitor", "a builder", "the claimant", "a student", "the deceased\'s daughter". Use professional framing in about half the questions ("A solicitor acts for…", "A solicitor has been instructed by…", "You have been asked to advise…"); otherwise a plain factual scenario.',
    '- Scenarios of 70-160 words with concrete, realistic detail (ages, sums, dates, what each person knew or intended), including the one fact that decides the answer and at least one detail that is irrelevant or a red herring.',
    '- Options are complete legal statements with a reason, not bare conclusions (except for the concept-answer shape). Two or three options share the same opening words and differ only in the legal reason, so the student must judge WHY, not just WHETHER.',
    '- Include, across the five options: the right conclusion for the wrong reason; a true statement of law that is incomplete or does not answer the question (the best answer is the most complete and precise one); a neighbouring doctrine confused with the right one (e.g. remoteness instead of duty, consent instead of contributory negligence, fraud instead of theft); and the wrong party or wrong element.',
    '- Do not let absolute words ("never", "always", "any") appear only in wrong options; if one wrong option is absolute, word the others so that wording alone gives nothing away.'
  ].join('\n');
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
    if (!seen.length) return 3;
    var lapses = 0, strong = 0;
    seen.forEach(function (e) { var p = state.progress[e.id]; lapses += p.lapses; if (p.ivl >= 21) strong++; });
    var lv = 3 - Math.min(1, lapses / seen.length) + 1.5 * strong / seen.length;
    return Math.max(1, Math.min(5, lv));
  }
  function levelName(lv) { return QZ_LEVELS[Math.max(1, Math.min(5, Math.round(lv)))].name; }

  function openQuiz() {
    if (!qz || qz.finished || !qz.questions || !qz.questions.length) {
      var prev = qz || {};
      qz = { step: 'setup', module: prev.module || state.filter, topics: prev.topics || [], sources: prev.sources || [], focus: prev.focus || 'mixed', n: prev.n || 10, diff: prev.diff || 'adaptive', timed: prev.mode !== 'practice' && prev.timed === true };
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
        '<div class="form-field full"><label class="lbl" for="qzTimed">Mode</label><select id="qzTimed"><option value="practice">Practice — see the answer after each question</option>' +
          '<option value="timed"' + (qz.timed ? ' selected' : '') + '>Timed exam — SQE pace (1 min 42 s a question), results at the end</option></select></div>' +
        '</div>' +
        '<div class="qz-topics-head"><span class="lbl">Topics <span class="muted">(' + (qz.topics.length ? qz.topics.length + ' selected' : 'none ticked = every topic') + ')</span></span>' +
          '<span><button type="button" class="linklike" data-qz="all-topics">Select all</button> · <button type="button" class="linklike" data-qz="no-topics">Clear</button></span></div>' +
        '<div class="qz-topics">' + (topicsHtml || '<p class="muted">Add cards with topics to choose from.</p>') + '</div>' +
        quizSourcesHTML() +
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
        if (qz.timed) body.insertAdjacentHTML('afterbegin', '<p class="muted qz-paused">⏸ The clock is paused while questions are written.</p>');
        return;
      }
      if (qz.timed) { renderExamQuestion(body, foot); return; }
      var q = qz.questions[qz.idx], chosen = qz.answers[qz.idx];
      body.innerHTML = '<div class="review-progress"><div class="bar"><i style="width:' + Math.round(qz.idx / qz.total * 100) + '%"></i></div><span>Question ' + (qz.idx + 1) + ' of ' + qz.total + ' · ' + qz.score + ' right</span></div>' +
        '<div class="qz-meta"><span class="chip">' + esc(topicLabel(q.topic)) + '</span><span class="chip qz-lv lv' + q.level + '">' + QZ_LEVELS[q.level].name + '</span>' +
          (q.target ? '<span class="chip qz-practice">Practice on an earlier mistake</span>' : '') + '</div>' +
        '<div class="quiz-stem">' + esc(q.stem) + '</div><p class="quiz-q">' + esc(q.question) + '</p>' +
        '<div class="quiz-opts">' + q.options.map(function (o, i) {
          var cls = chosen == null ? '' : i === q.answer ? ' right' : i === chosen ? ' wrong' : '';
          return '<button type="button" class="quiz-opt' + cls + '" data-opt="' + i + '"' + (chosen == null ? '' : ' disabled') + '><span class="letter">' + letters[i] + '</span><span>' + esc(o) + '</span></button>';
        }).join('') + '</div>' +
        (chosen != null ? '<div class="quiz-expl"><b>' + (chosen === q.answer ? '✓ Correct.' : '✗ The best answer is ' + letters[q.answer] + '.') + '</b> ' + esc(q.explanation) +
          (q.lvChange ? '<div class="qz-lvchange">' + esc(q.lvChange) + '</div>' : '') +
          (q.mastered ? '<div class="qz-lvchange">★ Mastered: you\'ve now got this point right twice, so it\'s marked as sorted in your mistakes log.</div>' : '') +
          (chosen !== q.answer ? '<div class="qz-saved">Saved to your mistakes log — you can go over it again at the end, or any time from My progress.</div>' : '') +
          '<div class="quiz-cards">' + q.cards.map(function (id) { var c = byId(id); return c ? '<button type="button" class="tag" data-peek="' + esc(id) + '">' + esc(c.name) + '</button>' : ''; }).join('') + '</div></div>' : '');
      foot.innerHTML = '<button type="button" class="btn" data-qz="finish" title="Stop here and go over what you\'ve answered">End quiz</button><span class="foot-note spacer">Built only from your cards. If something looks wrong, check the card.</span>' +
        (chosen != null ? '<button type="button" class="btn btn-primary" data-qz="next">' + (qz.idx + 1 < qz.total ? 'Next question' : 'See results') + '</button>' : '');
    } else if (qz.step === 'done') {
      renderQuizDone(body, foot);
    }
  }
  /* ---- timed exam mode: SQE pace, no feedback until you submit ---- */
  var QZ_SECS = 102, qzClock = null;
  function fmtClock(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + pad2(s % 60); }
  function renderExamQuestion(body, foot) {
    var letters = 'ABCDE', q = qz.questions[qz.idx], chosen = qz.answers[qz.idx];
    var done = qz.answers.filter(function (a) { return a != null; }).length;
    body.innerHTML = '<div class="review-progress"><div class="bar"><i style="width:' + Math.round(done / qz.total * 100) + '%"></i></div><span>Question ' + (qz.idx + 1) + ' of ' + qz.total + ' · ' + done + ' answered</span>' +
        '<span class="qz-clock' + (qz.timeLeft <= 60 ? ' low' : '') + '" id="qzClock" title="Time left">⏱ ' + fmtClock(qz.timeLeft) + '</span></div>' +
      '<div class="qz-meta"><span class="chip">' + esc(topicLabel(q.topic)) + '</span><span class="chip qz-exam-chip">Timed exam</span></div>' +
      '<div class="quiz-stem">' + esc(q.stem) + '</div><p class="quiz-q">' + esc(q.question) + '</p>' +
      '<div class="quiz-opts">' + q.options.map(function (o, i) {
        return '<button type="button" class="quiz-opt' + (chosen === i ? ' picked' : '') + '" data-opt="' + i + '" aria-pressed="' + (chosen === i) + '"><span class="letter">' + letters[i] + '</span><span>' + esc(o) + '</span></button>';
      }).join('') + '</div>' +
      '<p class="muted qz-exam-note">You can change your answer until you submit. Results and explanations come at the end.</p>';
    var last = qz.idx + 1 >= qz.total;
    foot.innerHTML = '<button type="button" class="btn" data-qz="submit">Submit now</button><span class="spacer"></span>' +
      (qz.idx > 0 ? '<button type="button" class="btn" data-qz="back">← Back</button>' : '') +
      '<button type="button" class="btn btn-primary" data-qz="' + (last ? 'submit' : 'next') + '">' + (last ? 'Submit answers' : (chosen == null ? 'Skip →' : 'Next →')) + '</button>';
  }
  // The clock only runs while a written question is on screen.
  function startClock() {
    clearInterval(qzClock);
    qzClock = setInterval(function () {
      // Stop for good only once the exam is over; while the first questions are being written it just waits.
      if (!qz || !qz.timed || qz.step === 'done' || qz.step === 'setup') { clearInterval(qzClock); return; }
      if (qz.step !== 'play' || $('#quizModal').hidden || qz.idx >= qz.questions.length) return;
      qz.timeLeft--;
      var c = $('#qzClock');
      if (c) { c.textContent = '⏱ ' + fmtClock(qz.timeLeft); c.classList.toggle('low', qz.timeLeft <= 60); }
      if (qz.timeLeft <= 0) { toast('Time\'s up — your answers have been submitted.'); submitExam(); }
    }, 1000);
  }
  function submitExam() {
    clearInterval(qzClock);
    if (qz.ctl) qz.ctl.abort();
    qz.writing = false;
    qz.score = 0;
    qz.questions.forEach(function (q, i) {
      var a = qz.answers[i];
      if (a == null) return;
      var right = a === q.answer;
      if (right) qz.score++;
      recordAnswer(q, right);
      memoryQuizAnswer(q, a, right);
    });
    qz.timeUsed = qz.total * QZ_SECS - qz.timeLeft;
    qz.step = 'done'; qz.finished = true;
    renderQuiz();
  }
  function renderQuizDone(body, foot) {
    var missed = [], byTopic = {}, wrong = [], answered = 0;
    qz.questions.forEach(function (q, i) {
      if (qz.answers[i] == null) return;
      answered++;
      var t = byTopic[q.topic] = byTopic[q.topic] || { n: 0, r: 0 };
      t.n++;
      if (qz.answers[i] === q.answer) t.r++;
      else { wrong.push(i); q.cards.forEach(function (id) { if (byId(id) && missed.indexOf(id) === -1) missed.push(id); }); }
    });
    if (!qz.logged && answered) {
      qz.logged = true;
      memorySession(qz.mode === 'practice' ? 'practice' : 'quiz', answered, qz.score, Object.keys(byTopic));
    }
    qz.missed = missed;
    var filter = qz.reviewFilter || (wrong.length ? 'wrong' : 'all');
    var shown = qz.questions.map(function (q, i) { return i; }).filter(function (i) { return qz.answers[i] != null && (filter === 'all' || qz.answers[i] !== qz.questions[i].answer); });
    var letters = 'ABCDE';
    var unanswered = qz.timed ? Math.max(0, qz.total - answered) : 0;
    body.innerHTML = (qz.timed ? '<p class="qz-timeline">⏱ Timed exam · time used ' + fmtClock(qz.timeUsed || 0) + ' of ' + fmtClock(qz.total * QZ_SECS) +
        (unanswered ? ' · ' + plural(unanswered, 'question') + ' not answered' : '') + '</p>' : '') +
      '<div class="rv-done"><h3>' + qz.score + ' / ' + (qz.timed ? qz.total : answered) + '</h3><p class="muted">' +
      (answered && qz.score === answered ? 'Perfect score.' : answered && qz.score / answered >= 0.6 ? 'Good work. Go over the ones you missed below.' : 'Worth another look — go over the ones you missed below.') + '</p></div>' +
      '<div class="qz-results">' + Object.keys(byTopic).map(function (k) {
        var t = byTopic[k], st = state.prefs.qstats[k];
        return '<div class="qz-res"><span>' + esc(topicLabel(k)) + '</span><b>' + t.r + '/' + t.n + '</b><small>' + (st ? 'now ' + levelName(st.lv) : '') + '</small></div>';
      }).join('') + '</div>' +
      (wrong.length ? '<div class="qz-practise-all"><div><b>Turn your mistakes into strengths</b><span>Fresh questions on exactly the points you got wrong, from new angles. Get a point right twice and it\'s marked as mastered.</span></div>' +
        '<button type="button" class="btn btn-primary" data-qz="practise-all">✦ Practise ' + (wrong.length === 1 ? 'this mistake' : 'my ' + wrong.length + ' mistakes') + '</button></div>' : '') +
      '<div class="qr-head-row"><h4>Go over your answers</h4><div class="seg" role="group" aria-label="Show">' +
        '<button type="button" class="seg-btn' + (filter === 'wrong' ? ' on' : '') + '" data-qz="show-wrong"' + (wrong.length ? '' : ' disabled') + '>Wrong (' + wrong.length + ')</button>' +
        '<button type="button" class="seg-btn' + (filter === 'all' ? ' on' : '') + '" data-qz="show-all">All (' + answered + ')</button></div></div>' +
      '<div class="qr-list">' + (shown.length ? shown.map(function (i) { return reviewItemHTML(qz.questions[i], qz.answers[i], i, filter === 'wrong'); }).join('') : '<p class="muted">Nothing to show.</p>') + '</div>';
    foot.innerHTML = (missed.length ? '<button type="button" class="btn spacer" data-qz="due">Add missed cards to today\'s review</button>' : '<span class="spacer"></span>') +
      '<button type="button" class="btn" data-qz="again">New quiz</button><button type="button" class="btn btn-primary" data-close>Done</button>';
  }
  // One answered question, laid out for going over afterwards (also used by the mistakes log).
  function reviewItemHTML(q, chosen, i, open) {
    var letters = 'ABCDE', right = chosen === q.answer;
    return '<details class="qr-item ' + (right ? 'is-right' : 'is-wrong') + '"' + (open ? ' open' : '') + '>' +
      '<summary><span class="qr-mark">' + (right ? '✓' : '✗') + '</span><span class="qr-sum"><b>' + (i != null ? 'Q' + (i + 1) + ' · ' : '') + esc(topicLabel(q.topic)) + '</b>' +
        '<span>' + (right ? 'You answered ' + letters[chosen] + ' — correct' : 'You chose ' + letters[chosen] + ' · best answer ' + letters[q.answer]) + '</span></span></summary>' +
      '<div class="qr-body"><div class="quiz-stem">' + esc(q.stem) + '</div><p class="quiz-q">' + esc(q.question) + '</p>' +
      '<ol class="qr-opts">' + q.options.map(function (o, k) {
        var cls = k === q.answer ? 'right' : k === chosen ? 'chosen' : '';
        return '<li class="' + cls + '"><span class="letter">' + letters[k] + '</span><span>' + esc(o) + '</span>' +
          (k === q.answer ? '<em>Best answer</em>' : k === chosen ? '<em>Your answer</em>' : '') + '</li>';
      }).join('') + '</ol>' +
      '<div class="quiz-expl"><b>Why:</b> ' + esc(q.explanation) + '<div class="quiz-cards">' +
        q.cards.map(function (id) { var c = byId(id); return c ? '<button type="button" class="tag" data-peek="' + esc(id) + '">' + esc(c.name) + '</button>' : ''; }).join('') + '</div></div>' +
      (!right && i != null && q.mistakeId ? '<div class="qr-actions"><button type="button" class="btn btn-sm" data-qz="practise-one" data-i="' + i + '">✦ Practise similar questions</button></div>' : '') +
      '</div></details>';
  }
  // Optional: only use cards that the chosen sources cover.
  function quizSourcesHTML() {
    var list = state.sources.filter(function (sr) { return qz.module === 'all' || !sr.module || sr.module === qz.module; });
    if (!list.length) return '';
    var valid = {}; list.forEach(function (sr) { valid[sr.id] = true; });
    qz.sources = (qz.sources || []).filter(function (id) { return valid[id]; });
    return '<details class="qz-srcbox"' + (qz.sources.length ? ' open' : '') + '><summary><span class="lbl">Limit to specific sources</span> <span class="muted" id="qzSrcCount">(' +
      (qz.sources.length ? qz.sources.length + ' selected' : 'optional — none ticked = all your cards') + ')</span></summary>' +
      '<p class="muted qz-src-note">Questions will only test cards that come from, or are discussed in, the sources you tick — and stay within what those sources say.</p>' +
      '<div class="qz-topics">' + list.map(function (sr) {
        return '<label class="qz-topic"><input type="checkbox" data-qsrc="' + esc(sr.id) + '"' + (qz.sources.indexOf(sr.id) !== -1 ? ' checked' : '') + '><span>' + esc(sr.title) + '</span><small>' +
          esc(MODULE_LABEL[sr.module] || '') + '</small></label>';
      }).join('') + '</div></details>';
  }

  /* ---- choosing what each question tests ---- */
  function quizPool() {
    var sel = {}; qz.topics.forEach(function (k) { sel[k] = true; });
    var pool = state.entries.filter(function (e) { return e.ratio && e.topic && (qz.module === 'all' || e.module === qz.module) && (!qz.topics.length || sel[topicKey(e)]); });
    if (qz.sources && qz.sources.length && qz.srcNorm) {
      var src = {}; qz.sources.forEach(function (id) { src[id] = true; });
      pool = pool.filter(function (e) { return src[e.sourceId] || sourceMentions(e); });
    }
    return pool;
  }
  function normText(t) { return ' ' + String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' '; }
  // Ways a card's authority could be named in a source: the full name, and "Claimant v Defendant's first word".
  function nameKeys(e) {
    var n = e.name.replace(/\s*[\[(].*$/, ''), keys = [normText(n)];
    var m = /^(.+?) v (\S+)/.exec(n); if (m) keys.push(normText(m[1] + ' v ' + m[2]));
    var act = /^(.+? (?:Act|Regulations|Order) \d{4})/.exec(n); if (act) keys.push(normText(act[1]));
    return keys.filter(function (k) { return k.length >= 10; });
  }
  function sourceMentions(e) {
    if (e.type === 'principle') return false;
    var keys = nameKeys(e);
    return qz.sources.some(function (id) { var t = qz.srcNorm[id]; return t && keys.some(function (k) { return t.indexOf(k) !== -1; }); });
  }
  // The passage of a chosen source that a card comes from (or is discussed in), to keep questions within it.
  function sourceExtract(e) {
    if (!qz.srcText) return '';
    var ids = qz.sources.slice().sort(function (a, b) { return (b === e.sourceId) - (a === e.sourceId); });
    for (var k = 0; k < ids.length; k++) {
      var t = qz.srcText[ids[k]]; if (!t) continue;
      var low = t.toLowerCase(), at = -1;
      if (ids[k] === e.sourceId && e.sourceQuote) at = low.indexOf(e.sourceQuote.toLowerCase().slice(0, 60));
      if (at < 0) { var nm = e.name.replace(/\s*[\[(].*$/, '').toLowerCase(); at = low.indexOf(nm); if (at < 0) { var mm = /^(.+? v \S+)/.exec(nm); if (mm) at = low.indexOf(mm[1]); } }
      if (at >= 0) return t.slice(Math.max(0, at - 350), at + 650).replace(/\f/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return '';
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
    var targets = (qz.targets || []).map(mistakeById).filter(function (m) { return m && !m.resolved; });
    for (var i = 0; i < size; i++) {
      if (!typesLeft.length) typesLeft = shuffle(QZ_TYPES.slice());
      if (!settingsLeft.length) settingsLeft = shuffle(QZ_SETTINGS.slice());
      // Practice: aim questions at the exact points you got wrong, rotating through them.
      if (targets.length && (qz.practiceOnly || !topics.length || i % 2 === 0)) {
        var m = targets[(qz.targetTurn = (qz.targetTurn || 0) + 1) % targets.length];
        var mcards = m.cards.map(byId).filter(Boolean);
        var mainT = mcards[0] || (byT[m.topic] || [])[0];
        if (mainT) {
          var sup = mcards.slice(1).concat((byT[m.topic] || state.entries.filter(function (x) { return topicKey(x) === m.topic && x.ratio; })).filter(function (c) { return mcards.indexOf(c) === -1; })).slice(0, 3);
          var lvT = Math.max(1, Math.min(5, Math.round(Math.min(m.level, topicLevel(m.topic)) + (m.tries ? 0.5 : 0))));
          slots.push({ topic: m.topic, main: mainT, support: sup.filter(function (c) { return c !== mainT; }).slice(0, 2), level: lvT, type: typesLeft.pop(), setting: settingsLeft.pop(), target: m });
          continue;
        }
      }
      if (!topics.length) break;
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
          '. Difficulty ' + s.level + ' – ' + QZ_LEVELS[s.level].brief + ' Question style: ' + s.type + ' Setting, if it suits the law: ' + s.setting + '.' +
          (s.target ? ' PRACTICE ON AN EARLIER MISTAKE: the student previously answered "' + s.target.question + '" on this point and chose "' + s.target.options[s.target.chosen] +
            '" instead of the best answer "' + s.target.options[s.target.answer] + '". Write a NEW question on the same rule with different facts and a different angle, so that a student who still holds that misunderstanding would pick a wrong option (include an option reflecting that misunderstanding), while one who now understands the point gets it right.' : '');
      }).join('\n'),
      '',
      'Rules for every question:',
      '- Use ONLY the law stated on the cards. Do not introduce other cases, statutes or rules, and never invent citations. You may name an authority only if it appears on the cards.',
      SBA_STYLE,
      '',
      '- A fresh fictional scenario for every question, then a one-sentence question in the shape given in the plan. Vary roles, settings and structure; never reuse or closely imitate these recent scenarios:',
      avoid.length ? avoid.map(function (a) { return '  · ' + a; }).join('\n') : '  · (none yet)',
      '- Exactly 5 options, and exactly one is the best answer according to the cards. The other four must be genuinely tempting: the right rule wrongly applied, the right outcome for the wrong reason, a neighbouring rule that does not apply, an exception whose conditions are not met, or a common misconception.',
      '- THE RIGHT ANSWER MUST NOT STAND OUT. All five options must be about the same length (within a few words of each other), use the same grammatical structure, give the same level of detail and the same kind of brief reason, and use similar hedging ("likely", "unless", etc.). Do not make the right answer the longest, the most qualified, the most precise, or the only one that repeats words from the scenario. No "all/none of the above", no absurd options, no options that are obviously the odd one out.',
      '- Before replying, check each question: could a student who does not know the law pick the answer from length, detail, tone or wording alone? If so, rewrite the options.',
      '- explanation (up to 130 words): why the best answer is right and, briefly, why each of the two most tempting wrong options is wrong (name the trap, e.g. "right outcome, wrong reason"), naming the card(s) relied on. UK spelling.',
      '- cards: the ids of the cards each question relies on.',
      qz.srcText ? '- STAY WITHIN THE CHOSEN SOURCES: test only points that are on the card and supported by its SOURCE EXTRACT below (where one is given). Do not test anything those sources do not cover.' : '',
      'Reply with ONLY a JSON array: [{"stem": string, "question": string, "options": [5 strings], "answer": index 0-4, "explanation": string, "cards": [id strings]}]',
      '',
      'CARDS:',
      Object.keys(cards).map(function (id) { return '[' + id + ']\n' + entryNotes(cards[id]); }).join('\n\n'),
      qz.srcText ? '\nSOURCE EXTRACTS (from the sources the student chose):\n' + slots.map(function (sl) { var x = sourceExtract(sl.main); return x ? '[' + sl.main.id + '] "' + x + '"' : ''; }).filter(Boolean).join('\n\n') : ''
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
      topic: slot.topic, level: slot.level, target: slot.target ? slot.target.id : null
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
    qz.mode = 'quiz'; qz.targets = null; qz.practiceOnly = false; qz.error = '';
    qz.timed = $('#qzTimed').value === 'timed';
    qz.srcText = null; qz.srcNorm = null;
    if (!qz.sources || !qz.sources.length) return beginQuiz();
    $('#quizBody').innerHTML = '<p style="margin:20px 0"><span class="spinner"></span>Reading your chosen sources…</p>';
    var mine = qz;
    Promise.all(qz.sources.map(function (id) { return loadSourceText(id).then(function (t) { return [id, t]; }, function () { return [id, '']; }); })).then(function (pairs) {
      if (qz !== mine) return;
      qz.srcText = {}; qz.srcNorm = {};
      pairs.forEach(function (p) { qz.srcText[p[0]] = p[1] || ''; qz.srcNorm[p[0]] = normText(p[1]); });
      beginQuiz();
    });
  }
  function beginQuiz() {
    var pool = quizPool();
    if (pool.length < 3 && !(qz.targets && qz.targets.length)) {
      qz.error = qz.sources && qz.sources.length ? 'Too few of your cards come from those sources (with these topics). Tick more sources or clear the topic choice.' : 'There aren\'t enough cards with rules in this selection. Tick more topics.';
      qz.step = 'setup'; renderQuiz(); return;
    }
    qz.total = qz.n; qz.questions = []; qz.answers = []; qz.idx = 0; qz.score = 0; qz.dropped = 0; qz.used = {}; qz.topicCount = {}; qz.finished = false; qz.logged = false; qz.reviewFilter = null;
    qz.step = 'writing';
    if (qz.timed) { qz.timeLeft = qz.total * QZ_SECS; startClock(); }
    $('#quizBody').innerHTML = '<p style="margin:20px 0"><span class="spinner"></span>' + (qz.mode === 'practice' ? 'Writing fresh questions on the points you got wrong…' :
      'Writing your first ' + Math.min(QZ_BATCH, qz.total) + ' questions from ' + cardsWord(pool.length) + '… the rest are written while you answer.') + '</p>';
    $('#quizFoot').innerHTML = '<button type="button" class="btn" data-qz="cancel">Cancel</button>';
    requestBatch();
  }
  // A short adaptive quiz on particular topics (used by Today's session).
  function startTopicQuiz(keys, n) {
    if (!claudeCaps.sample) return false;
    qz = { step: 'setup', module: 'all', topics: keys.slice(), sources: [], focus: 'weak', diff: 'adaptive', n: n || 5, timed: false, mode: 'quiz', targets: null };
    if ($('#quizModal').hidden) openModal($('#quizModal'));
    beginQuiz();
    return true;
  }
  // Practice aimed at particular mistakes (and, if given, a topic around them).
  function startPractice(mistakeIds, opts) {
    opts = opts || {};
    var ids = (mistakeIds || []).filter(function (id) { var m = mistakeById(id); return m && !m.resolved; });
    if (!claudeCaps.sample) { toast('Practice questions are written by Claude, which works when the app is opened in claude.ai.', { type: 'error' }); return; }
    var prev = qz || {};
    qz = { step: 'setup', module: 'all', topics: opts.topics || [], sources: [], focus: 'weak', diff: 'adaptive', mode: 'practice',
      targets: ids, practiceOnly: !(opts.topics && opts.topics.length), n: opts.n || Math.max(5, Math.min(20, ids.length * 2)) };
    qz.prevSetup = { module: prev.module, topics: prev.topics, sources: prev.sources, focus: prev.focus, n: prev.n, diff: prev.diff };
    if (!ids.length && !(opts.topics && opts.topics.length)) { toast('Nothing to practise there.'); return; }
    if ($('#quizModal').hidden) openModal($('#quizModal'));
    beginQuiz();
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
  function quizAction(a, arg) {
    if (a === 'go') startQuiz();
    else if (a === 'cancel') { if (qz.ctl) qz.ctl.abort(); qz.step = 'setup'; qz.writing = false; renderQuiz(); }
    else if (a === 'all-topics') { qz.topics = quizTopicList(qz.module).map(function (t) { return t.key; }); renderQuiz(); }
    else if (a === 'no-topics') { qz.topics = []; renderQuiz(); }
    else if (qz.timed && qz.step === 'play' && (a === 'next' || a === 'back' || a === 'submit' || a === 'finish')) {
      if (a === 'back') { qz.idx = Math.max(0, qz.idx - 1); renderQuiz(); }
      else if (a === 'next') { qz.idx++; renderQuiz(); maybeRequestMore(); }
      else {
        var left = qz.total - qz.answers.filter(function (x) { return x != null; }).length;
        if (left && qz.timeLeft > 0) {
          dialog({ title: 'Submit your answers?', message: plural(left, 'question') + ' not answered yet. Unanswered questions count as wrong.', buttons: [{ label: 'Keep going', value: false }, { label: 'Submit', value: true, style: 'btn-primary' }] })
            .then(function (go) { if (go) submitExam(); });
        } else submitExam();
      }
    }
    else if (a === 'next') {
      if (qz.idx + 1 < qz.total) { qz.idx++; renderQuiz(); maybeRequestMore(); }
      else { qz.step = 'done'; qz.finished = true; renderQuiz(); }
    } else if (a === 'retry') { qz.batchError = ''; renderQuiz(); requestBatch(); }
    else if (a === 'finish') { if (qz.ctl) qz.ctl.abort(); qz.writing = false; qz.step = 'done'; qz.finished = true; renderQuiz(); }
    else if (a === 'again') {
      var ps = qz.mode === 'practice' && qz.prevSetup ? qz.prevSetup : qz;
      qz = { step: 'setup', module: ps.module || state.filter, topics: ps.topics || [], sources: ps.sources || [], focus: ps.focus || 'mixed', n: ps.n || 10, diff: ps.diff || 'adaptive', timed: ps.timed === true && qz.mode !== 'practice' };
      renderQuiz();
    }
    else if (a === 'show-wrong' || a === 'show-all') { qz.reviewFilter = a === 'show-wrong' ? 'wrong' : 'all'; renderQuiz(); }
    else if (a === 'practise-all') {
      startPractice(qz.questions.filter(function (q, i) { return qz.answers[i] != null && qz.answers[i] !== q.answer && q.mistakeId; }).map(function (q) { return q.mistakeId; }));
    }
    else if (a === 'practise-one') {
      var q1 = qz.questions[+arg];
      if (q1 && q1.mistakeId) startPractice([q1.mistakeId], { n: 5 });
    }
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
    else if (t.id === 'qzTimed') qz.timed = t.value === 'timed';
    else if (t.matches('[data-qsrc]')) {
      var sid = t.getAttribute('data-qsrc');
      qz.sources = (qz.sources || []).filter(function (x) { return x !== sid; });
      if (t.checked) qz.sources.push(sid);
      var c = $('#qzSrcCount'); if (c) c.textContent = '(' + (qz.sources.length ? qz.sources.length + ' selected' : 'optional — none ticked = all your cards') + ')';
    }
    else if (t.matches('[data-topic]')) {
      var k = t.getAttribute('data-topic');
      qz.topics = qz.topics.filter(function (x) { return x !== k; });
      if (t.checked) qz.topics.push(k);
      var h = $('.qz-topics-head .muted'); if (h) h.textContent = '(' + (qz.topics.length ? qz.topics.length + ' selected' : 'none ticked = every topic') + ')';
    }
  }
  function answerQuiz(i) {
    var q = qz.questions[qz.idx];
    if (q && qz.timed && qz.step === 'play') { qz.answers[qz.idx] = i; renderQuiz(); return; }
    if (!q || qz.answers[qz.idx] != null) return;
    qz.answers[qz.idx] = i;
    var right = i === q.answer;
    if (right) qz.score++;
    recordAnswer(q, right);
    memoryQuizAnswer(q, i, right);
    renderQuiz();
  }

