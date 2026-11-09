/*
 * Checks the question bank, firm briefings, offline coach and interview engine.
 * Run: node test/verify.js
 *
 * - Bank: unique ids and wording, every competency has marking guidance,
 *   probes and a rubric; no unfilled {slots} after a firm is filled in.
 * - Engine: every format with every firm runs start to finish offline, never
 *   repeats a question within an interview, respects follow-up depth, and the
 *   Mishcon replay asks the real questions in the real order.
 * - AI path (with a fake AI): follow-ups and rephrased questions are used, a
 *   failure falls back to offline follow-ups, two failures (or a bad key)
 *   switch the AI off for the rest of the interview, a hang times out.
 * - Marking: offline and AI marking fill every thread, failures fall back to
 *   the offline estimate, and costs are counted per session.
 */
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');
['data/bank.js', 'data/firms.js', 'js/store.js', 'js/coach.js', 'js/ai.js', 'js/interview.js'].forEach(f => require(path.join(root, f)));
const IT = globalThis.IT;

let failures = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.error('FAIL:', msg); } };

IT.store.load();

/* ---------------- bank ---------------- */
const ids = new Set(), texts = new Set();
IT.QUESTIONS.forEach(q => {
  ok(!ids.has(q.id), 'duplicate id ' + q.id); ids.add(q.id);
  ok(!texts.has(q.q), 'duplicate wording ' + q.q); texts.add(q.q);
  ok(IT.CATS[q.cat], 'unknown category ' + q.cat);
  ok(/[?.]$/.test(q.q), 'question should end with ? or . : ' + q.q);
});
Object.entries(IT.SUBS).forEach(([k, s]) => {
  ok(s.look && s.look.length >= 2, k + ' needs assessor guidance');
  ok(s.traps && s.traps.length >= 1, k + ' needs red flags');
  ok(s.probes && s.probes.length >= 2, k + ' needs probes');
  ok(s.shape, k + ' needs an answer shape');
  ok(IT.RUBRICS[s.cat], k + ' category has no rubric');
});
ok(IT.QUESTIONS.length >= 260, 'bank should have at least 260 questions, has ' + IT.QUESTIONS.length);
IT.REPLAY.forEach(r => ok(IT.qById(r.qid), 'replay question missing ' + r.qid));

const slotLeft = s => /\{|\}|undefined|NaN|null/.test(s);
IT.FIRMS.concat([IT.resolveFirm('custom', 'Smith & Jones LLP')]).forEach(f => {
  IT.QUESTIONS.forEach(q => ok(!slotLeft(IT.fillFirm(q.q, f)), 'unfilled slot for ' + f.name + ': ' + q.q));
  Object.values(IT.SUBS).forEach(s => s.probes.forEach(p => ok(!slotLeft(IT.coach.fill(p, f.name, 'AI')), 'unfilled probe ' + p)));
  ok(f.id && f.name && f.group && Array.isArray(f.facts) && Array.isArray(f.format), 'firm fields ' + f.name);
});
ok(IT.fillFirm('Why {firm}?', IT.firmById('generic')) === 'Why this firm?', 'generic firm reads "this firm"');
ok(IT.fillFirm('{firm}\'s strategy', IT.firmById('generic')) === 'this firm\'s strategy', 'generic possessive');
ok(IT.fillFirm('{firm}\'s strategy', IT.firmById('linklaters')) === 'Linklaters\' strategy', 'possessive of a name ending in s');
ok(IT.fillFirm('{firm}\'s strategy', IT.firmById('cms')) === 'CMS\'s strategy', 'possessive of an acronym');

/* ---------------- coach ---------------- */
const m = IT.coach.metrics('Um, so basically I led a team of five and we increased sign-ups by 40%. I learned to delegate earlier.', 30, 120);
ok(m.words === 20, 'word count ' + m.words);
ok(m.fillers.um === 1 && m.fillers.basically === 1, 'fillers ' + JSON.stringify(m.fillers));
ok(m.numbers >= 1 && m.result >= 1 && m.reflection >= 1, 'evidence markers');
ok(IT.coach.metrics('I would like to explain', 10).fillerCount === 0, '"like to" is not a filler');
ok(IT.coach.findTopic('The Bank of England cut interest rates') === 'Bank of England policy', 'topic detection');
const gOff = IT.coach.grade({ sub: 'teamwork', cat: 'competency', turns: [{ q: 'x', transcript: 'We did a project. We won.', durationSec: 20 }] }, 'Baker McKenzie');
ok(gOff.overall >= 1 && gOff.overall <= 3, 'weak answer estimated low, got ' + gOff.overall);
ok(gOff.weaknesses.some(w => /we/i.test(w)), 'flags "we" over "I"');
const strong = 'The situation was that our university law society was losing members. My task as treasurer was to reverse that within one term. First, I surveyed 120 students and found cost was the main barrier. Second, I negotiated sponsorship of £2,000 from two firms, which meant I could cut fees by half. As a result, membership increased by 35% to 210 students. I learned that data persuades people more than enthusiasm, and I now start every project by asking the people affected.';
const gStrong = IT.coach.grade({ sub: 'initiative', cat: 'competency', turns: [{ q: 'x', transcript: strong, durationSec: 100 }] }, 'Baker McKenzie');
ok(gStrong.overall >= 3 && gStrong.overall > gOff.overall, 'strong answer estimated higher: ' + gStrong.overall);

