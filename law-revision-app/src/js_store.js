  /* ------------------------------------------------------------------
     I. STORAGE
     Inside claude.ai the library is kept in your account (the page's
     private database: only you, the owner, can read or write it).
     Opened as a plain file it is kept in this browser instead.

     Cloud layout (few, larger documents so syncing stays cheap):
       lib/s00..s31   { e: { <cardId>: card } }        cards, sharded by id
       prog/p0..p7    { p: { <cardId>: review record } }
       meta/stats     { days: { 'YYYY-MM-DD': [reviews, forgotten, new] } }
       meta/prefs     { newPerDay, exams, autoPace, notDup }
       src/<id>       source metadata
       srctext/<id>_<n> { sid, n, text }               source text in parts
     ------------------------------------------------------------------ */
  var claudeCaps = { db: null, sample: null, downloads: null };
  var LIB_SHARDS = 32, PROG_SHARDS = 8;
  function libShard(id) { return 's' + pad2(hash32(id) % LIB_SHARDS); }
  function progShard(id) { return 'p' + (hash32(id) % PROG_SHARDS); }

  var store = {
    mode: 'pending',          // 'pending' | 'local' | 'cloud'
    status: 'ok',             // 'ok' | 'busy' | 'error'
    error: '',
    localReason: '',
    written: { e: {}, p: {} },// last JSON sent or confirmed, per id
    docs: {},                 // 'coll/doc' -> true when it exists in the cloud
    server: { lib: {}, prog: {} },
    queues: {},
    textCache: {},
    firstLib: false, firstProg: false, migrated: false
  };

  function setSync(status, error) {
    store.status = status;
    if (status !== 'error') store.error = ''; else store.error = error || store.error;
    renderSyncStatus();
  }
  function anyQueued() {
    return Object.keys(store.queues).some(function (k) { var q = store.queues[k]; return q.running || q.pending; });
  }

  /* ---------- start-up ---------- */
  function initStorage() {
    if (window.claude && typeof window.claude.use === 'function') {
      window.claude.use('db').then(function (db) {
        if (db) startCloud(db); else startLocal('This view can\'t reach your claude.ai storage.');
      }, function () { startLocal('This view can\'t reach your claude.ai storage.'); });
    } else {
      startLocal('');
    }
  }

  /* ---------- this-browser mode ---------- */
  function startLocal(reason) {
    store.mode = 'local';
    store.localReason = reason;
    var raw = null, ok = true;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) { ok = false; }
    store.localOK = ok;
    var data = null;
    if (raw) {
      try { data = JSON.parse(raw); } catch (e) {
        try { window.localStorage.setItem(STORAGE_KEY + '.corrupt.' + Date.now(), raw); } catch (e2) { /* ignore */ }
        setTimeout(function () { toast('Saved data could not be read, so a fresh library was started. A copy of the old data was kept.', { type: 'error', timeout: 9000 }); }, 300);
      }
    }
    if (data) {
      state.entries = (Array.isArray(data.entries) ? data.entries : []).map(sanitizeEntry).filter(Boolean);
      state.progress = {};
      if (data.progress && typeof data.progress === 'object') {
        Object.keys(data.progress).forEach(function (id) { var p = sanitizeProgress(data.progress[id]); if (p) state.progress[id] = p; });
      }
      if (data.stats && data.stats.days && typeof data.stats.days === 'object') state.stats = { days: data.stats.days };
      if (data.prefs && typeof data.prefs === 'object') state.prefs = sanitizePrefs(data.prefs);
    } else {
      var t = Date.now();
      state.entries = SAMPLE_ENTRIES.map(function (e, i) {
        var copy = JSON.parse(JSON.stringify(e));
        copy.createdAt = copy.updatedAt = new Date(t - i * 1000).toISOString();
        return sanitizeEntry(copy);
      });
      persistLocal();
    }
    var src = readLocalSources();
    state.sources = src.meta.map(sanitizeSourceMeta).filter(Boolean);
    loadLocalNotes();
    state.loaded = true;
    setSync('ok');
    renderAll();
  }
  function persistLocal() {
    if (!store.localOK && store.localOK !== undefined) return false;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: SCHEMA_VERSION, savedAt: nowISO(),
        entries: state.entries, progress: state.progress, stats: state.stats, prefs: state.prefs
      }));
      return true;
    } catch (e) {
      var full = e && (e.name === 'QuotaExceededError' || e.code === 22);
      setSync('error', full ? 'Browser storage is full' : 'Could not save');
      toast(full ? 'Browser storage is full, so your latest change was not saved. Export a backup now.'
        : 'Could not save to browser storage. Export a backup to keep your work safe.', { type: 'error', timeout: 9000 });
      return false;
    }
  }
  function readLocalSources() {
    try {
      var d = JSON.parse(window.localStorage.getItem(SOURCES_KEY) || 'null');
      if (d && Array.isArray(d.meta) && d.text && typeof d.text === 'object') return d;
    } catch (e) { /* ignore */ }
    return { meta: [], text: {} };
  }
  function writeLocalSources(d) {
    window.localStorage.setItem(SOURCES_KEY, JSON.stringify(d));
  }

  /* ---------- claude.ai mode ---------- */
  function startCloud(db) {
    claudeCaps.db = db;
    store.mode = 'cloud';
    setSync('busy');
    renderAll();
    var fail = function (e) {
      if (!state.loaded) startLocal('Your claude.ai storage didn\'t respond (' + (e && e.code || 'error') + ').');
      else setSync('error', 'Sync stopped. Reload the page.');
    };
    db.collection('lib').onSnapshot(function (snap) {
      var docs = {};
      snap.docs.forEach(function (d) { docs[d.id] = d.data() || {}; store.docs['lib/' + d.id] = true; });
      store.server.lib = docs;
      rebuildEntries();
      if (!state.loaded) { state.loaded = true; setSync(anyQueued() ? 'busy' : 'ok'); }
      if (!snap.metadata.fromCache) store.firstLib = true;
      maybeMigrate();
      renderAllSoon();
    }, fail);
    db.collection('prog').onSnapshot(function (snap) {
      var docs = {};
      snap.docs.forEach(function (d) { docs[d.id] = d.data() || {}; store.docs['prog/' + d.id] = true; });
      store.server.prog = docs;
      rebuildProgress();
      if (!snap.metadata.fromCache) store.firstProg = true;
      maybeMigrate();
      renderAllSoon();
    }, fail);
    db.collection('meta').onSnapshot(function (snap) {
      snap.docs.forEach(function (d) {
        store.docs['meta/' + d.id] = true;
        var v = d.data() || {};
        if (d.id === 'stats' && v.days && typeof v.days === 'object' && !queueBusy('meta/stats')) state.stats = { days: JSON.parse(JSON.stringify(v.days)) };
        if (d.id === 'prefs' && !queueBusy('meta/prefs')) state.prefs = sanitizePrefs(v);
      });
      renderAllSoon();
      // Quiz levels can arrive after the quiz setup has opened.
      if (qz && qz.step === 'setup' && !$('#quizModal').hidden) renderQuiz();
    }, fail);
    startNotesCloud(db);
    db.collection('src').onSnapshot(function (snap) {
      state.sources = snap.docs.map(function (d) { return sanitizeSourceMeta(d.data()); }).filter(Boolean)
        .sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; });
      renderAllSoon();
      if (!$('#sourcesModal').hidden) renderSourceList();
    }, fail);
    setTimeout(function () {
      if (!state.loaded) { $('#entries').innerHTML = '<div class="loading"><span class="spinner"></span>Still loading your library from claude.ai…</div>'; }
    }, 12000);
  }
  function queueBusy(key) { var q = store.queues[key]; return !!(q && (q.running || q.pending)); }

  // Merge the server's shards with any local changes still being saved.
  function rebuildEntries() {
    var list = [], seen = {};
    var dirty = {};
    Object.keys(store.queues).forEach(function (k) { if (k.indexOf('lib/') === 0 && queueBusy(k)) dirty[k.slice(4)] = true; });
    var local = {};
    if (Object.keys(dirty).length) state.entries.forEach(function (e) { var s = libShard(e.id); if (dirty[s]) (local[s] = local[s] || []).push(e); });
    var newWritten = {};
    Object.keys(store.server.lib).forEach(function (shard) {
      if (dirty[shard]) return;
      var map = store.server.lib[shard].e || {};
      Object.keys(map).forEach(function (id) {
        var raw = map[id];
        var e = sanitizeEntry(raw && typeof raw === 'object' ? Object.assign({}, raw, { id: id }) : null);
        if (!e || seen[e.id]) return;
        seen[e.id] = true;
        list.push(e);
        newWritten[e.id] = JSON.stringify(e);
      });
    });
    Object.keys(dirty).forEach(function (shard) {
      (local[shard] || []).forEach(function (e) { if (!seen[e.id]) { seen[e.id] = true; list.push(e); newWritten[e.id] = store.written.e[e.id] || JSON.stringify(e); } });
    });
    store.written.e = newWritten;
    state.entries = list;
  }
  function rebuildProgress() {
    var dirty = {};
    Object.keys(store.queues).forEach(function (k) { if (k.indexOf('prog/') === 0 && queueBusy(k)) dirty[k.slice(5)] = true; });
    var next = {}, written = {};
    Object.keys(state.progress).forEach(function (id) { if (dirty[progShard(id)]) { next[id] = state.progress[id]; written[id] = store.written.p[id] || JSON.stringify(state.progress[id]); } });
    Object.keys(store.server.prog).forEach(function (shard) {
      if (dirty[shard]) return;
      var map = store.server.prog[shard].p || {};
      Object.keys(map).forEach(function (id) { var p = sanitizeProgress(map[id]); if (p) { next[id] = p; written[id] = JSON.stringify(p); } });
    });
    store.written.p = written;
    state.progress = next;
  }

  // One write at a time per document; later changes merge into the next write.
  function queueDoc(coll, docId, field, patch, needSet, fullFn) {
    var key = coll + '/' + docId;
    var q = store.queues[key] || (store.queues[key] = { running: null, pending: null, tries: 0 });
    if (!q.pending) q.pending = { coll: coll, docId: docId, field: field, patch: {}, set: false, fullFn: fullFn };
    Object.keys(patch || {}).forEach(function (k) { q.pending.patch[k] = patch[k]; });
    if (needSet) q.pending.set = true;
    q.pending.fullFn = fullFn;
    setSync('busy');
    pump(key);
  }
  function pump(key) {
    var q = store.queues[key];
    if (!q || q.running || !q.pending || !claudeCaps.db) return;
    var item = q.pending; q.pending = null; q.running = item;
    var ref = claudeCaps.db.collection(item.coll).doc(item.docId);
    var useSet = item.set || !store.docs[key] || !item.field;
    var body;
    if (useSet) body = item.fullFn();
    else { body = {}; body[item.field] = item.patch; }
    var p;
    try { p = useSet ? ref.set(body) : ref.update(body); } catch (e) { p = Promise.reject({ code: 'invalid_argument', message: String(e) }); }
    p.then(function () {
      store.docs[key] = true;
      q.running = null; q.tries = 0;
      if (q.pending) pump(key);
      else if (!anyQueued()) setSync('ok');
    }, function (err) {
      q.running = null;
      var code = err && err.code;
      // Put the failed change back in front of anything newer.
      var merged = item;
      if (q.pending) { Object.keys(q.pending.patch).forEach(function (k) { merged.patch[k] = q.pending.patch[k]; }); merged.set = merged.set || q.pending.set; merged.fullFn = q.pending.fullFn; }
      q.pending = merged;
      if (code === 'invalid_argument' && !useSet) { q.pending.set = true; q.tries++; if (q.tries < 3) return pump(key); }
      if ((code === 'resource_exhausted' || code === 'unavailable' || !code) && q.tries < 5) {
        q.tries++;
        setTimeout(function () { pump(key); }, 800 * Math.pow(2, q.tries) + Math.random() * 400);
        return;
      }
      var msg = code === 'quota_exceeded' ? 'Your claude.ai storage is full' :
        code === 'revoked' || code === 'not_granted' ? 'Saving isn\'t allowed in this view' : 'A change couldn\'t be saved';
      setSync('error', msg);
      toast(msg + '. Export a backup so nothing is lost.', { type: 'error', timeout: 9000 });
    });
  }

  function shardBody(shard) {
    var e = {};
    state.entries.forEach(function (x) { if (libShard(x.id) === shard) e[x.id] = x; });
    return { e: e };
  }
  function progBody(shard) {
    var p = {};
    Object.keys(state.progress).forEach(function (id) { if (progShard(id) === shard) p[id] = state.progress[id]; });
    return { p: p };
  }

  // Save whatever changed since the last save.
  function persist() {
    if (store.mode === 'local') return persistLocal();
    if (store.mode !== 'cloud') return false;
    var cur = {}, patches = {}, rewrite = {};
    state.entries.forEach(function (e) {
      var j = JSON.stringify(e); cur[e.id] = j;
      if (store.written.e[e.id] !== j) { var s = libShard(e.id); (patches[s] = patches[s] || {})[e.id] = e; store.written.e[e.id] = j; }
    });
    Object.keys(store.written.e).forEach(function (id) { if (!cur[id]) { rewrite[libShard(id)] = true; delete store.written.e[id]; } });
    Object.keys(rewrite).forEach(function (s) { queueDoc('lib', s, 'e', {}, true, function () { return shardBody(s); }); });
    Object.keys(patches).forEach(function (s) { if (!rewrite[s]) queueDoc('lib', s, 'e', patches[s], false, function () { return shardBody(s); }); });

    var curP = {}, pPatch = {}, pRewrite = {};
    Object.keys(state.progress).forEach(function (id) {
      var j = JSON.stringify(state.progress[id]); curP[id] = j;
      if (store.written.p[id] !== j) { var s = progShard(id); (pPatch[s] = pPatch[s] || {})[id] = state.progress[id]; store.written.p[id] = j; }
    });
    Object.keys(store.written.p).forEach(function (id) { if (!curP[id]) { pRewrite[progShard(id)] = true; delete store.written.p[id]; } });
    Object.keys(pRewrite).forEach(function (s) { queueDoc('prog', s, 'p', {}, true, function () { return progBody(s); }); });
    Object.keys(pPatch).forEach(function (s) { if (!pRewrite[s]) queueDoc('prog', s, 'p', pPatch[s], false, function () { return progBody(s); }); });
    return true;
  }
  function persistStats(day) {
    if (store.mode === 'local') return persistLocal();
    var patch = {}; patch[day] = state.stats.days[day];
    queueDoc('meta', 'stats', 'days', patch, false, function () { return { days: state.stats.days }; });
  }
  function persistPrefs() {
    if (store.mode === 'local') return persistLocal();
    queueDoc('meta', 'prefs', null, {}, true, function () { return JSON.parse(JSON.stringify(state.prefs)); });
  }

  // Bring over anything saved in this browser by an earlier (browser-only) version.
  function maybeMigrate() {
    if (store.migrated || !store.firstLib || !store.firstProg) return;
    store.migrated = true;
    var flag = null;
    try { flag = window.localStorage.getItem('lawRevisionApp.migrated'); } catch (e) { return; }
    if (flag) return;
    var data = null;
    try { data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { data = null; }
    var changed = 0;
    if (data && Array.isArray(data.entries)) {
      data.entries.map(sanitizeEntry).filter(Boolean).forEach(function (le) {
        var se = byId(le.id);
        if (!se) { state.entries.push(le); changed++; }
        else if (le.updatedAt > se.updatedAt) { Object.assign(se, le); changed++; }
        else if (le.memorised && !se.memorised) { se.memorised = true; changed++; }
      });
      if (data.progress && typeof data.progress === 'object') {
        Object.keys(data.progress).forEach(function (id) {
          var lp = sanitizeProgress(data.progress[id]); var sp = state.progress[id];
          if (lp && byId(id) && (!sp || lp.last > sp.last)) { state.progress[id] = lp; changed++; }
        });
      }
    }
    try { window.localStorage.setItem('lawRevisionApp.migrated', nowISO()); } catch (e) { /* ignore */ }
    if (changed) {
      persist();
      renderAll();
      toast('Brought over ' + plural(changed, 'change') + ' you saved in this browser earlier.', { type: 'success', timeout: 7000 });
    }
  }

  /* ---------- source texts ---------- */
  function utf8Len(s) { try { return new TextEncoder().encode(s).length; } catch (e) { return s.length * 2; } }
  function splitParts(text) {
    var parts = [], i = 0;
    while (i < text.length) {
      var size = 90000, chunk = text.slice(i, i + size);
      while (utf8Len(chunk) > 230000 && size > 5000) { size = Math.floor(size * 0.75); chunk = text.slice(i, i + size); }
      parts.push(chunk); i += chunk.length;
    }
    return parts.length ? parts : [''];
  }
  function saveSource(meta, text) {
    meta = sanitizeSourceMeta(meta);
    store.textCache[meta.id] = text;
    if (store.mode === 'cloud') {
      var db = claudeCaps.db, parts = splitParts(text);
      meta.parts = parts.length;
      var chain = Promise.resolve();
      setSync('busy');
      parts.forEach(function (part, n) {
        chain = chain.then(function () { return db.collection('srctext').doc(meta.id + '_' + n).set({ sid: meta.id, n: n, text: part }); });
      });
      return chain.then(function () { return db.collection('src').doc(meta.id).set(meta); })
        .then(function () { if (!anyQueued()) setSync('ok'); if (!sourceById(meta.id)) state.sources.push(meta); return meta; },
          function (err) { setSync('error', err && err.code === 'quota_exceeded' ? 'Your claude.ai storage is full' : 'A source couldn\'t be saved'); throw err; });
    }
    try {
      var d = readLocalSources();
      d.meta = d.meta.filter(function (m) { return m.id !== meta.id; }).concat([meta]);
      d.text[meta.id] = text;
      writeLocalSources(d);
      if (!sourceById(meta.id)) state.sources.push(meta);
      return Promise.resolve(meta);
    } catch (e) {
      return Promise.reject({ code: 'quota_exceeded', message: 'Browser storage is full' });
    }
  }
  function loadSourceText(id) {
    if (store.textCache[id] != null) return Promise.resolve(store.textCache[id]);
    var meta = sourceById(id);
    if (!meta) return Promise.reject({ code: 'not_found' });
    if (store.mode === 'cloud') {
      var db = claudeCaps.db, gets = [];
      for (var n = 0; n < Math.max(1, meta.parts); n++) gets.push(db.collection('srctext').doc(id + '_' + n).get());
      return Promise.all(gets).then(function (snaps) {
        var text = snaps.map(function (s) { return s.exists ? String((s.data() || {}).text || '') : ''; }).join('');
        store.textCache[id] = text;
        return text;
      });
    }
    var d = readLocalSources();
    store.textCache[id] = String(d.text[id] || '');
    return Promise.resolve(store.textCache[id]);
  }
  function removeSource(id) {
    var meta = sourceById(id);
    state.sources = state.sources.filter(function (m) { return m.id !== id; });
    delete store.textCache[id];
    delete passageIndex.bySource[id];
    if (store.mode === 'cloud') {
      var db = claudeCaps.db, ops = [db.collection('src').doc(id).delete()];
      for (var n = 0; n < Math.max(1, meta ? meta.parts : 1); n++) ops.push(db.collection('srctext').doc(id + '_' + n).delete());
      return Promise.all(ops);
    }
    try {
      var d = readLocalSources();
      d.meta = d.meta.filter(function (m) { return m.id !== id; });
      delete d.text[id];
      writeLocalSources(d);
    } catch (e) { /* ignore */ }
    return Promise.resolve();
  }

  // Called after any change to cards or review progress.
  function commit() {
    state.settings.changedSinceBackup = true;
    saveUI();
    persist();
    renderAll();
  }
