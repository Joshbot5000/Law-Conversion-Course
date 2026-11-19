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
  var VD_KINDS = ['title', 'hypo', 'principle', 'steps', 'case', 'roundup', 'compare', 'apply', 'recap'];
  var VD_VOICES = { buttery: 'Warm', airy: 'Light', glassy: 'Clear', rounded: 'Soft' };
  var vd = { view: 'list', mode: 'topic', topic: '', concept: '', length: 'quick', job: null, cur: null, scene: 0, playing: false, paused: false, timer: null, tts: null, ttsTried: false, voice: 'buttery', rate: 1, cc: true, unsub: [] };
  state.videos = [];

  /* ---- storage ---- */
  function sanitizeVideo(v) {
    if (!v || typeof v !== 'object' || typeof v.id !== 'string' || !Array.isArray(v.scenes)) return null;
    var scenes = v.scenes.map(cleanScene).filter(Boolean).slice(0, 24);
    if (!scenes.length) return null;
    return {
      v: 1, id: v.id.replace(/[^A-Za-z0-9_\-]/g, '-').slice(0, 80), title: s_(v.title, 160) || 'Explainer', topic: s_(v.topic, 200), module: MODULE_LABEL[v.module] ? v.module : '',
      length: v.length === 'full' ? 'full' : 'quick', createdAt: v.createdAt && !isNaN(new Date(v.createdAt).getTime()) ? v.createdAt : nowISO(), seed: Math.round(num(v.seed, 7)) || 7,
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
  var VD_ICONS_LIST = 'person, child, people, worker, doctor, police, judge, dog, car, road, ambulance, ship, house, shop, factory, hospital, court, fire, ball, money, contract, letter, phone, computer, book, gavel, scales, clock, calendar, warning, bottle, snail, food, tree, water, stairs, ladder, injury, eye, heart, lightbulb, question, tick, cross, key, lock, crown, chain, chainbreak, handshake';
  function videoPrompt(pool, label, length) {
    var q = length === 'quick';
    return [
      'EXPLAINER VIDEO SCRIPT',
      'You are a friendly, engaging law tutor recording a short whiteboard explainer video for a law conversion (PGDL) student who wants a quick revision refresher on: ' + label + '.',
      'Speak like a warm human tutor talking to one student: ELI5, simple and conversational, short sentences, contractions, the odd rhetorical question ("So what did the court say?"), a bit of humour, and every legal word explained in plain English the moment it appears. UK spelling. Never robotic, never a list read aloud.',
      'ACCURACY RULES:',
      '- Use ONLY the student\'s cards below for the law. Cover EVERY card: every principle and statute, and every case.',
      '- Tell each case as a tiny story: what happened (from the card\'s facts), what the court decided, and the rule it gives. Never invent a case, citation, date, fact or rule. If a card has no facts, just give its rule.',
      '- The everyday example must be clearly made up ("Imagine…") and must never be presented as a real case.',
      'STRUCTURE: a "title" scene; a "hypo" scene introducing one everyday made-up example with named characters; then the law in order ("principle" or "steps" scenes, and a "case" scene for each important case; put less important cases 2-4 at a time in a "roundup" scene; use "compare" to distinguish two cases); then an "apply" scene going back to the example and applying the law to it; then a "recap" scene.',
      q ? 'LENGTH: quick refresher, 6-10 scenes, about 2-3 minutes in total. Each narration 35-80 words.' : 'LENGTH: full explainer, 10-16 scenes, about 4-6 minutes in total. Each narration 50-110 words.',
      'Narration is read aloud by a voice: write it exactly as spoken. No brackets, no citations or report references, no bullet points, no headings. Say a case name naturally ("In Donoghue versus Stevenson…"); say a year only if it helps.',
      'VISUALS: each scene has a "visual" the app draws by hand on a whiteboard. Keep on-screen words SHORT (labels 1-6 words, rule up to 14 words). Shapes by kind:',
      ' title: {"kind":"title","title":"","subtitle":"","icons":["up to 3"]}',
      ' hypo: {"kind":"hypo","characters":[{"name":"","icon":""}],"props":["up to 3 icons"],"bubble":"what a character says, up to 12 words","label":"Imagine..."}',
      ' principle: {"kind":"principle","icon":"","rule":"","points":["2-4 short points"]}',
      ' steps: {"kind":"steps","steps":[{"label":"","icon":""}]}  (2-5 steps of a test, in order)',
      ' case: {"kind":"case","name":"case name exactly as on the card","year":"","panels":[{"icon":"","label":"what happened"},{"icon":"","label":"what was decided"},{"icon":"","label":"the rule"}]}',
      ' roundup: {"kind":"roundup","cases":[{"name":"","label":"the rule in a few words","icon":""}]}',
      ' compare: {"kind":"compare","left":{"title":"","icon":"","points":[""]},"right":{"title":"","icon":"","points":[""]}}',
      ' apply: {"kind":"apply","characters":[{"name":"","icon":""}],"verdict":"short answer","good":true}',
      ' recap: {"kind":"recap","points":["3-6 short takeaways"]}',
      'ICONS (use only these names): ' + VD_ICONS_LIST + '.',
      'Reply with ONLY JSON: {"title": "", "scenes": [{"kind": "", "heading": "short heading shown on screen", "narration": "", "cards": ["ids of the cards this scene covers"], "visual": {}}]}',
      '', 'CARDS (id | type | name | citation | facts | rule | exam use):',
      pool.map(function (e) { return '[' + e.id + '] ' + e.type + ' | ' + e.name + ' | ' + (e.citation || '') + ' | ' + vdClip(e.facts, 500) + ' | ' + vdClip(e.ratio, 600) + ' | ' + vdClip(e.strategy, 200); }).join('\n')
    ].join('\n');
  }
  function vdClip(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
  function vdIcon(n, fallback) { n = String(n || '').toLowerCase().trim(); return VD_ICONS[n] ? n : (fallback || 'question'); }
  function vdCh(list, n) { return (Array.isArray(list) ? list : []).map(function (c) { return c && typeof c === 'object' ? { name: s_(c.name, 30), icon: vdIcon(c.icon, 'person') } : null; }).filter(Boolean).slice(0, n); }
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
    else if (kind === 'recap') { V.points = pts(v.points, 6); if (!V.points.length) V.points = [o.heading || 'Recap']; }
    return o;
  }
  // Is a card mentioned in the script? By its id on a scene, or its name in the words or drawings.
  function vdNameKey(name) { var n = String(name || '').replace(/\s*[\[(].*$/, ''), m = /^(?:R \(([^)]+)\) v |R v )?(.+?)(?: v (\S+))?$/.exec(n); return normText(m && m[3] ? m[2] + ' v ' + m[3] : n).trim(); }
  function vdSceneText(sc) { return ' ' + normText(sc.heading + ' ' + sc.narration + ' ' + JSON.stringify(sc.visual).replace(/"[a-z]+":/g, ' ')) + ' '; }
  function vdCovered(card, scenes) {
    var k = vdNameKey(card.name), first = normText(card.name.split(/ v | — | - /)[0]).trim();
    return scenes.some(function (sc) { if (sc.cards.indexOf(card.id) !== -1) return true; var t = vdSceneText(sc); return (k.length >= 5 && t.indexOf(' ' + k + ' ') !== -1) || (card.type === 'case' && first.length >= 5 && t.indexOf(' ' + first + ' ') !== -1); });
  }
  function vdFirstSentence(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); var m = /^(.{20,}?[.!?])(\s|$)/.exec(t); return vdClip(m ? m[1] : t, n || 240); }
  // Fill any gaps from the cards themselves (no extra request), and flag cases that aren't in the cards.
  function vdCoverage(scenes, pool) {
    var missing = pool.filter(function (e) { return !vdCovered(e, scenes); });
    var cases = missing.filter(function (e) { return e.type === 'case'; }), rules = missing.filter(function (e) { return e.type !== 'case'; });
    var extra = [];
    rules.forEach(function (e) {
      extra.push(cleanScene({ kind: 'principle', auto: true, heading: vdClip(e.name, 70), cards: [e.id],
        narration: 'One more rule to keep in your back pocket: ' + e.name + '. ' + vdFirstSentence(e.ratio || e.facts, 400),
        visual: { kind: 'principle', icon: e.type === 'statute' ? 'book' : 'scales', rule: vdClip(vdFirstSentence(e.ratio || e.facts, 140), 140), points: [] } }));
    });
    for (var i = 0; i < cases.length; i += 3) {
      var grp = cases.slice(i, i + 3);
      extra.push(cleanScene({ kind: 'roundup', auto: true, heading: grp.length > 1 ? 'More cases to know' : 'One more case', cards: grp.map(function (e) { return e.id; }),
        narration: (grp.length > 1 ? 'A few more cases to know. ' : 'One more case to know. ') + grp.map(function (e) { return 'In ' + e.name.replace(/ v /g, ' versus ') + ', ' + (e.facts ? vdFirstSentence(e.facts, 220).replace(/^[A-Z]/, function (c) { return c.toLowerCase(); }) + ' ' : '') + 'The rule: ' + vdFirstSentence(e.ratio, 240); }).join(' '),
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
      var c = vdCoverage(scenes, pool);
      var v = sanitizeVideo({ id: uid('vd'), title: s_(r.title, 160) || label, topic: label, module: t ? t.module : (pool[0] && pool[0].module) || '', length: vd.length, createdAt: nowISO(),
        seed: Math.floor(Math.random() * 1e6) + 1, cardIds: pool.map(function (e) { return e.id; }), coverage: c.cov, scenes: c.scenes });
      return saveVideo(v).then(function () { vd.job = null; vd.cur = v; vd.scene = 0; vd.view = 'play'; renderVideo(); renderVideoCount(); toast('Video ready: “' + v.title + '”.', { type: 'success' }); });
    }).then(null, function (err) {
      if (err && err.code === 'cancelled') return;
      if (err && (err.code === 'not_granted' || err.code === 'sampling_disabled')) claudeCaps.sample = null;
      job.error = sampleErrorText(err); renderVideo();
    });
  }

  /* ---- hand-drawn drawing ---- */
  // Seeded random numbers, so a video looks the same every time it plays.
  function vdRng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  // Icons in a 100×100 box: c circle, e ellipse, r rectangle, l line through points, p closed shape.
  var VD_ICONS = {
    person: [['c', 50, 22, 12], ['l', 50, 34, 50, 66], ['l', 30, 50, 50, 42, 70, 50], ['l', 50, 66, 36, 92], ['l', 50, 66, 64, 92]],
    child: [['c', 50, 38, 10], ['l', 50, 48, 50, 70], ['l', 36, 58, 50, 54, 64, 58], ['l', 50, 70, 40, 90], ['l', 50, 70, 60, 90]],
    people: [['c', 32, 26, 10], ['l', 32, 36, 32, 62], ['l', 18, 48, 46, 48], ['l', 32, 62, 22, 88], ['l', 32, 62, 42, 88], ['c', 68, 26, 10], ['l', 68, 36, 68, 62], ['l', 54, 48, 82, 48], ['l', 68, 62, 58, 88], ['l', 68, 62, 78, 88]],
    worker: [['c', 50, 28, 11], ['p', 36, 24, 40, 12, 60, 12, 64, 24], ['l', 30, 25, 70, 25], ['l', 50, 39, 50, 66], ['l', 30, 52, 50, 44, 70, 52], ['l', 50, 66, 36, 92], ['l', 50, 66, 64, 92]],
    doctor: [['c', 50, 22, 12], ['l', 50, 34, 50, 66], ['l', 30, 50, 50, 42, 70, 50], ['l', 50, 66, 36, 92], ['l', 50, 66, 64, 92], ['l', 57, 52, 67, 52], ['l', 62, 47, 62, 57]],
    police: [['c', 50, 27, 11], ['p', 36, 18, 50, 8, 64, 18, 62, 21, 38, 21], ['l', 50, 38, 50, 66], ['l', 30, 52, 50, 44, 70, 52], ['l', 50, 66, 36, 92], ['l', 50, 66, 64, 92]],
    judge: [['c', 50, 24, 11], ['l', 38, 20, 34, 40], ['l', 62, 20, 66, 40], ['p', 32, 44, 68, 44, 74, 92, 26, 92], ['l', 50, 44, 50, 92]],
    dog: [['e', 46, 56, 24, 13], ['c', 74, 42, 10], ['l', 30, 66, 28, 84], ['l', 40, 68, 40, 84], ['l', 54, 68, 54, 84], ['l', 64, 66, 66, 84], ['l', 22, 52, 12, 42], ['l', 78, 34, 84, 26]],
    car: [['r', 12, 46, 76, 24], ['p', 26, 46, 36, 30, 64, 30, 74, 46], ['c', 30, 72, 8], ['c', 70, 72, 8]],
    road: [['l', 30, 92, 44, 8], ['l', 70, 92, 56, 8], ['l', 50, 86, 50, 74], ['l', 50, 58, 50, 46], ['l', 50, 32, 50, 22]],
    ambulance: [['r', 8, 40, 60, 30], ['p', 68, 48, 84, 48, 92, 60, 92, 70, 68, 70], ['c', 26, 74, 7], ['c', 76, 74, 7], ['l', 38, 48, 38, 62], ['l', 31, 55, 45, 55]],
    ship: [['p', 12, 60, 88, 60, 76, 80, 24, 80], ['l', 50, 60, 50, 16], ['p', 53, 20, 78, 52, 53, 52]],
    house: [['p', 18, 48, 50, 18, 82, 48], ['r', 26, 48, 48, 40], ['r', 44, 66, 12, 22]],
    shop: [['r', 16, 40, 68, 48], ['p', 12, 40, 22, 20, 78, 20, 88, 40], ['r', 42, 62, 16, 26], ['l', 22, 40, 22, 30]],
    factory: [['p', 10, 88, 10, 52, 30, 62, 30, 52, 50, 62, 50, 52, 70, 62, 70, 26, 84, 26, 84, 88], ['l', 74, 18, 78, 10]],
    hospital: [['r', 20, 22, 60, 66], ['l', 50, 34, 50, 60], ['l', 38, 47, 62, 47], ['r', 42, 70, 16, 18]],
    court: [['p', 14, 34, 50, 12, 86, 34], ['r', 18, 34, 64, 6], ['l', 26, 42, 26, 78], ['l', 42, 42, 42, 78], ['l', 58, 42, 58, 78], ['l', 74, 42, 74, 78], ['r', 14, 80, 72, 8]],
    fire: [['p', 50, 10, 70, 42, 68, 70, 50, 88, 32, 70, 30, 42, 42, 54], ['l', 50, 50, 57, 66, 50, 78, 43, 66, 50, 50]],
    ball: [['c', 50, 50, 24], ['l', 30, 38, 50, 48, 70, 38], ['l', 30, 62, 50, 52, 70, 62]],
    money: [['r', 12, 30, 76, 40], ['c', 50, 50, 11], ['l', 20, 38, 28, 38], ['l', 72, 62, 80, 62]],
    contract: [['r', 24, 10, 52, 76], ['l', 32, 24, 68, 24], ['l', 32, 34, 68, 34], ['l', 32, 44, 62, 44], ['l', 32, 70, 40, 62, 48, 70, 56, 62, 64, 68]],
    letter: [['r', 12, 26, 76, 48], ['l', 12, 26, 50, 56, 88, 26]],
    phone: [['r', 34, 12, 32, 76], ['l', 46, 78, 54, 78], ['l', 44, 18, 56, 18]],
    computer: [['r', 14, 18, 72, 46], ['l', 42, 64, 38, 80], ['l', 58, 64, 62, 80], ['l', 26, 82, 74, 82]],
    book: [['p', 50, 24, 16, 16, 16, 80, 50, 88, 84, 80, 84, 16], ['l', 50, 24, 50, 88]],
    gavel: [['p', 22, 30, 46, 14, 58, 32, 34, 48], ['l', 46, 40, 76, 74], ['r', 14, 82, 44, 8]],
    scales: [['l', 50, 14, 50, 84], ['l', 20, 26, 80, 26], ['l', 32, 86, 68, 86], ['l', 20, 26, 10, 54], ['l', 20, 26, 30, 54], ['e', 20, 56, 12, 4], ['l', 80, 26, 70, 54], ['l', 80, 26, 90, 54], ['e', 80, 56, 12, 4]],
    clock: [['c', 50, 50, 34], ['l', 50, 50, 50, 26], ['l', 50, 50, 66, 58]],
    calendar: [['r', 16, 22, 68, 62], ['l', 16, 38, 84, 38], ['l', 34, 14, 34, 28], ['l', 66, 14, 66, 28], ['l', 30, 52, 40, 52], ['l', 48, 52, 58, 52], ['l', 30, 66, 40, 66]],
    warning: [['p', 50, 12, 90, 84, 10, 84], ['l', 50, 36, 50, 62], ['c', 50, 73, 2]],
    bottle: [['p', 42, 10, 58, 10, 58, 28, 68, 42, 68, 90, 32, 90, 32, 42, 42, 28], ['r', 36, 54, 28, 18]],
    snail: [['l', 12, 80, 86, 80], ['p', 20, 80, 26, 66, 70, 66, 82, 80], ['c', 52, 52, 18], ['c', 52, 52, 8], ['l', 26, 68, 16, 48], ['l', 30, 68, 26, 46]],
    food: [['e', 50, 70, 38, 10], ['p', 20, 66, 26, 42, 50, 30, 74, 42, 80, 66], ['l', 50, 30, 50, 22]],
    tree: [['c', 50, 34, 24], ['l', 44, 56, 44, 90], ['l', 56, 56, 56, 90]],
    water: [['l', 8, 40, 20, 34, 32, 40, 44, 34, 56, 40, 68, 34, 80, 40, 92, 34], ['l', 8, 58, 20, 52, 32, 58, 44, 52, 56, 58, 68, 52, 80, 58, 92, 52], ['l', 8, 76, 20, 70, 32, 76, 44, 70, 56, 76, 68, 70, 80, 76, 92, 70]],
    stairs: [['l', 10, 90, 10, 72, 30, 72, 30, 54, 50, 54, 50, 36, 70, 36, 70, 18, 90, 18]],
    ladder: [['l', 34, 8, 30, 92], ['l', 66, 8, 70, 92], ['l', 33, 24, 67, 24], ['l', 32, 44, 68, 44], ['l', 31, 64, 69, 64], ['l', 31, 82, 69, 82]],
    injury: [['r', 14, 38, 72, 24], ['l', 40, 38, 40, 62], ['l', 60, 38, 60, 62], ['c', 50, 46, 1.5], ['c', 50, 54, 1.5]],
    eye: [['e', 50, 50, 38, 18], ['c', 50, 50, 10], ['c', 50, 50, 3]],
    heart: [['p', 50, 86, 16, 52, 18, 30, 34, 20, 50, 32, 66, 20, 82, 30, 84, 52]],
    lightbulb: [['c', 50, 38, 22], ['r', 41, 60, 18, 16], ['l', 44, 84, 56, 84], ['l', 44, 38, 50, 46, 56, 38]],
    question: [['l', 34, 34, 38, 20, 52, 14, 64, 20, 66, 34, 52, 46, 50, 62], ['c', 50, 78, 3]],
    tick: [['l', 18, 54, 42, 78, 84, 24]],
    cross: [['l', 24, 24, 76, 76], ['l', 76, 24, 24, 76]],
    key: [['c', 28, 50, 14], ['l', 42, 50, 88, 50], ['l', 74, 50, 74, 64], ['l', 84, 50, 84, 60]],
    lock: [['r', 26, 46, 48, 40], ['l', 36, 46, 36, 30, 44, 20, 56, 20, 64, 30, 64, 46], ['c', 50, 64, 4]],
    crown: [['p', 16, 74, 16, 30, 34, 50, 50, 22, 66, 50, 84, 30, 84, 74], ['l', 16, 84, 84, 84]],
    chain: [['e', 26, 50, 16, 9], ['e', 50, 50, 16, 9], ['e', 74, 50, 16, 9]],
    chainbreak: [['e', 22, 50, 16, 9], ['e', 78, 50, 16, 9], ['l', 44, 38, 50, 50, 46, 62], ['l', 56, 38, 50, 50, 54, 62]],
    handshake: [['l', 6, 46, 26, 46, 40, 38, 56, 44, 66, 40, 94, 40], ['l', 6, 66, 30, 66, 44, 74, 60, 70, 70, 62, 94, 62], ['l', 40, 52, 54, 60], ['l', 48, 48, 62, 56]]
  };
  var VD_INK = '#23314f', VD_PEN = ['#d2453a', '#2f6fb3', '#2a8a52', '#d98a1c', '#7b4bb3'];
  function Sketch(seed) {
    var R = vdRng(seed), parts = [], idx = 0;
    var j = function (a) { return (R() - 0.5) * 2 * a; };
    var seg = function (x1, y1, x2, y2) {
      var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1, bow = j(Math.min(6, len * 0.03));
      var mx = (x1 + x2) / 2 - dy / len * bow + j(1), my = (y1 + y2) / 2 + dx / len * bow + j(1);
      return 'M' + (x1 + j(1.2)).toFixed(1) + ' ' + (y1 + j(1.2)).toFixed(1) + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + (x2 + j(1.2)).toFixed(1) + ' ' + (y2 + j(1.2)).toFixed(1);
    };
    var ell = function (cx, cy, rx, ry) {
      var a0 = R() * Math.PI * 2, n = 44, d = '', over = 0.2 + R() * 0.3, wob = [j(0.05), j(0.05)];
      // One smooth, slightly lopsided loop that overshoots its start, like a pen circle.
      for (var i = 0; i <= n; i++) { var a = a0 + (Math.PI * 2 + over) * i / n, k = 1 + wob[0] * Math.sin(a * 2 + wob[1] * 9) + j(0.008); d += (i ? ' L' : 'M') + (cx + Math.cos(a) * rx * k).toFixed(1) + ' ' + (cy + Math.sin(a) * ry * k).toFixed(1); }
      return d;
    };
    var api = {
      R: R,
      // Add a stroke; `at` is its place in the drawing order, `w` its width.
      path: function (d, o) { o = o || {}; parts.push('<path class="vd-ink" pathLength="1" d="' + d + '" stroke="' + (o.color || VD_INK) + '" stroke-width="' + (o.w || 3.2) + '" fill="' + (o.fill || 'none') + '" style="--d:' + (o.at || 0) + '"/>'); },
      line: function (x1, y1, x2, y2, o) { api.path(seg(x1, y1, x2, y2), o); if (!o || !o.once) api.path(seg(x1, y1, x2, y2), Object.assign({}, o, { w: ((o && o.w) || 3.2) * 0.55 })); },
      poly: function (pts, closed, o) { var d = '', n = pts.length / 2; for (var i = 0; i < n - 1 + (closed ? 1 : 0); i++) { var a = i * 2, b = ((i + 1) % n) * 2; d += seg(pts[a], pts[a + 1], pts[b], pts[b + 1]) + ' '; } api.path(d, o); },
      rect: function (x, y, w, h, o) { api.poly([x, y, x + w, y, x + w, y + h, x, y + h], true, o); if (!o || !o.once) api.poly([x, y, x + w, y, x + w, y + h, x, y + h], true, Object.assign({}, o, { w: ((o && o.w) || 3.2) * 0.5 })); },
      ellipse: function (cx, cy, rx, ry, o) { api.path(ell(cx, cy, rx, ry), o); },
      // A highlighter swipe behind text.
      mark: function (x, y, w, h, color, at) { var d = 'M' + x + ' ' + (y + j(2)) + ' L' + (x + w) + ' ' + (y + j(3)) + ' L' + (x + w + j(3)) + ' ' + (y + h) + ' L' + (x + j(3)) + ' ' + (y + h + j(2)) + 'Z'; parts.push('<path class="vd-mark" d="' + d + '" fill="' + color + '" style="--d:' + (at || 0) + '"/>'); },
      icon: function (name, x, y, size, o) {
        var ops = VD_ICONS[name] || VD_ICONS.question, s = size / 100, X = function (v) { return x + v * s; }, Y = function (v) { return y + v * s; };
        o = Object.assign({ w: Math.max(2.4, size / 34) }, o, { once: true });
        ops.forEach(function (op) {
          if (op[0] === 'c') api.ellipse(X(op[1]), Y(op[2]), op[3] * s, op[3] * s, o);
          else if (op[0] === 'e') api.ellipse(X(op[1]), Y(op[2]), op[3] * s, op[4] * s, o);
          else if (op[0] === 'r') api.poly([X(op[1]), Y(op[2]), X(op[1] + op[3]), Y(op[2]), X(op[1] + op[3]), Y(op[2] + op[4]), X(op[1]), Y(op[2] + op[4])], true, o);
          else { var pts = []; for (var i = 1; i < op.length; i += 2) pts.push(X(op[i]), Y(op[i + 1])); api.poly(pts, op[0] === 'p', o); }
        });
      },
      // Handwritten text, wrapped to a width given in characters.
      text: function (str, x, y, o) {
        o = o || {};
        var size = o.size || 40, lines = vdWrap(str, o.chars || 30), lh = size * (o.lh || 1.12), anchor = o.anchor || 'start';
        if (o.mid) y -= (lines.length - 1) * lh / 2;
        parts.push('<text class="vd-text' + (o.title ? ' vd-title' : '') + '" x="' + x + '" y="' + y + '" font-size="' + size + '" fill="' + (o.color || VD_INK) + '" text-anchor="' + anchor + '" style="--d:' + (o.at || 0) + '"' + (o.rot ? ' transform="rotate(' + o.rot + ' ' + x + ' ' + y + ')"' : '') + '>' +
          lines.map(function (l, i) { return '<tspan x="' + x + '" dy="' + (i ? lh : 0) + '">' + esc(l) + '</tspan>'; }).join('') + '</text>');
        return lines.length * lh;
      },
      next: function () { return idx++; },
      svg: function () { return parts.join(''); }
    };
    return api;
  }
  function vdWrap(str, n) {
    var words = String(str || '').split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) { if ((cur + ' ' + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) lines.push(cur);
    return lines.slice(0, 6);
  }
  function vdArrow(S, x1, y1, x2, y2, o) {
    S.line(x1, y1, x2, y2, o);
    var a = Math.atan2(y2 - y1, x2 - x1), L = 16;
    S.line(x2, y2, x2 - L * Math.cos(a - 0.45), y2 - L * Math.sin(a - 0.45), Object.assign({}, o, { once: true }));
    S.line(x2, y2, x2 - L * Math.cos(a + 0.45), y2 - L * Math.sin(a + 0.45), Object.assign({}, o, { once: true }));
  }
  // Draw one scene as an SVG whiteboard (1280×720). Every stroke and word gets a place in the drawing order.
  function vdSceneSVG(v, sc, n) {
    var S = Sketch((v.seed || 7) * 31 + n * 7), V = sc.visual, k = 0, pen = VD_PEN[n % VD_PEN.length];
    var at = function () { return k++; };
    if (sc.kind !== 'title') {
      S.text(sc.heading, 70, 92, { size: 58, chars: 40, title: true, at: at() });
      S.line(66, 112, 66 + Math.min(1100, Math.max(220, sc.heading.length * 25)), 116, { color: pen, w: 5, at: at() });
    }
    var K = sc.kind;
    if (K === 'title') {
      var h = S.text(V.title, 640, 290, { size: 96, chars: 22, anchor: 'middle', title: true, mid: true, at: at() });
      S.line(380, 300 + h / 2, 900, 306 + h / 2, { color: pen, w: 6, at: at() });
      if (V.subtitle) S.text(V.subtitle, 640, 370 + h / 2, { size: 40, chars: 46, anchor: 'middle', color: '#55607a', at: at() });
      var ic = V.icons.length ? V.icons : ['scales'];
      ic.forEach(function (name, i) { S.icon(name, 640 - ic.length * 85 + i * 170 + 15, 500, 140, { color: VD_PEN[(n + i) % VD_PEN.length], at: at() }); });
      [[120, 120], [1150, 160], [140, 600], [1130, 590]].forEach(function (p) { S.line(p[0] - 12, p[1], p[0] + 12, p[1], { color: pen, once: true, at: at() }); S.line(p[0], p[1] - 12, p[0], p[1] + 12, { color: pen, once: true, at: k - 1 }); });
    } else if (K === 'hypo' || K === 'apply') {
      var ch = V.characters, w = ch.length > 2 ? 190 : 230;
      ch.forEach(function (c, i) {
        var x = 90 + i * (w + 30);
        S.icon(c.icon, x, 300, w, { color: VD_INK, at: at() });
        if (c.name) S.text(c.name, x + w / 2, 300 + w + 52, { size: 42, anchor: 'middle', color: VD_PEN[(n + i) % VD_PEN.length], at: at() });
      });
      var bx = Math.max(560, 90 + ch.length * (w + 30)), bw = 1200 - bx;
      if (K === 'hypo') {
        if (V.bubble) { S.ellipse(bx + bw / 2, 250, bw / 2, 92, { at: at() }); S.line(bx + bw * 0.22, 318, bx + bw * 0.12 - 40, 372, { once: true, at: k - 1 }); S.line(bx + bw * 0.34, 330, bx + bw * 0.12 - 40, 372, { once: true, at: k - 1 }); S.text('“' + V.bubble + '”', bx + bw / 2, 250, { size: 36, chars: Math.round(bw / 19), anchor: 'middle', mid: true, at: at() }); }
        V.props.forEach(function (p, i) { S.icon(p, bx + 20 + i * 180, 420, 150, { color: VD_PEN[(n + i + 1) % VD_PEN.length], at: at() }); });
        if (V.label) { S.mark(70, 628, Math.min(1100, V.label.length * 22 + 40), 54, '#fde68a', at()); S.text(V.label, 90, 668, { size: 40, chars: 60, at: k - 1 }); }
      } else {
        var good = V.good !== false, col = good ? '#2a8a52' : '#d2453a';
        S.ellipse(bx + bw / 2, 330, Math.min(250, bw / 2 - 10), 170, { color: col, w: 6, at: at() });
        S.text(V.verdict || (good ? 'Yes' : 'No'), bx + bw / 2, 320, { size: 50, chars: 16, anchor: 'middle', mid: true, color: col, rot: -6, title: true, at: at() });
        S.icon(good ? 'tick' : 'cross', bx + bw / 2 - 50, 520, 100, { color: col, w: 7, at: at() });
      }
    } else if (K === 'principle') {
      S.icon(V.icon, 70, 170, 170, { color: pen, at: at() });
      S.rect(270, 160, 940, 210, { at: at() });
      S.text(V.rule, 300, 265, { size: 46, chars: 40, mid: true, at: at() });
      var pts = V.points, pw = pts.length ? Math.min(330, (1140 - (pts.length - 1) * 30) / pts.length) : 0;
      pts.forEach(function (p, i) {
        var x = 70 + i * (pw + 30) + (1140 - pts.length * pw - (pts.length - 1) * 30) / 2;
        vdArrow(S, 740, 380, x + pw / 2, 450, { color: '#8a93a8', w: 2.6, at: at() });
        S.rect(x, 462, pw, 170, { color: VD_PEN[(n + i + 1) % VD_PEN.length], at: at() });
        S.text(p, x + pw / 2, 547, { size: 34, chars: Math.max(10, Math.round(pw / 17)), anchor: 'middle', mid: true, at: at() });
      });
    } else if (K === 'steps') {
      var st = V.steps, sw = (1140 - (st.length - 1) * 50) / st.length;
      st.forEach(function (s, i) {
        var x = 70 + i * (sw + 50), col = VD_PEN[(n + i) % VD_PEN.length];
        S.text(String(i + 1), x + 26, 230, { size: 56, color: col, title: true, at: at() });
        S.icon(s.icon, x + sw / 2 - 60, 200, 120, { color: col, at: k - 1 });
        S.rect(x, 340, sw, 230, { color: col, at: at() });
        S.text(s.label, x + sw / 2, 455, { size: 36, chars: Math.max(9, Math.round(sw / 18)), anchor: 'middle', mid: true, at: at() });
        if (i < st.length - 1) vdArrow(S, x + sw + 6, 455, x + sw + 44, 455, { color: VD_INK, w: 3, at: at() });
      });
    } else if (K === 'case') {
      var nm = V.name + (V.year ? ' (' + V.year + ')' : '');
      S.mark(64, 140, Math.min(1150, nm.length * 24 + 40), 62, '#fde68a', at());
      S.text(nm, 84, 186, { size: 46, chars: 48, title: true, at: k - 1 });
      var heads = ['What happened', 'Decided', 'The rule'], pn = V.panels.length || 1, pw2 = (1140 - (pn - 1) * 50) / pn;
      V.panels.forEach(function (p, i) {
        var x = 70 + i * (pw2 + 50), col = VD_PEN[(n + i) % VD_PEN.length];
        S.rect(x, 230, pw2, 420, { at: at() });
        S.text(heads[i] || '', x + 20, 278, { size: 30, color: col, at: at() });
        S.icon(p.icon, x + pw2 / 2 - 75, 300, 150, { color: col, at: at() });
        S.text(p.label, x + pw2 / 2, 545, { size: 34, chars: Math.max(12, Math.round(pw2 / 18)), anchor: 'middle', mid: true, at: at() });
        if (i < pn - 1) vdArrow(S, x + pw2 + 6, 440, x + pw2 + 44, 440, { w: 3, at: at() });
      });
    } else if (K === 'roundup') {
      var cs = V.cases, two = cs.length > 2;
      cs.forEach(function (c, i) {
        var col = VD_PEN[(n + i) % VD_PEN.length], x = two ? 70 + (i % 2) * 580 : 70, y = two ? 160 + Math.floor(i / 2) * 260 : 160 + i * 250, w2 = two ? 560 : 1140;
        S.rect(x, y, w2, 230, { color: col, at: at() });
        S.icon(c.icon, x + 20, y + 45, 130, { color: col, at: at() });
        S.text(c.name, x + 170, y + 70, { size: 34, chars: two ? 20 : 48, title: true, at: at() });
        S.text(c.label, x + 170, y + 150, { size: 30, chars: two ? 22 : 52, color: '#3d4a66', at: at() });
      });
    } else if (K === 'compare') {
      [V.left, V.right].forEach(function (s, i) {
        var x = i ? 690 : 70, col = VD_PEN[(n + i * 2) % VD_PEN.length];
        S.rect(x, 150, 520, 500, { color: col, at: at() });
        S.icon(s.icon, x + 20, 170, 110, { color: col, at: at() });
        S.text(s.title, x + 150, 230, { size: 40, chars: 16, title: true, color: col, mid: true, at: at() });
        s.points.forEach(function (p, j2) { S.text('• ' + p, x + 30, 350 + j2 * 75, { size: 32, chars: 28, at: at() }); });
      });
      S.ellipse(640, 400, 44, 38, { color: '#d2453a', at: at() }); S.text('vs', 640, 412, { size: 40, anchor: 'middle', color: '#d2453a', title: true, at: k - 1 });
    } else if (K === 'recap') {
      var rp = V.points, cols = rp.length > 3 ? 2 : 1;
      rp.forEach(function (p, i) {
        var x = 80 + (cols === 2 ? (i % 2) * 580 : 0), y = 190 + Math.floor(cols === 2 ? i / 2 : i) * 150;
        S.rect(x, y, 56, 56, { at: at() });
        S.icon('tick', x - 4, y - 14, 76, { color: '#2a8a52', w: 6, at: at() });
        S.text(p, x + 80, y + 40, { size: 36, chars: cols === 2 ? 26 : 52, at: at() });
      });
    }
    return { svg: S.svg(), steps: k };
  }

  /* ---- the voice ---- */
  function vdLoadTts() {
    if (vd.ttsTried) return Promise.resolve(vd.tts);
    vd.ttsTried = true;
    if (!window.claude || typeof window.claude.use !== 'function') return Promise.resolve(null);
    return window.claude.use('tts').then(function (t) {
      vd.tts = t || null;
      if (t) {
        vd.unsub.push(t.onLine(function (e) { if (vd.playing && e.id && /^s\d+$/.test(e.id)) vdShow(+e.id.slice(1)); }));
        vd.unsub.push(t.onState(function (e) {
          if (e.state === 'idle' && vd.playing) {
            vd.playing = false; vd.paused = false;
            if (e.reason === 'completed') vd.ended = true;
            else if (e.reason === 'not_granted' || e.reason === 'unavailable') { vd.tts = null; toast('Reading aloud is off for this app, so the video plays with captions.'); }
            else if (e.reason === 'rate_limited') toast('The voice needs a short break. Try again in a little while, or watch with captions.', { type: 'error' });
            renderVdControls();
          }
          if (e.state === 'paused' || e.state === 'speaking') renderVdControls();
        }));
        if (t.setRate) t.setRate(vd.rate).then(null, function () {});
      }
      return vd.tts;
    }, function () { vd.tts = null; return null; });
  }
  function fontsOnce() {
    if (document.getElementById('vdFonts')) return;
    var l = document.createElement('link'); l.id = 'vdFonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Patrick+Hand&display=swap';
    document.head.appendChild(l);
  }

  /* ---- the player ---- */
  function vdDur(sc) { return Math.max(5, sc.narration.length / 14.5 / vd.rate) / (window.__vdFast || 1); }   // seconds, roughly, at this pace
  function vdShow(i) {
    var v = vd.cur; if (!v || !$('#vdStage')) return;
    i = Math.max(0, Math.min(v.scenes.length - 1, i));
    vd.scene = i;
    var sc = v.scenes[i], d = vdSceneSVG(v, sc, i), dur = vdDur(sc);
    var step = Math.min(1.1, (dur * 0.7) / Math.max(1, d.steps));
    $('#vdStage').innerHTML = '<svg viewBox="0 0 1280 720" class="vd-svg" role="img" aria-label="' + esc(sc.heading || v.title) + '" style="--step:' + step.toFixed(2) + 's">' +
      '<defs><pattern id="vdGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#e6ecf5" stroke-width="1"/></pattern></defs>' +
      '<rect width="1280" height="720" fill="#fffdf7"/><rect width="1280" height="720" fill="url(#vdGrid)" opacity=".7"/>' + d.svg +
      '<text x="1210" y="690" font-size="22" fill="#9aa3b5" text-anchor="end" class="vd-plain">' + (i + 1) + ' / ' + v.scenes.length + '</text></svg>';
    $('#vdCap').innerHTML = (sc.warn.length ? '<p class="vd-warn">⚠ Mentions ' + esc(sc.warn.join(', ')) + ', which isn\'t in your cards — check it.</p>' : '') +
      (sc.auto ? '<p class="vd-auto">Added by the coverage check, straight from your card.</p>' : '') + '<p>' + esc(sc.narration) + '</p>';
    $('#vdCap').hidden = !vd.cc && !sc.warn.length;
    $('#vdStage').classList.toggle('paused', vd.paused);
    renderVdControls();
  }
  function renderVdControls() {
    var c = $('#vdCtl'); if (!c || !vd.cur) return;
    var v = vd.cur, voiced = !!vd.tts;
    c.innerHTML = '<div class="vd-row">' +
      (vd.playing ? '<button type="button" class="btn btn-sm" data-vd="pause">' + (vd.paused ? '▶ Resume' : '❚❚ Pause') + '</button><button type="button" class="btn btn-sm" data-vd="stop">■ Stop</button>'
        : '<button type="button" class="btn btn-sm btn-primary" data-vd="play">▶ ' + (vd.ended ? 'Play again' : vd.scene ? 'Play from here' : 'Play') + '</button>') +
      '<button type="button" class="btn btn-sm btn-ghost" data-vd="prev" aria-label="Previous scene">‹</button><button type="button" class="btn btn-sm btn-ghost" data-vd="next" aria-label="Next scene">›</button>' +
      '<span class="vd-dots">' + v.scenes.map(function (s, i) { return '<button type="button" class="vd-dot' + (i === vd.scene ? ' on' : '') + (s.auto ? ' auto' : '') + '" data-vd="go" data-i="' + i + '" title="' + esc((i + 1) + '. ' + (s.heading || s.kind)) + '"></button>'; }).join('') + '</span>' +
      '<span class="spacer"></span>' +
      (voiced ? '<label class="vd-sel">Voice <select id="vdVoice">' + Object.keys(VD_VOICES).map(function (k) { return '<option value="' + k + '"' + (k === vd.voice ? ' selected' : '') + '>' + VD_VOICES[k] + '</option>'; }).join('') + '</select></label>' : '') +
      '<label class="vd-sel">Speed <select id="vdRate">' + [0.85, 1, 1.15, 1.3].map(function (r) { return '<option value="' + r + '"' + (r === vd.rate ? ' selected' : '') + '>' + r + '×</option>'; }).join('') + '</select></label>' +
      '<button type="button" class="btn btn-sm' + (vd.cc ? ' on' : '') + '" data-vd="cc" aria-pressed="' + vd.cc + '">CC</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-vd="full" title="Full screen">⛶</button></div>' +
      (voiced ? '' : '<p class="vd-novoice">' + (vd.ttsTried ? 'The tutor\'s voice works when this app is open in Chrome or Edge on claude.ai, or in the Claude desktop app. Here the video plays with captions.' : '') + '</p>');
  }
  function vdPlay(from) {
    var v = vd.cur; if (!v) return;
    vd.ended = false;
    stopVdTimer();
    from = Math.max(0, Math.min(v.scenes.length - 1, from || 0));
    vd.playing = true; vd.paused = false;
    vdShow(from);
    if (vd.tts) {
      // One reading: a line per scene, so each scene's drawing starts as its words do.
      var lines = v.scenes.slice(from).map(function (s, i) { return { text: s.narration, id: 's' + (from + i), voice: vd.voice }; });
      vd.tts.speak(lines, { rate: vd.rate, voice: vd.voice }).then(null, function (err) {
        if (!err || err.code === 'stopped') return;
        vd.playing = false;
        if (err.code === 'not_granted' || err.code === 'unavailable') { vd.tts = null; toast('Reading aloud isn\'t available here, so the video plays with captions.'); vdPlay(vd.scene); return; }
        toast(err.code === 'rate_limited' ? 'The voice needs a short break — try again soon, or watch with captions.' : err.code === 'no_gesture' ? 'Press Play again to start the voice.' : 'The voice stopped unexpectedly. Press Play to carry on.', { type: 'error' });
        renderVdControls();
      });
      return;
    }
    // No voice here: captions, timed to roughly how long the words take to say.
    var tick = function () {
      if (!vd.playing || vd.paused) return;
      vd.timer = setTimeout(function () {
        if (!vd.playing || vd.paused) return;
        if (vd.scene >= v.scenes.length - 1) { vd.playing = false; vd.ended = true; renderVdControls(); return; }
        vdShow(vd.scene + 1); tick();
      }, vdDur(v.scenes[vd.scene]) * 1000);
    };
    tick();
  }
  function stopVdTimer() { if (vd.timer) { clearTimeout(vd.timer); vd.timer = null; } }
  function vdStop() { stopVdTimer(); var was = vd.playing; vd.playing = false; vd.paused = false; if (was && vd.tts) vd.tts.stop().then(null, function () {}); if ($('#vdStage')) $('#vdStage').classList.remove('paused'); renderVdControls(); }
  function vdPause() {
    if (!vd.playing) return;
    vd.paused = !vd.paused;
    $('#vdStage').classList.toggle('paused', vd.paused);
    if (vd.tts) (vd.paused ? vd.tts.pause() : vd.tts.resume()).then(null, function () {});
    else if (!vd.paused) { var keep = vd.scene; vd.playing = false; vd.scene = keep; vdPlay(keep); return; }
    else stopVdTimer();
    renderVdControls();
  }

  /* ---- the window ---- */
  function openVideo() { fontsOnce(); vdLoadTts(); if (vd.view !== 'gen' || !vd.job) vd.view = vd.cur && vd.view === 'play' ? 'play' : 'list'; renderVideo(); openModal($('#vdModal')); }
  function renderVideo() {
    var body = $('#vdBody'), foot = $('#vdFoot');
    if (vd.view === 'gen') {
      var j = vd.job || {};
      body.innerHTML = '<div class="vd-gen">' + (j.error ? '<p class="step-note warn">' + esc(j.error) + '</p>' : '<p><span class="spinner"></span> Writing your explainer on <b>' + esc(j.label || '') + '</b> from ' + plural(j.n || 0, 'card') + '…</p><p class="muted">One request to Claude writes the whole script and what to draw. The drawing and the coverage check happen here, for free.</p>') + '</div>';
      foot.innerHTML = j.error ? '<button type="button" class="btn" data-vd="new">Back</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-vd="make">Try again</button>' : '<button type="button" class="btn" data-vd="cancel">Cancel</button>';
      return;
    }
    if (vd.view === 'play' && vd.cur) {
      var v = vd.cur, c = v.coverage;
      body.innerHTML = '<div class="vd-head"><h3>' + esc(v.title) + '</h3><span>' + (v.module ? esc(MODULE_LABEL[v.module]) + ' · ' : '') + plural(v.scenes.length, 'scene') + ' · about ' + Math.max(1, Math.round(v.scenes.reduce(function (n, s) { return n + s.narration.length; }, 0) / 14.5 / 60)) + ' min · ' +
        '<b class="vd-cov">Covers ' + c.covered + (c.added ? ' + ' + c.added : '') + ' of ' + plural(c.cards, 'card') + ' on this topic</b>' + (c.added ? ' (' + c.added + ' added by the coverage check)' : '') + (c.flagged ? ' · <b class="vd-bad">' + c.flagged + ' to check</b>' : '') + '</span></div>' +
        '<div class="vd-stage" id="vdStage"></div><div class="vd-ctl" id="vdCtl"></div><div class="vd-cap" id="vdCap"></div>';
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
        '<div class="form-field"><span class="lbl">Length</span><div class="seg"><button type="button" class="seg-btn' + (vd.length === 'quick' ? ' on' : '') + '" data-vd="len" data-l="quick">Quick refresher (2–3 min)</button><button type="button" class="seg-btn' + (vd.length === 'full' ? ' on' : '') + '" data-vd="len" data-l="full">Full explainer (4–6 min)</button></div></div>' +
        '<p class="vd-pool" id="vdPool">' + (pool.length ? 'Made from <b>' + plural(pool.length, 'card') + '</b>: ' + esc(pool.slice(0, 8).map(function (e) { return e.name; }).join(', ')) + (pool.length > 8 ? '…' : '') + (pool.length > 14 && vd.length === 'quick' ? '<br><span class="warn">That\'s a lot for a quick refresher; a full explainer gives each case more room.</span>' : '') : (vd.mode === 'topic' ? 'Choose a topic to see which cards it uses.' : 'Type a concept to find matching cards.')) + '</p>' +
        '<p class="muted rn-note">Uses one Claude request per video. Saved videos replay for free. Only your own cards are used for the law.</p>' +
        (claudeCaps.sample ? '' : '<p class="step-note warn">Videos are written by Claude, which works when the app is opened in claude.ai.</p>');
      foot.innerHTML = '<button type="button" class="btn" data-vd="list">Back</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-vd="make"' + (claudeCaps.sample && pool.length ? '' : ' disabled') + '>✦ Make video</button>';
      return;
    }
    var list = state.videos.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    body.innerHTML = list.length ? '<div class="rn-list">' + list.map(function (v) {
      return '<div class="rn-item"><div class="rn-item-text"><b>' + esc(v.title) + '</b><span>' + (v.module ? esc(MODULE_LABEL[v.module]) + ' · ' : '') + (v.length === 'full' ? 'Full explainer' : 'Quick refresher') + ' · ' + plural(v.scenes.length, 'scene') + ' · ' +
        new Date(v.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '</span><small>' + esc(v.topic) + '</small></div>' +
        '<div class="rn-item-tools"><button type="button" class="btn btn-sm btn-primary" data-vd="open" data-id="' + esc(v.id) + '">▶ Watch</button><button type="button" class="btn btn-sm btn-ghost" data-vd="delete" data-id="' + esc(v.id) + '">Delete</button></div></div>';
    }).join('') + '</div>' : '<div class="empty" style="padding:30px 16px"><h3>No videos yet</h3><p>Pick a topic and get a friendly, hand-drawn explainer with a tutor\'s voice: the principles, every case as a tiny story, and a made-up example to tie it together.</p></div>';
    foot.innerHTML = '<span class="spacer"></span><button type="button" class="btn" data-close>Close</button><button type="button" class="btn btn-primary" data-vd="new">＋ New video</button>';
  }
  function videoAction(a, el) {
    var id = el && el.getAttribute('data-id');
    if (a === 'new') { vdStop(); vd.view = 'new'; renderVideo(); }
    else if (a === 'list') { vdStop(); vd.view = 'list'; renderVideo(); }
    else if (a === 'mode') { vd.mode = el.getAttribute('data-m'); renderVideo(); }
    else if (a === 'len') { vd.length = el.getAttribute('data-l'); renderVideo(); }
    else if (a === 'make') startVideo();
    else if (a === 'cancel') { if (vd.job) vd.job.ctl.abort(); vd.job = null; vd.view = 'new'; renderVideo(); }
    else if (a === 'open') { var v = state.videos.filter(function (x) { return x.id === id; })[0]; if (!v) return; vd.cur = v; vd.scene = 0; vd.ended = false; vd.view = 'play'; renderVideo(); }
    else if (a === 'play') vdPlay(vd.ended ? 0 : vd.scene);
    else if (a === 'pause') vdPause();
    else if (a === 'stop') vdStop();
    else if (a === 'prev' || a === 'next' || a === 'go') {
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
  function bindVideo() {
    $('#vdBtn').addEventListener('click', function () { openVideo(); });
    var m = $('#vdModal');
    m._onClose = function () { vdStop(); if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); };
    m.addEventListener('click', function (ev) { var b = ev.target.closest('[data-vd]'); if (b) videoAction(b.getAttribute('data-vd'), b); });
    m.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.id === 'vdTopic') { vd.topic = t.value; renderVideo(); }
      else if (t.id === 'vdVoice') { vd.voice = t.value; if (vd.playing) vdPlay(vd.scene); }
      else if (t.id === 'vdRate') { vd.rate = +t.value || 1; if (vd.tts && vd.tts.setRate) vd.tts.setRate(vd.rate).then(null, function () {}); }
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