/* ---------------- engine helpers ---------------- */
const ANSWER = 'I think the key point is that I personally led the work. As a result we increased engagement by 20%, and I learned to plan earlier. This matters to clients because costs rise, which means more restructuring and disputes work for the firm and new business development opportunities.';
function freshStore() {
  return { state: { settings: Object.assign({}, IT.store.state.settings, { apiKey: '' }), profile: {}, firmNotes: {}, sessions: [], log: [], seen: {} }, save() { return true; }, uid: p => p + '-' + Math.random().toString(36).slice(2) };
}
async function run(opts, answerFn) {
  const iv = new IT.Interview(Object.assign({ store: freshStore(), seed: 7 }, opts));
  const asked = [];
  let q = await iv.next(), guard = 0;
  while (q && guard++ < 200) {
    asked.push(q);
    iv.answer({ transcript: answerFn ? answerFn(q) : ANSWER, durationSec: 60, prepSec: 5, firstWordSec: 1.2 });
    q = await iv.next();
  }
  return { iv, asked };
}

(async () => {
  /* ---------------- engine, offline ---------------- */
  for (const fmt of IT.FORMATS) {
    for (const firm of IT.FIRMS) {
      const { iv, asked } = await run({ formatId: fmt.id, firmId: firm.id, ai: null });
      ok(iv.done, fmt.id + '/' + firm.id + ' finished');
      const mains = asked.filter(a => a.kind === 'main');
      ok(mains.length === iv.plan.length, fmt.id + '/' + firm.id + ' asked every planned question');
      const norm = s => s.toLowerCase();
      ok(new Set(asked.map(a => norm(a.text))).size === asked.length, fmt.id + '/' + firm.id + ' repeated a question: ' + asked.map(a => a.text).join(' | '));
      asked.forEach(a => ok(!slotLeft(a.text) && a.text.length > 8, 'bad question text ' + a.text));
      iv.threads.forEach(t => ok(t.turns.length - 1 <= Math.max(iv.depth, t.script.length + t.offlineScript.length), fmt.id + ' depth exceeded'));
      if (fmt.id === 'oneway' || fmt.id === 'quickfire') ok(asked.every(a => a.kind === 'main'), fmt.id + ' should have no follow-ups');
      ok(iv.record.status === 'answered', 'status answered');
    }
  }
  {
    const { asked } = await run({ formatId: 'replay', firmId: 'mishcon', ai: null });
    const t = asked.map(a => a.text);
    ok(/integrity was challenged, and how you turned that setback into an advantage/.test(t[0]), 'replay starts with integrity: ' + t[0]);
    const news = t.findIndex(x => /news story you have been following/.test(x));
    ok(news > 0, 'replay asks the news question');
    ok(/impact a client of Mishcon de Reya/.test(t[news + 1]), 'replay asks client impact next: ' + t[news + 1]);
    ok(/Mishcon's business development/.test(t[news + 2]), 'replay asks business development next: ' + t[news + 2]);
  }
  {
    const { iv, asked } = await run({ formatId: 'adaptive', firmId: 'baker', ai: null }, () => '');
    ok(asked.every(a => a.kind === 'main'), 'silence gets no follow-up');
    ok(iv.done, 'silent interview still ends');
  }
  {
    const { asked } = await run({ formatId: 'adaptive', firmId: 'generic', ai: null, focus: 'ethics', length: 3 });
    ok(asked.filter(a => a.kind === 'main').every(a => IT.QUESTIONS.find(q => q.q === a.text).cat === 'ethics'), 'focus filter respected');
  }
  {
    const { asked } = await run({ formatId: 'adaptive', firmId: 'baker', ai: null, qids: ['resilience-1'], depth: 2 });
    ok(asked.length === 3 && asked[0].text === IT.qById('resilience-1').q, 'single-question practice with 2 follow-ups');
  }
  {
    // Questions seen least often are preferred.
    const st = freshStore();
    IT.QUESTIONS.filter(q => q.cat === 'commercial').forEach(q => { st.state.seen[q.id] = 5; });
    st.state.seen['ai-tech-2'] = 0;
    const iv = new IT.Interview({ store: st, formatId: 'oneway', firmId: 'generic', ai: null, focus: 'commercial', length: 1, seed: 3 });
    ok(iv.plan[0].qid === 'ai-tech-2', 'least-seen question chosen, got ' + iv.plan[0].qid);
  }

  /* ---------------- engine, fake AI ---------------- */
  const fakeAI = behaviour => {
    let n = 0;
    return {
      available: () => true, meter: { calls: 0, inTok: 0, outTok: 0, searches: 0 }, costOf: (mm) => mm.inTok / 1e6 * 4 + mm.outTok / 1e6 * 20, AIError: IT.ai.AIError,
      nextMove: async (ctx, signal) => {
        n++;
        return behaviour(n, ctx, signal);
      }
    };
  };
  {
    const ai = fakeAI((n, ctx) => {
      ai.meter.calls++; ai.meter.inTok += 1000; ai.meter.outTok += 100;
      if (ctx.followUpsLeft > 1) return { move: 'follow_up', say: 'AI follow-up number ' + n + '?', intent: 'Tests depth' };
      return { move: 'next_question', say: ctx.nextPlanned ? 'Rephrased: ' + ctx.nextPlanned.text : 'Thank you, that is all.', intent: '' };
    });
    const { iv, asked } = await run({ formatId: 'adaptive', firmId: 'mishcon', ai });
    ok(asked.some(a => a.source === 'ai' && /AI follow-up/.test(a.text)), 'AI follow-ups used');
    ok(asked.some(a => a.kind === 'main' && /^Rephrased:/.test(a.text)), 'AI rephrased main question used');
    ok(iv.record.aiInterviewer === true, 'record marks AI interviewer');
    ok(iv.record.cost && iv.record.cost.calls > 0 && iv.record.cost.usd > 0, 'cost counted ' + JSON.stringify(iv.record.cost));
    ok(iv.done && asked.filter(a => a.kind === 'main').length === iv.plan.length, 'AI interview completes the plan');
  }
  {
    const ai = fakeAI(n => { if (n === 1) throw Object.assign(new Error('Claude is busy'), { code: 'busy' }); return { move: 'follow_up', say: 'Recovered AI follow-up ' + n + '?', intent: '' }; });
    const { iv, asked } = await run({ formatId: 'adaptive', firmId: 'baker', ai, length: 2 });
    ok(asked[1] && asked[1].source === 'offline', 'first failure falls back offline');
    ok(asked.some(a => a.source === 'ai'), 'AI resumes after one failure');
    ok(iv.notices.length === 1 && !iv.aiOff, 'one notice, AI still on');
  }
  {
    const ai = fakeAI(() => { throw Object.assign(new Error('Your API key was rejected.'), { code: 'auth' }); });
    const { iv, asked } = await run({ formatId: 'adaptive', firmId: 'baker', ai, length: 3 });
    ok(iv.aiOff && asked.filter(a => a.source === 'ai').length === 0, 'bad key switches AI off');
    ok(asked.filter(a => a.source === 'offline').length >= 2, 'offline follow-ups continue after bad key');
    ok(iv.done, 'interview completes after bad key');
  }
  {
    const ai = fakeAI((n, ctx, signal) => new Promise((res, rej) => { if (signal) signal.addEventListener('abort', () => rej(new Error('aborted'))); }));
    const t0 = Date.now();
    const { iv, asked } = await run({ formatId: 'adaptive', firmId: 'baker', ai, length: 1, depth: 2, aiTimeout: 150 });
    ok(Date.now() - t0 < 3000, 'hung AI times out quickly');
    ok(asked.length === 3 && asked.slice(1).every(a => a.source === 'offline'), 'timeouts produce offline follow-ups');
    ok(iv.aiOff, 'two timeouts switch AI off');
  }
  {
    const ai = fakeAI(() => ({ move: 'follow_up', say: IT.qById('resilience-1').q, intent: '' }));
    const { asked } = await run({ formatId: 'adaptive', firmId: 'baker', ai, qids: ['resilience-1'], depth: 1 });
    ok(asked.length === 1, 'AI repeating the same question is ignored');
  }

  /* ---------------- marking ---------------- */
  {
    const { iv } = await run({ formatId: 'adaptive', firmId: 'baker', ai: null, length: 3 });
    const rec = await iv.mark();
    ok(rec.status === 'marked' && rec.summary && rec.summary.source === 'offline', 'offline marking done');
    ok(rec.threads.every(t => t.grade && t.grade.scores.length), 'every thread graded offline');
    ok(rec.threads.every(t => t.grade.scores.every(s => s.score === null || (s.score >= 1 && s.score <= 5))), 'offline scores in range');
  }
  {
    const st = freshStore();
    st.state.settings.factCheck = true;
    const calls = { grade: 0, fact: 0, sum: 0 };
    const ai = {
      available: () => true, meter: { calls: 0, inTok: 0, outTok: 0, searches: 0 }, costOf: () => 0.5, AIError: IT.ai.AIError,
      nextMove: async () => ({ move: 'next_question', say: '', intent: '' }),
      factCheck: async () => { calls.fact++; ai.meter.calls++; ai.meter.searches++; return 'Claim :: verified :: fine'; },
      grade: async (ctx, t, facts) => { calls.grade++; ai.meter.calls++; if (t.cat === 'motivation') throw Object.assign(new Error('Claude is busy'), { code: 'busy' }); return { source: 'ai', overall: 3, verdict: 'Progress', headline: 'ok', scores: [{ criterion: 'Relevance', score: 3, evidence: facts || '' }], strengths: [], weaknesses: [], turn_notes: [], fact_check: [], model_answer: '', rewrite: '', drill: '' }; },
      summarise: async () => { calls.sum++; ai.meter.calls++; return { source: 'ai', overall: 3, verdict: 'Progress', readiness: '', summary: '', strengths: [], priorities: [], thinking_on_feet: '', next_session: [] }; }
    };
    const iv = new IT.Interview({ store: st, formatId: 'adaptive', firmId: 'mishcon', ai, seed: 2, length: 4, depth: 0 });
    let q = await iv.next();
    while (q) { iv.answer({ transcript: ANSWER, durationSec: 50 }); q = await iv.next(); }
    const rec = await iv.mark();
    ok(calls.grade === rec.threads.length && calls.sum === 1, 'AI graded every thread and summarised');
    ok(calls.fact >= 1, 'fact check ran for commercial content');
    const mot = rec.threads.find(t => t.cat === 'motivation');
    if (mot) ok(mot.grade.source === 'offline' && /AI marking failed/.test(mot.grade.error), 'failed AI grade falls back offline');
    ok(rec.summary.source === 'ai' && rec.summary.errors && rec.summary.errors.length, 'summary records errors');
    ok(rec.cost && rec.cost.calls >= calls.grade + calls.sum, 'marking cost counted: ' + JSON.stringify(rec.cost));
    ok(st.state.sessions[0].id === rec.id, 'session saved to store');
  }

  /* ---------------- AI request shape ---------------- */
  {
    // Capture what would be sent to the API with a stub SDK.
    let sent = null;
    globalThis.AnthropicSDK = function () { return { beta: { messages: { create: async (body) => { sent = body; return { stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"move":"follow_up","say":"Why?","intent":"x"}' }] }; } } } }; };
    IT.store.state.settings.apiKey = 'sk-ant-test';
    const mv = await IT.ai.nextMove({ firm: IT.firmById('mishcon'), format: IT.formatById('adaptive'), harshness: 'tough', threads: [{ cat: 'competency', turns: [{ q: 'Q?', transcript: 'A.', durationSec: 3 }] }], followUpsLeft: 2, nextPlanned: null, remaining: 0 });
    ok(mv.say === 'Why?', 'parses structured output');
    ok(sent.model === 'claude-opus-5-5' && sent.output_config.effort === 'low' && sent.output_config.format.type === 'json_schema', 'request uses Opus 5.5, low effort, JSON schema');
    ok(sent.fallbacks === 'default' && sent.betas.includes('server-side-fallback-2026-07-01'), 'fallbacks enabled');
    ok(!('temperature' in sent) && sent.thinking.type === 'adaptive', 'no sampling params, adaptive thinking');
    ok(/Mishcon de Reya/.test(sent.system) && /Article 50/.test(sent.system), 'firm briefing in system prompt');
    IT.store.state.settings.apiKey = 'sk-ant-test-2'; // a new key makes a new client with the new stub
    globalThis.AnthropicSDK = function () { return { beta: { messages: { create: async () => ({ stop_reason: 'refusal', stop_details: { category: 'bio' }, usage: {}, content: [] }) } } }; };
    let threw = null;
    try { await IT.ai._call({ system: 's', messages: [{ role: 'user', content: 'x' }], schema: {} }); } catch (e) { threw = e; }
    ok(threw && threw.code === 'refusal', 'refusal surfaces as an error');
    IT.store.state.settings.apiKey = 'sk-ant-test-3';
    globalThis.AnthropicSDK = function () { return { beta: { messages: { create: async () => ({ stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: 'Here: {"a":1} done' }] }) } } }; };
    const loose = await IT.ai._call({ system: 's', messages: [{ role: 'user', content: 'x' }], schema: {} });
    ok(loose.a === 1, 'extracts JSON from surrounding text');
    IT.store.state.settings.apiKey = '';
  }

  console.log((failures ? 'FAILED ' + failures : 'All passed') + ' (' + checks + ' checks, ' + IT.QUESTIONS.length + ' questions, ' + IT.FIRMS.length + ' firms)');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
