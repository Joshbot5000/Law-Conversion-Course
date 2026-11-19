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
      kind: m.kind === 'poster' ? 'poster' : 'notes',
      counts: m.counts && typeof m.counts === 'object' ? { principles: num(m.counts.principles, 0), terms: num(m.counts.terms, 0), cases: num(m.counts.cases, 0), pages: num(m.counts.pages, 0), points: num(m.counts.points, 0), check: num(m.counts.check, 0) } : { principles: 0, terms: 0, cases: 0, pages: 0, points: 0, check: 0 }
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
    var counts;
    if (doc.kind === 'poster') { var st = psStats(doc); counts = { pages: doc.pages.length, points: st.found, check: st.flag + st.notFound }; }
    else counts = { principles: doc.sections.reduce(function (n, s) { return n + s.entries.length; }, 0), terms: doc.terms.length, cases: doc.cases.length };
    var meta = sanitizeRnMeta({ id: doc.id, title: doc.title, module: doc.module, sources: doc.sources, createdAt: doc.createdAt, parts: parts.length, kind: doc.kind, counts: counts });
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
    delete rnBodies[id]; delete psBlobs[id];
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
  function renderRnCount() { var c = $('#rnCount'); if (c) c.textContent = String(state.rdocs.filter(function (m) { return m.kind === 'poster'; }).length); }
  // For backups: every document in full.
  function rnForExport() {
    return Promise.all(state.rdocs.map(function (m) { return loadRnDoc(m.id).then(null, function () { return null; }); })).then(function (l) { return l.filter(Boolean); });
  }
  function importRnDocs(list) {
    if (!Array.isArray(list)) return Promise.resolve(0);
    var have = {}; state.rdocs.forEach(function (m) { have[m.id] = true; });
    var todo = list.filter(function (d) { return d && typeof d.id === 'string' && !have[d.id] && (Array.isArray(d.sections) || (d.kind === 'poster' && Array.isArray(d.pages))); });
    return todo.reduce(function (p, d) { return p.then(function () { return saveRnDoc(d.kind === 'poster' ? cleanPoster(d) : cleanRnDoc(d)); }); }, Promise.resolve()).then(function () { return todo.length; });
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

  function renderRnProgress() {
    if (rn.view !== 'gen' || !rn.job) return;
    var j = rn.job, done = j.steps.filter(function (s) { return s.state !== 'run'; }).length;
    $('#rnBody').innerHTML = '<p class="muted" style="margin-top:0">Claude lists every point in your sources first, then writes the posters from that list and checks each page against it, so nothing important is left out. This takes a few minutes — you can keep this open or come back to it.</p>' +
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
  function rnFull(d) { return d && d.kind === 'poster' ? cleanPoster(d) : cleanRnDoc(d); }
  function renderRn() {
    var body = $('#rnBody'), foot = $('#rnFoot');
    if (rn.view === 'gen') return renderRnProgress();
    if (rn.view === 'view' && rn.doc) {
      var poster = rn.doc.kind === 'poster';
      body.innerHTML = poster ? posterViewHTML(rn.doc) : rnHTML(rn.doc);
      foot.innerHTML = '<button type="button" class="btn" data-rn="list">← All posters</button><span class="spacer"></span>' +
        (poster ? '<button type="button" class="btn" data-rn="cov" data-id="' + esc(rn.doc.id) + '">⬇ Coverage check</button>' : '') +
        '<button type="button" class="btn btn-primary" data-rn="pdf" data-id="' + esc(rn.doc.id) + '">⬇ Download ' + (poster ? 'posters' : 'PDF') + '</button>';
      body.scrollTop = 0;
      if (poster) setTimeout(function () { previewPoster(rn.doc); }, 30);
      return;
    }
    if (rn.view === 'new') {
      var groups = {};
      state.sources.forEach(function (s) { (groups[s.module || ''] = groups[s.module || ''] || []).push(s); });
      var order = MODULES.map(function (m) { return m.id; }).concat(['']);
      body.innerHTML = '<p class="muted" style="margin-top:0">Tick the sources to turn into <b>revision posters</b>: up to 4 landscape A4 pages you can print, laid out as infographics (a tile-grid overview, flow maps for step-by-step tests, mind maps for factors, and a timeline with a case table). Claude picks the best layout for each page.</p>' +
        '<div class="form-field"><label class="lbl" for="rnTitle">Title <span class="hint">(optional — Claude suggests one)</span></label><input class="input" id="rnTitle" maxlength="200" value="' + esc(rn.title) + '" placeholder="e.g. Tort Ch 7 – Occupiers\' Liability"></div>' +
        '<div class="qz-topics rn-srcs">' + order.filter(function (m) { return groups[m]; }).map(function (m) {
          return '<div class="qz-mod">' + esc(MODULE_LABEL[m] || 'Other') + '</div>' + groups[m].map(function (s) {
            return '<label class="qz-topic"><input type="checkbox" data-rnsrc="' + esc(s.id) + '"' + (rn.sel.indexOf(s.id) !== -1 ? ' checked' : '') + '><span>' + esc(s.title) + '</span><small>' + (s.pages ? plural(s.pages, 'page') : Math.max(1, Math.round(s.chars / 6000)) + 'k words') + '</small></label>';
          }).join('');
        }).join('') + '</div>' +
        '<div class="rn-note-box"><b>The coverage check.</b> Before anything is drawn, Claude lists every principle, test, case, statute, exception and learning outcome in your sources, page by page. Each page is then checked against that list (and the source) by a separate pass; anything missing or wrong is fixed, and anything still missing is put back word for word. You see the full list, and where each point is, before you print.</div>' +
        '<p class="muted rn-note">Uses your Claude allowance: about 8–16 requests for a chapter (more for several chapters). Only your chosen sources are used, and every case is checked against them.</p>' +
        (claudeCaps.sample ? '' : '<p class="step-note warn">Posters are written by Claude, which works when the app is opened in claude.ai.</p>');
      foot.innerHTML = '<button type="button" class="btn" data-rn="list">Back</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-rn="go"' + (claudeCaps.sample ? '' : ' disabled') + '>✦ Make posters</button>';
      return;
    }
    var all = state.rdocs.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    var item = function (m) {
      var poster = m.kind === 'poster';
      return '<div class="rn-item"><div class="rn-item-text"><b>' + esc(m.title) + '</b><span>' + (m.module ? esc(MODULE_LABEL[m.module]) + ' · ' : '') +
        new Date(m.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' +
        (poster ? plural(m.counts.pages, 'page') + ' · ' + plural(m.counts.points, 'point') + ' checked' + (m.counts.check ? ' · <em class="rn-flag bad">' + m.counts.check + ' to check</em>' : '')
          : plural(m.counts.principles, 'principle') + ', ' + plural(m.counts.cases, 'case')) + '</span>' +
        '<small>From: ' + esc(m.sources.map(function (s) { return s.title; }).join(', ')) + '</small></div>' +
        '<div class="rn-item-tools"><button type="button" class="btn btn-sm" data-rn="open" data-id="' + esc(m.id) + '">View</button>' +
        '<button type="button" class="btn btn-sm btn-primary" data-rn="pdf" data-id="' + esc(m.id) + '">⬇ PDF</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-rn="delete" data-id="' + esc(m.id) + '">Delete</button></div></div>';
    };
    var posters = all.filter(function (m) { return m.kind === 'poster'; }), old = all.filter(function (m) { return m.kind !== 'poster'; });
    body.innerHTML = (posters.length ? '<div class="rn-list">' + posters.map(item).join('') + '</div>'
      : '<div class="empty" style="padding:30px 16px"><h3>No revision posters yet</h3><p>Choose one or more sources and Claude turns them into up to 4 printable landscape posters, checked against your sources so nothing important is missed.</p></div>') +
      (old.length ? '<details class="rn-old"><summary>Older long-form notes (' + old.length + ')</summary><div class="rn-list">' + old.map(item).join('') + '</div></details>' : '');
    foot.innerHTML = '<span class="spacer"></span><button type="button" class="btn" data-close>Close</button><button type="button" class="btn btn-primary" data-rn="new">＋ New posters</button>';
  }
  function rnAction(a, el) {
    var id = el && el.getAttribute('data-id');
    var busy = function (p) { el.disabled = true; return p.then(function () { el.disabled = false; }, function (err) { el.disabled = false; toast((err && err.message) || 'The PDF couldn\'t be made.', { type: 'error', timeout: 7000 }); }); };
    if (a === 'new') { rn.sel = rn.view === 'new' ? rn.sel : []; rn.title = ''; rn.view = 'new'; renderRn(); }
    else if (a === 'list') { rn.view = 'list'; renderRn(); }
    else if (a === 'go') { var t = $('#rnTitle'); if (t) rn.title = t.value.trim(); startPoster(); }
    else if (a === 'cancel') { if (rn.job) rn.job.ctl.abort(); rn.job = null; rn.view = 'new'; renderRn(); }
    else if (a === 'open') {
      $('#rnBody').innerHTML = '<p><span class="spinner"></span>Opening…</p>';
      loadRnDoc(id).then(function (d) { rn.doc = rnFull(d); rn.view = 'view'; renderRn(); }, function () { toast('That couldn\'t be opened.', { type: 'error' }); rn.view = 'list'; renderRn(); });
    }
    else if (a === 'pdf') busy(loadRnDoc(id).then(function (d) { d = rnFull(d); return d.kind === 'poster' ? downloadPoster(d) : downloadRnPdf(d); }));
    else if (a === 'cov') busy(loadRnDoc(id).then(function (d) { return downloadCoverage(rnFull(d)); }));
    else if (a === 'delete') {
      var m = state.rdocs.filter(function (x) { return x.id === id; })[0]; if (!m) return;
      dialog({ title: 'Delete “' + m.title + '”?', message: 'It will be deleted for good. Your sources and cards are not affected.', buttons: [{ label: 'Cancel', value: false }, { label: 'Delete', value: true, style: 'btn-danger' }] })
        .then(function (yes) { if (!yes) return; deleteRnDoc(id).then(function () { renderRn(); renderRnCount(); toast('Deleted.'); }); });
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
