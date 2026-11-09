/*
 * store.js: everything the app remembers, kept on this device only.
 *
 * - Settings, profile, firm notes, sessions and the real-interview log live in
 *   localStorage under one key (small text).
 * - Video and audio clips live in IndexedDB (large files), keyed by clip id.
 * Every read and write is wrapped so a private window or blocked storage never
 * breaks the app; it simply forgets on reload and says so.
 */
(function (g) {
  'use strict';
  const IT = g.IT = g.IT || {};
  const KEY = 'interview-trainer-v1';

  const DEFAULTS = () => ({
    v: 1,
    settings: {
      apiKey: '', model: 'claude-opus-5-5', factCheck: true,
      voice: true, voiceName: '', camera: true, record: true, answerMode: 'speak',
      harshness: 'tough', feedback: 'end', breathe: false
    },
    profile: { name: '', stage: '', education: '', experience: '', achievements: '', targets: '', extra: '' },
    firmNotes: {},
    sessions: [],
    log: [],
    seen: {},
    seeded: false
  });

  let state = DEFAULTS();
  let persistent = true;

  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    const out = Object.assign({}, base, saved);
    out.settings = Object.assign({}, base.settings, saved.settings || {});
    out.profile = Object.assign({}, base.profile, saved.profile || {});
    out.firmNotes = Object.assign({}, saved.firmNotes || {});
    out.sessions = Array.isArray(saved.sessions) ? saved.sessions : [];
    out.log = Array.isArray(saved.log) ? saved.log : [];
    out.seen = Object.assign({}, saved.seen || {});
    return out;
  }

  function load() {
    try {
      const raw = g.localStorage.getItem(KEY);
      state = merge(DEFAULTS(), raw ? JSON.parse(raw) : null);
    } catch (e) { state = DEFAULTS(); persistent = false; }
    seed();
    return state;
  }

  function save() {
    try { g.localStorage.setItem(KEY, JSON.stringify(state)); persistent = true; return true; }
    catch (e) { persistent = false; return false; }
  }

  /* First run: record the real Mishcon interview that prompted this app. */
  function seed() {
    if (state.seeded) return;
    state.seeded = true;
    state.log.unshift({
      id: 'log-mishcon-2026-11-09', date: '2026-11-09', firm: 'Mishcon de Reya', stage: 'AI interview (vacation scheme)',
      format: 'AI chat interview with follow-ups built from my answers',
      questions: [
        'Tell me about a time your integrity was challenged, and how you used that setback to build towards an advantage or something better.',
        'What news story have you been following recently?',
        'How is that story likely to impact a client of the firm?',
        'What will that mean for Mishcon\'s business development?'
      ],
      reflection: 'The hardest part was thinking on my feet: I could not predict the follow-ups, and they built on whatever I had just said. I felt out of my depth on the commercial chain (story -> client -> firm business development).',
      outcome: 'Awaiting result'
    });
    save();
  }

  const uid = p => (p || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

  /* ---------------- IndexedDB clips ---------------- */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!g.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      const req = g.indexedDB.open('interview-trainer-media', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('clips'); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB failed'));
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(d => new Promise((resolve, reject) => {
      const t = d.transaction('clips', mode);
      const store = t.objectStore('clips');
      let result;
      const r = fn(store);
      if (r) r.onsuccess = () => { result = r.result; };
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error || new Error('Storage error'));
      t.onabort = () => reject(t.error || new Error('Storage aborted (the disk may be full)'));
    }));
  }
  const clips = {
    put: (id, blob) => tx('readwrite', s => s.put(blob, id)),
    get: id => tx('readonly', s => s.get(id)),
    del: id => tx('readwrite', s => s.delete(id)),
    keys: () => tx('readonly', s => s.getAllKeys()),
    clear: () => tx('readwrite', s => s.clear())
  };

  async function usage() {
    try {
      if (g.navigator.storage && g.navigator.storage.estimate) {
        const e = await g.navigator.storage.estimate();
        return { used: e.usage || 0, quota: e.quota || 0 };
      }
    } catch (e) { /* not supported */ }
    return null;
  }
  async function askPersist() {
    try { if (g.navigator.storage && g.navigator.storage.persist) return await g.navigator.storage.persist(); } catch (e) { /* ignore */ }
    return false;
  }

  /* ---------------- backup ---------------- */
  function exportData() {
    const copy = JSON.parse(JSON.stringify(state));
    copy.settings.apiKey = ''; // never put the key in a file
    copy.exported = new Date().toISOString();
    return copy;
  }
  function importData(obj) {
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.sessions)) throw new Error('That file is not an Interview Trainer backup.');
    const key = state.settings.apiKey;
    const next = merge(DEFAULTS(), obj);
    next.settings.apiKey = key;
    next.seeded = true;
    // Keep sessions from both, newest first, no duplicates.
    const byId = new Map();
    state.sessions.concat(next.sessions).forEach(s => { if (s && s.id) byId.set(s.id, s); });
    next.sessions = Array.from(byId.values()).sort((a, b) => (b.started || 0) - (a.started || 0));
    const logById = new Map();
    state.log.concat(next.log).forEach(l => { if (l && l.id) logById.set(l.id, l); });
    next.log = Array.from(logById.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    state = next;
    save();
  }
  function resetAll() {
    const key = state.settings.apiKey;
    state = DEFAULTS();
    state.settings.apiKey = key;
    state.seeded = true;
    save();
    return clips.clear().catch(() => {});
  }

  IT.store = {
    load, save, uid, clips, usage, askPersist, exportData, importData, resetAll,
    get state() { return state; },
    get persistent() { return persistent; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
