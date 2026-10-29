  /* ------------------------------------------------------------------
     U5. FRIENDS' EDITION — the same app published separately for friends.
         Each person's library lives in their own browser (IndexedDB, which
         holds far more than localStorage) and starts as a copy of a starter
         library built into the page. Claude features still work: they run
         on each viewer's own claude.ai account.
         In the main edition EDITION is 'main' and this layer just passes
         through to localStorage.
     ------------------------------------------------------------------ */
  var KV_DB = 'lawRevisionApp', KV_STORE = 'kv';
  var kvMem = null, kvDB = null, kvFailed = false;

  function kvGet(k) {
    if (!kvMem) return window.localStorage.getItem(k);
    return Object.prototype.hasOwnProperty.call(kvMem, k) ? kvMem[k] : null;
  }
  function kvSet(k, v) {
    if (!kvMem) { window.localStorage.setItem(k, v); return; }
    kvMem[k] = v;
    try {
      var tx = kvDB.transaction(KV_STORE, 'readwrite');
      tx.objectStore(KV_STORE).put(v, k);
      tx.onerror = tx.onabort = function () { kvWriteFailed(tx.error); };
    } catch (e) { kvWriteFailed(e); }
  }
  function kvWriteFailed(err) {
    var full = err && err.name === 'QuotaExceededError';
    setSync('error', full ? 'Browser storage is full' : 'Could not save in this browser');
    if (kvFailed) return;
    kvFailed = true;
    toast((full ? 'This browser has run out of space, so changes are not being saved.' : 'Changes could not be saved in this browser.') +
      ' Export a backup now to keep your work safe.', { type: 'error', timeout: 10000 });
  }
  // Load everything kept in IndexedDB into memory. If IndexedDB can't be used (e.g. some private windows),
  // fall back to localStorage, which still works for a smaller library.
  function kvOpen() {
    return new Promise(function (resolve) {
      var req;
      try { req = window.indexedDB.open(KV_DB, 1); } catch (e) { resolve(false); return; }
      req.onupgradeneeded = function () { req.result.createObjectStore(KV_STORE); };
      req.onerror = req.onblocked = function () { resolve(false); };
      req.onsuccess = function () {
        var db = req.result, mem = {};
        try {
          var cur = db.transaction(KV_STORE, 'readonly').objectStore(KV_STORE).openCursor();
          cur.onsuccess = function () {
            var c = cur.result;
            if (c) { mem[c.key] = c.value; c.continue(); return; }
            kvDB = db; kvMem = mem; resolve(true);
          };
          cur.onerror = function () { resolve(false); };
        } catch (e) { resolve(false); }
      };
    });
  }
  // A brand-new friend: give them their own copy of the starter library.
  function seedFromStarter() {
    state.entries = (STARTER.entries || []).map(function (e) {
      var copy = JSON.parse(JSON.stringify(e));
      copy.verified = copy.verified === true;
      return sanitizeEntry(copy);
    }).filter(Boolean);
    var src = STARTER.sources || { meta: [], text: {} };
    try { writeLocalSources({ meta: src.meta || [], text: src.text || {} }); } catch (e) { /* reported by kvSet */ }
    persistLocal();
    setTimeout(function () {
      toast('Welcome! Your library starts with ' + cardsWord(state.entries.length) + ' and ' + (src.meta || []).length +
        ' sources. It\'s yours to change, and it\'s saved in this browser.', { type: 'success', timeout: 9000 });
    }, 400);
  }
