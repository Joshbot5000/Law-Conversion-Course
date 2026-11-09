/*
 * ai.js: the AI interviewer and assessor, using Claude through the official
 * Anthropic SDK (vendor/anthropic-sdk-1.3.0.js), called straight from the
 * browser with your own API key. The key stays in this browser's storage and
 * is sent only to api.anthropic.com.
 *
 * Calls:
 *   nextMove  - the interviewer decides the next question (low effort: fast).
 *   factCheck - checks news claims in an answer with live web search.
 *   grade     - marks one question and its follow-ups against the rubric.
 *   summarise - the overall verdict and a plan for next time.
 * Every call asks for JSON that matches a schema, handles refusals and cut-off
 * replies, and opts into server-side fallback so a declined request is retried
 * on another model.
 */
(function (g) {
  'use strict';
  const IT = g.IT = g.IT || {};

  IT.MODELS = [
    { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', note: 'Best interviewer and marker (default)', price: { in: 4, out: 20 } },
    { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', note: 'Faster replies, about half the cost', price: { in: 2, out: 10 } }
  ];
  const WEB_SEARCH_PER_USE = 0.01;

  class AIError extends Error {
    constructor(code, message, cause) { super(message); this.code = code; this.cause = cause; }
  }

  /* ---------------- client and metering ---------------- */
  let client = null, clientKey = '';
  function settings() { return IT.store.state.settings; }
  function available() { return !!(settings().apiKey && g.AnthropicSDK); }
  function getClient() {
    const key = settings().apiKey;
    if (!key) throw new AIError('no-key', 'Add your Claude API key in Settings to switch on the AI interviewer and marking.');
    if (!g.AnthropicSDK) throw new AIError('no-sdk', 'The AI library did not load. Reload the page.');
    if (!client || clientKey !== key) {
      client = new g.AnthropicSDK({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2 });
      clientKey = key;
    }
    return client;
  }

  const meter = { inTok: 0, outTok: 0, searches: 0, calls: 0, reset() { this.inTok = 0; this.outTok = 0; this.searches = 0; this.calls = 0; } };
  function track(resp) {
    const u = resp && resp.usage || {};
    meter.calls++;
    meter.inTok += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
    meter.outTok += u.output_tokens || 0;
    meter.searches += (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
  }
  function costOf(m, modelId) {
    const p = (IT.MODELS.find(x => x.id === modelId) || IT.MODELS[0]).price;
    return (m.inTok / 1e6) * p.in + (m.outTok / 1e6) * p.out + m.searches * WEB_SEARCH_PER_USE;
  }

  function friendly(err) {
    const A = g.AnthropicSDK;
    if (err instanceof AIError) return err;
    if (A) {
      if (A.APIUserAbortError && err instanceof A.APIUserAbortError) return new AIError('aborted', 'Cancelled.', err);
      if (A.AuthenticationError && err instanceof A.AuthenticationError) return new AIError('auth', 'Your API key was rejected. Check it in Settings (it starts sk-ant-).', err);
      if (A.PermissionDeniedError && err instanceof A.PermissionDeniedError) return new AIError('permission', 'This API key is not allowed to use that model. Try the other model in Settings.', err);
      if (A.NotFoundError && err instanceof A.NotFoundError) return new AIError('not-found', 'That model was not found for your account. Choose another in Settings.', err);
      if (A.RateLimitError && err instanceof A.RateLimitError) return new AIError('rate', 'Rate limit reached. Wait a minute and try again.', err);
      if (A.BadRequestError && err instanceof A.BadRequestError) {
        const msg = String(err.message || '');
        if (/credit balance/i.test(msg)) return new AIError('credit', 'Your Anthropic account has no credit left. Add credit at console.anthropic.com (Billing).', err);
        return new AIError('bad-request', 'Claude rejected the request: ' + msg.replace(/^\d+\s*/, '').slice(0, 220), err);
      }
      if (A.InternalServerError && err instanceof A.InternalServerError) return new AIError('busy', 'Claude is busy at the moment. Try again shortly.', err);
      if (A.APIConnectionTimeoutError && err instanceof A.APIConnectionTimeoutError) return new AIError('timeout', 'Claude took too long to reply.', err);
      if (A.APIConnectionError && err instanceof A.APIConnectionError) return new AIError('offline', 'Could not reach Claude. Check your internet connection.', err);
      if (A.APIError && err instanceof A.APIError) return new AIError('api', 'Claude returned an error' + (err.status ? ' (' + err.status + ')' : '') + '.', err);
    }
    if (err && err.name === 'AbortError') return new AIError('aborted', 'Cancelled.', err);
    return new AIError('unknown', (err && err.message) || 'Something went wrong talking to Claude.', err);
  }

  async function call(opts) {
    const c = getClient();
    const model = settings().model || IT.MODELS[0].id;
    const body = {
      model,
      max_tokens: opts.maxTokens || 16000,
      system: opts.system,
      thinking: { type: 'adaptive' },
      output_config: { effort: opts.effort || 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default'
    };
    if (opts.schema) body.output_config.format = { type: 'json_schema', schema: opts.schema };
    if (opts.tools) body.tools = opts.tools;
    let messages = opts.messages.slice();
    let resp;
    try {
      for (let round = 0; ; round++) {
        resp = await c.beta.messages.create(Object.assign({}, body, { messages }), { timeout: opts.timeout || 120000, signal: opts.signal, maxRetries: opts.retries == null ? 2 : opts.retries });
        track(resp);
        if (resp.stop_reason === 'pause_turn' && round < 4) { messages = messages.concat([{ role: 'assistant', content: resp.content }]); continue; }
        break;
      }
    } catch (e) { throw friendly(e); }
    if (resp.stop_reason === 'refusal') throw new AIError('refusal', 'Claude declined to answer this one' + (resp.stop_details && resp.stop_details.category ? ' (' + resp.stop_details.category + ')' : '') + '.');
    if (resp.stop_reason === 'max_tokens') throw new AIError('truncated', 'Claude\'s reply was cut off.');
    const text = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    if (!opts.schema) return text;
    try { return JSON.parse(text); } catch (e) {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* fall through */ } }
      throw new AIError('bad-json', 'Claude\'s reply could not be read.');
    }
  }

  async function test() {
    const c = getClient();
    try { await c.models.retrieve(settings().model || IT.MODELS[0].id, {}, { timeout: 20000, maxRetries: 1 }); return true; }
    catch (e) { throw friendly(e); }
  }

  /* ---------------- context builders ---------------- */
  const HARSH = {
    standard: 'Professional and fair. Probe a vague answer once, then move on.',
    tough: 'Demanding, like a sceptical partner. Probe every vague, generic or unsupported answer. Ask for specifics, numbers and the candidate\'s own role. Test claims.',
    brutal: 'A relentless pressure test. Challenge assumptions, play devil\'s advocate, ask "so what?", push back on opinions, and test whether the candidate can defend a view. Never rude or personal.'
  };
  const FEEDBACK_TONE = {
    standard: 'Be direct and constructive.',
    tough: 'Be blunt. The candidate has asked to be told hard truths. Do not soften criticism or pad with praise.',
    brutal: 'Be unsparing, as a partner debriefing a weak candidate would be in private. Name every weakness plainly. No padding.'
  };

  function firmBriefing(firm) {
    const notes = (IT.store.state.firmNotes[firm.id] || '').trim();
    const lines = ['Firm: ' + firm.name + ' (' + firm.group + ')'];
    if (firm.known && firm.known.length) lines.push('Known for: ' + firm.known.join('; '));
    if (firm.facts && firm.facts.length) lines.push('Facts:\n- ' + firm.facts.join('\n- '));
    if (firm.format && firm.format.length) lines.push('Its interview process (as reported):\n- ' + firm.format.join('\n- '));
    if (firm.style) lines.push('Interviewing style to adopt: ' + firm.style);
    if (notes) lines.push('Candidate\'s own research notes on the firm (may contain errors; do not treat as verified):\n' + notes);
    return lines.join('\n');
  }

  function profileText() {
    const p = IT.store.state.profile;
    const rows = [['Name', p.name], ['Current stage', p.stage], ['Education', p.education], ['Experience', p.experience], ['Achievements', p.achievements], ['Firms applying to', p.targets], ['Other', p.extra]].filter(r => r[1] && String(r[1]).trim());
    return rows.length ? rows.map(r => r[0] + ': ' + String(r[1]).trim()).join('\n') : 'No profile given. Ask about their background where useful.';
  }

  function threadText(thread) {
    return thread.turns.map((t, i) => (i === 0 ? 'Main question' : 'Follow-up ' + i) + ': ' + t.q + '\nCandidate (' + (t.typed ? 'typed' : 'spoken, auto-transcribed') + ', ' + Math.round(t.durationSec || 0) + 's): ' + (t.transcript || '[no answer]')).join('\n\n');
  }

  /* ---------------- the interviewer ---------------- */
  const MOVE_SCHEMA = {
    type: 'object', additionalProperties: false, required: ['move', 'say', 'intent'],
    properties: {
      move: { type: 'string', enum: ['follow_up', 'next_question', 'end'] },
      say: { type: 'string', description: 'Exactly what the interviewer says next: one question, spoken style.' },
      intent: { type: 'string', description: 'What this question tests, in under 20 words, for the candidate\'s report.' }
    }
  };

  function interviewerSystem(ctx) {
    return [
      'You are the interviewer in a realistic graduate recruitment interview for a trainee solicitor (vacation scheme or training contract) at a UK law firm. Stay in role throughout.',
      '', firmBriefing(ctx.firm), '',
      'Interview format: ' + ctx.format.name + '. ' + ctx.format.blurb,
      'Pressure level: ' + HARSH[ctx.harshness || 'tough'],
      '', 'Candidate profile (from their application):', profileText(), '',
      'Each turn you decide the single next thing to say. Rules:',
      '- Ask exactly one question, in spoken British English, under 45 words. No lists, no multi-part questions.',
      '- Stay neutral: no praise, no feedback, no hints, no scores. At most a brief acknowledgement such as "Thank you." before the question.',
      '- Follow up (move "follow_up") when the answer is vague or generic, relies on "we" without the candidate\'s own role, lacks a result or a lesson, makes a claim worth testing, contradicts something earlier, or opens a commercial thread worth pulling.',
      '- Build directly on the candidate\'s own words; quote a short phrase of theirs where natural. Make follow-ups hard to predict.',
      '- Pivot the way a real AI interviewer does: from a story to its effect on a client of the firm, then what it means for the firm\'s practice areas and business development, then the counter-argument.',
      '- Never repeat a question already asked in this interview, or ask the same thing in other words.',
      '- When the thread is exhausted, or follow_ups_left is 0, use move "next_question": ask the next planned question, adapting the wording to this firm and, where it helps, linking naturally from what the candidate just said. If there is no planned question left, use move "end" with a short closing line.',
      '- Do not state facts about the firm beyond the briefing and widely known public information.',
      '- Spoken answers are automatic speech-to-text transcripts: ignore transcription errors and missing punctuation.'
    ].join('\n');
  }

  async function nextMove(ctx, signal) {
    const history = ctx.threads.map((t, i) => 'Question ' + (i + 1) + ' (' + (IT.CATS[t.cat] ? IT.CATS[t.cat].label : t.cat) + ')\n' + threadText(t)).join('\n\n---\n\n');
    const user = [
      'Interview so far:', history || '(nothing yet)', '',
      'Current question\'s follow_ups_left: ' + ctx.followUpsLeft,
      ctx.nextPlanned ? 'Next planned question (' + ctx.nextPlanned.label + '): ' + ctx.nextPlanned.text : 'Next planned question: none (this is the last one).',
      'Planned questions remaining after that: ' + ctx.remaining,
      ctx.mustMove ? 'You must now move on (use next_question or end).' : '',
      '', 'Decide your next move.'
    ].join('\n');
    return call({ system: interviewerSystem(ctx), messages: [{ role: 'user', content: user }], schema: MOVE_SCHEMA, effort: 'low', maxTokens: 6000, timeout: 30000, retries: 1, signal });
  }

  /* ---------------- fact check ---------------- */
  async function factCheck(thread, signal) {
    const today = new Date().toISOString().slice(0, 10);
    const system = 'You fact-check a law student\'s interview answer about news and business. Today is ' + today + '. Use web search to check the specific factual claims in the answer (names, figures, dates, events, deal status, who did what). Search only for claims that matter; at most four searches. Then reply with plain text only: one line per claim in the form "CLAIM :: verified|inaccurate|outdated|unverifiable :: one-sentence note with the correct position and the source name". If the answer makes no checkable claims, reply exactly "No checkable claims."';
    const answer = thread.turns.map(t => t.transcript || '').join('\n');
    return call({ system, messages: [{ role: 'user', content: 'Answer to check:\n' + answer }], tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }], effort: 'low', maxTokens: 8000, timeout: 120000, signal });
  }

  /* ---------------- marking ---------------- */
  const GRADE_SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['overall', 'verdict', 'headline', 'scores', 'strengths', 'weaknesses', 'turn_notes', 'fact_check', 'model_answer', 'rewrite', 'drill'],
    properties: {
      overall: { type: 'integer', description: '1-5' },
      verdict: { type: 'string', enum: ['Reject', 'Borderline', 'Progress', 'Strong', 'Exceptional'] },
      headline: { type: 'string', description: 'One blunt sentence an assessor would write.' },
      scores: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['criterion', 'score', 'evidence'], properties: { criterion: { type: 'string' }, score: { type: 'integer' }, evidence: { type: 'string', description: 'Why, quoting the candidate where possible.' } } } },
      strengths: { type: 'array', items: { type: 'string' } },
      weaknesses: { type: 'array', items: { type: 'string' } },
      turn_notes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['turn', 'note'], properties: { turn: { type: 'integer', description: '0 = main answer, 1 = first follow-up, ...' }, note: { type: 'string' } } } },
      fact_check: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['claim', 'status', 'note'], properties: { claim: { type: 'string' }, status: { type: 'string', enum: ['verified', 'inaccurate', 'outdated', 'unverifiable'] }, note: { type: 'string' } } } },
      model_answer: { type: 'string', description: 'How a top candidate would structure this answer: a short outline, not an invented life story.' },
      rewrite: { type: 'string', description: 'The candidate\'s main answer rewritten to a strong standard, first person, using only facts they gave; put [square brackets] where they must supply missing evidence.' },
      drill: { type: 'string', description: 'One specific exercise to fix the biggest weakness.' }
    }
  };

  function graderSystem(ctx, thread) {
    const sub = IT.SUBS[thread.sub] || {};
    const crit = criteriaFor(thread);
    return [
      'You are a senior partner and graduate recruitment assessor marking a trainee solicitor candidate\'s interview answer. The candidate wants an objective, demanding assessment to prepare for real interviews at competitive firms.',
      'Calibration (fixed, never inflate): mark to the standard of a competitive City firm that receives thousands of applications for a small number of places. 1 Poor: fails to answer or shows a red flag. 2 Weak: generic, vague, claims without evidence. 3 Competent: answers with a real example and some structure; borderline at a competitive firm. 4 Strong: specific, structured, owned, reflective; would progress at most City firms. 5 Exceptional: memorable, insightful, polished; top few per cent and rare. Untrained answers typically score 2-3. overall is your holistic judgement, not an average.',
      'Feedback tone: ' + FEEDBACK_TONE[ctx.harshness || 'tough'],
      '', firmBriefing(ctx.firm), '',
      'Question type: ' + (IT.CATS[thread.cat] || {}).label + ' / ' + (sub.label || thread.sub),
      'Score exactly these criteria, in this order: ' + crit.join('; ') + '.',
      sub.look ? 'Assessors credit: ' + sub.look.map(s => s.replace(/\{firm\}/g, ctx.firm.name)).join('; ') + '.' : '',
      sub.traps ? 'Red flags: ' + sub.traps.join('; ') + '.' : '',
      sub.shape ? 'Strong answer shape: ' + sub.shape : '',
      'Delivery: judge from the metrics given and the coherence of the transcript. Spoken answers are automatic transcripts, so ignore transcription errors, missing punctuation and missing "um"s.',
      '"Composure under follow-up questions", where listed, judges how well the candidate thought on their feet: did follow-up answers stay structured, answer the actual question and add substance, or did they repeat, ramble or freeze?',
      'Accuracy: use the fact-check notes when given. If a claim is unverifiable, say so and do not penalise heavily; penalise clear errors.',
      'fact_check: list the notable factual claims and their status (empty if none).'
    ].filter(Boolean).join('\n');
  }

  function criteriaFor(thread) {
    const crit = (IT.RUBRICS[thread.cat] || IT.RUBRICS.competency).slice();
    if (thread.turns.length > 1) crit.push('Composure under follow-up questions');
    return crit;
  }

  async function grade(ctx, thread, facts, signal) {
    const metrics = thread.turns.map((t, i) => {
      const m = t.metrics || {};
      return (i === 0 ? 'Main' : 'Follow-up ' + i) + ': ' + (m.words || 0) + ' words in ' + Math.round(t.durationSec || 0) + 's' + (t.limit ? ' (limit ' + t.limit + 's)' : '') + ', ' + (m.wpm || 0) + ' wpm, ' + (m.fillerCount || 0) + ' fillers, ' + (t.prepSec != null ? 'thinking time used ' + Math.round(t.prepSec) + 's, ' : '') + (t.firstWordSec != null ? 'first word after ' + t.firstWordSec.toFixed(1) + 's, ' : '') + (t.longPauses ? t.longPauses + ' pauses over 4s' : 'no long pauses');
    }).join('\n');
    const user = [threadText(thread), '', 'Delivery metrics:', metrics, '', facts ? 'Fact-check notes (from live web search):\n' + facts : 'No fact check was run.', '', 'Mark this answer.'].join('\n');
    const out = await call({ system: graderSystem(ctx, thread), messages: [{ role: 'user', content: user }], schema: GRADE_SCHEMA, effort: 'high', maxTokens: 16000, timeout: 180000, signal });
    return normaliseGrade(out, criteriaFor(thread));
  }

  function normaliseGrade(out, crit) {
    const clamp = n => Math.max(1, Math.min(5, Math.round(Number(n) || 1)));
    const o = Object.assign({ strengths: [], weaknesses: [], turn_notes: [], fact_check: [], scores: [] }, out || {});
    o.overall = clamp(o.overall);
    o.scores = (o.scores || []).map(s => ({ criterion: String(s.criterion || ''), score: clamp(s.score), evidence: String(s.evidence || '') }));
    crit.forEach(c => { if (!o.scores.some(s => s.criterion.toLowerCase() === c.toLowerCase())) o.scores.push({ criterion: c, score: null, evidence: 'Not scored.' }); });
    o.source = 'ai';
    return o;
  }

  /* ---------------- the overall debrief ---------------- */
  const SUMMARY_SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['overall', 'verdict', 'readiness', 'summary', 'strengths', 'priorities', 'thinking_on_feet', 'next_session'],
    properties: {
      overall: { type: 'integer', description: '1-5 holistic' },
      verdict: { type: 'string', enum: ['Reject', 'Borderline', 'Progress', 'Strong', 'Exceptional'] },
      readiness: { type: 'string', description: 'Would this performance progress at the firm today? One or two blunt sentences.' },
      summary: { type: 'string', description: 'The debrief a partner would give, 3-5 sentences.' },
      strengths: { type: 'array', items: { type: 'string' } },
      priorities: { type: 'array', description: 'The three most important things to fix, most important first.', items: { type: 'object', additionalProperties: false, required: ['title', 'why', 'how'], properties: { title: { type: 'string' }, why: { type: 'string' }, how: { type: 'string', description: 'A concrete practice method.' } } } },
      thinking_on_feet: { type: 'string', description: 'How the candidate handled unpredictable follow-ups and pressure, and one technique to improve.' },
      next_session: { type: 'array', items: { type: 'string' }, description: 'What to practise in the next session, as specific question types or drills.' }
    }
  };

  async function summarise(ctx, session, history, signal) {
    const lines = session.threads.map((t, i) => {
      const gr = t.grade || {};
      return 'Q' + (i + 1) + ' [' + ((IT.CATS[t.cat] || {}).label || t.cat) + '] ' + t.turns[0].q + '\nScore ' + (gr.overall || '?') + '/5 (' + (gr.verdict || '') + '): ' + (gr.headline || '') + '\nWeaknesses: ' + (gr.weaknesses || []).join('; ') + '\nFollow-ups faced: ' + (t.turns.length - 1);
    }).join('\n\n');
    const system = [
      'You are a senior partner giving a candidate a private debrief after a practice interview for a trainee solicitor role. Calibrate to a competitive City firm; never inflate. ' + FEEDBACK_TONE[ctx.harshness || 'tough'],
      '', firmBriefing(ctx.firm), '',
      'The candidate struggles with thinking on their feet and with anxiety in unpredictable AI and video interviews. Make the plan practical: specific drills and techniques, not generic advice.'
    ].join('\n');
    const user = ['Format: ' + ctx.format.name, '', 'Marked answers:', lines, '', history ? 'Their earlier sessions, for trend: ' + history : 'This is their first marked session.', '', 'Write the debrief.'].join('\n');
    const out = await call({ system, messages: [{ role: 'user', content: user }], schema: SUMMARY_SCHEMA, effort: 'medium', maxTokens: 12000, timeout: 120000, signal });
    out.overall = Math.max(1, Math.min(5, Math.round(Number(out.overall) || 1)));
    out.source = 'ai';
    return out;
  }

  IT.ai = { available, test, nextMove, factCheck, grade, summarise, meter, costOf, criteriaFor, friendly, AIError, _call: call };
})(typeof window !== 'undefined' ? window : globalThis);
