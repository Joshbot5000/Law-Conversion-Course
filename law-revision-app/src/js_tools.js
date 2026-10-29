  /* ------------------------------------------------------------------
     U2. STUDY TOOLS: exam pacing, checking cards against sources,
         finding duplicates, links between related cards, backup nudge
     ------------------------------------------------------------------ */

  /* ---- Exam dates and pacing ---- */
  function examDays(mod) {
    var d = state.prefs.exams[mod];
    if (!d) return null;
    var t = new Date(d + 'T00:00:00').getTime();
    var left = Math.round((t - startOfDay()) / DAY);
    return left >= 0 ? left : null;
  }
  // For each module with an upcoming exam: how many new cards a day finish it with time to spare.
  function examPlan() {
    return MODULES.map(function (m) {
      var left = examDays(m.id);
      if (left == null) return null;
      var unseen = state.entries.filter(function (e) { return e.module === m.id && !state.progress[e.id]; }).length;
      var buffer = left > 28 ? 14 : Math.floor(left / 2);
      var learnDays = Math.max(1, left - buffer);
      return { module: m.id, date: state.prefs.exams[m.id], left: left, unseen: unseen, buffer: buffer, need: Math.ceil(unseen / learnDays) };
    }).filter(Boolean).sort(function (a, b) { return a.left - b.left; });
  }
  function plannedNewPerDay() { return examPlan().reduce(function (s, p) { return s + p.need; }, 0); }
  function effectiveNewPerDay() {
    var base = state.prefs.newPerDay;
    if (!state.prefs.autoPace) return base;
    return Math.max(base, Math.min(100, plannedNewPerDay()));
  }
  function examRank(mod) { var left = examDays(mod); return left == null ? 100000 : left; }

  function openPlan() { renderPlan(); openModal($('#planModal')); }
  function renderPlan() {
    var plan = {}; examPlan().forEach(function (p) { plan[p.module] = p; });
    var rows = MODULES.map(function (m) {
      var cards = state.entries.filter(function (e) { return e.module === m.id; });
      if (!cards.length && !state.prefs.exams[m.id]) return '';
      var unseen = cards.filter(function (e) { return !state.progress[e.id]; }).length;
      var p = plan[m.id];
      var info = p
        ? (p.unseen ? '<b>' + p.need + '</b> new a day · ' + plural(p.left, 'day') + ' left' + (p.buffer ? ', last ' + p.buffer + ' for revision only' : '') : '✓ every card started · ' + plural(p.left, 'day') + ' left')
        : (state.prefs.exams[m.id] ? '<span class="muted">Exam date has passed</span>' : '<span class="muted">No exam date</span>');
      return '<div class="plan-row"><div><b>' + esc(m.label) + '</b><span>' + plural(cards.length, 'card') + ' · ' + unseen + ' not started</span></div>' +
        '<label class="sr-only" for="exam-' + m.id + '">Exam date for ' + esc(m.label) + '</label>' +
        '<input class="input" type="date" id="exam-' + m.id + '" data-exam="' + m.id + '" value="' + esc(state.prefs.exams[m.id] || '') + '">' +
        '<div class="plan-info">' + info + '</div></div>';
    }).join('');
    var planned = plannedNewPerDay();
    var eff = effectiveNewPerDay();
    var verdict = '';
    if (Object.keys(plan).length) {
      verdict = state.prefs.autoPace
        ? 'Auto-pacing is on: you\'ll get <b>' + eff + '</b> new cards a day (your plan needs ' + planned + ', your minimum is ' + state.prefs.newPerDay + ').'
        : (planned > state.prefs.newPerDay
          ? '<span class="warn">⚠ Behind: your exams need about <b>' + planned + '</b> new cards a day but you\'re set to ' + state.prefs.newPerDay + '. Turn on auto-pacing or raise your daily number.</span>'
          : '✓ On track: your plan needs ' + planned + ' new cards a day and you\'re set to ' + state.prefs.newPerDay + '.');
      if (planned > 60) verdict += ' <span class="warn">That\'s a heavy load – consider starting earlier or prioritising key topics.</span>';
    }
    $('#planBody').innerHTML =
      '<p class="muted" style="margin-top:0">Add your exam dates. The plan spreads each module\'s unstarted cards over the time left, keeping the final two weeks (or half the time, if less) for revision only. Modules with the nearest exam come first in your reviews.</p>' +
      '<div class="plan-list">' + (rows || '<p class="muted">Add some cards first.</p>') + '</div>' +
      '<label class="plan-auto"><input type="checkbox" id="autoPace"' + (state.prefs.autoPace ? ' checked' : '') + '> Auto-pace: raise my new cards a day to match the plan (never below my usual ' + state.prefs.newPerDay + ')</label>' +
      (verdict ? '<p class="plan-verdict">' + verdict + '</p>' : '');
  }
  function planChange(ev) {
    var t = ev.target;
    if (t.matches('[data-exam]')) {
      var mod = t.getAttribute('data-exam');
      if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) state.prefs.exams[mod] = t.value; else delete state.prefs.exams[mod];
    } else if (t.id === 'autoPace') state.prefs.autoPace = t.checked;
    else return;
    persistPrefs();
    renderPlan();
    renderAll();
  }
  function examLine(mod) {
    var plan = examPlan().filter(function (p) { return mod === 'all' || p.module === mod; });
    if (!plan.length) return '<div class="exam-line"><button type="button" class="linklike" data-today="plan">📅 Add exam dates to pace your learning</button></div>';
    var next = plan[0];
    var need = plan.reduce(function (s, p) { return s + p.need; }, 0);
    var behind = need > effectiveNewPerDay();
    return '<div class="exam-line' + (behind ? ' behind' : '') + '">📅 ' + esc(MODULE_LABEL[next.module]) + ' exam in <b>' + plural(next.left, 'day') + '</b>' +
      (plan.length > 1 ? ' (+' + (plan.length - 1) + ' more)' : '') + ' · ' +
      (need ? need + ' new a day needed' + (behind ? ' – <b>behind</b>' : ' – on track') : 'all cards started') +
      ' <button type="button" class="linklike" data-today="plan">Plan</button></div>';
  }

  /* ---- Checking cards against their sources ---- */
  var vq = null;
  function openVerify(module) {
    vq = { module: module || 'all', ids: [], i: 0, checked: 0, texts: {} };
    $('#vqModule').innerHTML = '<option value="all">All modules</option>' + MODULES.map(function (m) { return '<option value="' + m.id + '">' + esc(m.label) + '</option>'; }).join('');
    $('#vqModule').value = vq.module;
    buildVerifyQueue();
    openModal($('#verifyModal'));
    renderVerify();
  }
  function buildVerifyQueue() {
    vq.ids = state.entries.filter(function (e) { return !e.verified && (vq.module === 'all' || e.module === vq.module); })
      .sort(textbookOrder).map(function (e) { return e.id; });
    vq.i = 0;
  }
  function verifyCurrent() {
    while (vq && vq.i < vq.ids.length) {
      var e = byId(vq.ids[vq.i]);
      if (e && !e.verified) return e;
      vq.ids.splice(vq.i, 1);
    }
    return null;
  }
  function renderVerify() {
    if (!vq) return;
    var body = $('#verifyBody'), e = verifyCurrent();
    var scope = state.entries.filter(function (x) { return vq.module === 'all' || x.module === vq.module; });
    var ver = scope.filter(function (x) { return x.verified; }).length;
    $('#vqProgress').textContent = ver + ' of ' + scope.length + ' verified' + (vq.checked ? ' · ' + vq.checked + ' this session' : '');
    $('#vqBar').style.width = (scope.length ? Math.round(ver / scope.length * 100) : 0) + '%';
    if (!e) {
      body.innerHTML = '<div class="empty" style="margin:10px 0"><h3>✓ Nothing left to check here</h3><p>' +
        (vq.ids.length === 0 && scope.length ? 'Every card in this scope has been verified.' : 'You\'ve been through every unchecked card in this scope.') + '</p></div>';
      $('#verifyFoot').hidden = true;
      return;
    }
    $('#verifyFoot').hidden = false;
    var L = LABELS[e.type];
    var left = vq.ids.length - vq.i;
    body.innerHTML =
      '<div class="vq-grid"><section class="vq-card">' +
        '<div class="card-meta">' + typeBadge(e) + '<span class="chip">' + esc(MODULE_LABEL[e.module]) + '</span>' + (e.topic ? '<span class="chip">' + esc(e.topic) + '</span>' : '') + '<span class="chip">' + left + ' left</span></div>' +
        '<h3 class="card-title">' + esc(e.name) + '</h3>' +
        (e.citation ? '<div class="card-citation">' + esc(e.citation) + '</div>' : '') +
        [[L[0], e.facts], [L[1], e.ratio], [L[2], e.strategy]].map(function (f) {
          return '<div class="vq-field"><div class="field-label">' + f[0] + '</div><div class="field-text' + (f[1] ? '' : ' is-empty') + '">' + (f[1] ? esc(f[1]) : 'Not added yet') + '</div></div>';
        }).join('') +
      '</section><section class="vq-source" id="vqSource">' + verifySourceHTML(e) + '</section></div>';
    centerPassage();
    if (e.sourceId && vq.texts[e.sourceId] === undefined) {
      vq.texts[e.sourceId] = null;
      loadSourceText(e.sourceId).then(function (t) { vq.texts[e.sourceId] = t; if (vq && verifyCurrent() === e) { $('#vqSource').innerHTML = verifySourceHTML(e); centerPassage(); } },
        function () { vq.texts[e.sourceId] = false; if (vq && verifyCurrent() === e) $('#vqSource').innerHTML = verifySourceHTML(e); });
    }
  }
  function centerPassage() {
    var box = $('#vqSource .vq-passage'), m = box && box.querySelector('mark');
    if (m) box.scrollTop = Math.max(0, m.offsetTop - box.clientHeight / 3);
  }
  function verifySourceHTML(e) {
    var s = e.sourceId ? sourceById(e.sourceId) : null;
    if (!s) return '<h4>Source</h4><p class="muted">No source is linked to this card. Check it against your textbook or notes, then verify or edit it.</p>';
    var head = '<h4>' + esc(s.title) + (e.sourceRef ? ' · ' + esc(e.sourceRef) : '') + '</h4>';
    var text = vq.texts[e.sourceId];
    if (text === null || text === undefined) return head + '<div class="loading"><span class="spinner"></span>Loading the passage…</div>';
    if (text === false) return head + '<p class="muted">Couldn\'t load this source.</p>';
    var hit = findQuote(text, e.sourceQuote);
    if (!hit) {
      var i = text.toLowerCase().indexOf(e.name.split(' – ')[0].toLowerCase());
      if (i !== -1) hit = { start: i, end: i + e.name.split(' – ')[0].length };
    }
    var btn = '<button type="button" class="btn btn-sm" data-vq="source">Open full source</button>';
    if (!hit) return head + '<p class="muted">The quoted passage couldn\'t be found automatically.</p>' + btn;
    var a = Math.max(0, hit.start - 700), b = Math.min(text.length, hit.end + 1100);
    var clip = function (s) { return esc(s.replace(/\f/g, '\n')); };
    return head + '<div class="vq-passage">' + (a > 0 ? '… ' : '') + clip(text.slice(a, hit.start)) + '<mark>' + clip(text.slice(hit.start, hit.end)) + '</mark>' +
      clip(text.slice(hit.end, b)) + (b < text.length ? ' …' : '') + '</div><p class="foot-note" style="margin:8px 0 0">Page ' + pageAt(text, hit.start) + ' of the source. ' + btn + '</p>';
  }
  function verifyAction(a) {
    var e = verifyCurrent();
    if (a === 'source' && e) { openEntrySource(e.id); return; }
    if (!e) return;
    if (a === 'ok') {
      e.verified = true; e.updatedAt = nowISO(); vq.checked++;
      commit();
      vq.ids.splice(vq.i, 1);
    } else if (a === 'skip') vq.i++;
    else if (a === 'back') vq.i = Math.max(0, vq.i - 1);
    else if (a === 'edit') { openForm(e.id); return; }
    if (vq.i >= vq.ids.length && vq.ids.length) vq.i = vq.ids.length;
    renderVerify();
  }

  /* ---- Finding duplicates ---- */
  var DUP_STOP = { r: 1, the: 1, ltd: 1, plc: 1, co: 1, company: 1, and: 1, of: 1, limited: 1, corp: 1, corporation: 1, inc: 1, llp: 1, re: 1 };
  function sigWords(s) { return normText(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (w) { return w && !DUP_STOP[w]; }); }
  function dupKeys(e) {
    var base = e.type === 'case' ? e.name.split(' – ')[0] : e.name;
    var keys = [e.type + '#n:' + nameKey(base)];
    (base.match(/\(the [^)]+\)/gi) || []).forEach(function (p) { keys.push(e.type + '#n:' + nameKey(p.slice(1, -1))); });
    if (e.type === 'case') {
      var sides = base.split(/\s+v\.?\s+/i);
      if (sides.length === 2) {
        var a = sigWords(sides[0].replace(/\(the [^)]+\)/gi, '')), b = sigWords(sides[1].replace(/\(the [^)]+\)/gi, '').split(/,\s*ex p/i)[0]);
        var exp = (/ex\s+p(?:arte)?\s+([A-Za-z]+)/i.exec(base) || [])[1] || '';
        var nums = (base.match(/\([^)]*\d[^)]*\)|\((?:CA|HL|PC|UKSC|SC)\)/g) || []).map(function (p) { return p.replace(/[^\dA-Z]+/g, ' ').trim(); }).join(' ');
        if (b.length) keys.push('case#p:' + (a[0] || '') + '|' + b[0] + '|' + exp.toLowerCase() + '|' + nums);
      }
    }
    return keys;
  }
  function findDuplicateGroups() {
    var parent = {}, owner = {};
    var find = function (x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    state.entries.forEach(function (e) {
      parent[e.id] = e.id;
      dupKeys(e).forEach(function (k) {
        if (owner[k]) { var ra = find(e.id), rb = find(owner[k]); if (ra !== rb) parent[ra] = rb; }
        else owner[k] = e.id;
      });
    });
    var groups = {};
    state.entries.forEach(function (e) { var r = find(e.id); (groups[r] = groups[r] || []).push(e); });
    var dismissed = {}; state.prefs.notDup.forEach(function (k) { dismissed[k] = true; });
    return Object.keys(groups).map(function (k) { return groups[k]; })
      .filter(function (g) { return g.length > 1 && !dismissed[groupKey(g)]; })
      .sort(function (a, b) { return a[0].name.localeCompare(b[0].name, 'en', { sensitivity: 'base' }); });
  }
  function groupKey(g) { return g.map(function (e) { return e.id; }).sort().join('|'); }
  function keepScore(e) {
    var p = state.progress[e.id];
    return (e.sourceId ? 3 : 0) + (e.verified ? 2 : 0) + (p ? Math.min(5, p.reps) : 0) + (e.facts + e.ratio + e.strategy).length / 1500;
  }
  var dupState = null;
  function openDuplicates() { dupState = { groups: findDuplicateGroups(), keep: {} }; renderDuplicates(); openModal($('#dupModal')); }
  function renderDuplicates() {
    var g = dupState.groups;
    $('#dupCount').textContent = g.length ? plural(g.length, 'possible duplicate') + ' found' : '';
    if (!g.length) {
      $('#dupBody').innerHTML = '<div class="empty" style="margin:10px 0"><h3>✓ No duplicates found</h3><p>Every card in your library has a unique name.</p></div>';
      return;
    }
    var exact = g.filter(exactGroup).length;
    $('#dupBody').innerHTML = (exact ? '<div class="dup-bulk"><span><b>' + plural(exact, 'group') + '</b> ' + (exact === 1 ? 'has' : 'have') + ' identical names.</span><button type="button" class="btn btn-primary btn-sm" data-dupall="1">Merge all exact matches</button></div>' : '') +
      '<p class="muted" style="margin-top:0">Choose the card to keep. Merging fills any empty fields from the other copies, combines their tags, keeps the strongest review history and removes the extra copies. You can undo straight afterwards.</p>' +
      g.map(function (group, gi) {
        var keepId = dupState.keep[gi] || group.slice().sort(function (a, b) { return keepScore(b) - keepScore(a); })[0].id;
        dupState.keep[gi] = keepId;
        return '<section class="dup-group" data-g="' + gi + '"><h4>' + esc(group[0].name) + '</h4>' +
          group.map(function (e) {
            return '<label class="dup-item' + (e.id === keepId ? ' keep' : '') + '"><input type="radio" name="keep' + gi + '" value="' + esc(e.id) + '"' + (e.id === keepId ? ' checked' : '') + '>' +
              '<div><div class="card-meta">' + typeBadge(e) + '<span class="chip">' + esc(MODULE_LABEL[e.module]) + '</span>' + srsChip(e) + (e.verified ? '<span class="chip">✓ Verified</span>' : '') + '</div>' +
              '<b>' + esc(e.name) + '</b>' + (e.citation ? ' <span class="muted">' + esc(e.citation) + '</span>' : '') +
              '<small>' + esc(e.topic || 'No topic') + (sourceLabel(e) ? ' · Source: ' + esc(sourceLabel(e)) : ' · No source') + '</small>' +
              '<p>' + esc((e.ratio || e.facts || '').slice(0, 240)) + ((e.ratio || e.facts || '').length > 240 ? '…' : '') + '</p></div></label>';
          }).join('') +
          '<div class="dup-actions"><button type="button" class="btn btn-sm" data-dup="peek">Compare in full</button><button type="button" class="btn btn-sm" data-dup="not">Not duplicates</button>' +
          '<button type="button" class="btn btn-sm btn-primary" data-dup="merge">Merge into the selected card</button></div></section>';
      }).join('');
  }
  function exactGroup(g) { var k = nameKey(g[0].name.replace(/[’']/g, '')); return g.every(function (e) { return e.module === g[0].module && nameKey(e.name.replace(/[’']/g, '')) === k; }); }
  function snapshotLibrary() {
    return { entries: state.entries.slice(), copies: state.entries.map(function (e) { return JSON.parse(JSON.stringify(e)); }), progress: JSON.parse(JSON.stringify(state.progress)) };
  }
  function restoreLibrary(snap) {
    snap.entries.forEach(function (e, i) { var c = snap.copies[i]; Object.keys(e).forEach(function (k) { delete e[k]; }); Object.keys(c).forEach(function (k) { e[k] = c[k]; }); e.updatedAt = nowISO(); });
    state.entries = snap.entries; state.progress = snap.progress; commit();
    if (!$('#dupModal').hidden) { dupState = { groups: findDuplicateGroups(), keep: {} }; renderDuplicates(); }
  }
  function mergeInto(group, keep) {
    var others = group.filter(function (e) { return e.id !== keep.id; });
    others.forEach(function (o) {
      ['citation', 'topic', 'facts', 'ratio', 'strategy'].forEach(function (f) {
        if (keep[f] || !o[f]) return;
        keep[f] = o[f];
        if (o.fmt && o.fmt[f]) { keep.fmt = keep.fmt || {}; keep.fmt[f] = o.fmt[f]; }
      });
      var yr = (/\d{4}/.exec(keep.citation) || [])[0];
      if (yr && o.citation.length > keep.citation.length && o.citation.indexOf(yr) !== -1 && !/;/.test(o.citation)) keep.citation = o.citation;
      if (!keep.sourceId && o.sourceId) { keep.sourceId = o.sourceId; keep.sourceRef = o.sourceRef; keep.sourceQuote = o.sourceQuote; }
      o.tags.forEach(function (t) { if (keep.tags.indexOf(t) === -1) keep.tags.push(t); });
      keep.memorised = keep.memorised || o.memorised;
    });
    var best = null;
    group.forEach(function (e) { var p = state.progress[e.id]; if (p && (!best || p.reps > best.reps || (p.reps === best.reps && p.ivl > best.ivl))) best = p; });
    if (best) state.progress[keep.id] = JSON.parse(JSON.stringify(best));
    var drop = {}; others.forEach(function (o) { drop[o.id] = true; delete state.progress[o.id]; });
    state.entries = state.entries.filter(function (e) { return !drop[e.id]; });
    keep.updatedAt = nowISO();
  }
  function mergeGroup(gi) {
    var group = dupState.groups[gi], keep = byId(dupState.keep[gi]);
    if (!group || !keep) return;
    var snap = snapshotLibrary();
    mergeInto(group, keep);
    commit();
    dupState.groups.splice(gi, 1); dupState.keep = {};
    renderDuplicates();
    toast('Merged into “' + keep.name + '”.', { type: 'success', timeout: 8000, actionLabel: 'Undo', onAction: function () { restoreLibrary(snap); toast('Merge undone.'); } });
  }
  function mergeAllExact() {
    var list = dupState.groups.filter(exactGroup);
    if (!list.length) return;
    dialog({
      title: 'Merge ' + plural(list.length, 'group') + '?',
      message: 'Every card in these groups has exactly the same name. For each group the app keeps the copy with a source link, verification and the most review history, fills its empty fields from the others, and removes the extra copies. You can undo this straight afterwards.',
      buttons: [{ label: 'Cancel', value: false }, { label: 'Merge all', value: true, style: 'btn-primary' }]
    }).then(function (go) {
      if (!go) return;
      var snap = snapshotLibrary(), removed = 0;
      list.forEach(function (g) { var keep = g.slice().sort(function (a, b) { return keepScore(b) - keepScore(a); })[0]; removed += g.length - 1; mergeInto(g, keep); });
      commit();
      dupState = { groups: findDuplicateGroups(), keep: {} }; renderDuplicates();
      toast(plural(removed, 'duplicate card') + ' merged away.', { type: 'success', timeout: 10000, actionLabel: 'Undo', onAction: function () { restoreLibrary(snap); toast('Merge undone.'); } });
    });
  }
  function dupClick(ev) {
    if (ev.target.closest('[data-dupall]')) { mergeAllExact(); return; }
    var radio = ev.target.closest('input[type=radio]');
    var sec = ev.target.closest('.dup-group');
    if (!sec) return;
    var gi = +sec.getAttribute('data-g');
    if (radio) { dupState.keep[gi] = radio.value; sec.querySelectorAll('.dup-item').forEach(function (l) { l.classList.toggle('keep', l.contains(radio)); }); return; }
    var b = ev.target.closest('[data-dup]');
    if (!b) return;
    var a = b.getAttribute('data-dup');
    if (a === 'merge') mergeGroup(gi);
    else if (a === 'not') {
      state.prefs.notDup.push(groupKey(dupState.groups[gi]));
      if (state.prefs.notDup.length > 500) state.prefs.notDup = state.prefs.notDup.slice(-500);
      persistPrefs();
      dupState.groups.splice(gi, 1); dupState.keep = {};
      renderDuplicates();
    } else if (a === 'peek') openPeek(dupState.keep[gi]);
  }

  /* ---- Related cards (principles ↔ the cases and statutes they cite) ---- */
  var relCache = { sig: '', map: {} };
  function relSig() {
    var n = 0; state.entries.forEach(function (e) { n += e.name.length + e.citation.length + e.ratio.length; });
    return state.entries.length + ':' + n;
  }
  function authorityPatterns(e) {
    var base = e.name.split(' – ')[0], out = [];
    var esc2 = function (w) { return regexEscape(w).replace(/\s+/g, '\\s+'); };
    if (e.type === 'case') {
      (base.match(/\((the [^)]+)\)/gi) || []).forEach(function (p) { out.push(new RegExp('\\b' + esc2(p.slice(1, -1)) + '\\b', 'i')); });
      if (/^the\s/i.test(base) && base.split(/\s+v\.?\s+/i).length === 1) out.push(new RegExp('\\b' + esc2(base) + '\\b', 'i'));
      var exp = /ex\s+p(?:arte)?\s+([A-Za-z][\w'’-]+)/i.exec(base);
      if (exp) out.push(new RegExp('ex\\s+p(?:arte)?\\s+' + esc2(exp[1]) + '\\b', 'i'));
      else {
        var sides = base.replace(/\([^)]*\)/g, ' ').split(/\s+v\.?\s+/i);
        if (sides.length === 2) {
          var raw = function (s) { return s.split(/[\s,]+/).filter(function (w) { return w && !DUP_STOP[normText(w).replace(/[^a-z0-9]/g, '')]; }); };
          var a = raw(sides[0]), b = raw(sides[1]);
          if (b.length > 1 && b[0].length === 1) b = b.slice(1);
          if (b.length && b[0].length > 1) {
            out.push(a.length ? new RegExp('\\b' + esc2(a[0]) + '\\b[^;\\n]{0,60}?\\bv\\.?\\s+(?:the\\s+)?' + esc2(b[0]) + '\\b', 'i')
              : new RegExp('\\bR\\s+v\\.?\\s+' + esc2(b[0]) + '\\b'));
          }
        }
      }
    } else if (e.type === 'statute') {
      var m = /^(.*?\b(?:Act|Acts|Regulations|Order)\s+\d{4})(?:,\s*(.*))?$/.exec(base);
      if (m) {
        var sec = m[2] ? (/\bs{1,2}\s+([\dA-Z]+(?:\(\d+\))?)/.exec(m[2]) || [])[1] : null;
        out.push({ act: new RegExp(esc2(m[1]), 'i'), sec: sec ? new RegExp('\\b(?:s|section)\\s+' + regexEscape(sec) + '(?![\\d(])', 'i') : null });
      }
    }
    return out;
  }
  function relatedMap() {
    var sig = relSig();
    if (relCache.sig === sig) return relCache.map;
    var map = {}, byMod = {};
    state.entries.forEach(function (e) { (byMod[e.module] = byMod[e.module] || []).push(e); });
    Object.keys(byMod).forEach(function (mod) {
      var list = byMod[mod];
      var auths = list.filter(function (e) { return e.type !== 'principle'; }).map(function (e) { return { e: e, pats: authorityPatterns(e) }; }).filter(function (x) { return x.pats.length; });
      list.filter(function (e) { return e.type === 'principle'; }).forEach(function (p) {
        var text = [p.name, p.citation, p.facts, p.ratio, p.strategy].join('\n');
        auths.forEach(function (x) {
          var hit = x.pats.some(function (pat) { return pat.act ? pat.act.test(text) && (!pat.sec || pat.sec.test(text)) : pat.test(text); });
          if (hit) { (map[p.id] = map[p.id] || []).push(x.e.id); (map[x.e.id] = map[x.e.id] || []).push(p.id); }
        });
      });
    });
    relCache = { sig: sig, map: map };
    return map;
  }
  function relatedLine(e) {
    var ids = (relatedMap()[e.id] || []).filter(function (id, i, arr) { return arr.indexOf(id) === i && byId(id); });
    if (!ids.length) return '';
    var shown = ids.slice(0, 6);
    return '<div class="related-line"><span>' + (e.type === 'principle' ? 'Authorities:' : 'Used in:') + '</span>' +
      shown.map(function (id) { var x = byId(id); return '<button type="button" data-action="related" data-rel="' + esc(id) + '" title="Open this card">' + esc(x.name.split(' – ')[0]) + '</button>'; }).join('') +
      (ids.length > shown.length ? '<span class="muted">+' + (ids.length - shown.length) + ' more</span>' : '') + '</div>';
  }

  /* ---- Backup nudge (once a day, when a backup is overdue) ---- */
  var nudgeChecked = false;
  function maybeNudgeBackup() {
    if (nudgeChecked || !state.loaded || store.mode === 'pending') return;
    nudgeChecked = true;
    if (state.entries.length < 30) return;
    var s = state.settings, today = dayKey();
    if (s.backupNudge === today || !s.changedSinceBackup) return;
    var old = !s.lastBackup || Date.now() - new Date(s.lastBackup).getTime() > 14 * DAY;
    if (!old) return;
    s.backupNudge = today; saveUI();
    toast(s.lastBackup ? 'Your last backup is over two weeks old.' : 'You haven\'t exported a backup from this device yet.', {
      timeout: 10000, actionLabel: 'Export now', onAction: exportDatabase
    });
  }

