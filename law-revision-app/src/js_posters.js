  /* ------------------------------------------------------------------
     U11. REVISION POSTERS — up to 4 landscape A4 pages that cover a
          reading, laid out as infographics (tile grid, flow map, mind map,
          timeline + case table; Claude picks the best mix), with a
          coverage check so nothing important is left out:
            1. INVENTORY  every point in the sources, page by page, each
                          with a priority (must / should / detail)
            2. PLAN       which page and layout each point goes on
            3. PAGE       each page written from its own points + pages
            4. CHECK      a separate pass compares each page with its
                          points and the source; FIX repairs it, CHECK
                          runs again; anything still missing is put back
                          in the page's "Also know" strip, word for word
                          from the inventory
            5. OUTCOMES   learning outcomes (if the reading lists them)
          Replaces the long "Standard" notes; older notes still open.
          Stored with the same rdoc / rdocpart storage (kind 'poster').
     ------------------------------------------------------------------ */
  var PS_STYLES = { tiles: 'Tile grid', flow: 'Flow map', mindmap: 'Mind map', cases: 'Timeline + case table' };
  var PS_TYPES = ['principle', 'test', 'case', 'statute', 'exception', 'definition', 'outcome'];
  var PS_PAL = ['#2f4b8f', '#6b3fa0', '#0f7a7a', '#c0582a', '#2b8a4e', '#8a5a00'];
  var PS_C = { ink: '#1d2433', muted: '#6a7286', line: '#d8dce5', soft: '#f3f4f8', red: '#c8372d', redBg: '#fdecea', green: '#2b8a4e', greenBg: '#e7f4ec', amber: '#b06a00', amberBg: '#fff4dc' };
  var PS_SRC_MAX = 40000;        // source characters sent with each page call
  var psBlobs = {};              // id → PDF blob (made on demand)

  var PS_RULES = [
    'You are making printable revision posters for a law conversion (PGDL) student. At most 4 landscape A4 pages must cover EVERYTHING important in the reading, so the student can trust the posters instead of re-reading the chapter.',
    'RULES:',
    '- Use ONLY the source pages given. Never invent a case, citation, year, court or section number. Copy names and citations as the source gives them; leave a citation empty if the source gives none.',
    '- Only if something essential is missing from the source may you add it, if you are certain, with "added": true. If unsure of a detail, set "unverified": true rather than guess.',
    '- UK spelling. Short, plain, exam-focused phrases, not prose. No markdown, no emojis.'
  ].join('\n');

  function psLine(it) { return it.id + ' [' + it.type + '|' + it.pri + '] ' + it.name + (it.cite ? ' ' + it.cite : '') + ' — ' + it.point + (it.topic ? ' (' + it.topic + ')' : '') + (it.page ? ' {' + it.page + '}' : ''); }

  function inventoryPrompt(chunk, srcTitles, part, of) {
    return [
      'REVISION POSTERS — INVENTORY' + (of > 1 ? ' (part ' + part + ' of ' + of + ' of the reading)' : ''),
      PS_RULES, '',
      'List EVERY point a student must know from these pages: every principle or rule, every legal test (one item per test, naming its elements), every case named anywhere (even in passing or in footnotes), every statute section, every exception or qualification, every key definition, and every learning outcome (only if the pages list learning outcomes; copy them word for word). Miss nothing: this list is used afterwards to prove the posters are complete.',
      'Priority: "must" = core rules, tests and leading cases that almost any exam answer on this topic needs; "should" = important supporting cases, exceptions and qualifications; "detail" = passing mentions, illustrations and minor points.',
      'Reply with ONLY JSON: {"title": "short title for the posters", "items": [{"type": "principle|test|case|statute|exception|definition|outcome", "name": "short label (a case name exactly as the source gives it)", "cite": "citation if the source gives one", "point": "the point in one short sentence (for a case: what it decided and why it matters)", "topic": "sub-topic", "page": "page ref like S1:4", "pri": "must|should|detail"}]}',
      'Use the page refs exactly as written in the markers at the start of each page.',
      '', 'SOURCES: ' + srcTitles, '', pagesText(chunk)
    ].join('\n');
  }
  function posterPlanPrompt(items, title) {
    return [
      'REVISION POSTERS — PLAN',
      PS_RULES, '',
      'Below is the complete list of points from the reading: id [type|priority] label — point (sub-topic) {page}.',
      'Plan 1 to 4 landscape posters that between them cover every point. Use fewer pages for short readings (roughly one page per 25-35 points; never more than 4). Choose the best layout for each page and mix layouts across the set:',
      '- "tiles": an overview grid of 2-5 coloured columns, one per element or sub-topic, each with its test, key cases and an exam trap. Best for the first page.',
      '- "flow": boxes and arrows in the order a legal test is applied, with exceptions branching off. Best for step-by-step tests.',
      '- "mindmap": one central idea with 4-8 branches, one per factor or category. Best for factors a court weighs.',
      '- "cases": a timeline plus a table with every case on one row (facts, held, use it when). Best for case-heavy sub-topics.',
      'Every id except learning outcomes must be assigned to exactly one page. Keep each sub-topic together.',
      'Reply with ONLY JSON: {"title": "' + (title ? title.replace(/"/g, "'") : 'short title') + '", "pages": [{"style": "tiles|flow|mindmap|cases", "title": "page title", "focus": "what this page covers", "ids": ["i1", "i2"]}]}',
      '', 'POINTS:', items.map(psLine).join('\n')
    ].join('\n');
  }
  var PS_PAGE_SHAPE = '{"title": "", "subtitle": "one line on how to use this page",' +
    ' "hub": {"heading": "", "text": "", "points": []},' +
    ' "blocks": [{"label": "short tag, e.g. STEP 1, ELEMENT 2, YES, NO, EXCEPTION", "kind": "step|yes|no|branch", "heading": "", "test": "the test in one line (optional)", "points": [POINT], "trap": "optional exam trap", "ids": ["i3"]}],' +
    ' "timeline": [{"year": "", "name": "short case name", "tag": "2-4 word point"}],' +
    ' "rows": [{"group": "sub-topic", "name": "case name", "cite": "", "facts": "one line", "held": "one line", "use": "use it when ...", "tag": "optional 1-2 word tag, e.g. CORE, NARROW", "ids": ["i7"], "added": false, "unverified": false}],' +
    ' "strip": [{"heading": "e.g. Statutes, Answer structure, Defences", "text": "", "ids": []}],' +
    ' "traps": ["exam trap"], "tips": ["exam tip"],' +
    ' "also": [{"name": "", "point": "one line", "ids": ["i9"]}]}' +
    '\nPOINT = {"lead": "bold lead-in (optional)", "case": "case name (optional)", "cite": "citation (optional)", "text": "", "ids": ["i2"], "added": false, "unverified": false}';
  var PS_STYLE_HELP = {
    tiles: 'Layout "tiles": "blocks" are 2-5 columns side by side (one per element or sub-topic), each with "test", 2-6 points and a "trap" where useful. "strip": up to 3 small boxes along the bottom (e.g. statutes, answer structure, defences). Leave "hub", "timeline" and "rows" empty.',
    flow: 'Layout "flow": "blocks" are boxes joined by arrows in the order the test is applied (kind "step", or "yes" / "no" for outcome boxes), then exceptions or special rules with kind "branch". 4-10 short blocks. Leave "hub", "timeline" and "rows" empty.',
    mindmap: 'Layout "mindmap": "hub" is the central idea (its test and leading authority); "blocks" are 4-8 branches around it, one per factor or category. Leave "timeline" and "rows" empty.',
    cases: 'Layout "cases": "timeline" has up to 10 key cases in date order (only years the source gives); "rows" has one row per case, grouped by sub-topic ("group"). "blocks" may hold 0-3 short boxes for rules that are not cases. Leave "hub" empty.'
  };
  function posterPagePrompt(pg, n, of, items, others, pages) {
    return [
      'REVISION POSTERS — PAGE ' + n + ' of ' + of + ': ' + pg.title,
      PS_RULES, '',
      'Write this poster page. ' + PS_STYLE_HELP[pg.style],
      'It must fit on ONE landscape A4 page when printed: about 380-480 words in total. Weigh and prioritise: "must" points get full treatment (rule + authority + why it matters); "should" points get a short line; "detail" points go in "also" as one-liners. Never drop a point to save space: shorten it instead.',
      'Every id listed below must appear in the "ids" of at least one block, point, row or "also" entry, and every case must be named. Add 1-2 exam traps and 1-2 exam tips.',
      'Reply with ONLY JSON in this shape (omit nothing, use empty values where a part is not used):', PS_PAGE_SHAPE,
      '', 'POINTS FOR THIS PAGE:', items.map(psLine).join('\n'),
      others.length ? '\nOTHER PAGES COVER (do not repeat them): ' + others.join('; ') : '',
      '', 'SOURCE PAGES:', pagesText(pages)
    ].join('\n');
  }
  function posterCheckPrompt(items, pageText, pages) {
    return [
      'REVISION POSTERS — CHECK',
      'You are checking one revision poster page against the list of points it must cover and against the source pages. Be strict: the student will rely on this poster instead of the reading.',
      'For each point: report it as "missing" if the poster does not state it, or compresses it so much that the rule or the case\'s significance is lost. Report it as "wrong" if the poster misstates the law compared with the source (wrong case for a rule, wrong outcome, wrong section, wrong element of a test).',
      'Reply with ONLY JSON: {"missing": ["i4"], "wrong": [{"id": "i6", "issue": "what is wrong and what the source says"}]}',
      '', 'POINTS:', items.map(psLine).join('\n'),
      '', 'POSTER (ids in square brackets show which point each part covers):', pageText,
      '', 'SOURCE PAGES:', pagesText(pages)
    ].join('\n');
  }
  function posterFixPrompt(pg, missing, wrong, pages) {
    return [
      'REVISION POSTERS — FIX',
      PS_RULES, '',
      'Fix this poster page. Add every missing point and correct every wrong one, keeping the same layout and still fitting on ONE landscape A4 page (shorten lower-priority wording to make room; never drop a point). Put each point\'s id in the "ids" of the part that covers it.',
      missing.length ? 'MISSING:\n' + missing.map(psLine).join('\n') : '',
      wrong.length ? 'WRONG:\n' + wrong.map(function (w) { return psLine(w.item) + '\n   Problem: ' + w.issue; }).join('\n') : '',
      'Reply with ONLY JSON: the whole page in the same shape as below.',
      '', 'PAGE:', JSON.stringify(pg.content),
      '', 'SOURCE PAGES:', pagesText(pages)
    ].join('\n');
  }
  function posterOutcomesPrompt(outcomes, text) {
    return [
      'REVISION POSTERS — OUTCOMES',
      'For each learning outcome, decide whether these posters give a student what they need to achieve it, and say where (page number and box). If something is missing, say exactly what.',
      'Reply with ONLY JSON: {"outcomes": [{"n": 1, "covered": true, "where": "Page 1 · box name", "note": "what is missing, if anything"}]}',
      '', 'OUTCOMES:', outcomes.map(function (o, i) { return (i + 1) + '. ' + o.name; }).join('\n'),
      '', 'POSTERS:', text
    ].join('\n');
  }

  /* ---- cleaning ---- */
  function psIds(v) { return (Array.isArray(v) ? v : []).map(function (x) { return s_(x, 20).replace(/[^\w]/g, ''); }).filter(Boolean).slice(0, 60); }
  function psPoint(p) {
    if (typeof p === 'string') p = { text: p };
    if (!p || typeof p !== 'object') return null;
    var o = { lead: s_(p.lead, 120), case: s_(p.case, 200), cite: s_(p.cite, 120), text: s_(p.text, 500), ids: psIds(p.ids), added: p.added === true, unverified: p.unverified === true, notFound: p.notFound === true };
    return o.lead || o.case || o.text ? o : null;
  }
  function psBlock(b) {
    if (!b || typeof b !== 'object') return null;
    var o = { label: s_(b.label, 40), kind: ['step', 'yes', 'no', 'branch'].indexOf(b.kind) !== -1 ? b.kind : 'step', heading: s_(b.heading, 160), test: s_(b.test, 400), text: s_(b.text, 500),
      points: (Array.isArray(b.points) ? b.points : []).map(psPoint).filter(Boolean).slice(0, 12), trap: s_(b.trap, 300), ids: psIds(b.ids) };
    return o.heading || o.points.length || o.test || o.text ? o : null;
  }
  function psContent(c, style) {
    c = c && typeof c === 'object' ? c : {};
    var hub = c.hub && typeof c.hub === 'object' ? { heading: s_(c.hub.heading, 120), text: s_(c.hub.text, 400), points: (Array.isArray(c.hub.points) ? c.hub.points : []).map(psPoint).filter(Boolean).slice(0, 4), ids: psIds(c.hub.ids) } : null;
    return {
      title: s_(c.title, 120), subtitle: s_(c.subtitle, 200),
      hub: style === 'mindmap' && hub && (hub.heading || hub.text) ? hub : null,
      blocks: (Array.isArray(c.blocks) ? c.blocks : []).map(psBlock).filter(Boolean).slice(0, 12),
      timeline: style === 'cases' ? (Array.isArray(c.timeline) ? c.timeline : []).map(function (t) { return t && s_(t.name) ? { year: s_(t.year, 12), name: s_(t.name, 60), tag: s_(t.tag, 50) } : null; }).filter(Boolean).slice(0, 10) : [],
      rows: (Array.isArray(c.rows) ? c.rows : []).map(function (r) { return r && s_(r.name) ? { group: s_(r.group, 40), name: s_(r.name, 200), cite: s_(r.cite, 120), facts: s_(r.facts, 300), held: s_(r.held, 300), use: s_(r.use, 300), tag: s_(r.tag, 20), ids: psIds(r.ids), added: r.added === true, unverified: r.unverified === true, notFound: r.notFound === true } : null; }).filter(Boolean).slice(0, 24),
      strip: (Array.isArray(c.strip) ? c.strip : []).map(function (x) { return x && (s_(x.heading) || s_(x.text)) ? { heading: s_(x.heading, 60), text: s_(x.text, 500), ids: psIds(x.ids) } : null; }).filter(Boolean).slice(0, 3),
      traps: arr(c.traps, 3, 300), tips: arr(c.tips, 3, 300),
      also: (Array.isArray(c.also) ? c.also : []).map(function (a) { return a && s_(a.name) ? { name: s_(a.name, 160), point: s_(a.point, 300), ids: psIds(a.ids), restored: a.restored === true } : null; }).filter(Boolean).slice(0, 40)
    };
  }
  function cleanPoster(d) {
    var items = (Array.isArray(d.items) ? d.items : []).map(function (it) {
      if (!it || !s_(it.name) || !s_(it.id)) return null;
      return { id: s_(it.id, 20), type: PS_TYPES.indexOf(it.type) !== -1 ? it.type : 'principle', name: s_(it.name, 300), cite: s_(it.cite, 160), point: s_(it.point, 500), topic: s_(it.topic, 120), page: s_(it.page, 20),
        pri: ['must', 'should', 'detail'].indexOf(it.pri) !== -1 ? it.pri : 'should', status: ['full', 'short', 'restored', 'flag', 'outcome'].indexOf(it.status) !== -1 ? it.status : 'full', where: s_(it.where, 160), issue: s_(it.issue, 400), notFound: it.notFound === true };
    }).filter(Boolean);
    return {
      v: 2, kind: 'poster', id: s_(d.id, 80) || uid('ps'), title: s_(d.title, 200) || 'Revision posters', module: MODULE_LABEL[d.module] ? d.module : '', createdAt: d.createdAt || nowISO(),
      sources: Array.isArray(d.sources) ? d.sources.slice(0, 20).map(function (x) { return { id: s_(x && x.id, 120), title: s_(x && x.title, 200) }; }) : [],
      pages: (Array.isArray(d.pages) ? d.pages : []).slice(0, 4).map(function (p) { var st = PS_STYLES[p && p.style] ? p.style : 'tiles'; return { style: st, title: s_(p && p.title, 120), content: psContent(p && p.content, st) }; }),
      items: items,
      outcomes: (Array.isArray(d.outcomes) ? d.outcomes : []).map(function (o) { return o && s_(o.outcome) ? { outcome: s_(o.outcome, 600), covered: o.covered !== false, where: s_(o.where, 200), note: s_(o.note, 600) } : null; }).filter(Boolean),
      checks: Math.max(0, Math.round(num(d.checks, 0)))
    };
  }

  /* ---- where each point ended up ---- */
  // Every place on a page that can carry ids, with a readable location and its text.
  function psParts(c, n) {
    var out = [], pre = 'Page ' + n + ' · ';
    var ptxt = function (p) { return [p.lead, p.case, p.cite, p.text].filter(Boolean).join(' '); };
    if (c.hub) out.push({ ids: c.hub.ids.concat.apply(c.hub.ids, c.hub.points.map(function (p) { return p.ids; })), where: pre + 'centre', full: true, text: [c.hub.heading, c.hub.text].concat(c.hub.points.map(ptxt)).join(' ') });
    c.blocks.forEach(function (b) {
      var name = pre + (b.heading || b.label || 'box');
      out.push({ ids: b.ids, where: name, full: true, text: [b.label, b.heading, b.test, b.text, b.trap].concat(b.points.map(ptxt)).join(' ') });
      b.points.forEach(function (p) { out.push({ ids: p.ids, where: name, full: true, text: ptxt(p) }); });
    });
    c.rows.forEach(function (r) { out.push({ ids: r.ids, where: pre + 'case table', full: true, text: [r.name, r.cite, r.facts, r.held, r.use].join(' ') }); });
    c.strip.forEach(function (s) { out.push({ ids: s.ids, where: pre + (s.heading || 'bottom strip'), full: true, text: s.heading + ' ' + s.text }); });
    c.also.forEach(function (a) { out.push({ ids: a.ids, where: pre + 'Also know', full: false, restored: a.restored, text: a.name + ' ' + a.point }); });
    return out;
  }
  function psPageText(c) {
    var L = [c.title, c.subtitle];
    var pt = function (p) { return '- ' + [p.lead, p.case, p.cite, p.text].filter(Boolean).join(' ') + (p.ids.length ? ' [' + p.ids.join(',') + ']' : ''); };
    if (c.hub) L.push('CENTRE: ' + c.hub.heading + ' — ' + c.hub.text, c.hub.points.map(pt).join('\n'));
    c.blocks.forEach(function (b) { L.push('BOX ' + [b.label, b.heading].filter(Boolean).join(': ') + (b.ids.length ? ' [' + b.ids.join(',') + ']' : '') + (b.test ? '\n  Test: ' + b.test : '') + (b.text ? '\n  ' + b.text : '') + (b.points.length ? '\n' + b.points.map(pt).join('\n') : '') + (b.trap ? '\n  Trap: ' + b.trap : '')); });
    if (c.rows.length) L.push('CASE TABLE:\n' + c.rows.map(function (r) { return '- ' + r.name + ' ' + r.cite + ' | ' + r.facts + ' | ' + r.held + ' | ' + r.use + (r.ids.length ? ' [' + r.ids.join(',') + ']' : ''); }).join('\n'));
    c.strip.forEach(function (s) { L.push(s.heading + ': ' + s.text + (s.ids.length ? ' [' + s.ids.join(',') + ']' : '')); });
    if (c.traps.length) L.push('Traps: ' + c.traps.join(' | '));
    if (c.tips.length) L.push('Tips: ' + c.tips.join(' | '));
    if (c.also.length) L.push('ALSO KNOW:\n' + c.also.map(function (a) { return '- ' + a.name + ': ' + a.point + (a.ids.length ? ' [' + a.ids.join(',') + ']' : ''); }).join('\n'));
    return L.filter(Boolean).join('\n');
  }
  // Is this point really on the page? Its id must be there, and for a case or statute its name must be too.
  function psFind(it, parts) {
    var key = it.type === 'case' || it.type === 'statute';
    var hits = parts.filter(function (p) { return p.ids.indexOf(it.id) !== -1 && (!key || rnInSources(it.name, ' ' + normText(p.text) + ' ')); });
    if (!hits.length && key) hits = parts.filter(function (p) { return rnInSources(it.name, ' ' + normText(p.text) + ' ') && normText(it.name).length >= 6; });
    if (!hits.length) return null;
    var full = hits.filter(function (h) { return h.full; })[0];
    return full ? { where: full.where, status: 'full' } : { where: hits[0].where, status: hits[0].restored ? 'restored' : 'short' };
  }

  /* ---- writing a set ---- */
  function startPoster() {
    var ids = rn.sel.slice();
    if (!ids.length) { toast('Tick at least one source.'); return; }
    if (!claudeCaps.sample) { toast('Posters are written by Claude, which works when the app is opened in claude.ai.', { type: 'error' }); return; }
    var job = rn.job = { ctl: new AbortController(), steps: [], error: '', done: false };
    rn.view = 'gen'; renderRn();
    var step = function (label) { var s = { label: label, state: 'run' }; job.steps.push(s); renderRnProgress(); return s; };
    var ask = function (prompt, s) {
      var go = function (tries) {
        return claudeCaps.sample.json(prompt, { signal: job.ctl.signal, cache: false }).then(null, function (err) {
          if (err && err.code === 'cancelled') throw err;
          if (tries < 1 && (!err || err.code === 'invalid_json' || err.code === 'unavailable' || err.code === 'rate_limited')) return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return go(tries + 1); });
          throw err;
        });
      };
      return go(0).then(function (r) { if (s) s.state = 'ok'; renderRnProgress(); return r; }, function (err) { if (s) s.state = 'bad'; renderRnProgress(); throw err; });
    };
    var pool = function (tasks) {
      var i = 0, results = [];
      var worker = function () { if (job.ctl.signal.aborted || i >= tasks.length) return Promise.resolve(); var k = i++; return tasks[k]().then(function (r) { results[k] = r; }, function (e) { if (e && e.code === 'cancelled') throw e; results[k] = { error: e }; }).then(worker); };
      return Promise.all([worker(), worker()]).then(function () { return results; });
    };
    var srcs, pages, norm, items = [], byId = {}, outcomes = [], doc, title = '';
    var s0 = step('Reading your sources');
    Promise.all(ids.map(function (id) { return loadSourceText(id).then(function (t) { var m = sourceById(id); return { id: id, title: m ? m.title : id, module: m ? m.module : '', text: t || '' }; }); })).then(function (list) {
      srcs = list.filter(function (s) { return s.text.trim(); });
      if (!srcs.length) throw { code: 'empty', message: 'Those sources have no text to work from.' };
      pages = rnPages(srcs);
      norm = ' ' + normText(srcs.map(function (s) { return s.text; }).join(' ')) + ' ';
      s0.state = 'ok';
      var chunks = rnChunks(pages), titles = srcs.map(function (s, i) { return 'S' + (i + 1) + ' = ' + s.title; }).join('; ');
      return pool(chunks.map(function (c, i) { var s = step('Listing every point in your sources' + (chunks.length > 1 ? ' (part ' + (i + 1) + ' of ' + chunks.length + ')' : '')); return function () { return ask(inventoryPrompt(c, titles, i + 1, chunks.length), s); }; }));
    }).then(function (res) {
      var good = res.filter(function (r) { return r && !r.error && Array.isArray(r.items); });
      if (good.length < res.length) throw (res.filter(function (r) { return r && r.error; })[0] || {}).error || { code: 'invalid_json' };
      // Merge the lists; the same case or statute named in two parts is one point.
      var seen = {};
      good.forEach(function (r) {
        if (!title) title = s_(r.title, 200);
        r.items.forEach(function (x) {
          if (!x || !s_(x.name)) return;
          var type = PS_TYPES.indexOf(x.type) !== -1 ? x.type : 'principle';
          var k = type + ':' + normText(x.name) + (type === 'case' || type === 'statute' ? '' : ':' + normText(x.point).slice(0, 60));
          if (seen[k]) { if (x.pri === 'must') seen[k].pri = 'must'; return; }
          var it = { id: 'i' + (items.length + outcomes.length + 1), type: type, name: s_(x.name, 300), cite: s_(x.cite, 160), point: s_(x.point, 500), topic: s_(x.topic, 120), page: s_(x.page, 20).replace(/\s+/g, ''),
            pri: ['must', 'should', 'detail'].indexOf(x.pri) !== -1 ? x.pri : 'should' };
          seen[k] = it; byId[it.id] = it;
          (type === 'outcome' ? outcomes : items).push(it);
        });
      });
      if (!items.length) throw { code: 'empty', message: 'Claude couldn\'t find any points in those sources.' };
      var sp = step('Planning the posters (' + plural(items.length, 'point') + ' to cover)');
      return ask(posterPlanPrompt(items, rn.title), sp);
    }).then(function (plan) {
      var pl = (Array.isArray(plan && plan.pages) ? plan.pages : []).slice(0, 4).map(function (p) { return { style: PS_STYLES[p && p.style] ? p.style : 'tiles', title: s_(p && p.title, 120) || 'Page', ids: psIds(p && p.ids).filter(function (id) { return byId[id] && byId[id].type !== 'outcome'; }) }; });
      if (!pl.length) pl = [{ style: 'tiles', title: title || 'Overview', ids: [] }];
      // Any point the plan forgot goes on the page that already holds most of its sub-topic.
      var placed = {}; pl.forEach(function (p) { p.ids = p.ids.filter(function (id) { if (placed[id]) return false; placed[id] = true; return true; }); });
      items.forEach(function (it) {
        if (placed[it.id]) return;
        var best = 0, score = -1;
        pl.forEach(function (p, i) { var n = p.ids.filter(function (id) { return byId[id].topic && byId[id].topic === it.topic; }).length; if (n > score) { score = n; best = i; } });
        pl[best].ids.push(it.id); placed[it.id] = true;
      });
      pl = pl.filter(function (p) { return p.ids.length; });
      if (!rn.title) title = s_(plan && plan.title, 200) || title;
      doc = { id: uid('ps'), title: rn.title || title, module: srcs.map(function (s) { return s.module; }).filter(Boolean)[0] || '', createdAt: nowISO(),
        sources: srcs.map(function (s) { return { id: s.id, title: s.title }; }), pages: [], items: items.concat(outcomes), outcomes: [], checks: 0 };
      // Write, check and (if needed) fix each page, two at a time.
      return pool(pl.map(function (p, i) {
        var mine = p.ids.map(function (id) { return byId[id]; });
        var others = pl.filter(function (q, j) { return j !== i; }).map(function (q) { return q.title; });
        var src = pagesFor(pages, mine.map(function (it) { return it.page; }), mine.map(function (it) { return it.name + ' ' + it.topic; })).filter(function (x, k, all) { return all.slice(0, k + 1).reduce(function (n, y) { return n + y.text.length; }, 0) <= PS_SRC_MAX; });
        var sw = step('Writing page ' + (i + 1) + ': ' + p.title + ' (' + PS_STYLES[p.style].toLowerCase() + ')');
        return function () {
          var pg = { style: p.style, title: p.title, content: null };
          var check = function (label) {
            var parts = psParts(pg.content, i + 1);
            var sc = step(label);
            // If Claude's check fails, our own check below still runs.
            return ask(posterCheckPrompt(mine, psPageText(pg.content), src), sc).then(null, function (err) { if (err && err.code === 'cancelled') throw err; return {}; }).then(function (r) {
              doc.checks++;
              var miss = psIds(r && r.missing).filter(function (id) { return byId[id] && p.ids.indexOf(id) !== -1; });
              // Also count anything our own check can't find on the page, whatever Claude said.
              mine.forEach(function (it) { if (!psFind(it, parts) && miss.indexOf(it.id) === -1) miss.push(it.id); });
              var wrong = (Array.isArray(r && r.wrong) ? r.wrong : []).map(function (w) { var id = s_(w && w.id, 20); return byId[id] && p.ids.indexOf(id) !== -1 ? { item: byId[id], issue: s_(w.issue, 400) } : null; }).filter(Boolean);
              return { missing: miss.map(function (id) { return byId[id]; }), wrong: wrong };
            });
          };
          return ask(posterPagePrompt(p, i + 1, pl.length, mine, others, src), sw).then(function (r) {
            pg.content = psContent(r, p.style);
            return check('Checking page ' + (i + 1) + ' against your sources');
          }).then(function (res) {
            if (!res.missing.length && !res.wrong.length) return res;
            var sf = step('Fixing page ' + (i + 1) + ' (' + [res.missing.length ? plural(res.missing.length, 'missing point') : '', res.wrong.length ? plural(res.wrong.length, 'correction') : ''].filter(Boolean).join(', ') + ')');
            return ask(posterFixPrompt(pg, res.missing, res.wrong, src), sf).then(function (fixed) {
              var c = psContent(fixed, p.style);
              if (c.blocks.length || c.rows.length || c.hub) pg.content = c;
              return check('Checking page ' + (i + 1) + ' again');
            }, function (err) { if (err && err.code === 'cancelled') throw err; return res; });
          }).then(function (res) {
            // Last resort: whatever is still missing goes into "Also know", word for word from the list of points.
            res.missing.forEach(function (it) { pg.content.also.push({ name: it.name + (it.cite ? ' ' + it.cite : ''), point: it.point, ids: [it.id], restored: true }); });
            res.wrong.forEach(function (w) {
              w.item.issue = w.issue;
              pg.content.also.push({ name: w.item.name + (w.item.cite ? ' ' + w.item.cite : ''), point: w.item.point, ids: [w.item.id], restored: true });
            });
            doc.pages[i] = pg;
          }, function (err) {
            if (err && err.code === 'cancelled') throw err;
            // The page couldn't be written: keep every point anyway, as a plain list.
            sw.state = 'bad'; renderRnProgress();
            pg.content = psContent({ title: p.title, subtitle: 'Claude couldn\'t lay this page out, so here are its points from your sources.', also: mine.map(function (it) { return { name: it.name + (it.cite ? ' ' + it.cite : ''), point: it.point, ids: [it.id], restored: true }; }) }, p.style);
            doc.pages[i] = pg;
          });
        };
      }));
    }).then(function () {
      doc.pages = doc.pages.filter(Boolean);
      // Final coverage: where did every point end up?
      var parts = [].concat.apply([], doc.pages.map(function (p, i) { return psParts(p.content, i + 1); }));
      var sf = step('Final coverage check');
      doc.items.forEach(function (it) {
        if (it.type === 'outcome') { it.status = 'outcome'; return; }
        var f = psFind(it, parts);
        if (it.issue) { it.status = 'flag'; it.where = f ? f.where : ''; }
        else if (f) { it.status = f.status; it.where = f.where; }
        else { // cannot happen after the restore step, but never let a point vanish silently
          var last = doc.pages[doc.pages.length - 1];
          last.content.also.push({ name: it.name, point: it.point, ids: [it.id], restored: true });
          it.status = 'restored'; it.where = 'Page ' + doc.pages.length + ' · Also know';
        }
        if ((it.type === 'case' || it.type === 'statute') && !rnInSources(it.name, norm)) it.notFound = true;
      });
      // Flag any case on the posters that isn't in the sources.
      doc.pages.forEach(function (p) {
        p.content.blocks.forEach(function (b) { b.points.forEach(function (pt) { if (pt.case && !rnInSources(pt.case, norm)) pt.notFound = true; }); });
        if (p.content.hub) p.content.hub.points.forEach(function (pt) { if (pt.case && !rnInSources(pt.case, norm)) pt.notFound = true; });
        p.content.rows.forEach(function (r) { if (!rnInSources(r.name, norm)) r.notFound = true; });
      });
      sf.state = 'ok';
      if (!outcomes.length) return;
      var so = step('Checking your learning outcomes');
      return ask(posterOutcomesPrompt(outcomes, doc.pages.map(function (p, i) { return 'PAGE ' + (i + 1) + '\n' + psPageText(p.content); }).join('\n\n')), so).then(function (r) {
        var got = Array.isArray(r && r.outcomes) ? r.outcomes : [];
        doc.outcomes = outcomes.map(function (o, i) { var g = got.filter(function (x) { return x && Math.round(num(x.n, 0)) === i + 1; })[0] || got[i] || {}; return { outcome: o.name, covered: g.covered !== false && !!(g.where || g.covered), where: s_(g.where, 200), note: s_(g.note, 600) }; });
      }, function (err) { if (err && err.code === 'cancelled') throw err; doc.outcomes = outcomes.map(function (o) { return { outcome: o.name, covered: false, where: '', note: 'Not checked.' }; }); });
    }).then(function () {
      doc = cleanPoster(doc);
      if (!doc.title) doc.title = srcs.map(function (s) { return s.title; }).join(' + ').slice(0, 200);
      var vs = step('Saving to your Revision posters');
      return saveRnDoc(doc).then(function () { vs.state = 'ok'; job.done = true; rn.doc = doc; rn.view = 'view'; renderRn(); renderRnCount();
        toast('Posters ready: “' + doc.title + '”.', { type: 'success' }); });
    }).then(null, function (err) {
      if (err && err.code === 'cancelled') return;
      if (err && (err.code === 'not_granted' || err.code === 'sampling_disabled')) claudeCaps.sample = null;
      job.error = err && err.message && err.code === 'empty' ? err.message : sampleErrorText(err);
      renderRnProgress();
    });
  }

  /* ---- coverage summary ---- */
  function psStats(d) {
    var pts = d.items.filter(function (it) { return it.type !== 'outcome'; });
    var c = function (st) { return pts.filter(function (it) { return it.status === st; }).length; };
    return { found: pts.length, full: c('full'), short: c('short'), restored: c('restored'), flag: c('flag'), notFound: pts.filter(function (it) { return it.notFound; }).length,
      must: pts.filter(function (it) { return it.pri === 'must'; }).length, mustFull: pts.filter(function (it) { return it.pri === 'must' && it.status === 'full'; }).length,
      outcomes: d.outcomes.length, outcomesOk: d.outcomes.filter(function (o) { return o.covered; }).length };
  }
  var PS_STATUS = { full: ['✓ on the poster', 'ok'], short: ['✓ one line (Also know)', 'ok'], restored: ['✓ put back by the check', 'warn'], flag: ['⚠ check this', 'bad'] };
  function posterCoverageHTML(d) {
    var st = psStats(d), pr = { must: 0, should: 1, detail: 2 };
    var rows = d.items.filter(function (it) { return it.type !== 'outcome'; }).slice().sort(function (a, b) { return pr[a.pri] - pr[b.pri] || a.id.localeCompare(b.id, 'en', { numeric: true }); });
    return '<div class="ps-sum">' +
      '<div><b>' + st.found + '</b><span>points found in your sources</span></div>' +
      '<div class="good"><b>' + (st.full + st.short + st.restored + st.flag) + '/' + st.found + '</b><span>on the posters</span></div>' +
      '<div class="good"><b>' + st.mustFull + '/' + st.must + '</b><span>must-know points in full</span></div>' +
      '<div' + (st.restored ? ' class="warn"' : '') + '><b>' + st.restored + '</b><span>left out at first, put back by the check</span></div>' +
      '<div' + (st.flag || st.notFound ? ' class="bad"' : '') + '><b>' + (st.flag + st.notFound) + '</b><span>to check yourself</span></div>' +
      (st.outcomes ? '<div' + (st.outcomesOk < st.outcomes ? ' class="warn"' : ' class="good"') + '><b>' + st.outcomesOk + '/' + st.outcomes + '</b><span>learning outcomes covered</span></div>' : '') + '</div>' +
      '<details class="ps-cov"' + (st.flag || st.notFound ? ' open' : '') + '><summary>Coverage check: every point found in your sources, and where it is on the posters</summary>' +
      '<div class="ps-table"><div class="ps-tr ps-th"><span>Point</span><span>Type</span><span>Priority</span><span>Source</span><span>Where on the posters</span><span>Status</span></div>' +
      rows.map(function (it) {
        var s = PS_STATUS[it.status] || PS_STATUS.full;
        return '<div class="ps-tr"><span><b>' + esc(it.name) + '</b>' + (it.point ? '<small>' + esc(it.point) + '</small>' : '') + (it.issue ? '<small class="bad">Check: ' + esc(it.issue) + '</small>' : '') + (it.notFound ? '<small class="bad">Not found in your sources — check</small>' : '') + '</span>' +
          '<span>' + esc(it.type) + '</span><span><i class="ps-pr ' + it.pri + '">' + it.pri.toUpperCase() + '</i></span><span>' + esc(it.page) + '</span><span>' + esc(it.where) + '</span><span class="' + s[1] + '">' + s[0] + '</span></div>';
      }).join('') + '</div>' +
      (d.outcomes.length ? '<h4 class="rn-sub">Learning outcomes</h4><div class="ps-table ps-out">' + d.outcomes.map(function (o) { return '<div class="ps-tr"><span>' + esc(o.outcome) + '</span><span class="' + (o.covered ? 'ok' : 'warn') + '">' + (o.covered ? '✓ ' : '⚠ ') + esc(o.where || (o.covered ? 'Covered' : 'Not fully covered')) + '</span><span>' + esc(o.note) + '</span></div>'; }).join('') + '</div>' : '') +
      '</details>';
  }
  function posterViewHTML(d) {
    return '<div class="ps-view"><div class="rn-cover"><h2>' + esc(d.title) + '</h2><p>' + (d.module ? esc(MODULE_LABEL[d.module]) + ' · ' : '') + plural(d.pages.length, 'page') + ' (' + d.pages.map(function (p) { return PS_STYLES[p.style]; }).join(', ') + ') · From: ' + esc(d.sources.map(function (s) { return s.title; }).join(', ')) + '</p></div>' +
      posterCoverageHTML(d) + '<div class="ps-preview" id="psPreview"><p class="muted"><span class="spinner"></span>Drawing the posters…</p></div></div>';
  }
  // Show the real PDF pages in the app (drawn by pdf.js, which the app already uses to read PDFs).
  function previewPoster(d) {
    var box = $('#psPreview'); if (!box) return;
    posterBlob(d).then(function (blob) { return blob.arrayBuffer(); }).then(function (buf) {
      return loadScript(LIBS.pdfWorker).then(function () { return loadScript(LIBS.pdf); }).then(function () { return window.pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise; });
    }).then(function (pdf) {
      if (!$('#psPreview')) return;
      box.innerHTML = '';
      var w = Math.max(320, box.clientWidth || 800), n = 0;
      var next = function () {
        if (++n > pdf.numPages || !document.body.contains(box)) return;
        return pdf.getPage(n).then(function (pg) {
          var vp0 = pg.getViewport({ scale: 1 }), sc = w / vp0.width, dpr = Math.min(2, window.devicePixelRatio || 1), vp = pg.getViewport({ scale: sc * dpr });
          var cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; cv.style.width = '100%'; cv.className = 'ps-page';
          box.appendChild(cv);
          return pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        }).then(next);
      };
      return next();
    }).then(null, function () { if ($('#psPreview')) box.innerHTML = '<p class="muted">The preview couldn\'t be drawn here, but the PDF download still works.</p>'; });
  }

  /* ---- the PDF: one landscape A4 page per poster ---- */
  var PS_W = 841.89 - 52;        // content width (A4 landscape, 26pt margins)
  function psRuns(p, s, acc) {
    var r = [];
    if (p.lead) r.push({ text: p.lead + (p.case || p.text ? ': ' : ''), bold: true });
    if (p.case) r.push({ text: p.case, bold: true, italics: true });
    if (p.cite) r.push({ text: ' ' + p.cite, fontSize: 6.8 * s, color: acc === '#fff' ? '#e6e9f2' : PS_C.muted });
    if (p.case && p.text) r.push({ text: ': ' });
    if (p.text) r.push({ text: p.text });
    return r.concat(psFlags(p, s));
  }
  function psFlags(x, s) {
    var out = [];
    if (x.added) out.push({ text: '  (added, not in your reading)', italics: true, color: PS_C.amber, fontSize: 7 * s });
    if (x.unverified) out.push({ text: '  (unverified)', italics: true, color: PS_C.amber, fontSize: 7 * s });
    if (x.notFound) out.push({ text: '  (not in your sources — check)', italics: true, color: PS_C.red, fontSize: 7 * s });
    return out;
  }
  function psBox(stack, o) {
    return { table: { widths: ['*'], body: [[{ stack: stack, fillColor: o.fill || null }]] }, margin: o.margin || [0, 0, 0, 0],
      layout: { hLineWidth: function () { return o.line || 0; }, vLineWidth: function (i) { return o.left ? (i === 0 ? o.left : 0) : (o.line || 0); },
        hLineColor: function () { return o.color || PS_C.line; }, vLineColor: function () { return o.color || PS_C.line; },
        paddingLeft: function () { return o.pad || 6; }, paddingRight: function () { return o.pad || 6; }, paddingTop: function () { return o.padY || 4; }, paddingBottom: function () { return o.padY || 4; } } };
  }
  function psTag(t, col, s) { return { text: t.toUpperCase(), bold: true, color: col, fontSize: 6.4 * s, characterSpacing: 0.4 }; }
  function psNote(kind, t, s) {
    var red = kind === 'trap';
    return psBox([{ text: [{ text: (red ? 'EXAM TRAP  ' : 'EXAM TIP  '), bold: true, color: red ? PS_C.red : PS_C.green, fontSize: 6.6 * s }, { text: t }] }], { fill: red ? PS_C.redBg : PS_C.greenBg, left: 2.5, color: red ? PS_C.red : PS_C.green });
  }
  function psPoints(points, s, acc) {
    return points.map(function (p) { return { text: [{ text: '•  ', color: acc, bold: true }].concat(psRuns(p, s, acc)), margin: [0, 1.2 * s, 0, 1.2 * s] }; });
  }
  // A box for flow maps and mind maps.
  function psNode(b, s, acc) {
    var col = b.kind === 'yes' ? PS_C.green : b.kind === 'no' ? PS_C.red : b.kind === 'branch' ? PS_C.amber : acc;
    var fill = b.kind === 'yes' ? '#f1faf4' : b.kind === 'no' ? '#fdf3f2' : b.kind === 'branch' ? '#fff9ec' : null;
    var st = [];
    if (b.label) st.push(psTag(b.label, col, s));
    if (b.heading) st.push({ text: b.heading, bold: true, color: col, fontSize: 10 * s, margin: [0, 0.5, 0, 1.5] });
    if (b.test) st.push({ text: b.test, bold: true, margin: [0, 0, 0, 1.5] });
    if (b.text) st.push({ text: b.text, margin: [0, 0, 0, 1.5] });
    st = st.concat(psPoints(b.points, s, col));
    if (b.trap) st.push({ text: [{ text: 'TRAP  ', bold: true, color: PS_C.red, fontSize: 6.4 * s }, b.trap], margin: [0, 2, 0, 0] });
    return psBox(st, { fill: fill, line: 1, color: col, pad: 6, padY: 5 });
  }
  function psArrow(s, acc) { return { width: 12, margin: [0, 22 * s, 0, 0], canvas: [{ type: 'polyline', closePath: true, color: acc, points: [{ x: 2, y: 0 }, { x: 10, y: 5 }, { x: 2, y: 10 }] }] }; }
  function psMain(p, s, acc) {
    var c = p.content, out = [];
    if (p.style === 'tiles') {
      var tiles = c.blocks.filter(function (b) { return b.kind !== 'branch'; }), extra = c.blocks.filter(function (b) { return b.kind === 'branch'; });
      var rowsOf = tiles.length > 5 ? [tiles.slice(0, Math.ceil(tiles.length / 2)), tiles.slice(Math.ceil(tiles.length / 2))] : [tiles];
      rowsOf.forEach(function (row, ri) {
        out.push({ columnGap: 7, margin: [0, ri ? 6 : 0, 0, 0], columns: row.map(function (b, i) {
          var col = PS_PAL[(i + ri * 3) % PS_PAL.length], st = [];
          if (b.test) st.push(psBox([psTag('The test', col, s), { text: b.test, bold: true }], { fill: '#f4f5fa', pad: 5, padY: 3, margin: [0, 0, 0, 3] }));
          if (b.text) st.push({ text: b.text, margin: [0, 0, 0, 2] });
          st = st.concat(psPoints(b.points, s, col));
          if (b.trap) st.push(psNote('trap', b.trap, s));
          return { width: '*', table: { widths: ['*'], body: [[{ stack: [psTag(b.label || ('Part ' + (i + 1)), '#ffffff', s), { text: b.heading, bold: true, color: '#ffffff', fontSize: 12 * s }], fillColor: col }], [{ stack: st }]] },
            layout: { hLineWidth: function (k, node) { return k === 0 || k === node.table.body.length ? 0.8 : 0; }, vLineWidth: function () { return 0.8; }, hLineColor: function () { return col; }, vLineColor: function () { return col; },
              paddingLeft: function () { return 6; }, paddingRight: function () { return 6; }, paddingTop: function () { return 4; }, paddingBottom: function () { return 5; } } };
        }) });
      });
      if (extra.length) out.push({ columnGap: 7, margin: [0, 6, 0, 0], columns: extra.map(function (b) { return Object.assign({ width: '*' }, psNode(b, s, acc)); }) });
    } else if (p.style === 'flow') {
      var steps = c.blocks.filter(function (b) { return b.kind !== 'branch'; }), branches = c.blocks.filter(function (b) { return b.kind === 'branch'; });
      var per = Math.max(1, Math.ceil(steps.length / Math.ceil(steps.length / 4)));   // balanced rows of up to 4
      for (var i = 0; i < steps.length; i += per) {
        var cols = [];
        steps.slice(i, i + per).forEach(function (b, k) { if (k) cols.push(psArrow(s, acc)); cols.push(Object.assign({ width: '*' }, psNode(b, s, acc))); });
        if (i) out.push({ text: '»  continued', color: acc, bold: true, fontSize: 7 * s, margin: [0, 3, 0, 2] });
        out.push({ columns: cols, columnGap: 3, margin: [0, i ? 0 : 0, 0, 3] });
      }
      if (branches.length) {
        out.push({ text: 'SPECIAL RULES & EXCEPTIONS', bold: true, color: PS_C.amber, fontSize: 7 * s, characterSpacing: 0.4, margin: [0, 5, 0, 2] });
        var bper = branches.length > 4 ? Math.ceil(branches.length / 2) : branches.length;
        for (var j = 0; j < branches.length; j += bper) out.push({ columnGap: 7, margin: [0, 0, 0, 4], columns: branches.slice(j, j + bper).map(function (b) { return Object.assign({ width: '*' }, psNode(b, s, acc)); }) });
      }
    } else if (p.style === 'mindmap') {
      var br = c.blocks.slice(0, 8), rest = c.blocks.slice(8), half = Math.ceil(br.length / 2);
      var side = function (list) { return list.map(function (b, i) { return Object.assign(psNode(b, s, PS_PAL[(i * 2 + (list === br ? 0 : 1)) % PS_PAL.length]), { margin: [0, 0, 0, 6] }); }); };
      var left = br.slice(0, half), right = br.slice(half);
      var hub = c.hub || { heading: p.title, text: '', points: [] };
      var spoke = function (n, flip) { // short connector lines, one per branch, drawn beside the hub
        var lines = []; for (var k = 0; k < n; k++) { var y = 10 + k * (90 / Math.max(1, n - 1 || 1)); lines.push({ type: 'line', x1: flip ? 0 : 22, y1: 50, x2: flip ? 22 : 0, y2: y, lineWidth: 1, lineColor: '#b9a3d6' }); }
        return { width: 22, canvas: lines, margin: [0, 18 * s, 0, 0] };
      };
      out.push({ columnGap: 2, columns: [
        { width: '*', stack: side(left) }, spoke(left.length, false),
        { width: 175 * Math.min(1, s + 0.1), margin: [0, 26 * s, 0, 0], table: { widths: ['*'], body: [[{ fillColor: acc, alignment: 'center', stack: [{ text: hub.heading, bold: true, color: '#fff', fontSize: 15 * s, margin: [0, 6, 0, 3] }, { text: hub.text, color: '#fff' }].concat(hub.points.map(function (pt) { return { text: psRuns(pt, s, '#fff'), color: '#fff', margin: [0, 2, 0, 0] }; })).concat([{ text: ' ', fontSize: 4 }]) }]] },
          layout: { hLineWidth: function () { return 0; }, vLineWidth: function () { return 0; }, paddingLeft: function () { return 9; }, paddingRight: function () { return 9; }, paddingTop: function () { return 6; }, paddingBottom: function () { return 6; } } },
        spoke(right.length, true), { width: '*', stack: side(right) }] });
      if (rest.length) out.push({ columnGap: 7, margin: [0, 2, 0, 0], columns: rest.map(function (b) { return Object.assign({ width: '*' }, psNode(b, s, acc)); }) });
    } else if (p.style === 'cases') {
      var tl = c.timeline, n = tl.length;
      if (n) {
        var dots = [{ type: 'line', x1: 0, y1: 5, x2: PS_W, y2: 5, lineWidth: 1.4, lineColor: acc }];
        tl.forEach(function (t, k) { dots.push({ type: 'ellipse', x: (k + 0.5) * PS_W / n, y: 5, r1: 3.5, r2: 3.5, color: '#ffffff', lineColor: acc, lineWidth: 1.4 }); });
        out.push({ columns: tl.map(function (t) { return { width: '*', text: t.year, alignment: 'center', bold: true, color: acc, fontSize: 8.5 * s }; }) });
        out.push({ canvas: dots, margin: [0, 1, 0, 1] });
        out.push({ columns: tl.map(function (t) { return { width: '*', alignment: 'center', fontSize: 7.2 * s, text: [{ text: t.name, bold: true, italics: true }, t.tag ? '\n' + t.tag : ''] }; }), margin: [0, 0, 0, 6] });
      }
      if (c.rows.length) {
        var th = function (t) { return { text: t.toUpperCase(), bold: true, color: '#fff', fontSize: 6.8 * s, fillColor: acc }; };
        out.push({ table: { headerRows: 1, widths: ['10%', '20%', '26%', '21%', '23%'], body: [[th('Topic'), th('Case'), th('Facts in one line'), th('Held'), th('Use it when...')]].concat(c.rows.map(function (r) {
          return [{ text: r.group.toUpperCase(), bold: true, color: acc, fontSize: 6.8 * s }, { text: [{ text: r.name, bold: true, italics: true }, r.cite ? { text: ' ' + r.cite, fontSize: 6.6 * s, color: PS_C.muted } : ''].concat(psFlags(r, s)) },
            r.facts, r.held, { text: [r.use, r.tag ? { text: '  ' + r.tag.toUpperCase(), bold: true, color: /narrow|limit|overrul/i.test(r.tag) ? PS_C.red : acc, fontSize: 6.4 * s } : ''] }];
        })) }, layout: { hLineWidth: function (k) { return k === 1 ? 0 : 0.4; }, vLineWidth: function () { return 0; }, hLineColor: function () { return PS_C.line; }, fillColor: function (k) { return k > 0 && k % 2 === 0 ? '#f4f8f8' : null; },
          paddingTop: function () { return 2.6 * s; }, paddingBottom: function () { return 2.6 * s; }, paddingLeft: function () { return 4; }, paddingRight: function () { return 4; } } });
      }
      if (c.blocks.length) out.push({ columnGap: 7, margin: [0, 6, 0, 0], columns: c.blocks.slice(0, 4).map(function (b, i) { return Object.assign({ width: '*' }, psNode(b, s, PS_PAL[(i + 2) % PS_PAL.length])); }) });
    }
    return out;
  }
  function psPageContent(d, p, n, of, s) {
    var c = p.content, acc = p.style === 'tiles' ? PS_C.ink : PS_PAL[(n - 1) % PS_PAL.length], out = [];
    out.push({ columns: [{ width: 'auto', text: c.title || p.title, bold: true, color: acc, fontSize: 19 * s }, { width: '*', text: c.subtitle, color: PS_C.muted, fontSize: 8.6 * s, margin: [10, 8 * s, 0, 0] },
      { width: 'auto', text: (n + ' / ' + of), color: PS_C.muted, fontSize: 8 * s, margin: [0, 8 * s, 0, 0] }] });
    out.push({ canvas: [{ type: 'line', x1: 0, y1: 2, x2: PS_W, y2: 2, lineWidth: 2.2, lineColor: acc }], margin: [0, 2, 0, 6 * s] });
    out = out.concat(psMain(p, s, acc));
    if (c.strip.length) out.push({ columnGap: 7, margin: [0, 6 * s, 0, 0], columns: c.strip.map(function (x) { return Object.assign({ width: '*' }, psBox([psTag(x.heading || 'Also', '#4a536a', s), { text: x.text }], { fill: PS_C.soft, pad: 6 })); }) });
    var notes = c.traps.map(function (t) { return psNote('trap', t, s); }).concat(c.tips.map(function (t) { return psNote('tip', t, s); }));
    if (notes.length) out.push({ columnGap: 7, margin: [0, 6 * s, 0, 0], columns: notes.slice(0, 4).map(function (x) { return Object.assign({ width: '*' }, x); }) });
    if (c.also.length) {
      var runs = [psTag('Also know  ', acc, s)];
      c.also.forEach(function (a, i) { if (i) runs.push({ text: '   ·   ', color: PS_C.muted }); runs.push({ text: a.name, bold: true }); if (a.point) runs.push({ text: ': ' + a.point }); });
      out.push(psBox([{ text: runs, fontSize: 8 * s }], { fill: PS_C.soft, left: 2.5, color: acc, margin: [0, 6 * s, 0, 0] }));
    }
    return out;
  }
  function psDef(d, pages, scales) {
    var content = [];
    pages.forEach(function (p, i) {
      var nodes = psPageContent(d, p, i + 1, d.pages.length, scales[i]);
      content.push({ stack: nodes, fontSize: 8.9 * scales[i], pageBreak: i ? 'before' : undefined });
    });
    return {
      pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [26, 22, 26, 26], info: { title: d.title, subject: 'Revision posters', creator: 'Law Revision Repository' },
      footer: function (cur, total) { psDef.count = total; return { columns: [{ text: d.title + '  ·  From: ' + d.sources.map(function (x) { return x.title; }).join('; '), color: PS_C.muted, fontSize: 6.5 }, { text: 'Revision posters  ·  ' + d.items.filter(function (it) { return it.type !== 'outcome'; }).length + ' points checked against your sources', alignment: 'right', color: PS_C.muted, fontSize: 6.5 }], margin: [26, 9, 26, 0] }; },
      content: content, defaultStyle: { font: 'Roboto', fontSize: 8.9, lineHeight: 1.18, color: PS_C.ink }
    };
  }
  function psPages(def) { return new Promise(function (res, rej) { psDef.count = 0; try { window.pdfMake.createPdf(def).getBuffer(function () { res(psDef.count); }); } catch (e) { rej(e); } }); }
  // The biggest text size at which each poster still fits on one page.
  var PS_SCALES = [1.4, 1.3, 1.2, 1.12, 1.05, 1, 0.94, 0.88, 0.83, 0.78, 0.73, 0.69, 0.65, 0.61];
  function psFit(d, p) {
    var lo = 0, hi = PS_SCALES.length - 1, best = hi;
    var tryAt = function () {
      if (lo > hi) return Promise.resolve(PS_SCALES[best]);
      var mid = (lo + hi) >> 1;
      return psPages(psDef(d, [p], [PS_SCALES[mid]])).then(function (n) { if (n <= 1) { best = mid; hi = mid - 1; } else lo = mid + 1; return tryAt(); });
    };
    return tryAt();
  }
  function posterBlob(d) {
    if (psBlobs[d.id]) return Promise.resolve(psBlobs[d.id]);
    return loadScript(LIBS.pdfmake).then(function () { return loadScript(LIBS.pdfmakeFonts); }).then(function () {
      if (!window.pdfMake) throw new Error('The PDF maker couldn\'t load. Check your internet connection.');
      var safe = pdfSafe(d);
      return safe.pages.reduce(function (pr, p) { return pr.then(function (sc) { return psFit(safe, p).then(function (x) { return sc.concat([x]); }); }); }, Promise.resolve([])).then(function (scales) {
        return new Promise(function (res, rej) { try { window.pdfMake.createPdf(psDef(safe, safe.pages, scales)).getBlob(function (b) { psBlobs[d.id] = b; res(b); }); } catch (e) { rej(e); } });
      });
    });
  }
  // The coverage check as its own printable PDF.
  function coverageDef(d) {
    var st = psStats(d), pr = { must: 0, should: 1, detail: 2 };
    var rows = d.items.filter(function (it) { return it.type !== 'outcome'; }).slice().sort(function (a, b) { return pr[a.pri] - pr[b.pri] || a.id.localeCompare(b.id, 'en', { numeric: true }); });
    var th = function (t) { return { text: t, bold: true, fontSize: 7.5, color: '#4a536a' }; };
    var lab = { full: 'Yes', short: 'Yes (one line)', restored: 'Yes (put back by the check)', flag: 'Check this' };
    var tile = function (big, l, col) { return psBox([{ text: String(big), bold: true, fontSize: 18, color: col || PS_C.ink }, { text: l, fontSize: 7.5, color: PS_C.muted }], { fill: PS_C.soft, pad: 7, padY: 5 }); };
    var content = [
      { text: 'Coverage check: ' + d.title, bold: true, fontSize: 17, margin: [0, 0, 0, 2] },
      { text: 'Every point Claude found in your sources, and where it is on your posters.  From: ' + d.sources.map(function (x) { return x.title; }).join('; '), color: PS_C.muted, fontSize: 8.5, margin: [0, 0, 0, 8] },
      { columnGap: 6, columns: [tile(st.found, 'points found in your sources'), tile((st.full + st.short + st.restored + st.flag) + '/' + st.found, 'on the posters', PS_C.green), tile(st.mustFull + '/' + st.must, 'must-know points in full', PS_C.green), tile(st.restored, 'put back by the check', st.restored ? PS_C.amber : null), tile(st.flag + st.notFound, 'to check yourself', st.flag + st.notFound ? PS_C.red : null)].concat(st.outcomes ? [tile(st.outcomesOk + '/' + st.outcomes, 'learning outcomes covered', st.outcomesOk < st.outcomes ? PS_C.amber : PS_C.green)] : []).map(function (x) { return Object.assign({ width: '*' }, x); }), margin: [0, 0, 0, 10] },
      { table: { headerRows: 1, widths: ['38%', '9%', '8%', '7%', '22%', '16%'], body: [[th('Point'), th('Type'), th('Priority'), th('Source'), th('Where on the posters'), th('On the posters?')]].concat(rows.map(function (it) {
        return [{ text: [{ text: it.name, bold: true }, it.point ? { text: '\n' + it.point, color: PS_C.muted, fontSize: 7.5 } : '', it.issue ? { text: '\nCheck: ' + it.issue, color: PS_C.red, fontSize: 7.5 } : '', it.notFound ? { text: '\nNot found in your sources — check', color: PS_C.red, fontSize: 7.5 } : ''] },
          it.type, { text: it.pri.toUpperCase(), bold: it.pri === 'must', fontSize: 7.5 }, it.page, it.where, { text: lab[it.status] || 'Yes', bold: true, color: it.status === 'flag' ? PS_C.red : it.status === 'restored' ? PS_C.amber : PS_C.green }];
      })) }, layout: { hLineWidth: function (i) { return i === 1 ? 1 : 0.3; }, vLineWidth: function () { return 0; }, hLineColor: function () { return PS_C.line; }, paddingTop: function () { return 3; }, paddingBottom: function () { return 3; } }, fontSize: 8.3 }
    ];
    if (d.outcomes.length) content.push({ text: 'Learning outcomes', bold: true, fontSize: 12, margin: [0, 12, 0, 4] }, { table: { headerRows: 1, widths: ['45%', '25%', '30%'], body: [[th('Outcome'), th('Where'), th('Note')]].concat(d.outcomes.map(function (o) { return [o.outcome, { text: (o.covered ? 'Covered: ' : 'Not fully: ') + o.where, color: o.covered ? PS_C.green : PS_C.amber }, o.note]; })) }, layout: 'lightHorizontalLines', fontSize: 8.3 });
    return { pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [30, 26, 30, 30], content: content, defaultStyle: { font: 'Roboto', fontSize: 8.5, lineHeight: 1.15, color: PS_C.ink },
      footer: function (cur, total) { return { text: 'Coverage check  ·  ' + cur + ' / ' + total, alignment: 'right', fontSize: 6.5, color: PS_C.muted, margin: [30, 10, 30, 0] }; } };
  }
  function savePdf(blob, name) {
    name = name.replace(/[^\w\s–\-().,&']/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) + '.pdf';
    if (claudeCaps.downloads) {
      return claudeCaps.downloads.save({ filename: name, data: blob }).then(null, function (err) {
        if (err && err.code === 'declined') return;
        throw new Error('This view can\'t save files. Open the app in claude.ai in a web browser to download the PDF.');
      });
    }
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    return Promise.resolve();
  }
  function downloadPoster(d) { return posterBlob(d).then(function (b) { return savePdf(b, d.title + ' – posters'); }); }
  function downloadCoverage(d) {
    return loadScript(LIBS.pdfmake).then(function () { return loadScript(LIBS.pdfmakeFonts); }).then(function () {
      return new Promise(function (res, rej) { try { window.pdfMake.createPdf(coverageDef(pdfSafe(d))).getBlob(res); } catch (e) { rej(e); } });
    }).then(function (b) { return savePdf(b, d.title + ' – coverage check'); });
  }
