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
  window.claude = { use: function (n) { return Promise.resolve(n === 'db' ? (window.__noDb ? null : db) : n === 'sample' ? sample : n === 'downloads' ? downloads : null); } };
})();
