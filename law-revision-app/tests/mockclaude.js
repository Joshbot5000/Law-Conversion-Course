// Injected before the page loads: a stand-in for claude.ai's runtime (db, sample, downloads).
(function () {
  var KEY = '__mockdb';
  var store = {};
  // The stand-in database survives reloads through window.name (set synchronously, so it is never stale),
  // with sessionStorage as a fallback. Chromium can lose the last sessionStorage writes on a reload under load.
  var NAME = KEY + ':';
  try { store = JSON.parse(window.name.indexOf(NAME) === 0 ? window.name.slice(NAME.length) : (sessionStorage.getItem(KEY) || '{}')); } catch (e) { store = {}; }
  if (window.__SEED && !Object.keys(store).length) store = window.__SEED;
  var save = function () { try { var s = JSON.stringify(store); window.name = NAME + s; sessionStorage.setItem(KEY, s); } catch (e) { console.log('mockdb persist failed', e); } };
  save();
  window.__mock = { writes: [], calls: [], saved: null, store: store };
  var listeners = [];
  function depth(p) { return p.split('/').length; }
  function collDocs(c) {
    return Object.keys(store).filter(function (p) { return p.indexOf(c + '/') === 0 && depth(p) === depth(c) + 1; }).sort().map(function (p) {
      var d = JSON.parse(JSON.stringify(store[p]));
      return { id: p.split('/').pop(), exists: true, data: function () { return d; }, metadata: { fromCache: false, hasPendingWrites: false } };
    });
  }
  function notify(c) {
    listeners.filter(function (l) { return l.c === c; }).forEach(function (l) {
      setTimeout(function () { var docs = collDocs(c); l.cb({ docs: docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: function () { return []; } }); }, 5);
    });
  }
  function merge(a, b) {
    Object.keys(b).forEach(function (k) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], b[k]);
      else a[k] = b[k];
    });
    return a;
  }
  var delay = function () { return new Promise(function (r) { setTimeout(r, 15); }); };
  function docRef(p) {
    var c = p.split('/').slice(0, -1).join('/');
    return {
      id: p.split('/').pop(), path: p,
      get: function () { var has = p in store; var d = has ? JSON.parse(JSON.stringify(store[p])) : undefined; return delay().then(function () { return { id: p.split('/').pop(), exists: has, data: function () { return d; } }; }); },
      set: function (d) { var s = JSON.stringify(d); window.__mock.writes.push(['set', p, s.length]); if (s.length > 262144) return Promise.reject({ code: 'invalid_argument', message: 'too big' }); store[p] = JSON.parse(s); save(); notify(c); return delay(); },
      update: function (d) { window.__mock.writes.push(['update', p, JSON.stringify(d).length]); if (!(p in store)) return Promise.reject({ code: 'invalid_argument', message: 'missing' }); merge(store[p], JSON.parse(JSON.stringify(d))); save(); notify(c); return delay(); },
      delete: function () { window.__mock.writes.push(['delete', p]); delete store[p]; save(); notify(c); return delay(); }
    };
  }
  var db = {
    doc: docRef,
    collection: function (c) {
      return {
        path: c,
        doc: function (id) { return docRef(c + '/' + id); },
        onSnapshot: function (cb, err) { listeners.push({ c: c, cb: cb }); setTimeout(function () { var docs = collDocs(c); cb({ docs: docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: function () { return []; } }); }, 20); return function () {}; }
      };
    }
  };

  function answerFor(input) {
    var text = typeof input === 'string' ? input : input.map(function (t) { return t.content; }).join('\n\n');
    if (text.indexOf('<material>') !== -1) {
      var mat = text.split('<material>\n')[1].split('</material>')[0];
      var out = [], page = null, m;
      var sentences = mat.split(/(?<=[.])\s+/);
      var seen = {};
      sentences.forEach(function (s) {
        var pm = /\[\[p\.(\d+)\]\]/g, mm; while ((mm = pm.exec(s))) page = +mm[1];
        if (out.length >= 3) return;
        var cm = /([A-Z][A-Za-z']+(?: [A-Z][A-Za-z']+)*) v ([A-Z][A-Za-z']+(?: [A-Z][A-Za-z']+)*)/.exec(s);
        if (cm && !seen[cm[0]] && s.indexOf('[[') === -1 && s.length < 300) {
          seen[cm[0]] = 1;
          out.push({ type: 'case', name: cm[0], citation: '', topic: 'Frustration', facts: 'Facts per the text.', ratio: 'Rule per the text: ' + s.slice(0, 120), strategy: 'Use for frustration.', tags: ['frustration', 'test'], page: page, quote: s.replace(/\s+/g, ' ').trim() });
        }
      });
      out.push({ type: 'principle', name: 'Invented rule for testing', citation: 'Key authorities: Nobody v Nothing', topic: 'Testing', facts: '', ratio: 'A rule the text never states.', strategy: '', tags: ['test'], page: 1, quote: 'This sentence is not in the source at all.' });
      return JSON.stringify(out);
    }
    if (text.indexOf('EXPLAINER VIDEO SCRIPT') !== -1) {
      var cards = [], cre = /^\[([^\]]+)\] (\w+) \| ([^|]+) \|/gm, cx;
      while ((cx = cre.exec(text))) cards.push({ id: cx[1], type: cx[2], name: cx[3].trim() });
      var cs = cards.filter(function (c) { return c.type === 'case'; }), keep = window.__vdAll ? cards : cards.slice(0, -1);   // leave the last card out, to test the coverage check
      var sc = [
        { kind: 'title', heading: 'Promises you can rely on', narration: 'Hi! Let us make this topic simple. Grab a cup of tea.', cards: [], visual: { kind: 'title', title: 'Promises you can rely on', subtitle: 'A quick refresher', icons: ['handshake', 'scales', 'house'] } },
        { kind: 'hypo', heading: 'Meet Sam and Priya', narration: 'Imagine Sam rents a flat from Priya. Priya promises to halve the rent. Can she change her mind later?', cards: [], visual: { kind: 'hypo', characters: [{ name: 'Sam', icon: 'person', mood: 'worried' }, { name: 'Priya', icon: 'worker', mood: 'happy' }], props: ['house', 'money'], bubble: 'I will halve your rent!', label: 'Imagine...' } },
        { kind: 'steps', heading: 'The test', narration: 'There are four things to check, one after another.', cards: keep.filter(function (c) { return c.type !== 'case'; }).map(function (c) { return c.id; }), visual: { kind: 'steps', steps: [{ label: 'A clear promise', icon: 'letter' }, { label: 'Reliance', icon: 'person' }, { label: 'Inequitable to go back', icon: 'scales' }, { label: 'Shield not sword', icon: 'lock' }] } },
        { kind: 'case', heading: 'The famous case', narration: 'In ' + (cs[0] ? cs[0].name : 'a case') + ', the landlord promised lower rent during the war. The court said that promise counted. Also, Invented v Nobody said something else.', cards: cs[0] ? [cs[0].id] : [], visual: { kind: 'case', name: cs[0] ? cs[0].name : 'Case', year: '1947', panels: [{ icon: 'house', label: 'Rent halved in the war' }, { icon: 'gavel', label: 'Promise binding' }, { icon: 'scales', label: 'Promises can be enforced' }] } },
        { kind: 'roundup', heading: 'More cases', narration: 'Two more quick ones.', cards: keep.filter(function (c) { return c.type === 'case'; }).slice(1).map(function (c) { return c.id; }), visual: { kind: 'roundup', cases: keep.filter(function (c) { return c.type === 'case'; }).slice(1, 3).map(function (c) { return { name: c.name, label: 'A short rule', icon: 'gavel' }; }) } },
        { kind: 'compare', heading: 'Shield or sword?', narration: 'Here is the difference between the two ideas.', cards: [], visual: { kind: 'compare', left: { title: 'Shield', icon: 'lock', points: ['Defence only'] }, right: { title: 'Sword', icon: 'cross', points: ['No new claim'] } } },
        { kind: 'principle', heading: 'The big rule', narration: 'So the big rule is simple.', cards: [], visual: { kind: 'principle', icon: 'scales', rule: 'A clear promise relied on can bind', points: ['Clear', 'Relied on', 'Fair'] } },
        { kind: 'quiz', heading: 'Quick check', narration: 'Quick check. Can a promise ever be used to start a claim? Pause and have a think. The answer is no. It is a shield, not a sword.', cards: [], visual: { kind: 'quiz', question: 'Can estoppel start a claim?', answer: 'No: a shield, not a sword' } },
        { kind: 'apply', heading: 'Back to Sam', narration: 'So can Priya go back? Not for the past rent.', cards: [], visual: { kind: 'apply', characters: [{ name: 'Sam', icon: 'person' }], verdict: 'Sam is protected', good: true } },
        { kind: 'recap', heading: 'Recap', narration: 'Let us recap the key points.', cards: [], visual: { kind: 'recap', points: ['Clear promise', 'Reliance', 'Fairness', 'Shield not sword'] } }
      ];
      return JSON.stringify({ title: 'Mock explainer', scenes: sc });
    }
    if (text.indexOf('REVISION POSTERS — ') !== -1) {
      var M = window.__mock; M.ps = (M.ps || 0) + 1;
      var itemsIn = function (t) { var out = [], re = /^(i\d+) \[(\w+)\|(\w+)\] (.+?) — (.*)$/gm, x; while ((x = re.exec(t))) out.push({ id: x[1], type: x[2], pri: x[3], name: x[4], point: x[5].replace(/ \(.*$/, '').replace(/ \{.*$/, '') }); return out; };
      var between = function (a, b) { var i = text.indexOf(a); if (i === -1) return ''; var j = b ? text.indexOf(b, i + a.length) : -1; return text.slice(i + a.length, j === -1 ? undefined : j); };
      if (text.indexOf('REVISION POSTERS — INVENTORY') !== -1) {
        var refs = []; var rr = /=== \[(S\d+:\d+)\] ===/g, mm; while ((mm = rr.exec(text))) refs.push(mm[1]);
        var found = {}; var cr = /([A-Z][A-Za-z&'.]+(?: [A-Z][A-Za-z&'.]+)*) v ([A-Z][A-Za-z&'.]+(?: [A-Z][A-Za-z&'.]+)*)/g, cm;
        while ((cm = cr.exec(text))) found[cm[0]] = true;
        var items = [
          { type: 'test', name: 'But-for test', point: 'Would the harm have happened but for the breach?', topic: 'Causation', page: refs[0], pri: 'must' },
          { type: 'principle', name: 'Neighbour principle', point: 'Take care to avoid harming those closely affected.', topic: 'Duty', page: refs[0], pri: 'must' },
          { type: 'statute', name: 'Compensation Act 2006 s1', point: 'Courts may consider deterring desirable activities.', topic: 'Breach', page: refs[0], pri: 'should' },
          { type: 'exception', name: 'Omissions exception', point: 'A duty arises where D assumed responsibility.', topic: 'Duty', page: refs[0], pri: 'should' },
          { type: 'definition', name: 'Novus actus interveniens', point: 'A new act that breaks the chain of causation.', topic: 'Causation', page: refs[1] || refs[0], pri: 'detail' }
        ].concat(Object.keys(found).slice(0, 6).map(function (n, i) { return { type: 'case', name: n, cite: '', point: 'Decided a point about ' + n + '.', topic: i % 2 ? 'Causation' : 'Duty', page: refs[0], pri: i < 2 ? 'must' : 'should' }; }))
          .concat([{ type: 'case', name: 'Nobody v Nothing', point: 'An invented case.', topic: 'Duty', page: refs[0], pri: 'detail' }])
          .concat(window.__rnOutcomes ? [{ type: 'outcome', name: 'Explain causation', point: '', topic: '', page: refs[0], pri: 'must' }] : []);
        return JSON.stringify({ title: 'Mock poster title', items: items });
      }
      if (text.indexOf('REVISION POSTERS — PLAN') !== -1) {
        var all = itemsIn(text), ids = all.map(function (x) { return x.id; });
        if (window.__psForget) ids = ids.slice(0, -1);
        var h = Math.ceil(ids.length / 2);
        return JSON.stringify({ title: 'Mock poster title', pages: [{ style: 'tiles', title: 'The overview', ids: ids.slice(0, h) }, { style: window.__psStyle2 || 'cases', title: 'The cases', ids: ids.slice(h) }] });
      }
      if (text.indexOf('REVISION POSTERS — PAGE') !== -1) {
        var mine = itemsIn(between('POINTS FOR THIS PAGE:', '\n\nSOURCE PAGES:'));
        var style = (/Layout "(\w+)"/.exec(text) || [])[1];
        var keep = window.__psNoOmit ? mine : mine.slice(0, -1);   // leave the last point out, to test the check
        var pt = function (it) { return it.type === 'case' ? { case: it.name, cite: '', text: it.point, ids: [it.id] } : { lead: it.name, text: it.point, ids: [it.id] }; };
        var c = { title: (/PAGE \d+ of \d+: (.*)/.exec(text) || [])[1], subtitle: 'Use this page to revise.', hub: null, blocks: [], timeline: [], rows: [], strip: [], traps: ['Do not confuse the stages.'], tips: ['Name the case, then apply it.'], also: [] };
        if (style === 'cases') {
          keep.filter(function (it) { return it.type === 'case'; }).forEach(function (it, i) { c.rows.push({ group: 'Causation', name: it.name, cite: '', facts: 'What happened in one line.', held: 'What was held.', use: 'When to use it.', tag: i === 0 ? 'CORE' : '', ids: [it.id] }); c.timeline.push({ year: String(1930 + i * 10), name: it.name.split(' v ')[0], tag: 'a point' }); });
          var rest = keep.filter(function (it) { return it.type !== 'case'; });
          if (rest.length) c.blocks.push({ label: 'RULES', kind: 'step', heading: 'Other rules', points: rest.map(pt), ids: [] });
        } else if (style === 'mindmap') {
          c.hub = { heading: 'Breach', text: 'Reasonable person', points: [] };
          keep.forEach(function (it, i) { c.blocks.push({ label: 'Factor ' + (i + 1), kind: 'step', heading: it.name, points: [pt(it)], ids: [] }); });
        } else if (style === 'flow') {
          keep.forEach(function (it, i) { c.blocks.push({ label: 'Step ' + (i + 1), kind: i === keep.length - 1 ? 'branch' : 'step', heading: it.name, points: [pt(it)], ids: [] }); });
        } else {
          for (var k = 0; k < keep.length; k += 2) c.blocks.push({ label: 'Element ' + (k / 2 + 1), kind: 'step', heading: 'Part ' + (k / 2 + 1), test: 'The test for this part.', points: keep.slice(k, k + 2).map(pt), trap: 'A trap.', ids: [] });
          c.strip.push({ heading: 'Answer structure', text: 'Duty, breach, causation, remoteness.', ids: [] });
        }
        return JSON.stringify(c);
      }
      if (text.indexOf('REVISION POSTERS — CHECK') !== -1) {
        var pts = itemsIn(between('POINTS:', '\n\nPOSTER')), poster = between('POSTER (ids in square brackets show which point each part covers):', '\n\nSOURCE PAGES:');
        var miss = pts.filter(function (it) { return !new RegExp('[\\[,]' + it.id + '[\\],]').test(poster); }).map(function (it) { return it.id; });
        var wrong = [];
        if (window.__psWrong && pts.length && !/Problem:/.test(text)) { M.wrongId = M.wrongId || pts[0].id; if (pts.some(function (p) { return p.id === M.wrongId; })) wrong.push({ id: M.wrongId, issue: 'The poster gives the wrong outcome; the source says the claim failed.' }); }
        return JSON.stringify({ missing: miss, wrong: wrong });
      }
      if (text.indexOf('REVISION POSTERS — FIX') !== -1) {
        M.fixes = (M.fixes || 0) + 1;
        var page = JSON.parse(between('PAGE:\n', '\n\nSOURCE PAGES:'));
        if (window.__psBadFix) return JSON.stringify(page);
        var add = itemsIn(between('MISSING:\n', 'Reply with ONLY JSON'));
        var target = page.blocks && page.blocks.length ? page.blocks[0] : null;
        add.forEach(function (it) {
          var p = it.type === 'case' ? { case: it.name, cite: '', text: it.point, ids: [it.id] } : { lead: it.name, text: it.point, ids: [it.id] };
          if (target) target.points.push(p); else page.rows.push({ group: 'More', name: it.name, cite: '', facts: '-', held: it.point, use: '-', tag: '', ids: [it.id] });
        });
        return JSON.stringify(page);
      }
      if (text.indexOf('REVISION POSTERS — OUTCOMES') !== -1) return JSON.stringify({ outcomes: [{ n: 1, covered: true, where: 'Page 1 · Part 1', note: '' }] });
    }
    if (text.indexOf('quick test answer') !== -1) {
      var pair = text.indexOf('DISTINGUISH') !== -1;
      var r = { verdict: 'partly', right: ['You identified the main rule.'], missed: ['You left out the material facts.'], wrong: [] };
      if (pair) r.model = 'Model answer: the first case turns on its own facts, while the second applies a different rule from the cards.';
      return JSON.stringify(r);
    }
    if (text.indexOf('Rewrite ONLY the options') !== -1) {
      window.__mock.repairs = (window.__mock.repairs || 0) + 1;
      var list = JSON.parse(text.slice(text.indexOf('\n[') + 1));
      return JSON.stringify(list.map(function (q) {
        if (window.__badRepair) return { options: q.options, answer: q.answer };
        var opts = q.options.map(function (o, i) { return i === q.answer ? 'Right answer here' : 'Wrong answer ' + ['one', 'two', 'three', 'four', 'five'][i]; });
        return { options: opts, answer: q.answer };
      }));
    }
    if (text.indexOf('single-best-answer') !== -1) {
      var ids = []; var re = /^\[([^\]\n]+)\]$/gm, x; while ((x = re.exec(text))) ids.push(x[1]);
      var n = /Write (\d+) single/.exec(text); n = n ? +n[1] : 5;
      window.__mock.qn = (window.__mock.qn || 0);
      var qs = [];
      for (var i = 0; i < n; i++) {
        var k = ++window.__mock.qn;
        var opts = ['Right answer here', 'Wrong answer one', 'Wrong answer two', 'Wrong answer three', 'Wrong answer four'];
        // Every third question (when asked) gives itself away by length, to test the checks.
        if (window.__giveaways && k % 3 === 0) opts[0] = 'Right answer here because the rule on the card applies to these exact facts in full detail';
        qs.push({ stem: 'Scenario ' + k + ': Ann and Bob make a deal.', question: 'What is the best advice?', options: opts, answer: 0, explanation: 'Because of the card.', cards: [ids[i % ids.length]] });
      }
      return JSON.stringify(qs);
    }
    if (text.indexOf('exam problem question') !== -1) return JSON.stringify({ title: 'The Test Problem', topic: 'Testing', text: 'Ann agrees to sell Bob a boat. Advise Bob.', issues: ['Issue one [card A]', 'Issue two [card B]'] });
    if (text.indexOf('checking a law student') !== -1) return '- You got the rule right.\n- You missed the facts.\nSuggested rating: Good';
    if (text.indexOf('strict UK law examiner') !== -1) return '**Mark: 62/100 (2:1).**\n- Good issue spotting.\n- Cite more authority.';
    return 'Here is a simple explanation from your notes [C1]. The source says the same thing [S1].\n- A bullet with **bold** [C2, S2].';
  }
  function sample(input, opts) {
    opts = opts || {};
    window.__mock.calls.push({ input: input, opts: { modelTier: opts.modelTier, cache: opts.cache } });
    var full = answerFor(input);
    return new Promise(function (res, rej) {
      var i = 0;
      var t = setInterval(function () {
        if (opts.signal && opts.signal.aborted) { clearInterval(t); rej({ code: 'cancelled', text: full.slice(0, i) || undefined }); return; }
        i = Math.min(full.length, i + 60);
        if (opts.onText) opts.onText({ text: full.slice(0, i), delta: '' });
        if (i >= full.length) { clearInterval(t); res({ text: full, truncated: false, modelTierApplied: opts.modelTier || 'default' }); }
      }, window.__sampleDelay || 25);
    });
  }
  sample.json = function (input, opts) { return sample(input, Object.assign({}, opts, { onText: null })).then(function (r) { return JSON.parse(r.text); }); };
  var downloads = { save: function (r) { window.__mock.saved = { filename: r.filename, size: r.data.length, data: r.data }; return Promise.resolve({}); } };
  // A stand-in for the platform voice: each line "plays" for __ttsLineMs, firing onLine / onState like the real one.
  var tl = { state: [], line: [] }, cur = null;
  var ttsState = function (st, reason) { tl.state.forEach(function (f) { f({ state: st, reason: reason }); }); };
  var tts = {
    speak: function (lines, opts) {
      if (cur) { cur.end('replaced'); }
      lines = typeof lines === 'string' ? [{ text: lines }] : lines;
      window.__mock.tts = (window.__mock.tts || []).concat([{ lines: lines.map(function (l) { return { id: l.id, voice: l.voice, len: l.text.length }; }), opts: opts }]);
      if (lines.some(function (l) { return !l.text || l.text.length > 2000; })) return Promise.reject({ code: 'invalid_argument', message: 'bad line' });
      return new Promise(function (res, rej) {
        var i = 0, t = null, me = { paused: false };
        me.end = function (reason) { clearTimeout(t); cur = null; ttsState('idle', reason); rej({ code: 'stopped', reason: reason }); };
        me.go = function () { if (me.paused) return; if (i >= lines.length) { cur = null; ttsState('idle', 'completed'); res({ playedMs: 1000 }); return; } var l = lines[i]; tl.line.forEach(function (f) { f({ line: i, id: l.id }); }); i++; t = setTimeout(me.go, window.__ttsLineMs || 250); };
        me.pause = function () { me.paused = true; clearTimeout(t); ttsState('paused'); };
        me.resume = function () { me.paused = false; ttsState('speaking'); me.go(); };
        cur = me; ttsState('starting'); setTimeout(function () { ttsState('speaking'); me.go(); }, 10);
      });
    },
    add: function (l) { return tts.speak(l); },
    stop: function () { window.__mock.ttsStops = (window.__mock.ttsStops || 0) + 1; if (cur) cur.end('stopped'); return Promise.resolve(); },
    pause: function () { if (cur) cur.pause(); return Promise.resolve(); },
    resume: function () { if (cur) cur.resume(); return Promise.resolve(); },
    setRate: function (r) { window.__mock.rate = r; return Promise.resolve(); },
    active: function () { return !!cur; },
    voices: function () { return Promise.resolve(['buttery', 'airy', 'glassy', 'rounded']); },
    onState: function (f) { tl.state.push(f); return function () {}; },
    onLine: function (f) { tl.line.push(f); return function () {}; },
    onPosition: function () { return function () {}; }
  };
  window.claude = { use: function (n) { return Promise.resolve(n === 'db' ? (window.__noDb ? null : db) : n === 'sample' ? sample : n === 'downloads' ? downloads : n === 'tts' ? (window.__noTts ? null : tts) : null); } };
})();
