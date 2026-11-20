  /* ------------------------------------------------------------------
     U12. EXPLAINER VIDEOS — an ELI5 whiteboard video on any topic or
          concept, narrated in a natural Claude voice (the `tts`
          capability), with hand-drawn visuals drawn live in the page.
          Cheap by design: ONE Claude request writes the whole script
          (scenes + what to draw) from the owner's own cards; the
          drawings, timing and coverage check happen in the page, and a
          saved video replays for free.
          Coverage: every card in the chosen topic must appear; any the
          script missed get a scene built from the card itself (no
          extra request). Case names not in the cards are flagged.
          Stored as `video/<id>` (one doc each) or, in the browser,
          under `lawRevisionApp.v1.videos`.
     ------------------------------------------------------------------ */
  var VD_KEY = 'lawRevisionApp.v1.videos';
  var VD_MAX_CARDS = 40;
  var VD_KINDS = ['title', 'hypo', 'principle', 'steps', 'case', 'roundup', 'compare', 'quiz', 'apply', 'recap'];
  var VD_VOICES = { buttery: 'Warm', airy: 'Light', glassy: 'Clear', rounded: 'Soft' };
  var VD_RATES = [[0.75, 'Slow'], [0.85, 'Tutor pace'], [1, 'Normal'], [1.15, 'Brisk']];
  var vd = { view: 'list', mode: 'topic', topic: '', concept: '', length: 'quick', job: null, cur: null, scene: 0, playing: false, paused: false, timer: null, tts: null, ttsTried: false, ttsReady: false, voice: 'buttery', pvOn: false, pvVoice: 'bf_emma', pvTok: 0, rate: 0.85, style: 'whiteboard', view_style: '', cc: true, unsub: [] };
  state.videos = [];

  /* ---- storage ---- */
  function sanitizeVideo(v) {
    if (!v || typeof v !== 'object' || typeof v.id !== 'string' || !Array.isArray(v.scenes)) return null;
    var scenes = v.scenes.map(cleanScene).filter(Boolean).slice(0, 40);
    if (!scenes.length) return null;
    return {
      v: 1, id: v.id.replace(/[^A-Za-z0-9_\-]/g, '-').slice(0, 80), title: s_(v.title, 160) || 'Explainer', topic: s_(v.topic, 200), module: MODULE_LABEL[v.module] ? v.module : '',
      length: v.length === 'full' ? 'full' : 'quick', style: VD_STYLES[v.style] ? v.style : 'whiteboard', createdAt: v.createdAt && !isNaN(new Date(v.createdAt).getTime()) ? v.createdAt : nowISO(), seed: Math.round(num(v.seed, 7)) || 7,
      cardIds: (Array.isArray(v.cardIds) ? v.cardIds : []).map(function (x) { return s_(x, 120); }).filter(Boolean).slice(0, 80),
      coverage: v.coverage && typeof v.coverage === 'object' ? { cards: num(v.coverage.cards, 0), covered: num(v.coverage.covered, 0), added: num(v.coverage.added, 0), flagged: num(v.coverage.flagged, 0) } : { cards: 0, covered: 0, added: 0, flagged: 0 },
      scenes: scenes
    };
  }
  function readLocalVideos() { try { var d = JSON.parse(kvGet(VD_KEY) || '[]'); return Array.isArray(d) ? d : []; } catch (e) { return []; } }
  function loadLocalVideos() { state.videos = readLocalVideos().map(sanitizeVideo).filter(Boolean); setTimeout(renderVideoCount, 0); }
  function startVideoCloud(db) {
    db.collection('video').onSnapshot(function (snap) {
      state.videos = snap.docs.map(function (d) { return sanitizeVideo(d.data()); }).filter(Boolean);
      renderVideoCount();
      if (!$('#vdModal').hidden && vd.view === 'list') renderVideo();
    }, function () { /* list stays as it is */ });
  }
  function saveVideo(v) {
    if (store.mode === 'cloud' && claudeCaps.db) {
      setSync('busy');
      return claudeCaps.db.collection('video').doc(v.id).set(v).then(function () {
        if (!state.videos.some(function (x) { return x.id === v.id; })) state.videos.push(v);
        if (!anyQueued()) setSync('ok');
      }, function (err) { setSync('error', err && err.code === 'quota_exceeded' ? 'Your claude.ai storage is full' : 'The video couldn\'t be saved'); throw err; });
    }
    var list = readLocalVideos().filter(function (x) { return x && x.id !== v.id; }).concat([v]);
    try { kvSet(VD_KEY, JSON.stringify(list)); } catch (e) { return Promise.reject({ code: 'quota_exceeded' }); }
    state.videos = list.map(sanitizeVideo).filter(Boolean);
    return Promise.resolve();
  }
  function deleteVideo(id) {
    state.videos = state.videos.filter(function (v) { return v.id !== id; });
    if (store.mode === 'cloud' && claudeCaps.db) return claudeCaps.db.collection('video').doc(id).delete().then(null, function () {});
    try { kvSet(VD_KEY, JSON.stringify(readLocalVideos().filter(function (x) { return x && x.id !== id; }))); } catch (e) { /* ignore */ }
    return Promise.resolve();
  }
  function renderVideoCount() { var c = $('#vdCount'); if (c) c.textContent = String(state.videos.length); }
  function importVideos(list) {
    if (!Array.isArray(list)) return Promise.resolve(0);
    var have = {}; state.videos.forEach(function (v) { have[v.id] = true; });
    var todo = list.map(sanitizeVideo).filter(function (v) { return v && !have[v.id]; });
    return todo.reduce(function (p, v) { return p.then(function () { return saveVideo(v); }); }, Promise.resolve()).then(function () { return todo.length; });
  }

  /* ---- what the video covers ---- */
  function vdTopics() {
    var by = {};
    state.entries.forEach(function (e) { if (e.topic && (e.ratio || e.facts)) { var k = topicKey(e); (by[k] = by[k] || { key: k, module: e.module, topic: e.topic, n: 0 }).n++; } });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return a.module === b.module ? a.topic.localeCompare(b.topic) : MODULES.map(function (m) { return m.id; }).indexOf(a.module) - MODULES.map(function (m) { return m.id; }).indexOf(b.module); });
  }
  // The cards a video is made from: a whole topic, or the cards that best match a concept typed in.
  function vdPool() {
    var cards;
    if (vd.mode === 'topic') cards = state.entries.filter(function (e) { return topicKey(e) === vd.topic && (e.ratio || e.facts); });
    else {
      var words = normText(vd.concept).split(' ').filter(function (w) { return w.length >= 3; });
      if (!words.length) return [];
      cards = state.entries.map(function (e) {
        var name = normText(e.name + ' ' + e.topic + ' ' + (e.tags || []).join(' ')), body = normText(e.ratio + ' ' + e.facts);
        var sc = 0; words.forEach(function (w) { if (name.indexOf(' ' + w) !== -1) sc += 3; else if (body.indexOf(' ' + w) !== -1) sc += 1; });
        return { e: e, sc: sc };
      }).filter(function (x) { return x.sc >= Math.max(2, words.length); }).sort(function (a, b) { return b.sc - a.sc; }).map(function (x) { return x.e; });
    }
    // Same case twice (duplicates) → once.
    var seen = {};
    cards = cards.filter(function (e) { var k = normText(e.name); if (seen[k]) return false; seen[k] = true; return true; });
    cards.sort(function (a, b) { return (b.key ? 1 : 0) - (a.key ? 1 : 0) || (a.type === 'case' ? 1 : 0) - (b.type === 'case' ? 1 : 0); });
    return cards.slice(0, VD_MAX_CARDS);
  }

  /* ---- the script: ONE request ---- */
  var VD_ICONS_LIST = 'person, child, people, worker, doctor, police, judge, dog, car, road, ambulance, ship, train, bike, plane, house, shop, factory, hospital, court, fire, ball, money, contract, letter, phone, computer, book, pen, briefcase, parcel, gavel, scales, clock, calendar, warning, bottle, snail, food, cake, tree, water, umbrella, sun, cloud, stairs, ladder, injury, eye, heart, lightbulb, magnifier, megaphone, puzzle, target, trophy, bell, star, flag, question, tick, cross, key, lock, crown, chain, chainbreak, handshake';
  function videoPrompt(pool, label, length) {
    var q = length === 'quick';
    return [
      'EXPLAINER VIDEO SCRIPT',
      'You are the student\'s favourite law tutor: warm, patient, encouraging and genuinely enthusiastic. You are recording an animated explainer video for a law conversion (PGDL) student on: ' + label + '. The goal is that they truly GET it, explained like they are five (ELI5), not just hear it.',
      'HOW YOU SPEAK (this is read aloud by a natural voice, so write for the ear):',
      '- Calm and unhurried. Short sentences, one idea at a time. Leave breathing space with full stops and commas. Never cram.',
      '- Talk to "you" directly, like sitting next to them: "Here\'s the key bit.", "Let\'s slow down here.", "Stay with me, this is the clever part.", "Nice, you\'ve got that."',
      '- Signpost: say where we are going, then go there, then sum it up in one line before moving on ("So, in a nutshell…").',
      '- Every legal word gets an instant plain-English explanation and an everyday analogy. Contractions, a little humour, rhetorical questions ("So what did the court say?"). UK spelling. Never robotic, never a list read aloud.',
      'EXPLAIN FULLY:',
      '- Every principle or statute: (1) the rule in one plain sentence, (2) an ELI5 analogy from everyday life, (3) why it exists or why it matters, (4) when it applies and when it does not, (5) a one-line sum-up.',
      '- Every case as a proper little story: who the people were and what happened (from the card\'s facts), what went wrong, what the court decided, the rule it gives us, and why it matters in an exam (from the card\'s exam use).',
      '- Tie ideas together: show how each rule connects to the made-up example.',
      'ACCURACY RULES:',
      '- Use ONLY the student\'s cards below for the law. Cover EVERY card: list each card\'s id in "cards" on the scene that explains it, and say every case\'s name aloud in that scene.',
      '- Never invent a case, citation, date, fact or rule. If a card has no facts, give only its rule.',
      '- The everyday example must be clearly made up ("Imagine…") and never presented as a real case.',
      'STRUCTURE: a "title" scene; a "hypo" scene introducing one everyday made-up example with named characters; then the law in a sensible order ("principle" or "steps" scenes; a "case" scene per important case; "roundup" for at most 2 smaller cases at a time; "compare" to distinguish two cases); ' + (q ? 'one' : 'a') + ' "quiz" check-in' + (q ? '' : 's') + ' where the student applies what they have just learnt to the made-up example; an "apply" scene going back to the example; a "recap" scene.',
      'QUIZ CHECK-INS: ' + (q ? 'exactly 1' : '2 or 3 (never more), spread through the lesson,') + ' each placed straight after the law it tests has been taught. Each asks how that law applies to the made-up example\'s characters (a short twist on the scenario is fine), with 3 or 4 plausible options, exactly one right. The video pauses for the student to choose, then shows "explain". Its narration only sets up the question ("Time to put it into practice… Have a think, then pick your answer."); never say the answer in the narration.',
      q ? 'LENGTH: a refresher of about 4-5 minutes at a calm pace: 550-750 words of narration IN TOTAL across all scenes except quiz scenes (never more than 750). Spend the words where they matter most: core rules and leading cases get the fullest explanation; minor cases get a sentence or two in a roundup.'
        : 'LENGTH: a full lesson of about 10-12 minutes at a calm, unhurried pace: 1,250-1,550 words of narration IN TOTAL across all scenes except quiz scenes (never more than 1,550, so it stays within 12 minutes; quiz scenes do not count). Weigh and prioritise: core rules and leading cases get the full layered explanation; less important cases are told briefly (two or three sentences each, at most two per roundup). Never rush: cover less detail rather than speaking faster.',
      'Narration: no brackets, no citations or report references, no bullet points, no headings. Say case names naturally ("In Donoghue versus Stevenson…"); a year only if it helps.',
      'VISUALS: the app draws each scene as an animated illustration. Keep on-screen words SHORT (labels 1-6 words, rule up to 14 words). Pick lively, specific icons that match the story. Shapes by kind:',
      ' title: {"kind":"title","title":"","subtitle":"","icons":["up to 3"]}',
      ' hypo: {"kind":"hypo","characters":[{"name":"","icon":"","mood":"happy|sad|surprised|thinking|worried|angry"}],"props":["up to 3 icons"],"bubble":"what a character says, up to 12 words","label":"Imagine..."}',
      ' principle: {"kind":"principle","icon":"","rule":"","points":["2-4 short points"]}',
      ' steps: {"kind":"steps","steps":[{"label":"","icon":""}]}  (2-5 steps of a test, in order)',
      ' case: {"kind":"case","name":"case name exactly as on the card","year":"","panels":[{"icon":"","label":"what happened"},{"icon":"","label":"what was decided"},{"icon":"","label":"the rule"}]}',
      ' roundup: {"kind":"roundup","cases":[{"name":"","label":"the rule in a few words","icon":""}]}',
      ' compare: {"kind":"compare","left":{"title":"","icon":"","points":[""]},"right":{"title":"","icon":"","points":[""]}}',
      ' quiz: {"kind":"quiz","question":"the question, about the example\'s characters (up to 30 words)","options":["3 or 4 short options"],"answer":0,"explain":"why the right answer is right, naming the rule or case (1-3 sentences)"}',
      ' apply: {"kind":"apply","characters":[{"name":"","icon":"","mood":""}],"verdict":"short answer","good":true}',
      ' recap: {"kind":"recap","points":["3-6 short takeaways"]}',
      'ICONS (use only these names): ' + VD_ICONS_LIST + '.',
      'Reply with ONLY JSON: {"title": "", "scenes": [{"kind": "", "heading": "short heading shown on screen", "narration": "", "cards": ["ids of the cards this scene covers"], "visual": {}}]}',
      '', 'CARDS (id | type | name | citation | facts | rule | exam use):',
      pool.map(function (e) { return '[' + e.id + '] ' + e.type + ' | ' + e.name + ' | ' + (e.citation || '') + ' | ' + vdClip(e.facts, 600) + ' | ' + vdClip(e.ratio, 700) + ' | ' + vdClip(e.strategy, 300); }).join('\n')
    ].join('\n');
  }
  function vdClip(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
  function vdIcon(n, fallback) { n = String(n || '').toLowerCase().trim(); return VD_ICONS[n] ? n : (fallback || 'question'); }
  function vdCh(list, n) { return (Array.isArray(list) ? list : []).map(function (c) { return c && typeof c === 'object' ? { name: s_(c.name, 30), icon: vdIcon(c.icon, 'person'), mood: VD_MOODS.indexOf(c.mood) !== -1 ? c.mood : '' } : null; }).filter(Boolean).slice(0, n); }
  function cleanScene(sc) {
    if (!sc || typeof sc !== 'object') return null;
    var v = sc.visual && typeof sc.visual === 'object' ? sc.visual : {}, kind = VD_KINDS.indexOf(sc.kind) !== -1 ? sc.kind : VD_KINDS.indexOf(v.kind) !== -1 ? v.kind : 'principle';
    var o = { kind: kind, heading: s_(sc.heading, 80), narration: s_(sc.narration, 1800), cards: (Array.isArray(sc.cards) ? sc.cards : []).map(function (x) { return s_(x, 120); }).filter(Boolean).slice(0, 12), auto: sc.auto === true, warn: arr(sc.warn, 4, 160), visual: { kind: kind } };
    if (!o.narration) return null;
    var V = o.visual, pts = function (l, n, m) { return arr(l, n, m || 90); };
    if (kind === 'title') { V.title = s_(v.title, 90) || o.heading; V.subtitle = s_(v.subtitle, 100); V.icons = (Array.isArray(v.icons) ? v.icons : []).slice(0, 3).map(function (i) { return vdIcon(i); }); }
    else if (kind === 'hypo' || kind === 'apply') { V.characters = vdCh(v.characters, 3); if (!V.characters.length) V.characters = [{ name: '', icon: 'person' }]; V.props = (Array.isArray(v.props) ? v.props : []).slice(0, 3).map(function (i) { return vdIcon(i); }); V.bubble = s_(v.bubble, 110); V.label = s_(v.label, 60); V.verdict = s_(v.verdict, 60); V.good = v.good !== false; }
    else if (kind === 'principle') { V.icon = vdIcon(v.icon, 'scales'); V.rule = s_(v.rule, 140) || o.heading; V.points = pts(v.points, 4); }
    else if (kind === 'steps') { V.steps = (Array.isArray(v.steps) ? v.steps : []).map(function (x) { return x && s_(x.label) ? { label: s_(x.label, 60), icon: vdIcon(x.icon, 'tick') } : null; }).filter(Boolean).slice(0, 5); if (V.steps.length < 2) { o.kind = V.kind = 'principle'; V.icon = 'scales'; V.rule = o.heading; V.points = []; } }
    else if (kind === 'case') { V.name = s_(v.name, 90) || o.heading; V.year = s_(v.year, 12); V.panels = (Array.isArray(v.panels) ? v.panels : []).map(function (x) { return x && s_(x.label) ? { label: s_(x.label, 90), icon: vdIcon(x.icon) } : null; }).filter(Boolean).slice(0, 3); }
    else if (kind === 'roundup') { V.cases = (Array.isArray(v.cases) ? v.cases : []).map(function (x) { return x && s_(x.name) ? { name: s_(x.name, 80), label: s_(x.label, 130), icon: vdIcon(x.icon, 'gavel') } : null; }).filter(Boolean).slice(0, 4); }
    else if (kind === 'compare') { var side = function (x) { x = x && typeof x === 'object' ? x : {}; return { title: s_(x.title, 50), icon: vdIcon(x.icon, 'scales'), points: pts(x.points, 4, 70) }; }; V.left = side(v.left); V.right = side(v.right); }
    else if (kind === 'quiz') { V.question = s_(v.question, 220) || o.heading; V.answer = s_(v.answer, 160); V.options = arr(v.options, 4, 120); V.correct = V.options.length >= 2 ? Math.max(0, Math.min(V.options.length - 1, Math.round(num(v.answer, 0)))) : -1; if (V.options.length < 2) V.options = []; V.explain = s_(v.explain, 500); }
    else if (kind === 'recap') { V.points = pts(v.points, 6); if (!V.points.length) V.points = [o.heading || 'Recap']; }
    return o;
  }
  // Is a card mentioned in the script? By its id on a scene, or its name in the words or drawings.
  function vdNameKey(name) { var n = String(name || '').replace(/\s*[\[(].*$/, ''), m = /^(?:R \(([^)]+)\) v |R v )?(.+?)(?: v (\S+))?$/.exec(n); return normText(m && m[3] ? m[2] + ' v ' + m[3] : n).trim(); }
  function vdSceneText(sc) { return ' ' + normText(sc.heading + ' ' + sc.narration + ' ' + JSON.stringify(sc.visual).replace(/"[a-z]+":/g, ' ')) + ' '; }
  function vdCovered(card, scenes) {
    var k = vdNameKey(card.name), first = normText(card.name.split(/ v | — | - /)[0]).trim();
    // A case only counts if its name is actually said or shown; a rule counts if a scene claims it or names it.
    return scenes.some(function (sc) { var t = vdSceneText(sc), named = (k.length >= 5 && t.indexOf(' ' + k + ' ') !== -1) || (card.type === 'case' && first.length >= 5 && t.indexOf(' ' + first + ' ') !== -1); return named || (card.type !== 'case' && sc.cards.indexOf(card.id) !== -1); });
  }
  function vdFirstSentence(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); var m = /^(.{20,}?[.!?])(\s|$)/.exec(t); return vdClip(m ? m[1] : t, n || 240); }
  // Fill any gaps from the cards themselves (no extra request), and flag cases that aren't in the cards.
  function vdCoverage(scenes, pool) {
    var missing = pool.filter(function (e) { return !vdCovered(e, scenes); });
    var cases = missing.filter(function (e) { return e.type === 'case'; }), rules = missing.filter(function (e) { return e.type !== 'case'; });
    var extra = [];
    rules.forEach(function (e) {
      extra.push(cleanScene({ kind: 'principle', auto: true, heading: vdClip(e.name, 70), cards: [e.id],
        narration: 'One more rule to keep in your back pocket. It\'s called ' + e.name + '. ' + vdClip(vdFirstSentence(e.ratio || e.facts, 320), 320) + (e.strategy ? ' Why does it matter? ' + vdFirstSentence(e.strategy, 180) : ''),
        visual: { kind: 'principle', icon: e.type === 'statute' ? 'book' : 'scales', rule: vdClip(vdFirstSentence(e.ratio || e.facts, 140), 140), points: [] } }));
    });
    for (var i = 0; i < cases.length; i += 2) {
      var grp = cases.slice(i, i + 2);
      extra.push(cleanScene({ kind: 'roundup', auto: true, heading: grp.length > 1 ? 'More cases to know' : 'One more case', cards: grp.map(function (e) { return e.id; }),
        narration: (grp.length > 1 ? 'A few more cases to know. ' : 'One more case to know. ') + grp.map(function (e) { return 'Let\'s look at ' + e.name.replace(/ v /g, ' versus ') + '. ' + (e.facts ? 'Here\'s what happened. ' + vdFirstSentence(e.facts, 240) + ' ' : '') + 'And the rule it gives us? ' + vdFirstSentence(e.ratio, 260); }).join(' '),
        visual: { kind: 'roundup', cases: grp.map(function (e) { return { name: vdClip(e.name, 60), label: vdClip(vdFirstSentence(e.ratio, 130), grp.length > 2 ? 80 : 130), icon: 'gavel' }; }) } }));
    }
    var at = scenes.length && scenes[scenes.length - 1].kind === 'recap' ? scenes.length - 1 : scenes.length;
    var out = scenes.slice(0, at).concat(extra.filter(Boolean)).concat(scenes.slice(at));
    // Case names the script mentions that aren't in this topic's cards (or anywhere in the library).
    var known = {}; pool.concat(state.entries).forEach(function (e) { known[vdNameKey(e.name)] = true; });
    var flagged = 0;
    out.forEach(function (sc) {
      if (sc.auto) return;
      var names = {}, re = /\b((?:R \([A-Z][\w'&.-]*\) )?[A-Z][\w'&.-]*(?: [A-Z][\w'&.-]*){0,4}) (?:v|versus) ([A-Z][\w'&.-]*(?: [A-Z][\w'&.-]*){0,4})/g, m;
      var txt = sc.narration + ' ' + JSON.stringify(sc.visual);
      while ((m = re.exec(txt))) names[m[1] + ' v ' + m[2]] = true;
      var kn = Object.keys(known).filter(Boolean);
      var isKnown = function (n) { var k = vdNameKey(n); return kn.some(function (x) { return x === k || x.indexOf(k) === 0 || k.indexOf(x) === 0; }); };
      // "In Combe v Combe", "Also Smith v Jones": drop leading words until a known name is found.
      sc.warn = Object.keys(names).filter(function (n) { var w = n.split(' v ')[0].split(' '), rest = n.slice(n.indexOf(' v ')); for (var i = 0; i < w.length; i++) if (isKnown(w.slice(i).join(' ') + rest)) return false; return true; })
        .map(function (n) { return n.replace(/^(?:In|And|Also|So|But|Then|See|Like|Under|From|After|Remember|Take|Think of|Look at) /, ''); });
      flagged += sc.warn.length;
    });
    return { scenes: out, cov: { cards: pool.length, covered: pool.length - missing.length, added: missing.length, flagged: flagged } };
  }
  // Spoken time at the calm tutor pace, not counting quiz check-ins (which wait for you).
  function vdLimit(len) { return len === 'full' ? 12 * 60 : 6 * 60; }
  function vdTeachSecs(scenes) { return scenes.reduce(function (n, s) { return n + (s.kind === 'quiz' ? 0 : vdDurAt(s, 0.85)); }, 0); }
  function vdShortenPrompt(scenes, len, pool) {
    var words = len === 'full' ? 1450 : 700;
    return [
      'EXPLAINER VIDEO SHORTEN',
      'This explainer video script is too long. Rewrite it so the narration of all scenes EXCEPT quiz scenes totals at most ' + words + ' words, while keeping it warm, calm, unhurried and ELI5.',
      'Keep every scene\'s "cards" ids, keep every case name that is said aloud, keep the quiz scenes exactly as they are, and keep the same JSON shape. Shorten by trimming repetition and minor detail, merging small scenes, and telling minor cases more briefly — never by speaking faster or dropping a card.',
      'Use ONLY the facts already in the script. Reply with ONLY JSON: {"scenes": [...]}',
      '', JSON.stringify(scenes)
    ].join('\n');
  }
  function startVideo() {
    var pool = vdPool();
    if (!pool.length) { toast(vd.mode === 'topic' ? 'Choose a topic first.' : 'No cards match that — try other words.'); return; }
    if (!claudeCaps.sample) { toast('Videos are written by Claude, which works when the app is opened in claude.ai.', { type: 'error' }); return; }
    var t = vdTopics().filter(function (x) { return x.key === vd.topic; })[0];
    var label = vd.mode === 'topic' && t ? t.topic + ' (' + MODULE_LABEL[t.module] + ')' : vd.concept;
    var job = vd.job = { ctl: new AbortController(), error: '', label: label, n: pool.length };
    vd.view = 'gen'; renderVideo();
    claudeCaps.sample.json(videoPrompt(pool, label, vd.length), { signal: job.ctl.signal, cache: false, modelTier: 'default' }).then(null, function (err) {
      if (err && err.code === 'cancelled') throw err;
      if (!err || err.code === 'invalid_json') return claudeCaps.sample.json(videoPrompt(pool, label, vd.length), { signal: job.ctl.signal, cache: false, modelTier: 'default' });
      throw err;
    }).then(function (r) {
      var scenes = (Array.isArray(r && r.scenes) ? r.scenes : []).map(cleanScene).filter(Boolean);
      if (scenes.length < 2) throw { code: 'invalid_json' };
      var limit = vdLimit(vd.length);
      if (vdTeachSecs(scenes) <= limit * 1.04) return [r, scenes];
      job.step = 'Tightening the script to fit ' + Math.round(limit / 60) + ' minutes…'; renderVideo();
      return claudeCaps.sample.json(vdShortenPrompt(scenes, vd.length, pool), { signal: job.ctl.signal, cache: false, modelTier: 'default' }).then(function (r2) {
        var s2 = (Array.isArray(r2 && r2.scenes) ? r2.scenes : []).map(cleanScene).filter(Boolean);
        return [r, s2.length >= 2 && vdTeachSecs(s2) < vdTeachSecs(scenes) ? s2 : scenes];
      }, function (err) { if (err && err.code === 'cancelled') throw err; return [r, scenes]; });
    }).then(function (rs) {
      var r = rs[0], scenes = rs[1];
      var c = vdCoverage(scenes, pool);
      var v = sanitizeVideo({ id: uid('vd'), title: s_(r.title, 160) || label, topic: label, module: t ? t.module : (pool[0] && pool[0].module) || '', length: vd.length, style: vd.style, createdAt: nowISO(),
        seed: Math.floor(Math.random() * 1e6) + 1, cardIds: pool.map(function (e) { return e.id; }), coverage: c.cov, scenes: c.scenes });
      return saveVideo(v).then(function () { vd.job = null; vd.cur = v; vd.view_style = ''; vd.scene = 0; vd.view = 'play'; renderVideo(); renderVideoCount(); toast('Video ready: “' + v.title + '”.', { type: 'success' }); });
    }).then(null, function (err) {
      if (err && err.code === 'cancelled') return;
      if (err && (err.code === 'not_granted' || err.code === 'sampling_disabled')) claudeCaps.sample = null;
      job.error = sampleErrorText(err); renderVideo();
    });
  }

  /* ---- the voice ---- */
  function vdLoadTts() {
    if (vd.ttsTried) return Promise.resolve(vd.tts);
    vd.ttsTried = true;
    if (!window.claude || typeof window.claude.use !== 'function') { vd.ttsReady = true; return Promise.resolve(null); }
    return window.claude.use('tts').then(function (t) {
      vd.tts = t || null;
      if (t) {
        vd.unsub.push(t.onLine(function (e) { var m = vd.playing && e.id && /^s(\d+)(?:_0)?$/.exec(e.id); if (m) { vdShow(+m[1]); if (vd.ttsFeed) vd.ttsFeed(+m[1]); } }));
        vd.unsub.push(t.onState(function (e) {
          if (e.state === 'idle' && vd.playing && e.reason === 'completed' && vd.ttsMore && vd.ttsMore()) { vd.ttsFeed(-1); return; }
          if (e.state === 'idle' && vd.playing && e.reason !== 'replaced' && e.reason !== 'stopped') {
            vd.playing = false; vd.paused = false;
            if (e.reason === 'completed' && !vdSegmentEnd()) vd.ended = true;
            else if (e.reason === 'not_granted' || e.reason === 'unavailable') { vdVoiceOff(e.reason); }
            else if (e.reason === 'rate_limited') toast('The voice needs a short break. Try again in a little while, or watch with captions.', { type: 'error' });
            renderVdControls();
          }
          if (e.state === 'paused' || e.state === 'speaking') renderVdControls();
        }));
        if (t.setRate) t.setRate(vd.rate).then(null, function () {});
      }
      vd.ttsReady = true; renderVdControls();
      return vd.tts;
    }, function () { vd.tts = null; vd.ttsReady = true; renderVdControls(); return null; });
  }
  function fontsOnce() {
    if (document.getElementById('vdFonts')) return;
    var l = document.createElement('link'); l.id = 'vdFonts'; l.rel = 'stylesheet';
    l.href = VD_FONTS;
    document.head.appendChild(l);
  }

  /* ---- the player ---- */
  function vdDurAt(sc, rate) { return Math.max(5, sc.narration.length / 13.5 / rate + 0.6 * vdChunks(sc.narration).length); }
  function vdDur(sc) { return vdDurAt(sc, vd.rate) / (window.__vdFast || 1); }
  function vdStyleKey() { return VD_STYLES[vd.view_style] ? vd.view_style : (vd.cur && VD_STYLES[vd.cur.style] ? vd.cur.style : 'whiteboard'); }
  // A scene's words in short breaths (2-3 sentences each): the pause between lines gives the listener time to take it in.
  function vdChunks(t) { var ss = String(t).match(/[^.!?]+[.!?]+["”’')]*\s*|[^.!?]+$/g) || [t], out = [], cur = ''; ss.forEach(function (x) { if (cur && (cur + x).length > 260) { out.push(cur.trim()); cur = ''; } cur += x; }); if (cur.trim()) out.push(cur.trim()); return out.length ? out : [String(t)]; }
  function vdLines(v, from) {
    var lines = [];
    v.scenes.slice(from).forEach(function (s, k) { vdChunks(s.narration).forEach(function (c, j) { lines.push({ text: c, id: 's' + (from + k) + '_' + j, voice: vd.voice }); }); });
    if (lines.length > 100) lines = v.scenes.slice(from, from + 100).map(function (s, k) { return { text: s.narration, id: 's' + (from + k) + '_0', voice: vd.voice }; });
    return lines;
  }   // seconds, roughly, at this pace
  function vdShow(i) {
    var v = vd.cur; if (!v || !$('#vdStage')) return;
    i = Math.max(0, Math.min(v.scenes.length - 1, i));
    vd.scene = i;
    var key = vdStyleKey(), T = VD_STYLES[key], sc = v.scenes[i], d = vdSceneSVG(v, sc, i, key), dur = vdDur(sc);
    var step = Math.min(1.2, (dur * 0.68) / Math.max(1, d.steps));
    $('#vdStage').className = 'vd-stage vd-st-' + key + (vd.paused ? ' paused' : '') + (vd.playing ? '' : ' idle');
    $('#vdStage').innerHTML = '<svg viewBox="0 0 1280 720" class="vd-svg" role="img" aria-label="' + esc(sc.heading || v.title) + '" style="--step:' + step.toFixed(2) + 's;--late:' + (dur * 0.62).toFixed(1) + 's">' +
      '<defs>' + vdDefs(T, v.seed || 7) + '</defs>' + vdBg(T) + '<g class="vd-cam"' + (T.chalk ? ' filter="url(#vdChalk)"' : '') + '>' + d.svg + '</g>' +
      '<text x="1210" y="690" font-size="22" fill="' + T.sub + '" text-anchor="end" class="vd-plain vd-count">' + (i + 1) + ' / ' + v.scenes.length + '</text></svg>';
    $('#vdCap').innerHTML = (sc.warn.length ? '<p class="vd-warn">⚠ Mentions ' + esc(sc.warn.join(', ')) + ', which isn\'t in your cards — check it.</p>' : '') +
      (sc.auto ? '<p class="vd-auto">Added by the coverage check, straight from your card.</p>' : '') + '<p>' + esc(sc.narration) + '</p>';
    $('#vdCap').hidden = !vd.cc && !sc.warn.length;
    renderVdControls();
  }
  function renderVdControls() {
    var st = $('#vdStage'); if (st) { st.classList.toggle('idle', !vd.playing); st.classList.toggle('paused', vd.playing && vd.paused); }
    var c = $('#vdCtl'); if (!c || !vd.cur) return;
    var v = vd.cur, voiced = !!vd.tts;
    c.innerHTML = '<div class="vd-row">' +
      (vd.playing ? '<button type="button" class="btn btn-sm" data-vd="pause">' + (vd.paused ? '▶ Resume' : '❚❚ Pause') + '</button><button type="button" class="btn btn-sm" data-vd="stop">■ Stop</button>'
        : '<button type="button" class="btn btn-sm btn-primary" data-vd="play">▶ ' + (vd.ended ? 'Play again' : vd.scene ? 'Play from here' : 'Play') + '</button>') +
      '<button type="button" class="btn btn-sm btn-ghost" data-vd="prev" aria-label="Previous scene">‹</button><button type="button" class="btn btn-sm btn-ghost" data-vd="next" aria-label="Next scene">›</button>' +
      '<span class="vd-dots">' + v.scenes.map(function (s, i) { return '<button type="button" class="vd-dot' + (i === vd.scene ? ' on' : '') + (s.auto ? ' auto' : '') + '" data-vd="go" data-i="' + i + '" title="' + esc((i + 1) + '. ' + (s.heading || s.kind)) + '"></button>'; }).join('') + '</span>' +
      '<span class="spacer"></span>' +
      (!voiced && vd.pvOn && pv.state === 'ready' ? '<label class="vd-sel">Voice <select id="vdPVoice">' + Object.keys(PV_VOICES).map(function (k) { return '<option value="' + k + '"' + (k === vd.pvVoice ? ' selected' : '') + '>' + PV_VOICES[k] + '</option>'; }).join('') + '</select></label>' : '') +
      (voiced ? '<label class="vd-sel">Voice <select id="vdVoice">' + Object.keys(VD_VOICES).map(function (k) { return '<option value="' + k + '"' + (k === vd.voice ? ' selected' : '') + '>' + VD_VOICES[k] + '</option>'; }).join('') + '</select></label>' : '') +
      '<label class="vd-sel">Style <select id="vdStyle">' + VD_STYLE_ORDER.map(function (k) { return '<option value="' + k + '"' + (k === vdStyleKey() ? ' selected' : '') + '>' + VD_STYLES[k].label + '</option>'; }).join('') + '</select></label>' +
      '<label class="vd-sel">Pace <select id="vdRate">' + VD_RATES.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === vd.rate ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select></label>' +
      '<button type="button" class="btn btn-sm' + (vd.cc ? ' on' : '') + '" data-vd="cc" aria-pressed="' + vd.cc + '">CC</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-vd="full" title="Full screen">⛶</button></div>' +
      '<p class="vd-novoice">' + vdVoiceNote() + '</p>';
  }
  function vdPlay(from) {
    var v = vd.cur; if (!v) return;
    vd.ended = false;
    stopVdTimer();
    from = Math.max(0, Math.min(v.scenes.length - 1, from || 0));
    vd.playing = true; vd.paused = false; vdAskHide();
    vd.stopAt = vdNextQuiz(from);
    vdShow(from);
    if (vd.tts) {
      vd.restarting = true; setTimeout(function () { vd.restarting = false; }, 600);
      // The voice is handed two scenes at a time and topped up as each scene starts: one long video in a single
      // reading can be more than the voice will take at once, and then it refuses the whole thing.
      var groups = [], tok = vd.ttsTok = (vd.ttsTok || 0) + 1, next = 0, first = true;
      vdLines(v, from).forEach(function (l) { var n = +/^s(\d+)/.exec(l.id)[1]; if (n > vd.stopAt) return; var s = n - from; (groups[s] = groups[s] || []).push(l); });
      groups = groups.filter(Boolean);
      var fail = function (err) {
        if (tok !== vd.ttsTok || !err || err.code === 'stopped') return;
        vd.ttsFeed = vd.ttsMore = null;
        if (err.code === 'not_granted' || err.code === 'unavailable') { vdVoiceOff(err.code); vdPlay(vd.scene); return; }
        if (err.code === 'no_gesture') { vd.playing = false; renderVdControls(); toast('Press Play again to start the voice.'); return; }
        // Anything else: keep the video going with captions from here, and say why.
        toast((err.code === 'rate_limited' ? 'The voice needs a short break' : 'The voice couldn\'t read this part (' + (err.code || 'error') + ')') + ', so the video carries on with captions. Press Play later to hear the voice again.', { type: 'error', timeout: 8000 });
        vdCaptionsFrom(vd.scene);
      };
      var feed = function () {
        if (tok !== vd.ttsTok || next >= groups.length) return;
        var g = groups[next++], p = first ? vd.tts.speak(g, { rate: vd.rate, voice: vd.voice }) : vd.tts.add(g, { rate: vd.rate, voice: vd.voice });
        first = false; p.then(null, fail);
      };
      vd.ttsMore = function () { return tok === vd.ttsTok && next < groups.length; };
      vd.ttsFeed = function (scene) { if (tok !== vd.ttsTok) return; var at = scene < 0 ? next : scene - from; while (next < groups.length && next <= at + 2) feed(); };
      feed(); feed();
      return;
    }
    if (vd.pvOn && pv.state === 'ready') { vdPhonePlay(from); return; }
    vdCaptionsFrom(from);
  }
  function vdCaptionsFrom(from) {
    var v = vd.cur; if (!v) return;
    stopVdTimer(); vd.ttsTok = (vd.ttsTok || 0) + 1; vd.ttsFeed = vd.ttsMore = null;
    vd.playing = true; vd.paused = false; if (vd.scene !== from) vdShow(from); else renderVdControls();
    // No voice here: captions, timed to roughly how long the words take to say.
    var tick = function () {
      if (!vd.playing || vd.paused) return;
      vd.timer = setTimeout(function () {
        if (!vd.playing || vd.paused) return;
        if (vd.scene >= Math.min(v.scenes.length - 1, vd.stopAt == null ? 1e9 : vd.stopAt)) { vd.playing = false; if (!vdSegmentEnd()) vd.ended = true; renderVdControls(); return; }
        vdShow(vd.scene + 1); tick();
      }, vdDur(v.scenes[vd.scene]) * 1000);
    };
    tick();
  }
  // Where the Claude voice is offered, why not, and what to do.
  function vdVoiceOff(code) {
    vd.tts = null;
    if (code === 'not_granted') { vd.ttsOff = true; try { localStorage.setItem('lawRevisionApp.v1.ttsOff', '1'); } catch (e) { /* ignore */ } }
    toast(code === 'not_granted' ? 'Reading aloud is turned off for this app. You can turn it back on in the app\'s Permissions menu.' : 'The voice isn\'t available just now, so the video plays with captions.');
    renderVdControls();
  }
  function vdVoiceNote() {
    if (vd.tts) return '🔊 <b>Tutor voice on.</b> Press Play and turn your sound up. Hear nothing? Check your device isn\'t muted, and that <i>Read aloud</i> is allowed in this app\'s Permissions menu (at the top of the page on claude.ai).';
    if (!vd.ttsReady) return '<span class="spinner"></span>Checking for the tutor voice…';
    var why = vd.ttsOff ? '🔇 <b>Reading aloud is turned off for this app.</b> To hear the tutor, turn <i>Read aloud</i> back on in the app\'s Permissions menu at the top of the page on claude.ai, then reopen the app.'
      : '🔇 <b>The Claude tutor voice isn\'t offered in this view.</b> It works when the app is opened on claude.ai in <b>Chrome or Edge on a computer</b>, or in the main window of the <b>Claude desktop app</b>. It isn\'t available in Safari, Firefox, the Claude phone apps, side panels, or the offline copy.';
    if (vd.ttsOff || !pvAvailable()) return why + (vd.ttsOff ? '' : ' Here it plays with captions.');
    if (pv.state === 'ready' && vd.pvOn) { setTimeout(function () { vdPrep(vd.playing ? vd.scene : 0); }, 0); return '🔊 <b>Phone voice on.</b> A natural voice made on this device. <span id="vdPrep"></span>'; }
    if (pv.state === 'loading') return '<span class="spinner"></span>' + esc(pv.stepText || 'Getting the phone voice ready…') + ' <b>' + pv.pct + '%</b> <span class="muted">(about 105 MB, only the first time — Wi-Fi is best)</span>';
    if (pv.state === 'error') return '⚠ The phone voice couldn\'t start here: ' + esc(pv.err) + ' <button type="button" class="btn btn-sm" data-vd="pvon">Try again</button>';
    return '🔇 The Claude tutor voice isn\'t offered on this device (it only works on a computer). <button type="button" class="btn btn-sm btn-primary" data-vd="pvon">🔊 Use the phone voice</button> <span class="muted">A natural-sounding voice that runs on this device. It downloads about 105 MB once (Wi-Fi is best).</span>';
  }
  function vdPvOn() {
    vd.pvOn = true; vdPref('pv', true);
    pv.onMade = vdPrepShow;
    return pvStart(function (t) { pv.stepText = t; renderVdControls(); }).then(function () { renderVdControls(); }, function () { renderVdControls(); });
  }
  // Prepare the voice for the whole video in the background (from scene `from` on, then the rest), and show how far it has got.
  function vdPrep(from) {
    var v = vd.cur; if (!v || !vd.pvOn || pv.state !== 'ready' || vd.tts) return;
    var voice = PV_VOICES[vd.pvVoice] ? vd.pvVoice : 'bf_emma', speed = vd.rate;
    var all = vdLines(v, 0), order = all.filter(function (l) { return +/^s(\d+)/.exec(l.id)[1] >= (from || 0); }).concat(all.filter(function (l) { return +/^s(\d+)/.exec(l.id)[1] < (from || 0); }));
    var items = order.map(function (l) { return { key: v.id + '|' + l.id + '|' + voice + '|' + speed + '|' + vdHash(l.text), text: l.text, voice: voice, speed: speed }; });
    vd.prepKeys = items.map(function (it) { return it.key; });
    pvPrepare(items);
    vdPrepShow();
  }
  function vdPrepShow() {
    var el = $('#vdPrep'); if (!el || !vd.prepKeys) return;
    var n = vd.prepKeys.length, done = vd.prepKeys.filter(function (k) { return pv.mem[k]; }).length;
    el.innerHTML = done >= n ? '✓ Voice ready for the whole video' : '<span class="spinner"></span>Preparing the voice for this video: <b>' + Math.round(done / Math.max(1, n) * 100) + '%</b> <span class="muted">(you can press Play now)</span>';
  }
  function vdHash(t) { var h = 2166136261; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  // Play with the phone voice: make each breath of narration in order (ahead of where you are) and play it as it's ready.
  function vdPhonePlay(from) {
    var v = vd.cur, tok = ++vd.pvTok, lines = vdLines(v, from).filter(function (l) { return +/^s(\d+)/.exec(l.id)[1] <= vd.stopAt; }), voice = PV_VOICES[vd.pvVoice] ? vd.pvVoice : 'bf_emma', speed = vd.rate;
    pvCtx().resume();
    vdPrep(from);
    var key = function (l) { return v.id + '|' + l.id + '|' + voice + '|' + speed + '|' + vdHash(l.text); };
    var made = { then: null };
    made = lines.map(function (l) { return { then: function (a, b) { return pvSay(key(l), l.text, voice, speed, true).then(a, b); } }; });
    var held = function () { return new Promise(function (r) { (function wait() { if (tok !== vd.pvTok || !vd.paused) r(); else setTimeout(wait, 200); })(); }); };
    var waiting = function (on) { var st = $('#vdStage'); if (st) st.classList.toggle('waiting', on); };
    var playAt = function (i) {
      if (tok !== vd.pvTok) return;
      if (i >= lines.length) { vd.playing = false; if (!vdSegmentEnd()) vd.ended = true; renderVdControls(); return; }
      var m = /^s(\d+)_(\d+)$/.exec(lines[i].id);
      if (m && m[2] === '0' && +m[1] !== vd.scene) vdShow(+m[1]);
      var t0 = setTimeout(function () { waiting(true); }, 250);
      made[i].then(function (audio) {
        clearTimeout(t0); waiting(false);
        if (tok !== vd.pvTok) return;
        return held().then(function () { if (tok !== vd.pvTok) return; return pvPlay(audio).then(function () { if (tok !== vd.pvTok) return; setTimeout(function () { playAt(i + 1); }, 380); }); });
      }, function (err) {
        clearTimeout(t0); waiting(false);
        if (tok !== vd.pvTok || (err && err.code === 'stopped')) return;
        vd.playing = false; renderVdControls(); toast('The phone voice hit a problem: ' + ((err && err.message) || 'unknown') + '. Press Play to try again.', { type: 'error', timeout: 7000 });
      });
    };
    playAt(0);
  }
  // Quiz check-ins: the video stops after a quiz scene's narration and waits for your answer.
  function vdNextQuiz(from) { var s = vd.cur.scenes; for (var i = from; i < s.length; i++) if (s[i].kind === 'quiz') return i; return s.length - 1; }
  function vdSegmentEnd() { var s = vd.cur && vd.cur.scenes[vd.stopAt]; if (!s || s.kind !== 'quiz') return false; vdAsk(vd.stopAt); return true; }
  function vdAskHide() { vd.asking = null; var el = $('#vdAsk'); if (el) { el.hidden = true; el.innerHTML = ''; } }
  function vdAsk(k, chosen) {
    var el = $('#vdAsk'), sc = vd.cur && vd.cur.scenes[k]; if (!el || !sc) return;
    vd.asking = k; vd.playing = false; renderVdControls();
    var V = sc.visual, has = V.options && V.options.length >= 2, done = chosen != null;
    var right = has && chosen === V.correct, L = 'ABCD';
    el.hidden = false;
    el.innerHTML = '<div class="vd-ask-q"><b>Your turn</b> ' + esc(V.question) + '</div>' +
      (has ? '<div class="vd-ask-opts">' + V.options.map(function (o, i) {
        var cls = done ? (i === V.correct ? ' right' : i === chosen ? ' wrong' : '') : '';
        return '<button type="button" class="vd-ask-opt' + cls + '" data-vd="ans" data-o="' + i + '"' + (done ? ' disabled' : '') + '><span>' + L[i] + '</span>' + esc(o) + '</button>';
      }).join('') + '</div>' : (done ? '' : '<button type="button" class="btn btn-sm" data-vd="ans" data-o="-1">Show the answer</button>')) +
      (done ? '<div class="vd-ask-fb ' + (has ? (right ? 'ok' : 'bad') : '') + '">' + (has ? (right ? '✓ Spot on! ' : '✗ Not quite — the answer is ' + L[V.correct] + '. ') : '') + esc(V.explain || V.answer || '') + '</div>' +
        '<div class="vd-ask-go"><button type="button" class="btn btn-primary btn-sm" data-vd="cont">Continue ▶</button></div>' : '<div class="vd-ask-hint">The video is paused until you answer.</div>');
    if (done && (V.explain || V.answer)) {
      var say = (has ? (right ? 'Spot on. ' : 'Not quite. The answer is ' + L[V.correct] + '. ') : '') + (V.explain || V.answer);
      if (vd.tts) vd.tts.speak([{ text: say.slice(0, 1800), voice: vd.voice }], { rate: vd.rate, voice: vd.voice }).then(null, function () {});
      else if (vd.pvOn && pv.state === 'ready') { var tok = ++vd.pvTok; pvSay(vd.cur.id + '|q' + k + '|' + chosen + '|' + vd.pvVoice + '|' + vd.rate, say, vd.pvVoice, vd.rate, true).then(function (a) { if (tok === vd.pvTok && vd.asking === k) return pvPlay(a); }, function () {}); }
    }
  }
  function stopVdTimer() { if (vd.timer) { clearTimeout(vd.timer); vd.timer = null; } }
  function vdStop(leaving) { stopVdTimer(); vd.ttsTok = (vd.ttsTok || 0) + 1; vd.ttsFeed = vd.ttsMore = null; vd.playing = false; vd.paused = false; vd.pvTok = (vd.pvTok || 0) + 1; pvHalt(); if (leaving) { pvDrop(); vd.prepKeys = null; vdAskHide(); } if (vd.tts) vd.tts.stop().then(null, function () {}); if ($('#vdStage')) $('#vdStage').classList.remove('paused'); renderVdControls(); }
  function vdToggle() { if (!vd.cur || vd.asking != null) return; if (vd.playing) vdPause(); else vdPlay(vd.ended ? 0 : vd.scene); }
  function vdPause() {
    if (!vd.playing) return;
    vd.paused = !vd.paused;
    $('#vdStage').classList.toggle('paused', vd.paused);
    if (vd.tts) (vd.paused ? vd.tts.pause() : vd.tts.resume()).then(null, function () {});
    else if (vd.pvOn && pv.state === 'ready') { if (pv.ctx) { if (vd.paused) pv.ctx.suspend(); else pv.ctx.resume(); } }
    else if (!vd.paused) { var keep = vd.scene; vd.playing = false; vd.scene = keep; vdPlay(keep); return; }
    else stopVdTimer();
    renderVdControls();
  }

  /* ---- the window ---- */
  function openVideo() { fontsOnce(); vdLoadTts().then(function (t) { if (!t && vd.pvOn && pvAvailable() && pv.state === 'off') vdPvOn(); }); if (vd.view !== 'gen' || !vd.job) vd.view = vd.cur && vd.view === 'play' ? 'play' : 'list'; renderVideo(); openModal($('#vdModal')); }
  function renderVideo() {
    var body = $('#vdBody'), foot = $('#vdFoot');
    if (vd.view === 'gen') {
      var j = vd.job || {};
      body.innerHTML = '<div class="vd-gen">' + (j.error ? '<p class="step-note warn">' + esc(j.error) + '</p>' : '<p><span class="spinner"></span> ' + (j.step ? esc(j.step) : 'Writing your explainer on <b>' + esc(j.label || '') + '</b> from ' + plural(j.n || 0, 'card') + '…') + '</p><p class="muted">One request to Claude writes the whole script and what to draw. The drawing and the coverage check happen here, for free.</p>') + '</div>';
      foot.innerHTML = j.error ? '<button type="button" class="btn" data-vd="new">Back</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-vd="make">Try again</button>' : '<button type="button" class="btn" data-vd="cancel">Cancel</button>';
      return;
    }
    if (vd.view === 'play' && vd.cur) {
      var v = vd.cur, c = v.coverage;
      body.innerHTML = '<div class="vd-head"><h3>' + esc(v.title) + '</h3><span>' + (v.module ? esc(MODULE_LABEL[v.module]) + ' · ' : '') + plural(v.scenes.length, 'scene') + ' · about ' + Math.max(1, Math.round(v.scenes.reduce(function (n, s) { return n + (s.kind === 'quiz' ? 0 : vdDurAt(s, vd.rate)); }, 0) / 60)) + ' min' + (function () { var q = v.scenes.filter(function (s) { return s.kind === 'quiz'; }).length; return q ? ' + ' + plural(q, 'quiz check-in') : ''; })() + ' · ' +
        '<b class="vd-cov">Covers ' + c.covered + (c.added ? ' + ' + c.added : '') + ' of ' + plural(c.cards, 'card') + ' on this topic</b>' + (c.added ? ' (' + c.added + ' added by the coverage check)' : '') + (c.flagged ? ' · <b class="vd-bad">' + c.flagged + ' to check</b>' : '') + '</span></div>' +
        '<div class="vd-stage" id="vdStage" title="Click to play or pause (or press the space bar)"></div><div class="vd-ask" id="vdAsk" hidden></div><div class="vd-ctl" id="vdCtl"></div><div class="vd-cap" id="vdCap"></div>';
      foot.innerHTML = '<button type="button" class="btn" data-vd="list">← All videos</button><span class="spacer"></span><button type="button" class="btn" data-close>Close</button>';
      vdShow(vd.scene || 0);
      return;
    }
    if (vd.view === 'new') {
      var topics = vdTopics(), pool = vdPool();
      var byMod = {}; topics.forEach(function (t) { (byMod[t.module] = byMod[t.module] || []).push(t); });
      body.innerHTML = '<p class="muted" style="margin-top:0">Pick a topic (or type a concept) and Claude writes a short whiteboard video: a friendly tutor explains it ELI5-style with a made-up everyday example, every principle and case from your cards (each case told as a tiny story), hand-drawn as it talks.</p>' +
        '<div class="seg" role="tablist"><button type="button" class="seg-btn' + (vd.mode === 'topic' ? ' on' : '') + '" data-vd="mode" data-m="topic">A topic</button><button type="button" class="seg-btn' + (vd.mode === 'concept' ? ' on' : '') + '" data-vd="mode" data-m="concept">A concept</button></div>' +
        (vd.mode === 'topic' ? '<div class="form-field"><label class="lbl" for="vdTopic">Topic</label><select class="input" id="vdTopic"><option value="">Choose a topic…</option>' +
          Object.keys(byMod).map(function (m) { return '<optgroup label="' + esc(MODULE_LABEL[m]) + '">' + byMod[m].map(function (t) { return '<option value="' + esc(t.key) + '"' + (t.key === vd.topic ? ' selected' : '') + '>' + esc(t.topic) + ' (' + t.n + ')</option>'; }).join('') + '</optgroup>'; }).join('') + '</select></div>'
          : '<div class="form-field"><label class="lbl" for="vdConcept">Concept</label><input class="input" id="vdConcept" maxlength="120" value="' + esc(vd.concept) + '" placeholder="e.g. promissory estoppel, but-for test, consideration"></div>') +
        '<div class="form-field"><span class="lbl">Length</span><div class="seg"><button type="button" class="seg-btn' + (vd.length === 'quick' ? ' on' : '') + '" data-vd="len" data-l="quick">Refresher</button><button type="button" class="seg-btn' + (vd.length === 'full' ? ' on' : '') + '" data-vd="len" data-l="full">Full lesson (with quiz check-ins)</button></div></div>' +
        '<div class="form-field"><span class="lbl">Style <span class="hint">(you can switch while watching — it\'s free)</span></span><div class="vd-styles">' + VD_STYLE_ORDER.map(function (k) { var T = VD_STYLES[k]; return '<button type="button" class="vd-sty' + (vd.style === k ? ' on' : '') + '" data-vd="sty" data-s="' + k + '"><i style="background:' + (T.bg === 'sky' ? 'linear-gradient(#cfe6ff,#fdf2ff)' : T.bg) + '">' + T.pens.slice(0, 4).map(function (c) { return '<b style="background:' + c + '"></b>'; }).join('') + '</i><span>' + T.label + '</span></button>'; }).join('') + '</div></div>' +
        '<p class="vd-pool" id="vdPool">' + (pool.length ? 'Made from <b>' + plural(pool.length, 'card') + '</b>: ' + esc(pool.slice(0, 8).map(function (e) { return e.name; }).join(', ')) + (pool.length > 8 ? '…' : '') + (pool.length > 14 && vd.length === 'quick' ? '<br><span class="warn">That\'s a lot for a quick refresher; a full explainer gives each case more room.</span>' : '') : (vd.mode === 'topic' ? 'Choose a topic to see which cards it uses.' : 'Type a concept to find matching cards.')) + '</p>' +
        '<p class="muted rn-note">Uses one Claude request per video. Saved videos replay for free. Only your own cards are used for the law.</p>' +
        (claudeCaps.sample ? '' : '<p class="step-note warn">Videos are written by Claude, which works when the app is opened in claude.ai.</p>');
      foot.innerHTML = '<button type="button" class="btn" data-vd="list">Back</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-vd="make"' + (claudeCaps.sample && pool.length ? '' : ' disabled') + '>✦ Make video</button>';
      return;
    }
    var list = state.videos.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    body.innerHTML = list.length ? '<div class="rn-list">' + list.map(function (v) {
      return '<div class="rn-item"><div class="rn-item-text"><b>' + esc(v.title) + '</b><span>' + (v.module ? esc(MODULE_LABEL[v.module]) + ' · ' : '') + (v.length === 'full' ? 'Full lesson' : 'Refresher') + ' · ' + VD_STYLES[v.style].label + ' · ' + plural(v.scenes.length, 'scene') + ' · ' +
        new Date(v.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '</span><small>' + esc(v.topic) + '</small></div>' +
        '<div class="rn-item-tools"><button type="button" class="btn btn-sm btn-primary" data-vd="open" data-id="' + esc(v.id) + '">▶ Watch</button><button type="button" class="btn btn-sm btn-ghost" data-vd="delete" data-id="' + esc(v.id) + '">Delete</button></div></div>';
    }).join('') + '</div>' : '<div class="empty" style="padding:30px 16px"><h3>No videos yet</h3><p>Pick a topic and get a friendly, hand-drawn explainer with a tutor\'s voice: the principles, every case as a tiny story, and a made-up example to tie it together.</p></div>';
    foot.innerHTML = '<span class="spacer"></span><button type="button" class="btn" data-close>Close</button><button type="button" class="btn btn-primary" data-vd="new">＋ New video</button>';
  }
  function videoAction(a, el) {
    var id = el && el.getAttribute('data-id');
    if (a === 'new') { vdStop(); vd.view = 'new'; renderVideo(); }
    else if (a === 'list') { vdStop(true); vd.view = 'list'; renderVideo(); }
    else if (a === 'mode') { vd.mode = el.getAttribute('data-m'); renderVideo(); }
    else if (a === 'len') { vd.length = el.getAttribute('data-l'); renderVideo(); }
    else if (a === 'sty') { vd.style = el.getAttribute('data-s'); vdPref('style', vd.style); renderVideo(); }
    else if (a === 'make') startVideo();
    else if (a === 'cancel') { if (vd.job) vd.job.ctl.abort(); vd.job = null; vd.view = 'new'; renderVideo(); }
    else if (a === 'open') { vdStop(true); var v = state.videos.filter(function (x) { return x.id === id; })[0]; if (!v) return; vd.cur = v; vd.view_style = ''; vd.scene = 0; vd.ended = false; vd.view = 'play'; renderVideo(); }
    else if (a === 'play') vdPlay(vd.ended ? 0 : vd.asking != null ? vd.asking + 1 : vd.scene);
    else if (a === 'ans') { vdAsk(vd.asking, +el.getAttribute('data-o')); }
    else if (a === 'cont') { var nx = vd.asking + 1; vd.pvTok++; pvHalt(); if (vd.tts) vd.tts.stop().then(null, function () {}); vdAskHide(); if (nx >= vd.cur.scenes.length) { vd.ended = true; renderVdControls(); } else vdPlay(nx); }
    else if (a === 'pvon') vdPvOn();
    else if (a === 'pause') vdPause();
    else if (a === 'stop') vdStop();
    else if (a === 'prev' || a === 'next' || a === 'go') {
      vdAskHide();
      var to = a === 'go' ? +el.getAttribute('data-i') : vd.scene + (a === 'next' ? 1 : -1);
      if (vd.playing) vdPlay(Math.max(0, Math.min(vd.cur.scenes.length - 1, to))); else { vd.ended = false; vdShow(to); }
    }
    else if (a === 'cc') { vd.cc = !vd.cc; vdShow(vd.scene); }
    else if (a === 'full') { var st = $('#vdStage'); if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); else if (st && st.requestFullscreen) st.parentNode.requestFullscreen().catch(function () {}); }
    else if (a === 'delete') {
      var m = state.videos.filter(function (x) { return x.id === id; })[0]; if (!m) return;
      dialog({ title: 'Delete “' + m.title + '”?', message: 'The video will be deleted. Your cards are not affected.', buttons: [{ label: 'Cancel', value: false }, { label: 'Delete', value: true, style: 'btn-danger' }] })
        .then(function (yes) { if (!yes) return; deleteVideo(id).then(function () { renderVideo(); renderVideoCount(); toast('Video deleted.'); }); });
    }
  }
  function vdPref(k, val) { try { var p = JSON.parse(localStorage.getItem('lawRevisionApp.v1.videoPrefs') || '{}'); p[k] = val; localStorage.setItem('lawRevisionApp.v1.videoPrefs', JSON.stringify(p)); } catch (e) { /* ignore */ } }
  function bindVideo() {
    try { var vp = JSON.parse(localStorage.getItem('lawRevisionApp.v1.videoPrefs') || '{}'); if (VD_RATES.some(function (r) { return r[0] === vp.rate; })) vd.rate = vp.rate; if (VD_STYLES[vp.style]) vd.style = vp.style; vd.pvOn = vp.pv === true; vd.pvVoice = PV_VOICES[vp.pvVoice] ? vp.pvVoice : 'bf_emma'; } catch (e) { /* ignore */ }
    try { vd.ttsOff = localStorage.getItem('lawRevisionApp.v1.ttsOff') === '1'; } catch (e) { /* ignore */ }
    $('#vdBtn').addEventListener('click', function () { openVideo(); });
    var m = $('#vdModal');
    m._onClose = function () { vdStop(true); if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); };
    m.addEventListener('click', function (ev) { var b = ev.target.closest('[data-vd]'); if (b) videoAction(b.getAttribute('data-vd'), b); else if (ev.target.closest('#vdStage')) vdToggle(); });
    document.addEventListener('keydown', function (ev) {
      if ((ev.key === ' ' || ev.key === 'k') && !m.hidden && topModal() === m && vd.view === 'play' && !(ev.target.closest && ev.target.closest('input, select, textarea, button, [contenteditable]'))) { ev.preventDefault(); vdToggle(); }
    });
    // Captions-only playback stops moving on when you switch away; the voice stops itself.
    document.addEventListener('visibilitychange', function () { if (document.hidden && vd.playing && !vd.paused && !vd.tts) vdPause(); });
    m.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.id === 'vdTopic') { vd.topic = t.value; renderVideo(); }
      else if (t.id === 'vdPVoice') { vd.pvVoice = t.value; vdPref('pvVoice', t.value); if (vd.playing) vdPlay(vd.scene); }
      else if (t.id === 'vdVoice') { vd.voice = t.value; if (vd.playing) vdPlay(vd.scene); }
      else if (t.id === 'vdRate') { vd.rate = +t.value || 0.85; vdPref('rate', vd.rate); if (!vd.tts && vd.pvOn && vd.playing) vdPlay(vd.scene); if (vd.tts && vd.tts.setRate) vd.tts.setRate(vd.rate).then(null, function () {}); }
      else if (t.id === 'vdStyle') { vd.view_style = t.value; vdPref('style', t.value); vdShow(vd.scene); }
    });
    var deb = null;
    m.addEventListener('input', function (ev) {
      if (ev.target.id !== 'vdConcept') return;
      vd.concept = ev.target.value;
      clearTimeout(deb); deb = setTimeout(function () {
        var pool = vdPool(), p = $('#vdPool'), go = $('#vdFoot [data-vd="make"]');
        if (p) p.innerHTML = pool.length ? 'Made from <b>' + plural(pool.length, 'card') + '</b>: ' + esc(pool.slice(0, 8).map(function (e) { return e.name; }).join(', ')) + (pool.length > 8 ? '…' : '') : 'No cards match yet — try other words.';
        if (go) go.disabled = !(claudeCaps.sample && pool.length);
      }, 250);
    });
  }
