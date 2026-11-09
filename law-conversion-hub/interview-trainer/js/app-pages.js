/*
 * app-pages.js: the report, progress, question bank, firms, learn and settings pages.
 */
(function () {
  'use strict';
  const IT = window.IT;
  const store = IT.store;
  const S = () => store.state;
  const { $, $$, esc, view, fmtTime, fmtDate, fmtDateTime, plural, overlay, closeOverlay, toast, pages, route } = IT.ui;

  const scoreClass = n => 'v' + (n ? Math.max(1, Math.min(5, Math.round(n))) : 3);
  const pips = (n, self) => '<span class="pips' + (self ? ' self' : '') + '" role="img" aria-label="' + (n ? n + ' out of 5' : 'not scored') + '">' + [1, 2, 3, 4, 5].map(i => '<i class="' + (n && i <= n ? 'on' : '') + '"></i>').join('') + '</span>';
  const catLabel = c => (IT.CATS[c] || {}).label || c;
  const allTurns = rec => rec.threads.flatMap(t => t.turns);

  function practiseQuestion(qid) {
    const p = IT.ui.setupPrefs();
    IT.startInterview(Object.assign({}, p, { formatId: 'adaptive', qids: [qid], length: 1, depth: Math.max(2, +p.depth || 0), focus: '' }));
  }
  function practiseFocus(cat) {
    const p = IT.ui.setupPrefs();
    IT.startInterview(Object.assign({}, p, { formatId: cat === 'commercial' ? 'commercial' : 'adaptive', focus: cat, length: 3, depth: Math.max(2, +p.depth || 0), qids: null }));
  }

  /* ================= report ================= */
  pages.report = function (args) {
    const id = args[0];
    const rec = S().sessions.find(s => s.id === id);
    if (!rec) { view.innerHTML = '<main class="wrap"><h1 class="page">Report not found</h1><p><a href="#/progress">Back to progress</a></p></main>'; return; }
    const job = IT.markingJob(id);
    if (rec.status !== 'marked' || (job && !job.done)) {
      if (job && !job.done) return markingView(rec, job);
      view.innerHTML = '<main class="wrap"><p class="eyebrow">' + esc(fmtDateTime(rec.started)) + '</p><h1 class="page">' + esc(rec.formatName) + ' · ' + esc(rec.firmName) + '</h1>' +
        '<div class="card"><p>This interview has not been marked yet' + (rec.status === 'in-progress' ? ' (it was left before the end)' : '') + '.</p><button class="btn primary" id="markNow">Mark it now</button></div>' + turnsOnly(rec) + '</main>';
      $('#markNow').addEventListener('click', () => { IT.startMarking(id); route(); });
      return;
    }
    renderReport(rec);
  };

  function markingView(rec, job) {
    view.innerHTML = '<main class="wrap"><p class="eyebrow">' + esc(fmtDateTime(rec.started)) + '</p><h1 class="page">Marking your interview</h1>' +
      '<p class="lede">' + (IT.ai.available() ? 'The assessor is checking facts and marking each answer against the rubric. This usually takes under a minute.' : 'Estimating scores from your transcripts.') + '</p>' +
      '<div class="card" style="margin-top:16px"><div class="row" style="justify-content:space-between"><b id="mLabel">' + esc(job.progress.label) + '</b><span class="num muted" id="mCount"></span></div><div class="progressbar" style="margin-top:10px"><i id="mBar" style="width:0%"></i></div></div></main>';
    const upd = (pr, finished) => {
      if (finished) { if (location.hash.indexOf(encodeURIComponent(rec.id)) >= 0 || location.hash.indexOf(rec.id) >= 0) route(); return; }
      const l = $('#mLabel'), b = $('#mBar'), c = $('#mCount');
      if (l) l.textContent = pr.label;
      if (b) b.style.width = Math.round(pr.done / Math.max(1, pr.total) * 100) + '%';
      if (c) c.textContent = pr.done + ' / ' + pr.total;
    };
    upd(job.progress);
    job.listeners.add(upd);
    IT.ui.setCleanup(() => job.listeners.delete(upd));
  }

  function turnsOnly(rec) {
    return rec.threads.filter(t => t.turns.length).map((t, i) => '<div class="card" style="margin-top:12px"><b>Q' + (i + 1) + '. ' + esc(t.turns[0].q) + '</b>' + t.turns.map((tu, j) => turnHtml(tu, j, null)).join('') + '</div>').join('');
  }

  function turnHtml(tu, j, gr) {
    const m = tu.metrics || {};
    const note = gr && (gr.turn_notes || []).find(n => n.turn === j);
    const src = { ai: 'asked by the AI interviewer', offline: 'offline follow-up', script: 'asked in your real interview', bank: '' }[tu.source] || '';
    const stats = [
      plural(m.words || 0, 'word'), fmtTime(tu.durationSec || 0) + (tu.limit ? ' of ' + fmtTime(tu.limit) : ''), (m.wpm || 0) + ' words/min',
      plural(m.fillerCount || 0, 'filler') + (m.fillerCount ? ' (' + Object.entries(m.fillers || {}).map(([k, v]) => k + ' ×' + v).join(', ') + ')' : ''),
      tu.prepSec != null ? 'thought for ' + Math.round(tu.prepSec) + ' s' : '', tu.firstWordSec != null ? 'first word after ' + tu.firstWordSec.toFixed(1) + ' s' : '',
      tu.typed ? 'typed' : 'spoken', src
    ].filter(Boolean);
    return '<div class="turn' + (j ? ' follow' : '') + '" style="margin-top:12px">' +
      '<div><span class="q">' + (j ? 'Follow-up ' + j + ': ' : '') + esc(tu.q) + '</span>' + (tu.intent && j ? '<div class="small muted">' + esc(tu.intent) + '</div>' : '') + '</div>' +
      '<div class="a">' + (tu.transcript ? esc(tu.transcript) : '<i class="muted">No answer</i>') + '</div>' +
      '<div class="stats">' + stats.map(s => '<span>' + esc(s) + '</span>').join('') + '</div>' +
      (tu.clipId ? '<div data-clip="' + esc(tu.clipId) + '" data-type="' + esc(tu.clipType || '') + '" class="small muted">Recording loads when opened…</div>' : '') +
      (note ? '<div class="notice info">' + esc(note.note) + '</div>' : '') + '</div>';
  }

  function renderReport(rec) {
    const sum = rec.summary || {};
    const ai = sum.source === 'ai';
    const urls = [];
    const threads = rec.threads.filter(t => t.turns.length);
    const cost = rec.cost && rec.cost.usd != null ? ' · AI cost about $' + rec.cost.usd.toFixed(2) : '';
    let html = '<main class="wrap">' +
      '<p class="eyebrow">' + esc(fmtDateTime(rec.started)) + ' · ' + esc({ standard: 'Standard', tough: 'Tough', brutal: 'Brutal' }[rec.harshness] || '') + ' pressure</p>' +
      '<h1 class="page">' + esc(rec.formatName) + ' · ' + esc(rec.firmName) + '</h1>' +
      '<p class="muted small" style="margin:0 0 16px">' + plural(threads.length, 'question') + ', ' + plural(allTurns(rec).length - threads.length, 'follow-up') + ' · ' + (rec.aiInterviewer ? 'AI interviewer' : 'offline interviewer') + ' · ' + (ai ? 'marked by AI' : 'estimated without AI') + esc(cost) + '</p>' +
      '<div class="card"><div class="verdict"><div class="score ' + scoreClass(sum.overall) + '"><div><b>' + (sum.overall || '–') + '</b><small>out of 5</small></div></div>' +
      '<div><span class="vtag ' + esc(sum.verdict) + '">' + esc(sum.verdict || '') + '</span><p style="margin:8px 0 6px;font-weight:600">' + esc(sum.readiness || '') + '</p><p style="margin:0">' + esc(sum.summary || '') + '</p></div></div>' +
      (sum.errors && sum.errors.length ? '<div class="notice" style="margin-top:12px">Some steps fell back to the offline estimate: ' + esc(sum.errors.slice(0, 3).join(' · ')) + '</div>' : '') +
      (!ai && IT.ai.available() ? '<div class="row" style="margin-top:12px"><button class="btn primary" id="remark">Mark again with AI</button><span class="small muted">Your API key is set now, so this interview can get a full assessor\'s marking.</span></div>' : '') +
      (!ai && !IT.ai.available() ? '<div class="notice info" style="margin-top:12px">These are estimates from what the app can measure (structure words, numbers, "I" versus "we", pace, fillers). Accuracy, insight and firm knowledge need judgement: rate those yourself under each answer, or <a href="#/settings">add an API key</a> and mark again.</div>' : '') +
      '</div>' +
      '<div class="grid2" style="margin-top:16px"><div class="card"><h3>Fix these first</h3>' +
      ((sum.priorities || []).length ? '<ol class="prio">' + sum.priorities.map(p => '<li><div><b>' + esc(p.title) + '</b><div class="small">' + esc(p.why || '') + '</div><div class="small muted" style="margin-top:2px">How: ' + esc(p.how || '') + '</div></div></li>').join('') + '</ol>' : '<p class="muted small">No priorities recorded.</p>') +
      '</div><div class="stack"><div class="card"><h3>Thinking on your feet</h3><p class="small" style="margin:0">' + esc(sum.thinking_on_feet || '') + '</p></div>' +
      ((sum.strengths || []).length ? '<div class="card"><h3>What worked</h3><ul class="small" style="margin:0;padding-left:1.1em">' + sum.strengths.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul></div>' : '') +
      ((sum.next_session || []).length ? '<div class="card"><h3>Next session</h3><ul class="small" style="margin:0;padding-left:1.1em">' + sum.next_session.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul></div>' : '') +
      '</div></div>' +
      '<h2 class="sec">Question by question</h2>';
    threads.forEach((t, i) => {
      const g = t.grade || {};
      const sub = IT.SUBS[t.sub] || {};
      const self = g.self || {};
      html += '<details class="thread"' + (i === 0 ? ' open' : '') + ' data-thread="' + i + '"><summary><span class="tscore">' + (g.overall || '–') + '<span class="small muted">/5</span></span><span><span class="small muted">' + esc(catLabel(t.cat)) + ' · ' + esc(t.label || '') + (t.turns.length > 1 ? ' · ' + plural(t.turns.length - 1, 'follow-up') : '') + '</span><br><span class="tq">' + esc(t.turns[0].q) + '</span></span><span class="vtag ' + esc(g.verdict) + '">' + esc(g.verdict || '') + '</span></summary><div class="tbody">' +
        (g.error ? '<div class="notice">' + esc(g.error) + '</div>' : '') +
        '<p style="margin:0;font-weight:600">' + esc(g.headline || '') + '</p>' +
        '<div class="crit">' + (g.scores || []).map(sc => {
          const mine = self[sc.criterion];
          const shown = sc.score || mine || null;
          return '<div class="c"><b>' + esc(sc.criterion) + '</b>' + pips(shown, !sc.score && mine) + '<span class="ev small">' + esc(sc.evidence || '') +
            (sc.score ? '' : ' <label class="small">Your rating <select data-self="' + i + '" data-crit="' + esc(sc.criterion) + '"><option value="">–</option>' + [1, 2, 3, 4, 5].map(n => '<option' + (mine === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>') + '</span></div>';
        }).join('') + '</div>' +
        ((g.strengths || []).length || (g.weaknesses || []).length ? '<div class="cols2">' +
          '<div class="box good"><h4>Credit</h4>' + ((g.strengths || []).length ? '<ul>' + g.strengths.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul>' : '<p class="muted">Nothing stood out.</p>') + '</div>' +
          '<div class="box badl"><h4>Lost marks</h4>' + ((g.weaknesses || []).length ? '<ul>' + g.weaknesses.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul>' : '<p class="muted">None noted.</p>') + '</div></div>' : '') +
        ((g.fact_check || []).length ? '<div class="box"><h4>Fact check (live web search)</h4><div class="tablewrap"><table class="facts" style="border-collapse:collapse;width:100%"><thead><tr><th>Claim</th><th>Status</th><th>Note</th></tr></thead><tbody>' + g.fact_check.map(f => '<tr><td>' + esc(f.claim) + '</td><td class="st-' + esc(f.status) + '">' + esc(f.status) + '</td><td>' + esc(f.note) + '</td></tr>').join('') + '</tbody></table></div></div>' : '') +
        '<div>' + t.turns.map((tu, j) => turnHtml(tu, j, g)).join('') + '</div>' +
        '<div class="cols2">' +
        (g.rewrite ? '<div class="box rewrite"><h4>Your answer, rewritten to a strong standard</h4><p>' + esc(g.rewrite) + '</p></div>' : '') +
        '<div class="box"><h4>How a top candidate structures it</h4><p>' + esc(g.model_answer || sub.shape || '') + '</p>' + (g.drill ? '<h4 style="margin-top:12px">Drill</h4><p>' + esc(g.drill) + '</p>' : '') + '</div></div>' +
        (sub.look ? '<details class="box"><summary style="cursor:pointer;font-weight:700">Marking guide for this question type</summary><div class="cols2" style="margin-top:10px"><div><h4>Assessors credit</h4><ul>' + sub.look.map(s => '<li>' + esc(IT.fillFirm(s, ctxFirm(rec))) + '</li>').join('') + '</ul></div><div><h4>Red flags</h4><ul>' + sub.traps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul></div></div></details>' : '') +
        (IT.qById(t.qid) ? '<div class="row"><button class="btn" data-again="' + esc(t.qid) + '">Practise this question again</button></div>' : '') +
        '</div></details>';
    });
    html += '<div class="row noprint" style="margin-top:20px"><a class="btn primary" href="#/">New interview</a><button class="btn" id="print">Print or save as PDF</button><button class="btn danger" id="del">Delete this interview</button></div></main>';
    view.innerHTML = html;

    const rm = $('#remark');
    if (rm) rm.addEventListener('click', () => { IT.startMarking(rec.id, true); route(); });
    $('#print').addEventListener('click', () => { $$('details.thread').forEach(d => { d.open = true; }); window.print(); });
    $('#del').addEventListener('click', async () => {
      if (!confirm('Delete this interview, its marks and its recordings? This cannot be undone.')) return;
      for (const tu of allTurns(rec)) if (tu.clipId) { try { await store.clips.del(tu.clipId); } catch (e) { /* ignore */ } }
      S().sessions = S().sessions.filter(s => s.id !== rec.id);
      store.save();
      location.hash = '#/progress';
    });
    $$('[data-again]').forEach(b => b.addEventListener('click', () => practiseQuestion(b.dataset.again)));
    $$('select[data-self]').forEach(sel => sel.addEventListener('change', () => {
      const t = threads[+sel.dataset.self];
      t.grade.self = t.grade.self || {};
      if (sel.value) t.grade.self[sel.dataset.crit] = +sel.value; else delete t.grade.self[sel.dataset.crit];
      store.save();
      const c = sel.closest('.c');
      const old = c.querySelector('.pips');
      old.outerHTML = pips(sel.value ? +sel.value : null, true);
    }));
    const loadClips = root => $$('[data-clip]', root).forEach(async el => {
      if (el.dataset.loaded) return;
      el.dataset.loaded = '1';
      try {
        const blob = await store.clips.get(el.dataset.clip);
        if (!blob) { el.textContent = 'Recording no longer on this device.'; return; }
        const url = URL.createObjectURL(blob);
        urls.push(url);
        const isVideo = /^video/.test(blob.type || el.dataset.type);
        const ext = /mp4/.test(blob.type) ? 'mp4' : (/ogg/.test(blob.type) ? 'ogg' : 'webm');
        el.className = '';
        el.innerHTML = (isVideo ? '<video controls preload="metadata" playsinline src="' + url + '"></video>' : '<audio controls preload="metadata" src="' + url + '"></audio>') +
          '<div class="small"><a href="' + url + '" download="interview-' + fmtDate(rec.started).replace(/\s/g, '-') + '-' + el.dataset.clip.slice(-5) + '.' + ext + '">Download recording</a> · ' + (blob.size / 1048576).toFixed(1) + ' MB</div>';
      } catch (e) { el.textContent = 'The recording could not be loaded.'; }
    });
    $$('details.thread').forEach(d => { if (d.open) loadClips(d); d.addEventListener('toggle', () => { if (d.open) loadClips(d); }); });
    IT.ui.setCleanup(() => urls.forEach(u => URL.revokeObjectURL(u)));
  }
  const ctxFirm = rec => IT.ui.ctxFor(rec).firm;

  /* ================= progress ================= */
  pages.progress = function () {
    const sessions = S().sessions;
    const marked = sessions.filter(s => s.summary && s.summary.overall).slice().sort((a, b) => a.started - b.started);
    const turns = sessions.flatMap(allTurns);
    const secs = turns.reduce((a, t) => a + (t.durationSec || 0), 0);
    const last3 = marked.slice(-3), prev3 = marked.slice(-6, -3);
    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const a1 = avg(last3.map(s => s.summary.overall)), a0 = avg(prev3.map(s => s.summary.overall));
    const trend = a1 != null && a0 != null ? (a1 - a0 >= 0.25 ? 'up' : a0 - a1 >= 0.25 ? 'down' : 'flat') : null;

    // Criterion and category averages from every graded answer (AI and estimates).
    const crit = {}, cats = {};
    sessions.forEach(s => s.threads.forEach(t => {
      const g = t.grade; if (!g) return;
      if (g.overall) { (cats[t.cat] = cats[t.cat] || []).push(g.overall); }
      (g.scores || []).forEach(sc => { const v = sc.score || (g.self || {})[sc.criterion]; if (v) (crit[sc.criterion] = crit[sc.criterion] || []).push(v); });
    }));
    const critRows = Object.entries(crit).map(([k, v]) => ({ k, v: avg(v), n: v.length })).sort((a, b) => a.v - b.v);
    const catRows = Object.keys(IT.CATS).map(k => ({ k, v: cats[k] ? avg(cats[k]) : null, n: cats[k] ? cats[k].length : 0 }));
    const recentTurns = sessions.slice(0, 5).flatMap(allTurns).filter(t => !t.typed && t.metrics && t.metrics.words > 20);
    const delivery = recentTurns.length ? { wpm: Math.round(avg(recentTurns.map(t => t.metrics.wpm))), fpm: avg(recentTurns.map(t => t.metrics.fillersPerMin)).toFixed(1), start: avg(recentTurns.filter(t => t.firstWordSec != null).map(t => t.firstWordSec)) } : null;

    // What to work on next.
    const recs = [];
    const lastSum = sessions.find(s => s.summary);
    if (lastSum) (lastSum.summary.priorities || []).slice(0, 2).forEach(p => recs.push({ t: p.title, d: p.how || p.why || '', cat: null }));
    critRows.slice(0, 2).forEach(r => { if (r.v < 3.5) recs.push({ t: 'Lift "' + r.k + '" (average ' + r.v.toFixed(1) + ')', d: CRIT_TIPS[r.k] || 'Use the marking guide in your reports for this criterion.', cat: null }); });
    const untried = catRows.filter(r => !r.n && r.k !== 'closing').map(r => r.k);
    const weakCat = catRows.filter(r => r.n).sort((a, b) => a.v - b.v)[0];
    if (weakCat && weakCat.v < 3.5) recs.push({ t: 'Drill your weakest area: ' + catLabel(weakCat.k) + ' (' + weakCat.v.toFixed(1) + '/5)', d: IT.CATS[weakCat.k].blurb, cat: weakCat.k });
    if (untried.length) recs.push({ t: 'Not practised yet: ' + untried.slice(0, 3).map(catLabel).join(', '), d: 'Firms mix these in to see how you cope with the unexpected.', cat: untried[0] });
    if (delivery && +delivery.fpm > 3) recs.push({ t: 'Cut filler words (' + delivery.fpm + ' a minute recently)', d: 'Replace "um" with a silent pause. Record a 60-second answer and count them yourself.', cat: null });
    if (!recs.length) recs.push({ t: 'Do your first interview', d: 'Start with the Mishcon replay, then an AI adaptive interview.', cat: null });

    view.innerHTML = '<main class="wrap"><p class="eyebrow">Progress</p><h1 class="page">How you are improving</h1><p class="lede">Everything is saved in this browser on this device. Export a backup below to keep it safe or move it to another computer.</p>' +
      '<div class="kpis" style="margin-top:16px">' +
      kpi(sessions.length, 'interviews') + kpi(turns.length, 'answers given') + kpi(Math.round(secs / 60), 'minutes speaking') + kpi(IT.ui.streak(), 'day streak') +
      kpi(marked.length ? marked[marked.length - 1].summary.overall + '/5' : '–', 'latest score') +
      kpi(a1 != null ? a1.toFixed(1) + (trend ? (trend === 'up' ? ' ▲' : trend === 'down' ? ' ▼' : ' ▬') : '') : '–', 'average, last 3') +
      '</div>' +
      '<div class="grid2" style="margin-top:16px"><div class="card chartcard" id="scoreCard"><h3>Overall score by interview</h3>' + (marked.length >= 2 ? '<div id="scoreChart"></div>' : '<p class="muted small">The chart appears after two marked interviews.</p>') + '</div>' +
      '<div class="card"><h3>Work on next</h3><ol class="prio">' + recs.slice(0, 5).map((r, i) => '<li><div><b>' + esc(r.t) + '</b><div class="small muted">' + esc(r.d) + '</div>' + (r.cat ? '<button class="btn small" style="margin-top:6px;min-height:0;padding:5px 10px" data-focus="' + r.cat + '">Practise ' + esc(catLabel(r.cat)) + '</button>' : '') + '</div></li>').join('') + '</ol></div></div>' +
      '<div class="grid2" style="margin-top:16px"><div class="card"><h3>Average by criterion</h3><p class="small muted" style="margin:0 0 10px">Weakest first, across every marked answer (including estimates and your own ratings).</p>' + (critRows.length ? bars(critRows.slice(0, 10)) : '<p class="muted small">No marks yet.</p>') + '</div>' +
      '<div class="card"><h3>Average by question type</h3>' + (catRows.some(r => r.n) ? bars(catRows.filter(r => r.n)) : '<p class="muted small">No marks yet.</p>') +
      (delivery ? '<h3 style="margin-top:16px">Delivery, last five interviews</h3><p class="small" style="margin:0">' + delivery.wpm + ' words a minute (aim 130-160) · ' + delivery.fpm + ' fillers a minute (aim under 2)' + (delivery.start != null ? ' · first word after ' + delivery.start.toFixed(1) + ' s' : '') + '</p>' : '') + '</div></div>' +
      '<h2 class="sec">History</h2>' + historyTable(sessions) +
      '<h2 class="sec" id="log">Real interviews</h2><p class="lede" style="margin-top:-6px">Log every real interview: what they asked and how it felt. Then practise those exact questions here.</p>' + logList() +
      '<div class="row" style="margin-top:12px"><button class="btn primary" id="addLog">Log a real interview</button></div>' +
      '<h2 class="sec">Backup</h2><div class="card"><p class="small" style="margin:0 0 10px">The backup holds your sessions, marks, transcripts, notes and log, but not video recordings (download those from each report) and never your API key.</p><div class="row"><button class="btn" id="exp">Export backup</button><label class="btn" style="cursor:pointer">Import backup<input type="file" id="imp" accept="application/json,.json" hidden></label></div></div>' +
      '</main>';

    if (marked.length >= 2) lineChart($('#scoreChart'), marked.map(s => ({ y: s.summary.overall, label: fmtDate(s.started), sub: s.formatName + ' · ' + s.firmName, id: s.id })));
    $$('[data-focus]').forEach(b => b.addEventListener('click', () => practiseFocus(b.dataset.focus)));
    $$('[data-mark]').forEach(b => b.addEventListener('click', () => { IT.startMarking(b.dataset.mark); location.hash = '#/report/' + encodeURIComponent(b.dataset.mark); }));
    $('#addLog').addEventListener('click', () => editLog(null));
    $$('[data-editlog]').forEach(b => b.addEventListener('click', () => editLog(b.dataset.editlog)));
    $$('[data-practlog]').forEach(b => b.addEventListener('click', () => {
      const l = S().log.find(x => x.id === b.dataset.practlog);
      const firm = IT.FIRMS.find(f => f.name.toLowerCase() === String(l.firm).toLowerCase());
      const p = IT.ui.setupPrefs();
      IT.startInterview(Object.assign({}, p, { firmId: firm ? firm.id : 'custom', customFirm: firm ? '' : l.firm, formatId: 'adaptive', customQs: l.questions, qids: null, depth: Math.max(2, +p.depth || 0), focus: '' }));
    }));
    $('#exp').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(store.exportData(), null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'interview-trainer-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    $('#imp').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try { store.importData(JSON.parse(await f.text())); toast('Backup imported and merged.', 'ok'); route(); }
      catch (err) { toast(err.message || 'That file could not be read.', 'bad'); }
    });
    if (location.hash.indexOf('#log') > 0) setTimeout(() => { const el = $('#log'); if (el) el.scrollIntoView(); }, 50);
  };

  const CRIT_TIPS = {
    'Structure': 'Signpost: "Two things. First... Second..." For examples use STAR and spend most of the time on Action.',
    'Specific evidence': 'Every example needs a number, a date or a named outcome. Prepare eight stories with figures.',
    'Personal ownership': 'Say "I", not "we". Name the decision you made and the step you took.',
    'Result and reflection': 'End every story with the result and one sentence on what you now do differently.',
    'Delivery': 'Slow to about 140 words a minute and pause instead of saying "um".',
    'Depth of analysis': 'Go two steps further: what happened, why it matters, who is affected, what lawyers do about it.',
    'Client impact': 'Name a client type (a UK retailer, a PE fund) and say exactly how its costs, revenue or risk change.',
    'Law firm and business development insight': 'Say which practice areas get work and how the firm would win it: client alerts, cross-selling, sector teams.',
    'Firm-specific research': 'Find two facts true of this firm and not its rivals: a deal, a sector strategy, a person you met.',
    'Accuracy': 'Check your stories the morning of the interview. Never guess numbers.',
    'Composure under follow-up questions': 'Pause for two seconds, restate the question in your head, give a one-line answer, then one reason and one example.',
    'Genuine motivation': 'Replace general statements with the moment you decided, and what you have done since to test it.'
  };

  const kpi = (v, k) => '<div class="kpi"><div class="v">' + esc(String(v)) + '</div><div class="k">' + esc(k) + '</div></div>';

  function bars(rows) {
    return '<div class="bars">' + rows.map(r => '<div class="b" title="' + esc(r.k + ': ' + (r.v != null ? r.v.toFixed(2) : '–') + ' from ' + plural(r.n, 'mark')) + '"><span>' + esc(IT.CATS[r.k] ? IT.CATS[r.k].label : r.k) + '</span><span class="track"><i style="width:' + (r.v ? (r.v / 5 * 100).toFixed(1) : 0) + '%"></i></span><span class="num small">' + (r.v != null ? r.v.toFixed(1) : '–') + '</span></div>').join('') + '</div>';
  }

  function lineChart(el, pts) {
    const W = 640, H = 220, L = 34, R = 14, T = 12, B = 30;
    const x = i => L + (pts.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (pts.length - 1));
    const y = v => T + (5 - v) * (H - T - B) / 4;
    const grid = [1, 2, 3, 4, 5].map(v => '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--grid)" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="var(--muted)">' + v + '</text>').join('');
    const path = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.y).toFixed(1)).join(' ');
    const step = Math.max(1, Math.ceil(pts.length / 6));
    const labels = pts.map((p, i) => (i % step === 0 || i === pts.length - 1) ? '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="var(--muted)">' + esc(p.label.replace(/ \d{4}$/, '')) + '</text>' : '').join('');
    const dots = pts.map((p, i) => '<circle cx="' + x(i) + '" cy="' + y(p.y) + '" r="5" fill="var(--chart)" stroke="var(--surface)" stroke-width="2"/>').join('');
    const lastI = pts.length - 1;
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Overall score for each marked interview, from ' + pts[0].y + ' to ' + pts[lastI].y + ' out of 5">' + grid +
      '<path d="' + path + '" fill="none" stroke="var(--chart)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' + dots +
      '<text x="' + Math.min(x(lastI) + 8, W - 4) + '" y="' + (y(pts[lastI].y) - 10) + '" text-anchor="end" font-size="12" font-weight="700" fill="var(--ink)">' + pts[lastI].y + '/5</text>' + labels +
      '<rect x="' + L + '" y="0" width="' + (W - L - R) + '" height="' + H + '" fill="transparent" id="hit" style="cursor:pointer"/></svg><div class="tip" hidden></div>';
    const svg = $('svg', el), tip = $('.tip', el), card = el.closest('.chartcard');
    const near = ev => {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * W;
      let best = 0; pts.forEach((p, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
      return { i: best, r };
    };
    svg.addEventListener('mousemove', ev => {
      const { i, r } = near(ev);
      const cr = card.getBoundingClientRect();
      tip.hidden = false;
      tip.innerHTML = '<b>' + pts[i].y + '/5</b> · ' + esc(pts[i].label) + '<br>' + esc(pts[i].sub);
      tip.style.left = (r.left - cr.left + x(i) / W * r.width) + 'px';
      tip.style.top = (r.top - cr.top + y(pts[i].y) / H * r.height) + 'px';
    });
    svg.addEventListener('mouseleave', () => { tip.hidden = true; });
    svg.addEventListener('click', ev => { location.hash = '#/report/' + encodeURIComponent(pts[near(ev).i].id); });
  }

  function historyTable(sessions) {
    if (!sessions.length) return '<p class="muted">No interviews yet. <a href="#/">Start one</a>.</p>';
    return '<div class="card tablewrap" style="padding:6px 10px"><table class="hist"><thead><tr><th>When</th><th>Format</th><th>Firm</th><th>Answers</th><th>Score</th><th></th></tr></thead><tbody>' +
      sessions.map(s => {
        const n = allTurns(s).length;
        const sc = s.summary && s.summary.overall ? s.summary.overall + '/5 <span class="vtag ' + esc(s.summary.verdict) + '">' + esc(s.summary.verdict) + '</span>' + (s.summary.source === 'offline' ? ' <span class="small muted">est.</span>' : '') : '<span class="muted">Not marked</span>';
        const act = s.status === 'marked' ? '<a href="#/report/' + encodeURIComponent(s.id) + '">Report</a>' : '<button class="btn small" style="min-height:0;padding:4px 10px" data-mark="' + esc(s.id) + '">Mark</button>';
        return '<tr><td class="num small">' + esc(fmtDateTime(s.started)) + '</td><td>' + esc(s.formatName) + '</td><td>' + esc(s.firmName) + '</td><td class="num">' + n + '</td><td>' + sc + '</td><td>' + act + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function logList() {
    const log = S().log;
    if (!log.length) return '<p class="muted">Nothing logged yet.</p>';
    return '<div class="stack">' + log.map(l => '<div class="card"><div class="row" style="justify-content:space-between;align-items:baseline"><div><b>' + esc(l.firm) + '</b> · ' + esc(l.stage) + ' · <span class="num small">' + esc(l.date) + '</span></div><span class="small muted">' + esc(l.outcome || '') + '</span></div>' +
      (l.format ? '<p class="small muted" style="margin:4px 0 0">' + esc(l.format) + '</p>' : '') +
      (l.questions && l.questions.length ? '<ol class="small" style="margin:8px 0;padding-left:1.3em">' + l.questions.map(q => '<li>' + esc(q) + '</li>').join('') + '</ol>' : '') +
      (l.reflection ? '<p class="small" style="margin:0 0 8px"><i>' + esc(l.reflection) + '</i></p>' : '') +
      '<div class="row">' + (l.questions && l.questions.length ? '<button class="btn primary small" data-practlog="' + esc(l.id) + '">Practise these questions</button>' : '') + '<button class="btn small" data-editlog="' + esc(l.id) + '">Edit</button></div></div>').join('') + '</div>';
  }

  function editLog(id) {
    const l = id ? S().log.find(x => x.id === id) : { id: null, date: new Date().toISOString().slice(0, 10), firm: '', stage: '', format: '', questions: [], reflection: '', outcome: '' };
    const box = overlay('<h2 style="font-family:var(--f-display);font-size:1.3rem;margin-bottom:12px">' + (id ? 'Edit' : 'Log') + ' a real interview</h2><div class="stack">' +
      '<div class="cols2"><label class="f">Date<input type="date" id="lDate" value="' + esc(l.date) + '"></label><label class="f">Firm<input type="text" id="lFirm" value="' + esc(l.firm) + '" list="firmNames"></label></div>' +
      '<datalist id="firmNames">' + IT.FIRMS.filter(f => f.id !== 'generic').map(f => '<option value="' + esc(f.name) + '">').join('') + '</datalist>' +
      '<div class="cols2"><label class="f">Stage<input type="text" id="lStage" value="' + esc(l.stage) + '" placeholder="e.g. Vacation scheme video interview"></label><label class="f">Outcome<input type="text" id="lOut" value="' + esc(l.outcome) + '" placeholder="e.g. Awaiting result"></label></div>' +
      '<label class="f">Format<input type="text" id="lFmt" value="' + esc(l.format) + '" placeholder="e.g. AI chat, 30 s thinking, 2 min answers"></label>' +
      '<label class="f">Questions they asked (one per line)<textarea id="lQs" rows="5">' + esc((l.questions || []).join('\n')) + '</textarea></label>' +
      '<label class="f">How it went, and what to do differently<textarea id="lRef" rows="4">' + esc(l.reflection) + '</textarea></label>' +
      '<div class="row"><button class="btn primary" id="lSave">Save</button><button class="btn" id="lCancel">Cancel</button>' + (id ? '<button class="btn danger" id="lDel">Delete</button>' : '') + '</div></div>', { dismiss: true });
    $('#lCancel', box).addEventListener('click', closeOverlay);
    $('#lSave', box).addEventListener('click', () => {
      const firm = $('#lFirm', box).value.trim();
      if (!firm) { $('#lFirm', box).focus(); return; }
      const entry = { id: l.id || store.uid('log'), date: $('#lDate', box).value || new Date().toISOString().slice(0, 10), firm, stage: $('#lStage', box).value.trim(), format: $('#lFmt', box).value.trim(), outcome: $('#lOut', box).value.trim(), questions: $('#lQs', box).value.split('\n').map(s => s.trim()).filter(Boolean), reflection: $('#lRef', box).value.trim() };
      const log = S().log;
      const i = log.findIndex(x => x.id === entry.id);
      if (i >= 0) log[i] = entry; else log.unshift(entry);
      log.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      store.save(); closeOverlay(); route();
    });
    const del = $('#lDel', box);
    if (del) del.addEventListener('click', () => { if (!confirm('Delete this entry?')) return; S().log = S().log.filter(x => x.id !== id); store.save(); closeOverlay(); route(); });
  }

  /* ================= question bank ================= */
  pages.bank = function () {
    const p = IT.ui.setupPrefs();
    const firm = p.firmId === 'custom' ? IT.resolveFirm('custom', p.customFirm) : (IT.firmById(p.firmId) || IT.firmById('generic'));
    const seen = S().seen;
    view.innerHTML = '<main class="wrap"><p class="eyebrow">Question bank</p><h1 class="page">' + IT.QUESTIONS.length + ' questions, and the follow-ups behind them</h1>' +
      '<p class="lede">Drawn from questions candidates report from UK vacation scheme and training contract interviews. Open one to see what assessors credit, the red flags, how a strong answer is shaped and the follow-ups to expect. Questions are worded for <b>' + esc(firm.name) + '</b> (change the firm on the Practise page).</p>' +
      '<div class="filters" style="margin-top:16px"><label class="f">Search<input type="search" id="qSearch" placeholder="e.g. setback, AI, news"></label><label class="f" style="max-width:260px">Type<select id="qCat"><option value="">All types</option>' + Object.keys(IT.CATS).map(k => '<option value="' + k + '">' + esc(IT.CATS[k].label) + '</option>').join('') + '</select></label><label class="check" style="margin-bottom:8px"><input type="checkbox" id="qUnseen"> Not yet practised</label></div>' +
      '<p class="small muted" id="qCount"></p><div class="qlist" id="qList"></div></main>';
    const draw = () => {
      const term = $('#qSearch').value.trim().toLowerCase();
      const cat = $('#qCat').value;
      const unseen = $('#qUnseen').checked;
      const list = IT.QUESTIONS.filter(q => (!cat || q.cat === cat) && (!unseen || !seen[q.id]) && (!term || (q.q + ' ' + (IT.SUBS[q.sub].label)).toLowerCase().includes(term)));
      $('#qCount').textContent = plural(list.length, 'question');
      $('#qList').innerHTML = list.slice(0, 400).map(q => {
        const s = IT.SUBS[q.sub];
        return '<details class="qitem"><summary><span class="tag">' + esc(s.label) + '</span><span class="qq">' + esc(IT.fillFirm(q.q, firm)) + '</span>' + (seen[q.id] ? '<span class="seen">practised ×' + seen[q.id] + '</span>' : '') + '</summary><div class="qb">' +
          '<div class="cols2"><div class="box good"><h4>Assessors credit</h4><ul>' + s.look.map(x => '<li>' + esc(IT.fillFirm(x, firm)) + '</li>').join('') + '</ul></div><div class="box badl"><h4>Red flags</h4><ul>' + s.traps.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div></div>' +
          '<div class="cols2"><div class="box"><h4>Strong answer shape</h4><p>' + esc(s.shape) + '</p></div><div class="box"><h4>Follow-ups to expect</h4><ul>' + s.probes.map(x => '<li>' + esc(IT.coach.fill(x, firm.id === 'generic' ? 'this firm' : firm.name, 'that')) + '</li>').join('') + '</ul></div></div>' +
          '<div class="row"><button class="btn primary" data-q="' + esc(q.id) + '">Practise with follow-ups</button></div></div></details>';
      }).join('');
      $$('[data-q]').forEach(b => b.addEventListener('click', () => practiseQuestion(b.dataset.q)));
    };
    ['qSearch', 'qCat', 'qUnseen'].forEach(id => $('#' + id).addEventListener('input', draw));
    draw();
  };

  /* ================= firms ================= */
  pages.firms = function () {
    const notes = S().firmNotes;
    view.innerHTML = '<main class="wrap"><p class="eyebrow">Firms</p><h1 class="page">Who you are practising for</h1>' +
      '<p class="lede">Each briefing is what the AI interviewer knows about the firm, plus your own research notes. Facts marked "reported" come from press coverage; anything still developing is listed under "check before your interview". Choose "Another firm" on the Practise page for any firm not listed.</p>' +
      '<div class="firmlist" style="margin-top:16px">' + IT.FIRMS.map(f => '<a class="firmbtn' + (notes[f.id] ? ' has' : '') + '" href="#/firm/' + f.id + '"><b>' + esc(f.name) + '</b><small>' + esc(f.group) + (notes[f.id] ? ' · your notes' : '') + '</small></a>').join('') + '</div></main>';
  };

  pages.firm = function (args) {
    const f = IT.firmById(args[0]);
    if (!f) { location.hash = '#/firms'; return; }
    const list = (title, arr) => arr && arr.length ? '<div class="box"><h4>' + title + '</h4><ul>' + arr.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '';
    view.innerHTML = '<main class="wrap"><p class="eyebrow"><a href="#/firms">Firms</a> · ' + esc(f.group) + '</p><h1 class="page">' + esc(f.name) + '</h1>' +
      '<div class="grid2" style="margin-top:12px"><div class="stack">' + list('Known for', f.known) + list('Facts', f.facts) + list('Interview process (as reported)', f.format) +
      (f.style ? '<div class="box"><h4>How the AI interviewer plays this firm</h4><p>' + esc(f.style) + '</p></div>' : '') + list('Firm-specific questions in the bank', f.extra) + list('Check before your interview', f.check) + '</div>' +
      '<div class="stack"><div class="card"><h3>Your research notes</h3><p class="small muted" style="margin:0 0 8px">Recent deals, people you met, the firm\'s strategy in your own words. The AI interviewer uses these to ask sharper questions, and the assessor checks your answers against them. Saved as you type.</p><textarea id="fNotes" rows="14" placeholder="e.g. Met a trainee at the open day who said...">' + esc(S().firmNotes[f.id] || '') + '</textarea><p class="small muted" id="fSaved" style="margin:6px 0 0"></p></div>' +
      '<button class="btn primary big" id="fGo">Practise with ' + esc(f.name) + '</button></div></div></main>';
    let t = 0;
    $('#fNotes').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { S().firmNotes[f.id] = e.target.value; store.save(); $('#fSaved').textContent = 'Saved.'; }, 400); });
    IT.ui.setCleanup(() => { clearTimeout(t); const ta = $('#fNotes'); if (ta) { S().firmNotes[f.id] = ta.value; store.save(); } });
    $('#fGo').addEventListener('click', () => { const p = IT.ui.setupPrefs(); p.firmId = f.id; if (p.formatId === 'replay') p.formatId = 'adaptive'; IT.ui.savePrefs(p); location.hash = '#/'; });
  };

  /* ================= learn ================= */
  pages.learn = function () {
    view.innerHTML = '<main class="wrap learn"><p class="eyebrow">Learn</p><h1 class="page">How to think on your feet</h1><p class="lede">Unpredictable follow-ups feel overwhelming because you try to invent an answer from nothing. These frameworks give you a shape to pour any answer into, so your mind only has to supply the content.</p>' +
      '<div class="grid2" style="margin-top:18px"><div>' +
      '<div class="card"><h3>1. Buy two seconds, honestly</h3><p>Silence of two or three seconds reads as thoughtful, not lost. Say <i>"Let me take a moment to think about that"</i> once if you need it. Then start with a one-sentence answer before any detail: <i>"Yes, I think it will help clients, for two reasons."</i></p></div>' +
      '<div class="card"><h3>2. Competency questions: STAR, weighted to Action</h3><ul><li><b>Situation</b> (one sentence) and <b>Task</b> (one sentence: what <i>you</i> had to achieve).</li><li><b>Action</b>, most of the answer, in the first person: the decision you made, the step you took, the person you persuaded.</li><li><b>Result</b> with a number, then <b>Reflection</b>: what you learned and now do differently.</li></ul><p>Prepare eight stories (team, leadership, integrity, setback, failure, conflict, pressure, initiative). Most questions can be answered with one of them.</p></div>' +
      '<div class="card"><h3>3. Opinion questions: PREP</h3><p><b>Point</b> (your view in one line), <b>Reason</b>, <b>Example</b>, <b>Point</b> again. For "Will AI replace trainees?": "No, but it will change what trainees do. Because... For example... So the trainees who thrive will be the ones who check and question AI output."</p></div>' +
      '<div class="card"><h3>4. The commercial chain (what tripped you up at Mishcon)</h3><p>Every news story answer should walk four links. Practise saying them in order until it is automatic:</p><ol><li><b>What happened</b>, in 20 seconds, with accurate facts.</li><li><b>Who it affects</b>: name a client type, such as a UK retailer importing from Asia or a private equity fund holding tech companies.</li><li><b>What they need from lawyers</b>: contract reviews, restructuring, regulatory advice, disputes, deal work. Name the practice areas.</li><li><b>What the firm does about it</b> (business development): client alerts and webinars, sector teams, cross-selling from the relationship it already has, positioning for the work before competitors.</li></ol><p>Then add one counter-argument: <i>"The risk to that view is..."</i>. The AI interviewer will push you down this chain whether you walk it or not, so walk it first.</p></div>' +
      '<div class="card"><h3>5. Why this firm: the two-fact test</h3><p>Give two reasons that are true of this firm and not of its closest competitor, each with evidence: a deal you followed, a sector strategy, a person you met, a training feature. Link each to your own story. If a reason would work for any firm, the assessor discounts it.</p></div>' +
      '</div><div>' +
      '<div class="card"><h3>How you are marked</h3><ul>' + IT.SCALE.map(s => '<li><b>' + s.n + ' ' + esc(s.label) + ':</b> ' + esc(s.text) + '</li>').join('') + '</ul><p class="small muted">Firms score each answer against set criteria (typically motivation, commercial awareness and competencies), then compare notes. This app uses the same approach with the criteria shown in each report.</p></div>' +
      '<div class="card"><h3>AI interviews like Mishcon\'s</h3><ul><li>The AI keeps probing until it has enough detail. Longer, specific answers (with names, numbers, your own role and the result) mean fewer follow-ups.</li><li>It builds questions from your application, so know every line of it.</li><li>Expect pivots from one theme to the next. Each answer can become the next question.</li><li>It is untimed, but do not ramble: answer, give evidence, stop.</li></ul></div>' +
      '<div class="card"><h3>One-way video technique</h3><ul><li>Camera at eye level, light in front of you, plain background.</li><li>Look at the lens when you make your key point.</li><li>Speak at about 140-160 words a minute; the app measures this.</li><li>Use your thinking time to choose a structure, not to write a script.</li><li>Finish with a clear final line rather than trailing off; it is fine to stop before the clock.</li></ul></div>' +
      '<div class="card"><h3>Nerves</h3><ul><li>Use the one-minute settle-in before each interview (box breathing: 4 in, 4 hold, 4 out, 4 hold).</li><li>Reframe: a racing heart is your body preparing to perform. Say "I am excited", not "I am calm".</li><li>Exposure works: ten unpredictable interviews make the eleventh feel ordinary. Use Brutal pressure in practice so the real thing feels easier.</li></ul></div>' +
      '<div class="card"><h3>A weekly plan</h3><ul><li><b>Mon:</b> AI adaptive interview, then redo your weakest answer.</li><li><b>Tue:</b> Read three business stories; run a Commercial awareness grill on one.</li><li><b>Wed:</b> Quick-fire pressure round.</li><li><b>Thu:</b> Partner interview for your target firm, with your research notes added.</li><li><b>Fri:</b> One-way video round; watch your recordings back.</li><li><b>Weekend:</b> Review Progress and update your eight stories.</li></ul></div>' +
      '</div></div></main>';
  };

  /* ================= settings ================= */
  pages.settings = function () {
    const st = S().settings;
    const pr = S().profile;
    const sup = IT.media.support();
    const costs = S().sessions.filter(s => s.cost && s.cost.usd != null).map(s => s.cost.usd);
    const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null;
    view.innerHTML = '<main class="wrap"><p class="eyebrow">Settings</p><h1 class="page">Settings</h1>' +
      '<div class="grid2" style="margin-top:14px"><div class="stack">' +
      '<div class="card"><h3>AI interviewer and marking</h3>' +
      '<p class="small" style="margin:0 0 10px">The AI uses Claude through your own Anthropic API key. Get one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> (sign up, add a little credit under Billing, then create a key). The key is stored only in this browser and sent only to Anthropic.</p>' +
      '<label class="f">API key<div class="row" style="flex-wrap:nowrap"><input type="password" id="key" value="' + esc(st.apiKey) + '" placeholder="sk-ant-..." autocomplete="off" spellcheck="false"><button class="btn" id="showKey" type="button">Show</button></div></label>' +
      '<div class="row" style="margin-top:10px"><button class="btn primary" id="saveKey">Save and test</button>' + (st.apiKey ? '<button class="btn danger" id="clearKey">Remove key</button>' : '') + '<span class="small" id="keyMsg"></span></div>' +
      '<label class="f" style="margin-top:14px">Model<select id="model">' + IT.MODELS.map(m => '<option value="' + m.id + '"' + (m.id === st.model ? ' selected' : '') + '>' + esc(m.name + ' · ' + m.note) + '</option>').join('') + '</select></label>' +
      '<label class="check" style="margin-top:12px"><input type="checkbox" id="fact"' + (st.factCheck ? ' checked' : '') + '> Fact-check news and figures in my answers with live web search</label>' +
      '<p class="small muted" style="margin:10px 0 0">Cost is charged by Anthropic to your account. ' + (avgCost != null ? 'Your interviews have cost about $' + avgCost.toFixed(2) + ' each on average.' : 'Expect roughly $0.50-$2 for a five-question interview on Opus 5.5 with marking, and about half that on Sonnet 5.5. The exact cost of each interview is shown on its report.') + '</p></div>' +
      '<div class="card"><h3>Interview defaults</h3><div class="toggles" style="margin-top:0">' +
      '<label class="check"><input type="checkbox" data-s="camera"' + (st.camera ? ' checked' : '') + '> Camera on</label>' +
      '<label class="check"><input type="checkbox" data-s="record"' + (st.record ? ' checked' : '') + '> Record answers</label>' +
      '<label class="check"><input type="checkbox" data-s="voice"' + (st.voice ? ' checked' : '') + '> Interviewer speaks</label>' +
      '<label class="check"><input type="checkbox" data-s="breathe"' + (st.breathe ? ' checked' : '') + '> Settle-in breathing</label></div>' +
      '<label class="f" style="margin-top:12px">Interviewer voice<div class="row" style="flex-wrap:nowrap"><select id="voiceSel"></select><button class="btn" id="testV" type="button">Test</button></div></label>' +
      '<p class="small muted" style="margin:8px 0 0">Browser support here: camera ' + (sup.camera ? 'yes' : 'no') + ' · recording ' + (sup.recorder ? 'yes' : 'no') + ' · speech-to-text ' + (sup.stt ? 'yes' : 'no (use Chrome or Edge)') + ' · voice ' + (sup.tts ? 'yes' : 'no') + '.</p></div>' +
      '</div><div class="stack">' +
      '<div class="card"><h3>About you</h3><p class="small muted" style="margin:0 0 10px">Like Mishcon\'s AI interview, the interviewer uses your application details to tailor questions. Write what you would put on an application form.</p>' +
      [['name', 'Name', 'text'], ['stage', 'Current stage', 'text', 'e.g. PGDL at the University of Law, applying for 2027 vacation schemes'], ['education', 'Education', 'area'], ['experience', 'Work experience', 'area'], ['achievements', 'Achievements and interests', 'area'], ['targets', 'Firms you are applying to', 'text'], ['extra', 'Anything else the interviewer should know', 'area']].map(([k, l, t, ph]) =>
        '<label class="f" style="margin-bottom:10px">' + l + (t === 'area' ? '<textarea data-p="' + k + '" rows="3">' + esc(pr[k]) + '</textarea>' : '<input type="text" data-p="' + k + '" value="' + esc(pr[k]) + '" placeholder="' + esc(ph || '') + '">') + '</label>').join('') +
      '<p class="small muted" id="pSaved" style="margin:0"></p></div>' +
      '<div class="card"><h3>Storage and privacy</h3><p class="small" id="usage" style="margin:0 0 10px">Checking storage…</p>' +
      '<p class="small muted" style="margin:0 0 10px">Everything stays on this device. Speech-to-text in Chrome and Edge is processed by the browser maker\'s service. With AI on, transcripts and your profile are sent to Anthropic for the interviewer and marking; recordings never leave the device.</p>' +
      '<div class="row"><button class="btn" id="delClips">Delete all recordings</button><button class="btn danger" id="reset">Reset everything</button></div></div>' +
      '</div></div></main>';

    const key = $('#key');
    $('#showKey').addEventListener('click', () => { key.type = key.type === 'password' ? 'text' : 'password'; $('#showKey').textContent = key.type === 'password' ? 'Show' : 'Hide'; });
    $('#saveKey').addEventListener('click', async () => {
      const v = key.value.trim();
      const msg = $('#keyMsg');
      if (!v) { msg.textContent = 'Paste a key first.'; return; }
      if (!/^sk-ant-/.test(v)) { msg.innerHTML = '<span style="color:var(--bad)">That does not look like an Anthropic key (they start with sk-ant-).</span>'; return; }
      st.apiKey = v; store.save(); IT.ui.aiPill();
      msg.textContent = 'Testing…';
      try { await IT.ai.test(); msg.innerHTML = '<span style="color:var(--ok);font-weight:700">Key works. The AI interviewer is on.</span>'; }
      catch (e) { msg.innerHTML = '<span style="color:var(--bad)">' + esc(e.message) + '</span>' + (e.code === 'offline' ? '' : ' The key is saved; fix the problem and test again.'); }
    });
    const ck = $('#clearKey');
    if (ck) ck.addEventListener('click', () => { if (!confirm('Remove the API key from this browser?')) return; st.apiKey = ''; store.save(); route(); });
    $('#model').addEventListener('change', e => { st.model = e.target.value; store.save(); IT.ui.aiPill(); });
    $('#fact').addEventListener('change', e => { st.factCheck = e.target.checked; store.save(); });
    $$('[data-s]').forEach(c => c.addEventListener('change', () => { st[c.dataset.s] = c.checked; store.save(); }));
    let pt = 0;
    $$('[data-p]').forEach(i => i.addEventListener('input', () => { clearTimeout(pt); pt = setTimeout(() => { $$('[data-p]').forEach(x => { pr[x.dataset.p] = x.value; }); store.save(); $('#pSaved').textContent = 'Saved.'; }, 400); }));
    IT.ui.setCleanup(() => { clearTimeout(pt); $$('[data-p]').forEach(x => { pr[x.dataset.p] = x.value; }); store.save(); IT.ui.refreshVoices = null; });

    const fillVoices = () => {
      const sel = $('#voiceSel'); if (!sel) return;
      const vs = IT.media.voices().filter(v => /^en/i.test(v.lang));
      sel.innerHTML = '<option value="">Automatic (best British English voice)</option>' + vs.map(v => '<option value="' + esc(v.name) + '"' + (v.name === st.voiceName ? ' selected' : '') + '>' + esc(v.name + ' (' + v.lang + ')') + '</option>').join('');
    };
    IT.ui.refreshVoices = fillVoices;
    fillVoices();
    $('#voiceSel').addEventListener('change', e => { st.voiceName = e.target.value; store.save(); });
    $('#testV').addEventListener('click', () => IT.media.speak('Tell me about a time your integrity was challenged.', st.voiceName));

    const showUsage = async () => {
      const u = await store.usage();
      let n = 0; try { n = (await store.clips.keys()).length; } catch (e) { /* ignore */ }
      const el = $('#usage'); if (!el) return;
      el.textContent = plural(n, 'recording') + ' saved' + (u ? ' · ' + (u.used / 1048576).toFixed(0) + ' MB used of about ' + (u.quota / 1073741824).toFixed(1) + ' GB available to this site' : '') + '.';
    };
    showUsage();
    $('#delClips').addEventListener('click', async () => {
      if (!confirm('Delete every recording? Transcripts and marks stay.')) return;
      try { await store.clips.clear(); } catch (e) { /* ignore */ }
      S().sessions.forEach(s => s.threads.forEach(t => t.turns.forEach(tu => { tu.clipId = null; })));
      store.save(); toast('Recordings deleted.', 'ok'); showUsage();
    });
    $('#reset').addEventListener('click', async () => {
      if (!confirm('Delete all interviews, marks, recordings, notes, your profile and log? Your API key is kept. This cannot be undone.')) return;
      await store.resetAll(); toast('Everything has been reset.', 'ok'); route();
    });
  };

  IT.boot();
})();
