  /* ------------------------------------------------------------------
     U10. REVISION NOTES — "The Standard" from chosen sources, as a
          well-laid-out PDF, kept in a Revision notes section.
          Written by Claude (the viewer's own allowance) in stages so long
          chapters are covered fully: plan → each sub-topic → memory hooks →
          plain English glossary → case glossary → learning outcomes check.
          Only the chosen sources are used; every case named is checked
          against them afterwards. Stored in claude.ai (rdoc + rdocpart) or,
          in the offline copy and friends' edition, in this browser.
     ------------------------------------------------------------------ */
  var RN_KEY = 'lawRevisionApp.v1.rdocs';
  var RN_PART = 180000;          // characters per stored part (documents are capped at 256 KB)
  var RN_CHUNK = 110000;         // source characters per planning call
  var RN_PAGES_MAX = 45000;      // source characters sent with each section call
  LIBS.pdfmake = ['https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js', 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/pdfmake.min.js'];
  LIBS.pdfmakeFonts = ['https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.js', 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/vfs_fonts.js'];
  var rn = { view: 'list', sel: [], title: '', job: null, doc: null };
  var rnBodies = {};             // id → full document (loaded on demand)

  /* ---- storage ---- */
  function sanitizeRnMeta(m) {
    if (!m || typeof m !== 'object' || typeof m.id !== 'string') return null;
    return {
      id: m.id.replace(/[^A-Za-z0-9_\-.~:@+]/g, '-').slice(0, 80),
      title: cleanString(m.title, 200).trim() || 'Revision notes',
      module: MODULE_LABEL[m.module] ? m.module : '',
      sources: Array.isArray(m.sources) ? m.sources.slice(0, 20).map(function (s) { return { id: cleanString(s && s.id, 120), title: cleanString(s && s.title, 200) }; }) : [],
      createdAt: m.createdAt && !isNaN(new Date(m.createdAt).getTime()) ? m.createdAt : nowISO(),
      parts: Math.max(1, Math.min(20, Math.round(num(m.parts, 1)))),
      counts: m.counts && typeof m.counts === 'object' ? { principles: num(m.counts.principles, 0), terms: num(m.counts.terms, 0), cases: num(m.counts.cases, 0) } : { principles: 0, terms: 0, cases: 0 }
    };
  }
  function readLocalRn() {
    var d = null;
    try { d = JSON.parse(kvGet(RN_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || !Array.isArray(d.meta)) d = { meta: [], body: {} };
    if (!d.body || typeof d.body !== 'object') d.body = {};
    return d;
  }
  function loadLocalRn() { state.rdocs = readLocalRn().meta.map(sanitizeRnMeta).filter(Boolean); setTimeout(renderRnCount, 0); }
  function startRnCloud(db) {
    db.collection('rdoc').onSnapshot(function (snap) {
      state.rdocs = snap.docs.map(function (d) { return sanitizeRnMeta(d.data()); }).filter(Boolean);
      renderRnCount();
      if (!$('#rnModal').hidden && rn.view === 'list') renderRn();
    }, function () { /* list stays as it is */ });
  }
  function saveRnDoc(doc) {
    var json = JSON.stringify(doc), parts = [];
    for (var i = 0; i < json.length; i += RN_PART) parts.push(json.slice(i, i + RN_PART));
    var meta = sanitizeRnMeta({ id: doc.id, title: doc.title, module: doc.module, sources: doc.sources, createdAt: doc.createdAt, parts: parts.length,
      counts: { principles: doc.sections.reduce(function (n, s) { return n + s.entries.length; }, 0), terms: doc.terms.length, cases: doc.cases.length } });
    rnBodies[doc.id] = doc;
    if (store.mode === 'cloud' && claudeCaps.db) {
      var db = claudeCaps.db;
      setSync('busy');
      return Promise.all(parts.map(function (p, n) { return db.collection('rdocpart').doc(doc.id + '_' + n).set({ rid: doc.id, n: n, text: p }); }))
        .then(function () { return db.collection('rdoc').doc(doc.id).set(meta); })
        .then(function () { if (!state.rdocs.some(function (m) { return m.id === meta.id; })) state.rdocs.push(meta); if (!anyQueued()) setSync('ok'); return meta; },
          function (err) { setSync('error', err && err.code === 'quota_exceeded' ? 'Your claude.ai storage is full' : 'Revision notes couldn\'t be saved'); throw err; });
    }
    var d = readLocalRn();
    d.meta = d.meta.filter(function (m) { return m.id !== meta.id; }).concat([meta]);
    d.body[doc.id] = json;
    try { kvSet(RN_KEY, JSON.stringify(d)); } catch (e) { return Promise.reject({ code: 'quota_exceeded' }); }
    state.rdocs = d.meta.map(sanitizeRnMeta).filter(Boolean);
    return Promise.resolve(meta);
  }
  function loadRnDoc(id) {
    if (rnBodies[id]) return Promise.resolve(rnBodies[id]);
    var meta = state.rdocs.filter(function (m) { return m.id === id; })[0];
    if (!meta) return Promise.reject({ code: 'not_found' });
    var got;
    if (store.mode === 'cloud' && claudeCaps.db) {
      var gets = [];
      for (var n = 0; n < meta.parts; n++) gets.push(claudeCaps.db.collection('rdocpart').doc(id + '_' + n).get());
      got = Promise.all(gets).then(function (snaps) { return snaps.map(function (s) { return s.exists ? String((s.data() || {}).text || '') : ''; }).join(''); });
    } else got = Promise.resolve(readLocalRn().body[id] || '');
    return got.then(function (json) { var doc = JSON.parse(json); rnBodies[id] = doc; return doc; });
  }
  function deleteRnDoc(id) {
    var meta = state.rdocs.filter(function (m) { return m.id === id; })[0];
    state.rdocs = state.rdocs.filter(function (m) { return m.id !== id; });
    delete rnBodies[id];
    if (store.mode === 'cloud' && claudeCaps.db) {
      var ops = [claudeCaps.db.collection('rdoc').doc(id).delete()];
      for (var n = 0; n < (meta ? meta.parts : 1); n++) ops.push(claudeCaps.db.collection('rdocpart').doc(id + '_' + n).delete());
      return Promise.all(ops).then(null, function () { /* tidy-up only */ });
    }
    var d = readLocalRn();
    d.meta = d.meta.filter(function (m) { return m.id !== id; }); delete d.body[id];
    try { kvSet(RN_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    return Promise.resolve();
  }
  function renderRnCount() { var c = $('#rnCount'); if (c) c.textContent = String(state.rdocs.length); }
  // For backups: every document in full.
  function rnForExport() {
    return Promise.all(state.rdocs.map(function (m) { return loadRnDoc(m.id).then(null, function () { return null; }); })).then(function (l) { return l.filter(Boolean); });
  }
  function importRnDocs(list) {
    if (!Array.isArray(list)) return Promise.resolve(0);
    var have = {}; state.rdocs.forEach(function (m) { have[m.id] = true; });
    var todo = list.filter(function (d) { return d && typeof d.id === 'string' && !have[d.id] && Array.isArray(d.sections); });
    return todo.reduce(function (p, d) { return p.then(function () { return saveRnDoc(cleanRnDoc(d)); }); }, Promise.resolve()).then(function () { return todo.length; });
  }

  /* ---- the sources, page by page ---- */
  // Pages labelled S1:3 (source 1, page 3); texts without page breaks are cut into ~3,000-character "pages".
  function rnPages(sources) {
    var pages = [];
    sources.forEach(function (s, si) {
      var parts = s.text.indexOf('\f') !== -1 ? s.text.split('\f') : (s.text.match(/[\s\S]{1,3000}(?=\s|$)/g) || [s.text]);
      parts.forEach(function (t, pi) { if (t.trim()) pages.push({ ref: 'S' + (si + 1) + ':' + (pi + 1), src: si, text: t.trim() }); });
    });
    return pages;
  }
  function pagesText(pages) {
    return pages.map(function (p) { return '=== [' + p.ref + '] ===\n' + p.text; }).join('\n\n');
  }
  function rnChunks(pages) {
    var chunks = [], cur = [], size = 0;
    pages.forEach(function (p) {
      if (size + p.text.length > RN_CHUNK && cur.length) { chunks.push(cur); cur = []; size = 0; }
      cur.push(p); size += p.text.length;
    });
    if (cur.length) chunks.push(cur);
    return chunks;
  }
  // The pages a list of refs points to, with a page either side, kept under a size limit.
  function pickPages(all, refs, limit) {
    var idx = {}, out = [];
    all.forEach(function (p, i) { idx[p.ref] = i; });
    var want = {};
    (refs || []).forEach(function (r) { var i = idx[String(r).replace(/\s+/g, '')]; if (i != null) { want[i] = true; if (all[i - 1] && all[i - 1].src === all[i].src) want[i - 1] = true; if (all[i + 1] && all[i + 1].src === all[i].src) want[i + 1] = true; } });
    var size = 0;
    Object.keys(want).map(Number).sort(function (a, b) { return a - b; }).forEach(function (i) { if (size + all[i].text.length <= (limit || RN_PAGES_MAX)) { out.push(all[i]); size += all[i].text.length; } });
    return out;
  }

  // If Claude's page refs don't match, find the pages that mention the sub-topic's own words instead.
  function pagesFor(all, refs, words) {
    var got = pickPages(all, refs);
    if (got.length) return got;
    var keys = normText(words.join(' ')).split(' ').filter(function (w) { return w.length >= 5; });
    var scored = all.map(function (p, i) { var t = normText(p.text), n = 0; keys.forEach(function (k) { if (t.indexOf(' ' + k) !== -1) n++; }); return { i: i, n: n }; })
      .filter(function (x) { return x.n; }).sort(function (a, b) { return b.n - a.n; });
    var out = [], size = 0;
    scored.forEach(function (x) { var p = all[x.i]; if (size + p.text.length <= RN_PAGES_MAX) { out.push(x.i); size += p.text.length; } });
    out.sort(function (a, b) { return a - b; });
    return out.length ? out.map(function (i) { return all[i]; }) : all.slice(0, 1);
  }

  /* ---- prompts ---- */
  var RN_RULES = [
    'You are writing revision notes for a law conversion (PGDL) student, in the exact format they call "The Standard". They find long textbook prose overwhelming: compress the reading into the principles and authorities they need, explained so simply they never need to ask what something means.',
    'RULES:',
    '- Use ONLY the source pages below. Never invent a case, citation, year, court or section number. Copy citations exactly as the source gives them; if the source gives none, leave the citation empty.',
    '- If something essential is missing from the source, you may add it only if you are certain, and set "added": true on it. If you are unsure of a detail, set "unverified": true rather than guess.',
    '- Explain every legal term the moment it appears, fully (no shortcuts). Every case gets its story and its rule. Every principle gets its authority.',
    '- UK spelling. Plain, warm, precise English. No markdown, no headings inside the text, no emojis.'
  ].join('\n');
  function planPrompt(chunk, srcTitles, part, of) {
    return [
      'REVISION NOTES — PLAN' + (of > 1 ? ' (part ' + part + ' of ' + of + ' of the reading)' : ''),
      RN_RULES, '',
      'Read the source pages and plan the notes. Sweep EVERYTHING, including footnotes and cases mentioned only in passing.',
      'Reply with ONLY JSON:',
      '{"title": "short title for these notes", "topicMap": ["3-6 short lines showing how the topic fits together, e.g. \\"Formation → Offer → Acceptance → Consideration\\""],',
      ' "outcomes": ["each learning outcome, word for word, ONLY if the pages list learning outcomes; otherwise empty"],',
      ' "sections": [{"title": "sub-topic", "pages": ["page refs like S1:4 that cover it"], "principles": ["a short label for EVERY principle or rule to cover in this sub-topic, in order"]}],',
      ' "hooks": [{"title": "one of the 3 most complex multi-part tests or sequences", "pages": ["S1:5"]}],',
      ' "terms": [{"term": "EVERY legal term, Latin maxim or jargon word used", "page": "S1:2"}],',
      ' "cases": [{"name": "EVERY case named anywhere, as the source names it", "page": "S1:6"}]}',
      'Use the page refs exactly as they appear in the page markers (for example S1:4 means source 1, page 4). Aim for 3-10 sub-topics of 2-8 principles each.',
      '', 'SOURCES: ' + srcTitles, '', pagesText(chunk)
    ].join('\n');
  }
  function sectionPrompt(sec, pages) {
    return [
      'REVISION NOTES — SECTION: ' + sec.title,
      RN_RULES, '',
      'Write the "Key principles with authorities" entries for this sub-topic. Cover every one of these, in order: ' + sec.principles.map(function (p, i) { return (i + 1) + '. ' + p; }).join('; ') + '. Add any principle on these pages that the list missed.',
      'For each principle:',
      '- principle: the rule in ONE sentence.',
      '- authority: the case or statute section that establishes it, exactly as the source gives it.',
      '- eli5: a plain explanation with an everyday analogy (2-4 sentences).',
      '- case: if a case establishes or illustrates it, {"name", "citation", "facts": what actually happened in 2-3 plain sentences, "decision": what the court decided, "ratio": the rule it established, "exam": why it matters in the exam}; otherwise null.',
      '- examAngle: where useful, how it shows up in an SBAQ or problem question (the typical fact pattern and the typical trap); otherwise "".',
      '- pros / cons: only where the source discusses arguments for and against (a rule, a reform); otherwise empty arrays.',
      'Reply with ONLY JSON: {"entries": [{"principle": "", "authority": "", "eli5": "", "case": null, "examAngle": "", "pros": [], "cons": [], "added": false, "unverified": false}]}',
      '', pagesText(pages)
    ].join('\n');
  }
  function hooksPrompt(hooks, pages) {
    return [
      'REVISION NOTES — MEMORY HOOKS', RN_RULES, '',
      'For each of these complex multi-part tests or sequences, give a memory hook: a mnemonic or a vivid visual story that makes the parts stick, plus the parts in order (each with its authority where the source gives one).',
      hooks.map(function (h, i) { return (i + 1) + '. ' + h.title; }).join('\n'),
      'Reply with ONLY JSON: {"hooks": [{"title": "", "hook": "the mnemonic or story", "steps": ["each part of the test, in order"]}]}',
      '', pagesText(pages)
    ].join('\n');
  }
  function glossaryPrompt(terms, pages) {
    return [
      'REVISION NOTES — PLAIN ENGLISH GLOSSARY', RN_RULES, '',
      'Explain each of these terms as it is used in the source: an ELI5 explanation with an everyday analogy, and its legal significance.',
      terms.join('; '),
      'Reply with ONLY JSON: {"terms": [{"term": "", "eli5": "", "significance": ""}]}',
      '', pagesText(pages)
    ].join('\n');
  }
  function casesPrompt(cases, pages) {
    return [
      'REVISION NOTES — CASE GLOSSARY', RN_RULES, '',
      'For each of these cases (all named in the source), give: its name and citation as the source gives them, what happened (1-2 plain sentences), the ratio or effect, and which principle it supports. If the source only mentions a case in passing, say only what the source says and set "unverified": true for anything you are not certain of.',
      cases.join('; '),
      'Reply with ONLY JSON: {"cases": [{"name": "", "citation": "", "facts": "", "ratio": "", "supports": "", "unverified": false}]}',
      '', pagesText(pages)
    ].join('\n');
  }
  function outcomesPrompt(outcomes, sections) {
    return [
      'REVISION NOTES — LEARNING OUTCOMES CHECK',
      'Map each learning outcome to the numbered sections of the notes that achieve it, with a one-line note. If an outcome is not fully covered, say what is missing.',
      'OUTCOMES:', outcomes.map(function (o, i) { return (i + 1) + '. ' + o; }).join('\n'),
      'SECTIONS:', sections.map(function (s, i) { return (i + 1) + '. ' + s.title + ' — ' + s.entries.map(function (e) { return e.principle; }).join(' | ').slice(0, 600); }).join('\n'),
      'Reply with ONLY JSON: {"outcomes": [{"outcome": "", "sections": [section numbers], "note": "", "covered": true}]}'
    ].join('\n');
  }
  function mergePrompt(plans) {
    return [
      'REVISION NOTES — MERGE',
      'These are plans for consecutive parts of the same reading. Write one short title and ONE topic map (3-6 short lines, using →) for the whole reading.',
      plans.map(function (p, i) { return 'Part ' + (i + 1) + ': ' + p.title + '\n' + (p.topicMap || []).join('\n'); }).join('\n\n'),
      'Reply with ONLY JSON: {"title": "", "topicMap": [""]}'
    ].join('\n');
  }

  /* ---- cleaning what comes back ---- */
  function s_(v, n) { return cleanString(v == null ? '' : String(v), n || 2000).trim(); }
  function arr(v, n, m) { return (Array.isArray(v) ? v : []).map(function (x) { return s_(x, m || 600); }).filter(Boolean).slice(0, n || 12); }
  function cleanEntry(e) {
    if (!e || typeof e !== 'object' || !s_(e.principle)) return null;
    var c = e.case && typeof e.case === 'object' && s_(e.case.name) ? { name: s_(e.case.name, 300), citation: s_(e.case.citation, 200), facts: s_(e.case.facts), decision: s_(e.case.decision), ratio: s_(e.case.ratio), exam: s_(e.case.exam) } : null;
    return { principle: s_(e.principle, 800), authority: s_(e.authority, 400), eli5: s_(e.eli5), case: c, examAngle: s_(e.examAngle), pros: arr(e.pros), cons: arr(e.cons), added: e.added === true, unverified: e.unverified === true };
  }
  function cleanRnDoc(d) {
    return {
      v: 1, id: s_(d.id, 80) || uid('rn'), title: s_(d.title, 200) || 'Revision notes', module: MODULE_LABEL[d.module] ? d.module : '', createdAt: d.createdAt || nowISO(),
      sources: Array.isArray(d.sources) ? d.sources.slice(0, 20).map(function (x) { return { id: s_(x && x.id, 120), title: s_(x && x.title, 200) }; }) : [],
      topicMap: arr(d.topicMap, 8, 300),
      sections: (Array.isArray(d.sections) ? d.sections : []).map(function (s) { return { title: s_(s && s.title, 200), entries: (Array.isArray(s && s.entries) ? s.entries : []).map(cleanEntry).filter(Boolean), failed: !!(s && s.failed) }; }).filter(function (s) { return s.title; }),
      hooks: (Array.isArray(d.hooks) ? d.hooks : []).map(function (h) { return h && s_(h.title) ? { title: s_(h.title, 300), hook: s_(h.hook), steps: arr(h.steps, 12) } : null; }).filter(Boolean).slice(0, 3),
      terms: (Array.isArray(d.terms) ? d.terms : []).map(function (t) { return t && s_(t.term) ? { term: s_(t.term, 200), eli5: s_(t.eli5), significance: s_(t.significance) } : null; }).filter(Boolean),
      cases: (Array.isArray(d.cases) ? d.cases : []).map(function (c) { return c && s_(c.name) ? { name: s_(c.name, 300), citation: s_(c.citation, 200), facts: s_(c.facts), ratio: s_(c.ratio), supports: s_(c.supports, 400), unverified: c.unverified === true, notFound: c.notFound === true } : null; }).filter(Boolean),
      outcomes: (Array.isArray(d.outcomes) ? d.outcomes : []).map(function (o) { return o && s_(o.outcome) ? { outcome: s_(o.outcome, 600), sections: (Array.isArray(o.sections) ? o.sections : []).map(Number).filter(function (n) { return n >= 1 && n <= 50; }), note: s_(o.note, 600), covered: o.covered !== false } : null; }).filter(Boolean)
    };
  }
  // Is this case (or authority) actually named in the chosen sources?
  function rnInSources(name, norm) {
    var n = String(name || '').replace(/\s*[\[(].*$/, '');
    var keys = [normText(n)], m = /^(.+?) v (\S+)/.exec(n);
    if (m) keys.push(normText(m[1] + ' v ' + m[2]));
    keys = keys.filter(function (k) { return k.length >= 6; });
    return !keys.length || keys.some(function (k) { return norm.indexOf(k) !== -1; });
  }

  /* ---- writing a document ---- */
  function startRn() {
    var ids = rn.sel.slice();
    if (!ids.length) { toast('Tick at least one source.'); return; }
    if (!claudeCaps.sample) { toast('Revision notes are written by Claude, which works when the app is opened in claude.ai.', { type: 'error' }); return; }
    var job = rn.job = { ctl: new AbortController(), steps: [], error: '', done: false };
    rn.view = 'gen'; renderRn();
    var step = function (label) { var s = { label: label, state: 'run' }; job.steps.push(s); renderRnProgress(); return s; };
    var ask = function (prompt, s) {
      // One automatic retry: a long section can occasionally come back cut short.
      var go = function (tries) {
        return claudeCaps.sample.json(prompt, { signal: job.ctl.signal, cache: false }).then(null, function (err) {
          if (err && err.code === 'cancelled') throw err;
          if (tries < 1 && (!err || err.code === 'invalid_json' || err.code === 'unavailable' || err.code === 'rate_limited')) return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return go(tries + 1); });
          throw err;
        });
      };
      return go(0).then(function (r) { if (s) s.state = 'ok'; renderRnProgress(); return r; }, function (err) { if (s) s.state = 'bad'; renderRnProgress(); throw err; });
    };
    // Run tasks two at a time.
    var pool = function (tasks) {
      var i = 0, results = [];
      var worker = function () { if (job.ctl.signal.aborted || i >= tasks.length) return Promise.resolve(); var k = i++; return tasks[k]().then(function (r) { results[k] = r; }, function (e) { if (e && e.code === 'cancelled') throw e; results[k] = { error: e }; }).then(worker); };
      return Promise.all([worker(), worker()]).then(function () { return results; });
    };
    var srcs, pages, norm, plans, doc;
    var s0 = step('Reading your sources');
    Promise.all(ids.map(function (id) { return loadSourceText(id).then(function (t) { var m = sourceById(id); return { id: id, title: m ? m.title : id, module: m ? m.module : '', text: t || '' }; }); })).then(function (list) {
      srcs = list.filter(function (s) { return s.text.trim(); });
      if (!srcs.length) throw { code: 'empty', message: 'Those sources have no text to work from.' };
      pages = rnPages(srcs);
      norm = normText(srcs.map(function (s) { return s.text; }).join(' '));
      s0.state = 'ok';
      var chunks = rnChunks(pages), titles = srcs.map(function (s, i) { return 'S' + (i + 1) + ' = ' + s.title; }).join('; ');
      return pool(chunks.map(function (c, i) { var s = step(chunks.length > 1 ? 'Planning part ' + (i + 1) + ' of ' + chunks.length : 'Planning the notes'); return function () { return ask(planPrompt(c, titles, i + 1, chunks.length), s); }; }));
    }).then(function (res) {
      plans = res.filter(function (p) { return p && !p.error && Array.isArray(p.sections); });
      if (!plans.length) throw (res[0] && res[0].error) || { code: 'invalid_json' };
      var mod = srcs.map(function (s) { return s.module; }).filter(Boolean)[0] || '';
      doc = { id: uid('rn'), title: rn.title || '', module: mod, createdAt: nowISO(), sources: srcs.map(function (s) { return { id: s.id, title: s.title }; }),
        topicMap: [], sections: [], hooks: [], terms: [], cases: [], outcomes: [] };
      var secs = [], hooks = [], terms = {}, cases = {}, outcomes = [];
      plans.forEach(function (p) {
        (p.sections || []).forEach(function (s) { if (s && s_(s.title)) secs.push({ title: s_(s.title, 200), pages: arr(s.pages, 30, 20), principles: arr(s.principles, 14, 200) }); });
        (p.hooks || []).forEach(function (h) { if (h && s_(h.title)) hooks.push({ title: s_(h.title, 300), pages: arr(h.pages, 10, 20) }); });
        (p.terms || []).forEach(function (t) { var k = s_(t && t.term, 200); if (k && !terms[k.toLowerCase()]) terms[k.toLowerCase()] = { term: k, page: s_(t.page, 20) }; });
        (p.cases || []).forEach(function (c) { var k = s_(c && c.name, 300); if (k && !cases[normText(k)]) cases[normText(k)] = { name: k, page: s_(c.page, 20) }; });
        arr(p.outcomes, 20, 600).forEach(function (o) { if (outcomes.indexOf(o) === -1) outcomes.push(o); });
      });
      hooks = hooks.slice(0, 3);
      var tasks = [];
      if (plans.length > 1) { var sm = step('Joining the parts together'); tasks.push(function () { return ask(mergePrompt(plans), sm).then(function (r) { doc.topicMap = arr(r && r.topicMap, 8, 300); if (!doc.title) doc.title = s_(r && r.title, 200); }); }); }
      else { doc.topicMap = arr(plans[0].topicMap, 8, 300); if (!doc.title) doc.title = s_(plans[0].title, 200); }
      secs.forEach(function (sec, i) {
        var st = step('Key principles: ' + sec.title);
        tasks.push(function () {
          return ask(sectionPrompt(sec, pagesFor(pages, sec.pages, [sec.title].concat(sec.principles))), st).then(function (r) {
            doc.sections[i] = { title: sec.title, entries: (Array.isArray(r && r.entries) ? r.entries : []).map(cleanEntry).filter(Boolean) };
          }, function (err) { if (err && err.code === 'cancelled') throw err; doc.sections[i] = { title: sec.title, entries: [], failed: true }; });
        });
      });
      if (hooks.length) { var sh = step('Memory hooks'); tasks.push(function () { return ask(hooksPrompt(hooks, pickPages(pages, [].concat.apply([], hooks.map(function (h) { return h.pages; })))), sh).then(function (r) { doc.hooks = (r && r.hooks) || []; }, function () { doc.hooks = []; }); }); }
      var tl = Object.keys(terms).map(function (k) { return terms[k]; }), cl = Object.keys(cases).map(function (k) { return cases[k]; });
      for (var t = 0; t < tl.length; t += 30) (function (batch, n) {
        var sg = step('Plain English glossary' + (tl.length > 30 ? ' (' + n + ')' : ''));
        tasks.push(function () { return ask(glossaryPrompt(batch.map(function (x) { return x.term; }), pickPages(pages, batch.map(function (x) { return x.page; }), 40000)), sg).then(function (r) { doc.terms = doc.terms.concat((r && r.terms) || []); }, function () { batch.forEach(function (x) { doc.terms.push({ term: x.term, eli5: '', significance: '' }); }); }); });
      })(tl.slice(t, t + 30), t / 30 + 1);
      for (var c = 0; c < cl.length; c += 20) (function (batch, n) {
        var sc = step('Case glossary' + (cl.length > 20 ? ' (' + n + ')' : ''));
        tasks.push(function () { return ask(casesPrompt(batch.map(function (x) { return x.name; }), pickPages(pages, batch.map(function (x) { return x.page; }), 40000)), sc).then(function (r) { doc.cases = doc.cases.concat((r && r.cases) || []); }, function () { batch.forEach(function (x) { doc.cases.push({ name: x.name, citation: '', facts: '', ratio: '', supports: '', unverified: true }); }); }); });
      })(cl.slice(c, c + 20), c / 20 + 1);
      job.outcomes = outcomes;
      return pool(tasks);
    }).then(function () {
      doc.sections = doc.sections.filter(Boolean);
      if (!job.outcomes.length) return;
      var so = step('Learning outcomes check');
      return ask(outcomesPrompt(job.outcomes, doc.sections), so).then(function (r) { doc.outcomes = (r && r.outcomes) || []; }, function () { doc.outcomes = job.outcomes.map(function (o) { return { outcome: o, sections: [], note: 'Not checked.', covered: false }; }); });
    }).then(function () {
      doc = cleanRnDoc(doc);
      if (!doc.title) doc.title = srcs.map(function (s) { return s.title; }).join(' + ').slice(0, 200);
      // Check every case against the chosen sources.
      doc.cases.forEach(function (c) { if (!rnInSources(c.name, norm)) c.notFound = true; });
      doc.cases.sort(function (a, b) { return a.name.localeCompare(b.name); });
      doc.terms.sort(function (a, b) { return a.term.localeCompare(b.term); });
      doc.sections.forEach(function (s) { s.entries.forEach(function (e) { if (e.case && !rnInSources(e.case.name, norm)) e.case.notFound = true; }); });
      var vs = step('Saving to your Revision notes');
      return saveRnDoc(doc).then(function () { vs.state = 'ok'; job.done = true; rn.doc = doc; rn.view = 'view'; renderRn(); renderRnCount();
        toast('Revision notes ready: “' + doc.title + '”.', { type: 'success' }); });
    }).then(null, function (err) {
      if (err && err.code === 'cancelled') return;
      if (err && (err.code === 'not_granted' || err.code === 'sampling_disabled')) claudeCaps.sample = null;
      job.error = err && err.message && err.code === 'empty' ? err.message : sampleErrorText(err);
      renderRnProgress();
    });
  }
  function renderRnProgress() {
    if (rn.view !== 'gen' || !rn.job) return;
    var j = rn.job, done = j.steps.filter(function (s) { return s.state !== 'run'; }).length;
    $('#rnBody').innerHTML = '<p class="muted" style="margin-top:0">Claude is working through your sources section by section, so nothing is skipped. Long chapters take a few minutes — you can keep this open or come back to it.</p>' +
      '<div class="review-progress"><div class="bar"><i style="width:' + Math.round(done / Math.max(1, j.steps.length) * 100) + '%"></i></div><span>' + done + ' of ' + j.steps.length + ' steps</span></div>' +
      '<ol class="rn-steps">' + j.steps.map(function (s) { return '<li class="' + s.state + '"><span class="rn-st">' + (s.state === 'ok' ? '✓' : s.state === 'bad' ? '!' : '<span class="spinner"></span>') + '</span>' + esc(s.label) + '</li>'; }).join('') + '</ol>' +
      (j.error ? '<p class="step-note warn">' + esc(j.error) + '</p>' : '');
    $('#rnFoot').innerHTML = j.error ? '<button type="button" class="btn" data-rn="list">Back</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-rn="go">Try again</button>'
      : '<button type="button" class="btn" data-rn="cancel">Cancel</button>';
  }

  /* ---- the window ---- */
  function openRn(preselect) {
    if (preselect) { rn.sel = [preselect]; rn.title = ''; rn.view = 'new'; }
    else if (rn.view !== 'gen' || !rn.job || rn.job.done || rn.job.error) rn.view = 'list';
    renderRn();
    openModal($('#rnModal'));
  }
  function renderRn() {
    var body = $('#rnBody'), foot = $('#rnFoot');
    if (rn.view === 'gen') return renderRnProgress();
    if (rn.view === 'view' && rn.doc) {
      body.innerHTML = rnHTML(rn.doc);
      foot.innerHTML = '<button type="button" class="btn" data-rn="list">← All revision notes</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-rn="pdf" data-id="' + esc(rn.doc.id) + '">⬇ Download PDF</button>';
      body.scrollTop = 0;
      return;
    }
    if (rn.view === 'new') {
      var groups = {};
      state.sources.forEach(function (s) { (groups[s.module || ''] = groups[s.module || ''] || []).push(s); });
      var order = MODULES.map(function (m) { return m.id; }).concat(['']);
      body.innerHTML = '<p class="muted" style="margin-top:0">Tick the sources to turn into revision notes in your <b>Standard</b> format: topic map, key principles with authorities (each with an ELI5, the case story and the exam angle), memory hooks, a plain English glossary, a case glossary and — if your reading lists them — a learning outcomes check.</p>' +
        '<div class="form-field"><label class="lbl" for="rnTitle">Title <span class="hint">(optional — Claude suggests one)</span></label><input class="input" id="rnTitle" maxlength="200" value="' + esc(rn.title) + '" placeholder="e.g. Tort Ch 7 – Occupiers\' Liability"></div>' +
        '<div class="qz-topics rn-srcs">' + order.filter(function (m) { return groups[m]; }).map(function (m) {
          return '<div class="qz-mod">' + esc(MODULE_LABEL[m] || 'Other') + '</div>' + groups[m].map(function (s) {
            return '<label class="qz-topic"><input type="checkbox" data-rnsrc="' + esc(s.id) + '"' + (rn.sel.indexOf(s.id) !== -1 ? ' checked' : '') + '><span>' + esc(s.title) + '</span><small>' + (s.pages ? plural(s.pages, 'page') : Math.max(1, Math.round(s.chars / 6000)) + 'k words') + '</small></label>';
          }).join('');
        }).join('') + '</div>' +
        '<p class="muted rn-note">Uses your Claude allowance: roughly one request per sub-topic plus a few for the glossaries — a typical chapter is 10–15 requests. Only your chosen sources are used, and every case is checked against them.</p>' +
        (claudeCaps.sample ? '' : '<p class="step-note warn">Revision notes are written by Claude, which works when the app is opened in claude.ai.</p>');
      foot.innerHTML = '<button type="button" class="btn" data-rn="list">Back</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-rn="go"' + (claudeCaps.sample ? '' : ' disabled') + '>✦ Write revision notes</button>';
      return;
    }
    var list = state.rdocs.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    body.innerHTML = (list.length ? '<div class="rn-list">' + list.map(function (m) {
      return '<div class="rn-item"><div class="rn-item-text"><b>' + esc(m.title) + '</b><span>' + (m.module ? esc(MODULE_LABEL[m.module]) + ' · ' : '') +
        new Date(m.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + plural(m.counts.principles, 'principle') + ', ' + plural(m.counts.cases, 'case') + ', ' + plural(m.counts.terms, 'term') + '</span>' +
        '<small>From: ' + esc(m.sources.map(function (s) { return s.title; }).join(', ')) + '</small></div>' +
        '<div class="rn-item-tools"><button type="button" class="btn btn-sm" data-rn="open" data-id="' + esc(m.id) + '">View</button>' +
        '<button type="button" class="btn btn-sm btn-primary" data-rn="pdf" data-id="' + esc(m.id) + '">⬇ PDF</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-rn="delete" data-id="' + esc(m.id) + '">Delete</button></div></div>';
    }).join('') + '</div>'
      : '<div class="empty" style="padding:30px 16px"><h3>No revision notes yet</h3><p>Choose one or more sources and Claude turns them into your Standard notes, laid out as a PDF you can read, print or keep.</p></div>');
    foot.innerHTML = '<span class="spacer"></span><button type="button" class="btn" data-close>Close</button><button type="button" class="btn btn-primary" data-rn="new">＋ New revision notes</button>';
  }
  function rnAction(a, el) {
    var id = el && el.getAttribute('data-id');
    if (a === 'new') { rn.sel = rn.view === 'new' ? rn.sel : []; rn.title = ''; rn.view = 'new'; renderRn(); }
    else if (a === 'list') { rn.view = 'list'; renderRn(); }
    else if (a === 'go') { var t = $('#rnTitle'); if (t) rn.title = t.value.trim(); startRn(); }
    else if (a === 'cancel') { if (rn.job) rn.job.ctl.abort(); rn.job = null; rn.view = 'new'; renderRn(); }
    else if (a === 'open') {
      $('#rnBody').innerHTML = '<p><span class="spinner"></span>Opening…</p>';
      loadRnDoc(id).then(function (d) { rn.doc = cleanRnDoc(d); rn.view = 'view'; renderRn(); }, function () { toast('Those notes couldn\'t be opened.', { type: 'error' }); rn.view = 'list'; renderRn(); });
    }
    else if (a === 'pdf') { el.disabled = true; loadRnDoc(id).then(function (d) { return downloadRnPdf(cleanRnDoc(d)); }).then(function () { el.disabled = false; }, function (err) { el.disabled = false; toast((err && err.message) || 'The PDF couldn\'t be made.', { type: 'error', timeout: 7000 }); }); }
    else if (a === 'delete') {
      var m = state.rdocs.filter(function (x) { return x.id === id; })[0]; if (!m) return;
      dialog({ title: 'Delete these revision notes?', message: '“' + m.title + '” will be deleted. Your sources and cards are not affected.', buttons: [{ label: 'Cancel', value: false }, { label: 'Delete', value: true, style: 'btn-danger' }] })
        .then(function (yes) { if (!yes) return; deleteRnDoc(id).then(function () { renderRn(); renderRnCount(); toast('Revision notes deleted.'); }); });
    }
  }
  function bindRn() {
    $('#rnBtn').addEventListener('click', function () { openRn(); });
    $('#rnModal').addEventListener('click', function (ev) { var b = ev.target.closest('[data-rn]'); if (b) rnAction(b.getAttribute('data-rn'), b); });
    $('#rnModal').addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.matches('[data-rnsrc]')) { var id = t.getAttribute('data-rnsrc'); rn.sel = rn.sel.filter(function (x) { return x !== id; }); if (t.checked) rn.sel.push(id); }
    });
    $('#rnModal').addEventListener('input', function (ev) { if (ev.target.id === 'rnTitle') rn.title = ev.target.value; });
  }

  /* ---- showing a document in the app ---- */
  function rnFlags(x) {
    return (x.added ? ' <em class="rn-flag added">(added, not in your reading)</em>' : '') + (x.unverified ? ' <em class="rn-flag">(unverified)</em>' : '') + (x.notFound ? ' <em class="rn-flag bad">(not found in your sources — check)</em>' : '');
  }
  function rnHTML(d) {
    var n = 0, h = '<div class="rn-doc"><div class="rn-cover"><h2>' + esc(d.title) + '</h2><p>' + (d.module ? esc(MODULE_LABEL[d.module]) + ' · ' : '') + 'From: ' + esc(d.sources.map(function (s) { return s.title; }).join(', ')) + '</p></div>';
    h += '<h3 class="rn-h">' + (++n) + '. Topic map</h3><div class="rn-map">' + d.topicMap.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '</div>';
    h += '<h3 class="rn-h">' + (++n) + '. Key principles with authorities</h3>';
    d.sections.forEach(function (s, si) {
      h += '<h4 class="rn-sub">' + (si + 1) + '. ' + esc(s.title) + '</h4>' + (s.failed ? '<p class="step-note warn">This sub-topic couldn\'t be written this time.</p>' : '');
      s.entries.forEach(function (e) {
        h += '<div class="rn-entry"><p class="rn-principle"><b>' + esc(e.principle) + '</b>' + rnFlags(e) + '</p>' +
          (e.authority ? '<p class="rn-auth"><i>Authority:</i> ' + esc(e.authority) + '</p>' : '') +
          (e.eli5 ? '<div class="rn-eli5"><b>ELI5:</b> ' + esc(e.eli5) + '</div>' : '') +
          (e.case ? '<div class="rn-case"><b>Case: ' + esc(e.case.name) + '</b>' + (e.case.citation ? ' <span class="muted">' + esc(e.case.citation) + '</span>' : '') + rnFlags(e.case) +
            [['Facts', e.case.facts], ['Decision', e.case.decision], ['Ratio', e.case.ratio], ['Exam relevance', e.case.exam]].filter(function (r) { return r[1]; }).map(function (r) { return '<div class="rn-row"><span>' + r[0] + '</span><p>' + esc(r[1]) + '</p></div>'; }).join('') + '</div>' : '') +
          (e.examAngle ? '<div class="rn-exam"><b>Exam angle:</b> ' + esc(e.examAngle) + '</div>' : '') +
          (e.pros.length || e.cons.length ? '<div class="rn-pc">' + e.pros.map(function (p) { return '<p class="pro">+ ' + esc(p) + '</p>'; }).join('') + e.cons.map(function (p) { return '<p class="con">− ' + esc(p) + '</p>'; }).join('') + '</div>' : '') + '</div>';
      });
    });
    if (d.hooks.length) h += '<h3 class="rn-h">' + (++n) + '. Memory hooks</h3>' + d.hooks.map(function (k) { return '<div class="rn-hook"><b>' + esc(k.title) + '</b><p>' + esc(k.hook) + '</p>' + (k.steps.length ? '<ol>' + k.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' : '') + '</div>'; }).join('');
    if (d.terms.length) h += '<h3 class="rn-h">' + (++n) + '. Plain English glossary</h3><div class="rn-table"><div class="rn-tr rn-th"><span>Term</span><span>ELI5</span><span>Legal significance</span></div>' +
      d.terms.map(function (t) { return '<div class="rn-tr"><span><b>' + esc(t.term) + '</b></span><span>' + esc(t.eli5) + '</span><span>' + esc(t.significance) + '</span></div>'; }).join('') + '</div>';
    if (d.cases.length) h += '<h3 class="rn-h">' + (++n) + '. Case glossary</h3><div class="rn-table rn-cases"><div class="rn-tr rn-th"><span>Case</span><span>What happened</span><span>Ratio / effect</span><span>Supports</span></div>' +
      d.cases.map(function (c) { return '<div class="rn-tr"><span><b>' + esc(c.name) + '</b>' + (c.citation ? '<br><small>' + esc(c.citation) + '</small>' : '') + rnFlags(c) + '</span><span>' + esc(c.facts) + '</span><span>' + esc(c.ratio) + '</span><span>' + esc(c.supports) + '</span></div>'; }).join('') + '</div>';
    if (d.outcomes.length) h += '<h3 class="rn-h">' + (++n) + '. Learning outcomes check</h3><div class="rn-table rn-out"><div class="rn-tr rn-th"><span>Learning outcome</span><span>Covered in</span><span>Note</span></div>' +
      d.outcomes.map(function (o) { return '<div class="rn-tr"><span>' + esc(o.outcome) + '</span><span>' + (o.covered ? '✓ ' : '⚠ ') + (o.sections.length ? 'Section ' + o.sections.join(', ') : '—') + '</span><span>' + esc(o.note) + '</span></div>'; }).join('') + '</div>';
    return h + '</div>';
  }

  /* ---- the PDF ---- */
  var RN_C = { accent: '#3a3f8f', ink: '#1d1d1f', muted: '#6b6b73', line: '#e2dfd6', eli5: '#eef3ff', exam: '#fff4dc', examLine: '#e3b049', caseBg: '#f6f5f1', good: '#157a3c', bad: '#b42318', warn: '#9a6200' };
  function rnPdfFlags(x) {
    var out = [];
    if (x.added) out.push({ text: '  (added, not in your reading)', italics: true, color: RN_C.warn, fontSize: 8.5 });
    if (x.unverified) out.push({ text: '  (unverified)', italics: true, color: RN_C.warn, fontSize: 8.5 });
    if (x.notFound) out.push({ text: '  (not found in your sources — check)', italics: true, color: RN_C.bad, fontSize: 8.5 });
    return out;
  }
  function box(content, fill, edge) {
    return { table: { widths: ['*'], body: [[{ stack: content, fillColor: fill }]] }, margin: [0, 3, 0, 3],
      layout: { hLineWidth: function () { return 0; }, vLineWidth: function (i) { return i === 0 && edge ? 2.5 : 0; }, vLineColor: function () { return edge; },
        paddingLeft: function () { return 8; }, paddingRight: function () { return 8; }, paddingTop: function () { return 5; }, paddingBottom: function () { return 5; } } };
  }
  // Roboto (the PDF font) has no arrows, ticks or maths symbols: swap them for ones it has.
  var PDF_SWAP = { '→': '»', '⇒': '»', '⟶': '»', '➔': '»', '←': '«', '⇐': '«', '↔': '«»', '✓': '(yes)', '✔': '(yes)', '✗': '(no)', '✘': '(no)', '≥': '>=', '≤': '<=', '≠': '!=', '…': '...', '▸': '»', '►': '»', '★': '*', '☆': '*' };
  function pdfSafe(v) {
    if (typeof v === 'string') return v.replace(/[→⇒⟶➔←⇐↔✓✔✗✘≥≤≠…▸►★☆]/g, function (c) { return PDF_SWAP[c]; }).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
    if (Array.isArray(v)) return v.map(pdfSafe);
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = typeof v[k] === 'function' ? v[k] : pdfSafe(v[k]); }); return o; }
    return v;
  }
  function rnPdfDef(d) {
    var n = 0, content = [];
    var H1 = function (t) { return { text: (++n) + '.  ' + t, style: 'h1', tocItem: true, tocStyle: { bold: true }, tocMargin: [0, 4, 0, 0] }; };
    content.push({ text: d.title, style: 'title' });
    content.push({ text: [(d.module ? MODULE_LABEL[d.module] + '  ·  ' : ''), 'Revision notes in the Standard format  ·  ', new Date(d.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })], style: 'meta' });
    content.push({ text: 'From: ' + d.sources.map(function (s) { return s.title; }).join('; '), style: 'meta', margin: [0, 0, 0, 10] });
    content.push({ toc: { title: { text: 'Contents', style: 'h2' }, numberStyle: { color: RN_C.muted } }, margin: [0, 0, 0, 6] });
    content.push(H1('Topic map'));
    content.push(box(d.topicMap.map(function (l) { return { text: l, margin: [0, 1.5, 0, 1.5], bold: true, color: RN_C.accent }; }), '#f3f3fa', RN_C.accent));
    content.push(H1('Key principles with authorities'));
    d.sections.forEach(function (s, si) {
      content.push({ text: (n) + '.' + (si + 1) + '  ' + s.title, style: 'h2', tocItem: true, tocMargin: [14, 1, 0, 0], tocStyle: { fontSize: 9.5, color: RN_C.muted } });
      if (s.failed) content.push({ text: 'This sub-topic couldn\'t be written this time.', color: RN_C.bad, italics: true });
      s.entries.forEach(function (e) {
        var stack = [{ text: [{ text: e.principle, bold: true }].concat(rnPdfFlags(e)), margin: [0, 0, 0, 2] }];
        if (e.authority) stack.push({ text: [{ text: 'Authority: ', italics: true, color: RN_C.muted }, { text: e.authority, italics: true }], margin: [0, 0, 0, 3] });
        if (e.eli5) stack.push(box([{ text: [{ text: 'ELI5  ', bold: true, color: RN_C.accent }, e.eli5] }], RN_C.eli5));
        if (e.case) {
          var rows = [['Facts', e.case.facts], ['Decision', e.case.decision], ['Ratio', e.case.ratio], ['Exam relevance', e.case.exam]].filter(function (r) { return r[1]; })
            .map(function (r) { return [{ text: r[0], bold: true, color: RN_C.muted, fontSize: 8.5 }, { text: r[1] }]; });
          stack.push({ margin: [0, 3, 0, 3], table: { widths: [62, '*'], body: [[{ colSpan: 2, text: [{ text: 'Case: ' + e.case.name, bold: true }, e.case.citation ? { text: '  ' + e.case.citation, color: RN_C.muted } : ''].concat(rnPdfFlags(e.case)), fillColor: RN_C.caseBg }, {}]].concat(rows) },
            layout: { hLineWidth: function (i, node) { return i === 0 || i === node.table.body.length ? 0.6 : 0.3; }, vLineWidth: function () { return 0; }, hLineColor: function () { return RN_C.line; }, paddingTop: function () { return 3; }, paddingBottom: function () { return 3; } } });
        }
        if (e.examAngle) stack.push(box([{ text: [{ text: 'Exam angle  ', bold: true, color: RN_C.warn }, e.examAngle] }], RN_C.exam, RN_C.examLine));
        e.pros.forEach(function (p) { stack.push({ text: [{ text: 'For:  ', bold: true }, p], color: RN_C.good, margin: [0, 1, 0, 1] }); });
        e.cons.forEach(function (p) { stack.push({ text: [{ text: 'Against:  ', bold: true }, p], color: RN_C.bad, margin: [0, 1, 0, 1] }); });
        content.push({ stack: stack, margin: [0, 4, 0, 8], unbreakable: JSON.stringify(e).length < 1400 });
      });
    });
    if (d.hooks.length) {
      content.push(H1('Memory hooks'));
      d.hooks.forEach(function (k) {
        content.push(box([{ text: k.title, bold: true, color: RN_C.accent, margin: [0, 0, 0, 2] }, { text: k.hook, margin: [0, 0, 0, 3] }].concat(k.steps.length ? [{ ol: k.steps, margin: [6, 0, 0, 0] }] : []), '#f6f5fb', RN_C.accent));
      });
    }
    var tableLayout = { hLineWidth: function (i) { return i === 1 ? 0.8 : 0.3; }, vLineWidth: function () { return 0; }, hLineColor: function () { return RN_C.line; },
      fillColor: function (i) { return i === 0 ? '#ecebf5' : i % 2 === 0 ? '#faf9f6' : null; }, paddingTop: function () { return 4; }, paddingBottom: function () { return 4; } };
    var th = function (t) { return { text: t, bold: true, fontSize: 8.5, color: RN_C.accent }; };
    if (d.terms.length) {
      content.push(Object.assign(H1('Plain English glossary'), { pageBreak: 'before' }));
      content.push({ table: { headerRows: 1, widths: ['22%', '46%', '32%'], body: [[th('Term'), th('ELI5'), th('Legal significance')]].concat(d.terms.map(function (t) { return [{ text: t.term, bold: true }, t.eli5, t.significance]; })) }, layout: tableLayout, fontSize: 9 });
    }
    if (d.cases.length) {
      content.push(Object.assign(H1('Case glossary'), { pageBreak: 'before' }));
      content.push({ table: { headerRows: 1, widths: ['24%', '30%', '28%', '18%'], body: [[th('Case'), th('What happened'), th('Ratio / effect'), th('Supports')]].concat(d.cases.map(function (c) {
        return [{ text: [{ text: c.name, bold: true }, c.citation ? { text: '\n' + c.citation, color: RN_C.muted, fontSize: 8 } : ''].concat(rnPdfFlags(c)) }, c.facts, c.ratio, c.supports];
      })) }, layout: tableLayout, fontSize: 8.8 });
    }
    if (d.outcomes.length) {
      content.push(H1('Learning outcomes check'));
      content.push({ table: { headerRows: 1, widths: ['44%', '18%', '38%'], body: [[th('Learning outcome'), th('Covered in'), th('Note')]].concat(d.outcomes.map(function (o) {
        return [o.outcome, { text: (o.covered ? 'Yes — ' : 'Partly — ') + (o.sections.length ? 'section 2.' + o.sections.join(', 2.') : '—'), color: o.covered ? RN_C.good : RN_C.warn }, o.note];
      })) }, layout: tableLayout, fontSize: 9 });
    }
    return {
      pageSize: 'A4', pageMargins: [44, 46, 44, 52], info: { title: d.title, subject: 'Revision notes', creator: 'Law Revision Repository' },
      footer: function (page, pages) { return { columns: [{ text: d.title, color: RN_C.muted, fontSize: 7.5 }, { text: page + ' / ' + pages, alignment: 'right', color: RN_C.muted, fontSize: 7.5 }], margin: [44, 18, 44, 0] }; },
      content: content,
      defaultStyle: { font: 'Roboto', fontSize: 9.8, lineHeight: 1.22, color: RN_C.ink },
      styles: {
        title: { fontSize: 22, bold: true, color: RN_C.accent, margin: [0, 0, 0, 4] },
        meta: { fontSize: 9, color: RN_C.muted },
        h1: { fontSize: 15, bold: true, color: RN_C.accent, margin: [0, 14, 0, 6] },
        h2: { fontSize: 11.5, bold: true, color: RN_C.ink, margin: [0, 10, 0, 3] }
      }
    };
  }
  function downloadRnPdf(d) {
    return loadScript(LIBS.pdfmake).then(function () { return loadScript(LIBS.pdfmakeFonts); }).then(function () {
      if (!window.pdfMake) throw new Error('The PDF maker couldn\'t load. Check your internet connection.');
      return new Promise(function (resolve, reject) {
        try { window.pdfMake.createPdf(rnPdfDef(pdfSafe(d))).getBlob(function (blob) { resolve(blob); }); } catch (e) { reject(e); }
      });
    }).then(function (blob) {
      var name = d.title.replace(/[^\w\s–\-().,&']/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) + '.pdf';
      if (claudeCaps.downloads) {
        return claudeCaps.downloads.save({ filename: name, data: blob }).then(null, function (err) {
          if (err && err.code === 'declined') return;
          throw new Error('This view can\'t save files. Open the app in claude.ai in a web browser to download the PDF.');
        });
      }
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });
  }
