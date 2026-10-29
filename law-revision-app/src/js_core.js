  /* ------------------------------------------------------------------
     D. APPLICATION STATE (kept in memory while the page is open)
     ------------------------------------------------------------------ */
  var STORAGE_KEY = 'lawRevisionApp.v1';        // library (offline copy)
  var SOURCES_KEY = 'lawRevisionApp.v1.sources'; // source texts (offline copy)
  var UI_KEY = 'lawRevisionApp.ui';              // per-device view settings
  var SCHEMA_VERSION = 2;
  var DAY = 86400000;

  var state = {
    entries: [],                     // all cards
    progress: {},                    // id -> spaced-repetition record
    stats: { days: {} },             // 'YYYY-MM-DD' -> [reviews, forgotten, new learned]
    prefs: { newPerDay: 15, exams: {}, autoPace: false, notDup: [], qstats: {} }, // synced study settings
    sources: [],                     // source metadata (texts load on demand)
    notes: [],                       // lecture notes
    commentFor: null,
    settings: {
      view: 'card', cram: false, sort: 'module', typeFilter: 'all', statusFilter: 'all',
      lastBackup: null, changedSinceBackup: false,
      mock: { scenarioId: null, answer: '', module: 'random', custom: null },
      direction: 'name', askMode: 'notes'
    },
    filter: 'all',                   // current module tab
    query: '',                       // current search text
    revealed: {}, expanded: {},
    editingId: null,
    loaded: false
  };

  /* ------------------------------------------------------------------
     E. SMALL UTILITIES
     ------------------------------------------------------------------ */
  function $(sel) { return document.querySelector(sel); }
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function regexEscape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function uid(prefix) { return (prefix || 'a') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function nowISO() { return new Date().toISOString(); }
  function plural(n, word, many) { return n + ' ' + (n === 1 ? word : (many || word + 's')); }
  function cardsWord(n) { return plural(n, 'card'); }
  function byId(id) { for (var i = 0; i < state.entries.length; i++) if (state.entries[i].id === id) return state.entries[i]; return null; }
  function sourceById(id) { for (var i = 0; i < state.sources.length; i++) if (state.sources[i].id === id) return state.sources[i]; return null; }

  function parseTags(input) {
    var seen = {};
    return String(input || '')
      .split(/[\s,;]+/)
      .map(function (t) { return t.replace(/^#+/, '').trim().toLowerCase().replace(/[^\p{L}\p{N}\-_]/gu, ''); })
      .filter(function (t) { if (!t || seen[t]) return false; seen[t] = true; return true; })
      .slice(0, 40);
  }
  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(t) { var d = new Date(t == null ? Date.now() : t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function startOfDay(t) { var d = new Date(t == null ? Date.now() : t); d.setHours(0, 0, 0, 0); return d.getTime(); }

  // Stable 32-bit hash (FNV-1a). Decides which storage shard a card lives in.
  function hash32(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  // Loose text form used to compare quotes and names.
  function normText(s) {
    return String(s || '').toLowerCase()
      .replace(/-\s*\n\s*/g, '').replace(/[‘’‛`´]/g, "'").replace(/[“”„]/g, '"')
      .replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ').trim();
  }
  function nameKey(s) { return normText(s).replace(/[^a-z0-9 ]/g, '').replace(/\b(the|ltd|plc|and|co|of)\b/g, '').replace(/\s+/g, ' ').trim(); }

  /* ------------------------------------------------------------------
     F. DATA VALIDATION — every card (new, edited, imported or synced)
        passes through here so the library never holds broken records.
     ------------------------------------------------------------------ */
  function cleanString(v, max) { return v == null ? '' : String(v).slice(0, max || 20000); }
  function sanitizeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var name = cleanString(raw.name, 300).trim();
    if (!name) return null;
    var module = MODULE_LABEL[raw.module] ? raw.module : null;
    if (!module) {
      var match = MODULES.filter(function (m) { return String(raw.module || '').toLowerCase() === m.label.toLowerCase(); })[0];
      module = match ? match.id : null;
    }
    if (!module) return null;
    var tags = Array.isArray(raw.tags) ? parseTags(raw.tags.join(' ')) : parseTags(raw.tags);
    var created = raw.createdAt && !isNaN(new Date(raw.createdAt).getTime()) ? raw.createdAt : nowISO();
    var updated = raw.updatedAt && !isNaN(new Date(raw.updatedAt).getTime()) ? raw.updatedAt : created;
    var id = typeof raw.id === 'string' ? raw.id.trim().replace(/[^A-Za-z0-9_\-.~:@+]/g, '-').slice(0, 120) : '';
    var out = {
      id: id || uid(),
      module: module,
      topic: cleanString(raw.topic, 200).trim(),
      type: raw.type === 'statute' || raw.type === 'principle' ? raw.type : 'case',
      name: name,
      citation: cleanString(raw.citation, 300).trim(),
      facts: cleanString(raw.facts).trim(),
      ratio: cleanString(raw.ratio).trim(),
      strategy: cleanString(raw.strategy).trim(),
      tags: tags,
      memorised: raw.memorised === true,
      verified: raw.verified === true,
      key: raw.key === true,
      comments: Array.isArray(raw.comments) ? raw.comments.filter(function (c) { return c && typeof c.text === 'string' && c.text.trim(); }).slice(-50).map(function (c) {
        return { id: typeof c.id === 'string' ? c.id.slice(0, 40) : uid('c'), text: cleanString(c.text, 4000).trim(), at: c.at && !isNaN(new Date(c.at).getTime()) ? c.at : nowISO() };
      }) : [],
      sourceId: cleanString(raw.sourceId, 120).trim(),
      sourceRef: cleanString(raw.sourceRef, 120).trim(),
      sourceQuote: cleanString(raw.sourceQuote, 1000).trim(),
      createdAt: created,
      updatedAt: updated
    };
    var fmt = sanitizeFmt(raw.fmt, out);
    if (fmt) out.fmt = fmt;
    return out;
  }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function sanitizeProgress(p) {
    if (!p || typeof p !== 'object') return null;
    var due = num(p.due, NaN);
    if (!isFinite(due)) return null;
    return {
      due: due, ivl: Math.max(0, num(p.ivl, 0)), ease: Math.min(3.5, Math.max(1.3, num(p.ease, 2.5))),
      reps: Math.max(0, Math.round(num(p.reps, 0))), lapses: Math.max(0, Math.round(num(p.lapses, 0))), last: num(p.last, 0)
    };
  }
  function sanitizePrefs(v) {
    v = v && typeof v === 'object' ? v : {};
    var out = { newPerDay: Math.max(0, Math.min(200, num(v.newPerDay, 15))), exams: {}, autoPace: v.autoPace === true, notDup: [] };
    if (v.exams && typeof v.exams === 'object') MODULES.forEach(function (m) {
      if (typeof v.exams[m.id] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.exams[m.id])) out.exams[m.id] = v.exams[m.id];
    });
    if (Array.isArray(v.notDup)) out.notDup = v.notDup.filter(function (k) { return typeof k === 'string' && k.length < 2000; }).slice(-500);
    out.qstats = {};
    if (v.qstats && typeof v.qstats === 'object') Object.keys(v.qstats).slice(0, 300).forEach(function (k) {
      var s = v.qstats[k];
      if (!s || typeof s !== 'object' || k.length > 300) return;
      out.qstats[k] = { lv: Math.max(1, Math.min(5, num(s.lv, 3))), n: Math.max(0, Math.round(num(s.n, 0))), r: Math.max(0, Math.round(num(s.r, 0))), at: typeof s.at === 'string' ? s.at.slice(0, 40) : '' };
    });
    return out;
  }
  function sanitizeSourceMeta(m) {
    if (!m || typeof m !== 'object' || !m.id) return null;
    return {
      id: String(m.id).replace(/[^A-Za-z0-9_\-.~:@+]/g, '-').slice(0, 100),
      title: cleanString(m.title, 200).trim() || 'Untitled source',
      module: MODULE_LABEL[m.module] ? m.module : '',
      kind: ['pdf', 'docx', 'text'].indexOf(m.kind) !== -1 ? m.kind : 'text',
      pages: Math.max(0, Math.round(num(m.pages, 0))),
      chars: Math.max(0, Math.round(num(m.chars, 0))),
      parts: Math.max(0, Math.round(num(m.parts, 0))),
      createdAt: m.createdAt || nowISO()
    };
  }

  /* ------------------------------------------------------------------
     G. PER-DEVICE VIEW SETTINGS (always in this browser)
     ------------------------------------------------------------------ */
  function loadUI() {
    var raw = null;
    try { raw = window.localStorage.getItem(UI_KEY); } catch (e) { /* storage blocked */ }
    var s = null;
    try { s = raw ? JSON.parse(raw) : null; } catch (e) { s = null; }
    if (!s) {
      // Older versions kept view settings inside the library blob.
      try { var old = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null'); s = old && old.settings; } catch (e) { s = null; }
    }
    if (!s || typeof s !== 'object') return;
    var t = state.settings;
    t.view = s.view === 'list' ? 'list' : 'card';
    t.cram = s.cram === true;
    t.sort = typeof s.sort === 'string' && s.sort !== 'unmemorised' ? s.sort : 'module';
    t.typeFilter = ['case', 'statute', 'principle'].indexOf(s.typeFilter) !== -1 ? s.typeFilter : 'all';
    t.statusFilter = typeof s.statusFilter === 'string' ? s.statusFilter : 'all';
    t.lastBackup = s.lastBackup || null;
    t.changedSinceBackup = s.changedSinceBackup === true;
    t.direction = ['name', 'rule', 'mixed'].indexOf(s.direction) !== -1 ? s.direction : 'name';
    t.askMode = s.askMode === 'open' ? 'open' : 'notes';
    t.backupNudge = typeof s.backupNudge === 'string' ? s.backupNudge : null;
    if (s.extraNew && typeof s.extraNew === 'object') t.extraNew = s.extraNew;
    if (s.mock && typeof s.mock === 'object') {
      t.mock.scenarioId = s.mock.scenarioId || null;
      t.mock.answer = typeof s.mock.answer === 'string' ? s.mock.answer : '';
      t.mock.module = typeof s.mock.module === 'string' ? s.mock.module : 'random';
      t.mock.custom = s.mock.custom && typeof s.mock.custom === 'object' ? s.mock.custom : null;
    }
  }
  function saveUI() {
    try { window.localStorage.setItem(UI_KEY, JSON.stringify(state.settings)); } catch (e) { /* not critical */ }
  }

  /* ------------------------------------------------------------------
     H. TOASTS, MODALS, DIALOGS
     ------------------------------------------------------------------ */
  function toast(message, opts) {
    opts = opts || {};
    var el = document.createElement('div');
    el.className = 'toast' + (opts.type ? ' ' + opts.type : '');
    var span = document.createElement('span');
    span.textContent = message;
    el.appendChild(span);
    var timer;
    var close = function () { clearTimeout(timer); if (el.parentNode) el.parentNode.removeChild(el); };
    if (opts.actionLabel) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = opts.actionLabel;
      b.onclick = function () { close(); if (opts.onAction) opts.onAction(); };
      el.appendChild(b);
    }
    var stack = $('#toastStack');
    while (stack.children.length >= 3) stack.removeChild(stack.firstChild);
    stack.appendChild(el);
    timer = setTimeout(close, opts.timeout || 3500);
  }

  var openModals = [];
  var lastFocus = [];
  function openModal(m) {
    if (!m.hidden) return;
    lastFocus.push(document.activeElement);
    m.hidden = false;
    openModals.push(m);
    document.body.classList.add('modal-open');
  }
  function closeModal(m, dismissed) {
    if (!m || m.hidden) return;
    m.hidden = true;
    openModals = openModals.filter(function (x) { return x !== m; });
    if (!openModals.length) document.body.classList.remove('modal-open');
    if (typeof m._onClose === 'function') m._onClose();
    if (dismissed && typeof m._onDismiss === 'function') { var fn = m._onDismiss; m._onDismiss = null; fn(); }
    var f = lastFocus.pop();
    if (f && typeof f.focus === 'function' && document.contains(f)) { try { f.focus(); } catch (e) { /* ignore */ } }
  }
  function topModal() { return openModals[openModals.length - 1] || null; }

  // A replacement for confirm(): resolves to the chosen button's value (null if dismissed).
  function dialog(opts) {
    return new Promise(function (resolve) {
      var m = $('#dialogModal');
      $('#dialogTitle').textContent = opts.title;
      $('#dialogMessage').textContent = opts.message;
      var box = $('#dialogButtons');
      box.innerHTML = '';
      opts.buttons.forEach(function (b) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn ' + (b.style || '');
        btn.textContent = b.label;
        btn.onclick = function () { m._onDismiss = null; closeModal(m); resolve(b.value); };
        box.appendChild(btn);
      });
      m._onDismiss = function () { resolve(null); };
      openModal(m);
      var primary = box.querySelector('.btn-primary, .btn-danger') || box.querySelector('button');
      if (primary) primary.focus();
    });
  }

  function copyToClipboard(text) {
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    };
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }
  function copyOrShow(text, okMsg) {
    copyToClipboard(text).then(function (ok) {
      if (ok) { toast(okMsg || 'Copied. Paste it into a Claude chat.', { type: 'success' }); return; }
      $('#clipboardText').value = text;
      openModal($('#clipboardModal'));
      setTimeout(function () { var t = $('#clipboardText'); t.focus(); t.select(); }, 50);
    });
  }
