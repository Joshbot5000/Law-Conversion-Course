/*
 * interview.js: runs one practice interview, independent of the screen.
 *
 *   const iv = new IT.Interview({ firmId, formatId, ... });
 *   let q = await iv.next();            // first question
 *   iv.answer({ transcript, durationSec, ... });
 *   q = await iv.next();                // a follow-up or the next question, or null at the end
 *   await iv.mark(progress => ...);     // AI or offline marking, then the debrief
 *
 * The session is saved after every answer, so closing the tab loses nothing.
 * If the AI is slow or fails mid-interview, the interviewer falls back to the
 * offline follow-ups so the interview never stalls.
 */
(function (g) {
  'use strict';
  const IT = g.IT = g.IT || {};

  const AI_MOVE_TIMEOUT = 25000;

  function rngFrom(seed) {
    if (seed == null) return Math.random;
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function resolveFirm(firmId, customName) {
    if (firmId === 'custom') {
      const name = String(customName || '').trim() || 'A law firm';
      return { id: 'custom-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, group: 'Law firm', known: [], facts: [], format: [], style: 'A professional graduate recruitment interviewer at ' + name + '.', extra: [], check: [] };
    }
    return IT.firmById(firmId) || IT.firmById('generic');
  }
  const firmLabel = firm => (firm.id === 'generic' ? 'this firm' : firm.name);
  const fillFirm = (text, firm) => String(text).replace(/\{firm\}'s/g, firm.id === 'generic' ? 'this firm\'s' : IT.coach.possessive(firm.name)).replace(/\{firm\}/g, firmLabel(firm));

  /* Which competency an unlisted question tests, from its wording. */
  function guessSub(text) {
    const t = String(text).toLowerCase();
    const rules = [
      [/business development|win (?:new )?work|pitch/, 'bd'], [/integrity|ethic|right thing|dishonest|unethical/, 'integrity'],
      [/setback|resilien|rejection|obstacle/, 'resilience'], [/fail|mistake/, 'failure'], [/news|story|headline/, 'news'],
      [/impact|affect|client|tariff|trade|geopolit|interest rate|sanction/, 'client-impact'], [/\bai\b|artificial intelligence|technology/, 'ai-tech'],
      [/lead/, 'leadership'], [/team/, 'teamwork'], [/conflict|disagree|difficult person/, 'conflict'], [/pressure|deadline|prioriti/, 'pressure'],
      [/strength/, 'strengths'], [/weakness/, 'weakness'], [/why (?:do you want to )?(?:work )?(?:at|for|join)|why us|why this firm|know about/, 'why-firm'],
      [/why law|lawyer|solicitor/, 'why-law'], [/questions for|ask (?:me|us)/, 'questions-for-us'], [/tell me about a time|describe a time|give an example/, 'teamwork']
    ];
    for (const [re, sub] of rules) if (re.test(t)) return sub;
    return 'why-firm';
  }

  /* Choose the main questions for a session. */
  function buildPlan(o) {
    const rng = o.rng || Math.random;
    const firm = o.firm;
    const fmt = o.format;
    const seen = o.seen || {};
    const item = (q, extra) => Object.assign({ qid: q.id, sub: q.sub, cat: q.cat, text: fillFirm(q.q, firm), label: (IT.SUBS[q.sub] || {}).label || q.sub, script: [], offlineScript: [] }, extra || {});

    if (o.qids && o.qids.length) return o.qids.map(id => IT.qById(id)).filter(Boolean).map(q => item(q));
    if (o.customQs && o.customQs.length) {
      // Your own questions, e.g. from a real interview you logged.
      return o.customQs.map((text, i) => { const sub = guessSub(text); return { qid: 'own-' + i + '-' + String(text).toLowerCase().replace(/[^a-z]+/g, '').slice(0, 24), sub, cat: IT.SUBS[sub].cat, text: fillFirm(text, firm), label: (IT.SUBS[sub] || {}).label, script: [], offlineScript: [] }; });
    }

    if (fmt.id === 'replay') {
      return IT.REPLAY.map((r, i) => {
        const q = IT.qById(r.qid);
        return i === 0 ? item(q, { offlineScript: r.probes.slice() }) : item(q, { script: r.probes.slice(0, 2), offlineScript: r.probes.slice(2) });
      });
    }

    const n = Math.max(1, Math.min(15, o.length || fmt.mains));
    let mix;
    if (o.focus && IT.CATS[o.focus]) mix = [o.focus];
    else if (fmt.id === 'quickfire') mix = ['strengths', 'curveball', 'motivation', 'competency', 'firm'];
    else mix = fmt.mix.slice();

    const usedSubs = new Set();
    const usedIds = new Set();
    const pickFrom = pool => {
      if (!pool.length) return null;
      // Prefer questions seen least often, then subs not yet used this session.
      const scored = pool.map(q => ({ q, k: (seen[q.id] || 0) * 10 + (usedSubs.has(q.sub) ? 5 : 0) + rng() }));
      scored.sort((a, b) => a.k - b.k);
      return scored[0].q;
    };
    const plan = [];
    const firmExtras = (firm.extra || []).slice();
    let extraUsed = false;
    for (let i = 0; i < n; i++) {
      let cat = mix[i % mix.length];
      if (fmt.id === 'commercial' && i === 0) cat = 'commercial';
      if (fmt.id === 'partner' && i === n - 1 && n > 2 && !o.focus) cat = 'closing';
      // Firm-specific questions take one "firm" slot when the firm has them.
      if (cat === 'firm' && firmExtras.length && !extraUsed && rng() < 0.6) {
        extraUsed = true;
        const text = firmExtras[Math.floor(rng() * firmExtras.length)];
        const sub = guessSub(text);
        plan.push({ qid: 'firm-' + firm.id + '-' + (firm.extra.indexOf(text) + 1), sub, cat: IT.SUBS[sub].cat, text, label: 'About ' + firm.name, script: [], offlineScript: [] });
        usedSubs.add(sub);
        continue;
      }
      let pool = IT.QUESTIONS.filter(q => q.cat === cat && !usedIds.has(q.id));
      if (fmt.id === 'quickfire') pool = pool.filter(q => IT.QUICKFIRE_SUBS.includes(q.sub) || q.cat === 'firm' || q.cat === 'competency');
      if (fmt.id === 'commercial' && i === 0) pool = pool.filter(q => q.sub === 'news');
      if (fmt.id === 'adaptive' && i === 0 && !o.focus) pool = IT.QUESTIONS.filter(q => ['integrity', 'resilience', 'failure', 'teamwork', 'leadership'].includes(q.sub));
      if (cat === 'closing') pool = IT.QUESTIONS.filter(q => q.cat === 'closing' && !usedIds.has(q.id));
      const q = pickFrom(pool) || pickFrom(IT.QUESTIONS.filter(x => !usedIds.has(x.id)));
      if (!q) break;
      usedIds.add(q.id); usedSubs.add(q.sub);
      plan.push(item(q));
    }
    return plan;
  }

  class Interview {
    constructor(o) {
      this.o = o;
      this.rng = rngFrom(o.seed);
      this.store = o.store || IT.store;
      this.ai = o.ai === undefined ? IT.ai : o.ai;
      this.firm = resolveFirm(o.firmId, o.customFirm);
      this.format = IT.formatById(o.formatId);
      this.harshness = o.harshness || 'tough';
      const brutal = this.harshness === 'brutal';
      this.depth = Math.max(0, Math.min(5, o.depth != null ? o.depth : this.format.depth + (brutal && this.format.depth ? 1 : 0)));
      this.prep = o.prep != null ? o.prep : (brutal ? Math.floor(this.format.prep / 2) : this.format.prep);
      this.limit = o.answer != null ? o.answer : this.format.answer;
      this.plan = buildPlan({ firm: this.firm, format: this.format, length: o.length, focus: o.focus, qids: o.qids, customQs: o.customQs, seen: this.store.state.seen, rng: this.rng });
      this.threads = [];
      this.mainIndex = -1;
      this.pending = null;
      this.aiTimeout = o.aiTimeout || AI_MOVE_TIMEOUT;
      this.aiFailures = 0;
      this.aiOff = !this.useAI();
      this.notices = [];
      this.done = false;
      this.started = Date.now();
      this._meterStart = snapshot(this.ai);
      this.record = {
        id: this.store.uid('s'), started: this.started, ended: null, status: 'in-progress',
        firmId: this.firm.id, firmName: this.firm.name, formatId: this.format.id, formatName: this.format.name,
        harshness: this.harshness, aiInterviewer: !this.aiOff, model: this.store.state.settings.model,
        threads: this.threads, summary: null, cost: null
      };
    }

    useAI() { return !!(this.ai && this.ai.available && this.ai.available() && this.o.useAI !== false); }

    ctx() { return { firm: this.firm, format: this.format, harshness: this.harshness }; }

    /* The question being asked now. */
    get current() { return this.pending; }

    _ask(kind, text, extra) {
      const thread = this.threads[this.threads.length - 1];
      this.pending = Object.assign({ kind, text, threadIndex: this.threads.length - 1, turnIndex: thread ? thread.turns.length : 0, limit: this.limit, prep: kind === 'main' ? this.prep : Math.min(this.prep, 10), label: thread ? thread.label : '', number: this.threads.length, total: this.plan.length }, extra || {});
      return this.pending;
    }

    _startMain(text, source) {
      this.mainIndex++;
      const p = this.plan[this.mainIndex];
      const thread = { qid: p.qid, sub: p.sub, cat: p.cat, label: p.label, script: p.script.slice(), offlineScript: p.offlineScript.slice(), turns: [], grade: null };
      this.threads.push(thread);
      const seen = this.store.state.seen;
      seen[p.qid] = (seen[p.qid] || 0) + 1;
      return this._ask('main', text || p.text, { source: source || 'bank', intent: 'Tests: ' + p.label, qid: p.qid });
    }

    /* Decide what to ask next. Resolves to a question object, or null when the interview is over. */
    async next() {
      if (this.done) return null;
      if (this.pending) return this.pending; // unanswered question still showing
      if (!this.threads.length) {
        if (!this.plan.length) return this._end();
        return this._startMain();
      }
      const thread = this.threads[this.threads.length - 1];
      const last = thread.turns[thread.turns.length - 1];
      const followed = thread.turns.length - 1;
      const hasMoreMains = this.mainIndex < this.plan.length - 1;
      const silent = !last || !String(last.transcript || '').trim();

      // Scripted follow-ups (the Mishcon replay) come first, in order.
      if (!silent && followed < thread.script.length) return this._ask('follow', thread.script[followed], { source: 'script', intent: 'The follow-up the real interview asked' });

      if (!silent && followed < this.depth) {
        if (!this.aiOff) {
          const nextPlanned = hasMoreMains ? this.plan[this.mainIndex + 1] : null;
          try {
            const move = await this._withTimeout(signal => this.ai.nextMove({
              firm: this.firm, format: this.format, harshness: this.harshness,
              threads: this.threads, followUpsLeft: this.depth - followed,
              nextPlanned, remaining: Math.max(0, this.plan.length - this.mainIndex - 2), mustMove: false
            }, signal));
            if (this.done) return null; // ended while the AI was thinking
            this.aiFailures = 0;
            const say = String(move && move.say || '').trim();
            if (move && move.move === 'follow_up' && say && !this._alreadyAsked(say)) return this._ask('follow', say, { source: 'ai', intent: move.intent || '' });
            if (move && move.move === 'next_question' && hasMoreMains) return this._startMain(say && !this._alreadyAsked(say) ? say : null, say ? 'ai' : 'bank');
            if (move && (move.move === 'end' || move.move === 'next_question') && !hasMoreMains) return this._end(say);
          } catch (e) {
            if (this.done) return null;
            this._aiFailed(e);
          }
        }
        if (this.aiOff || this.aiFailures) {
          // Offline follow-up: from the replay script, then from the answer itself.
          const offlineIdx = followed - thread.script.length;
          if (offlineIdx >= 0 && offlineIdx < thread.offlineScript.length) return this._ask('follow', thread.offlineScript[offlineIdx], { source: 'script', intent: 'The follow-up the real interview asked' });
          const everAsked = this.threads.flatMap(th => th.turns.map(tu => tu.q));
          const pr = IT.coach.probe(thread, firmLabel(this.firm), this.rng, everAsked);
          return this._ask('follow', pr, { source: 'offline', intent: 'Probing your answer' });
        }
      }
      if (hasMoreMains) return this._startMain();
      return this._end();
    }

    _alreadyAsked(text) {
      const norm = s => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
      const t = norm(text);
      return this.threads.some(th => th.turns.some(tu => norm(tu.q) === t));
    }

    _withTimeout(fn) {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      let timer;
      return Promise.race([
        fn(ctrl && ctrl.signal),
        new Promise((_, rej) => { timer = setTimeout(() => { if (ctrl) ctrl.abort(); const err = new Error('The AI interviewer took too long, so an offline follow-up was used.'); err.code = 'timeout'; rej(err); }, this.aiTimeout); })
      ]).finally(() => clearTimeout(timer));
    }

    _aiFailed(e) {
      this.aiFailures++;
      const msg = (e && e.message) || 'The AI interviewer failed.';
      const fatal = e && ['auth', 'credit', 'permission', 'not-found', 'no-key', 'no-sdk'].includes(e.code);
      if (fatal || this.aiFailures >= 2) {
        this.aiOff = true;
        this.notices.push(msg + ' The rest of this interview uses offline follow-ups.');
      } else this.notices.push(msg);
    }

    _end(closing) {
      this.done = true;
      this.pending = null;
      this.closing = closing || 'Thank you. That is the end of the interview.';
      this.record.ended = Date.now();
      this.record.status = 'answered';
      this._save();
      return null;
    }

    /* Record the answer to the current question. */
    answer(a) {
      const q = this.pending;
      if (!q) throw new Error('No question is waiting for an answer.');
      const thread = this.threads[q.threadIndex];
      const transcript = String(a.transcript || '').trim();
      thread.turns.push({
        kind: q.kind, q: q.text, intent: q.intent || '', source: q.source || '',
        transcript, typed: !!a.typed, durationSec: Math.max(0, +a.durationSec || 0), prepSec: a.prepSec != null ? +a.prepSec : null,
        firstWordSec: a.firstWordSec != null ? +a.firstWordSec : null, longPauses: a.longPauses || 0, limit: q.limit,
        clipId: a.clipId || null, clipType: a.clipType || '',
        metrics: IT.coach.metrics(transcript, a.durationSec, q.limit)
      });
      this.pending = null;
      this._save();
    }

    /* Stop early; keeps what has been answered. */
    stop() {
      if (this.done) return;
      this.pending = null;
      this._end('Interview stopped early.');
    }

    _save() {
      const st = this.store.state;
      const d = diff(snapshot(this.ai), this._meterStart);
      if (d.calls) this.record.cost = withUsd(d, this.ai, this.record.model);
      this.record.aiInterviewer = this.threads.some(t => t.turns.some(tu => tu.source === 'ai'));
      const i = st.sessions.findIndex(s => s.id === this.record.id);
      if (this.threads.some(t => t.turns.length)) {
        if (i >= 0) st.sessions[i] = this.record; else st.sessions.unshift(this.record);
      }
      this.store.save();
    }

    /* Mark every answered question, then write the debrief. */
    async mark(onProgress, signal) {
      return markSession(this.record, { firm: this.firm, format: this.format, harshness: this.harshness }, this.store, this.ai, onProgress, signal);
    }
  }

  async function markSession(record, ctx, store, ai, onProgress, signal) {
    store = store || IT.store;
    ai = ai === undefined ? IT.ai : ai;
    const threads = record.threads.filter(t => t.turns.length);
    const settings = store.state.settings;
    const useAI = !!(ai && ai.available && ai.available());
    let done = 0;
    const total = threads.length + 1;
    const tick = label => { if (onProgress) onProgress({ done, total, label }); };
    tick('Marking your answers');
    const meterStart = snapshot(ai);
    const errors = [];
    const one = async t => {
      if (t.grade && t.grade._final) {
        // Already marked by AI during the interview (feedback after each question).
      } else if (!t.turns.some(tu => tu.transcript)) {
        t.grade = { source: 'none', overall: 1, verdict: 'Reject', headline: 'No answer was given.', scores: (IT.RUBRICS[t.cat] || []).map(c => ({ criterion: c, score: 1, evidence: 'No answer.' })), strengths: [], weaknesses: ['Silence scores nothing. Even a short structured answer beats none: buy time with "Let me take a moment to think", then answer.'], turn_notes: [], fact_check: [], model_answer: (IT.SUBS[t.sub] || {}).shape || '', rewrite: '', drill: 'Answer this question three times with a 10-second thinking limit.' };
      } else if (useAI) {
        try {
          let facts = null;
          if (settings.factCheck && (t.cat === 'commercial' || t.sub === 'news' || /news|deal|merger|announced|reported|percent|%|billion|million/i.test(t.turns.map(x => x.transcript).join(' ')))) {
            try { facts = await ai.factCheck(t, signal); } catch (e) { facts = null; errors.push('Fact check skipped: ' + e.message); }
          }
          t.grade = await ai.grade(ctx, t, facts, signal);
        } catch (e) {
          if (e && e.code === 'aborted') throw e;
          errors.push(e.message);
          t.grade = IT.coach.grade(t, ctx.firm.name);
          t.grade.error = 'AI marking failed (' + e.message + '). This is the offline estimate.';
        }
      } else {
        t.grade = IT.coach.grade(t, ctx.firm.name);
      }
      done++;
      tick('Marked ' + done + ' of ' + threads.length);
    };
    // Two at a time keeps it quick without hitting rate limits.
    const queue = threads.slice();
    const workers = [0, 1].map(async () => { while (queue.length) await one(queue.shift()); });
    await Promise.all(workers);

    tick('Writing your debrief');
    let summary = null;
    if (useAI) {
      try {
        const prev = store.state.sessions.filter(s => s.id !== record.id && s.summary && s.summary.overall).slice(0, 6)
          .map(s => new Date(s.started).toISOString().slice(0, 10) + ' ' + s.formatName + ' at ' + s.firmName + ': ' + s.summary.overall + '/5').join('; ');
        summary = await ai.summarise(ctx, record, prev, signal);
      } catch (e) {
        if (e && e.code === 'aborted') throw e;
        errors.push(e.message);
      }
    }
    if (!summary) summary = offlineSummary(record);
    if (errors.length) summary.errors = Array.from(new Set(errors));
    record.summary = summary;
    record.status = 'marked';
    record.markedAt = Date.now();
    const d = diff(snapshot(ai), meterStart);
    if (d.calls) {
      const c = record.cost || { calls: 0, inTok: 0, outTok: 0, searches: 0 };
      record.cost = withUsd({ calls: c.calls + d.calls, inTok: c.inTok + d.inTok, outTok: c.outTok + d.outTok, searches: c.searches + d.searches }, ai, record.model);
    }
    const i = store.state.sessions.findIndex(s => s.id === record.id);
    if (i >= 0) store.state.sessions[i] = record; else store.state.sessions.unshift(record);
    store.save();
    done = total; tick('Done');
    return record;
  }

  /* AI usage counters, so each session records only its own cost. */
  function snapshot(ai) {
    const m = ai && ai.meter;
    return m ? { calls: m.calls, inTok: m.inTok, outTok: m.outTok, searches: m.searches } : { calls: 0, inTok: 0, outTok: 0, searches: 0 };
  }
  function diff(a, b) { return { calls: a.calls - b.calls, inTok: a.inTok - b.inTok, outTok: a.outTok - b.outTok, searches: a.searches - b.searches }; }
  function withUsd(c, ai, model) { return Object.assign(c, { usd: ai && ai.costOf ? +ai.costOf(c, model).toFixed(3) : null }); }

  function offlineSummary(record) {
    const gs = record.threads.filter(t => t.grade && t.grade.overall).map(t => t.grade.overall);
    const avg = gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : null;
    const overall = avg ? Math.max(1, Math.min(5, Math.round(avg))) : null;
    const verdicts = ['Reject', 'Reject', 'Borderline', 'Progress', 'Strong', 'Exceptional'];
    const tips = [];
    record.threads.forEach(t => (t.grade && t.grade.weaknesses || []).forEach(w => tips.push(w)));
    const counts = {};
    tips.forEach(w => { const k = w.split(/[.:(]/)[0]; counts[k] = (counts[k] || 0) + 1; });
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 3);
    const followUps = record.threads.reduce((a, t) => a + Math.max(0, t.turns.length - 1), 0);
    const starts = record.threads.flatMap(t => t.turns).map(t => t.firstWordSec).filter(x => x != null);
    const avgStart = starts.length ? starts.reduce((a, b) => a + b, 0) / starts.length : null;
    return {
      source: 'offline', overall, verdict: overall ? verdicts[overall] : 'Self-assess',
      readiness: 'Estimated without AI from observable features only. Add an API key in Settings for a full assessor\'s verdict.',
      summary: overall ? 'Estimated ' + overall + '/5 across ' + gs.length + ' questions. Use the marking guide under each answer to rate the parts the app cannot judge: accuracy, insight and firm knowledge.' : 'Rate yourself using the marking guide under each answer.',
      strengths: [],
      priorities: top.map(t => ({ title: t, why: 'Came up in ' + counts[t] + ' of your answers.', how: (tips.find(w => w.startsWith(t)) || t) })),
      thinking_on_feet: 'You faced ' + followUps + ' follow-up question' + (followUps === 1 ? '' : 's') + '.' + (avgStart != null ? ' On average you started speaking ' + avgStart.toFixed(1) + ' seconds after recording began.' : '') + ' To think on your feet: take a silent two-second pause, state your point in one sentence, then give one reason and one example.',
      next_session: ['Repeat the weakest question type in a Quick-fire round.', 'Try the AI adaptive interview to practise unpredictable follow-ups.']
    };
  }

  IT.Interview = Interview;
  IT.markSession = markSession;
  IT.buildPlan = buildPlan;
  IT.resolveFirm = resolveFirm;
  IT.fillFirm = fillFirm;
})(typeof window !== 'undefined' ? window : globalThis);
