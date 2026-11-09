/*
 * End-to-end interviews in Chromium with a fake camera and microphone,
 * a simulated speech recogniser (which, like Chrome's, stops by itself every
 * 1.5 seconds) and a simulated Claude API.
 *
 * Run with the hub served locally:  python3 -m http.server 8765  (from law-conversion-hub)
 * then:  node test/e2e.js [base-url]
 */
'use strict';
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/interview-trainer/';

let failures = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { failures++; console.error('FAIL:', m); } else if (process.env.VERBOSE) console.log('ok:', m); };

const FAKE_SR = () => {
  window.__sr = { queue: [], mode: 'ok', instances: 0 };
  class FakeSR {
    constructor() { window.__sr.instances++; this._t = []; this._r = []; }
    start() {
      const m = window.__sr.mode;
      if (m !== 'ok') { setTimeout(() => { if (this.onerror) this.onerror({ error: m }); if (this.onend) this.onend(); }, 50); return; }
      this._on = true;
      const tick = () => {
        if (!this._on) return;
        const s = window.__sr.queue.shift();
        if (s) {
          this._r.push({ isFinal: false, 0: { transcript: s }, length: 1 });
          const i = this._r.length - 1;
          this._emit(i);
          setTimeout(() => { if (!this._on) return; this._r[i] = { isFinal: true, 0: { transcript: s }, length: 1 }; this._emit(i); }, 60);
        }
        this._t.push(setTimeout(tick, 150));
      };
      tick();
      this._t.push(setTimeout(() => this._end(), 1500)); // Chrome ends sessions by itself
    }
    _emit(i) { if (this.onresult) this.onresult({ resultIndex: i, results: this._r.slice() }); }
    _end() { if (!this._on) return; this._on = false; this._t.forEach(clearTimeout); setTimeout(() => { if (this.onend) this.onend(); }, 10); }
    stop() { this._end(); }
    abort() { this._end(); }
  }
  window.SpeechRecognition = FakeSR;
  window.webkitSpeechRecognition = FakeSR;
};

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
function mockApi(page, state) {
  return page.route('https://api.anthropic.com/**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const json = (status, obj) => route.fulfill({ status, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: JSON.stringify(obj) });
    if (state.mode === '401') return json(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
    if (req.url().includes('/v1/models/')) return json(200, { id: 'claude-opus-5-5', type: 'model', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' });
    const body = JSON.parse(req.postData() || '{}');
    state.calls.push(body);
    const schema = body.output_config && body.output_config.format && body.output_config.format.schema;
    let text;
    if (body.tools) { state.facts++; text = 'The Bank of England cut rates :: verified :: Confirmed by BBC News, 6 November 2026.'; }
    else if (schema && schema.properties.move) { state.moves++; text = JSON.stringify({ move: 'follow_up', say: 'AI follow-up ' + state.moves + ': what exactly did you do yourself?', intent: 'Tests ownership' }); }
    else if (schema && schema.properties.scores) {
      state.grades++;
      text = JSON.stringify({ overall: 3, verdict: 'Borderline', headline: 'A real example, but the result is vague.', scores: [{ criterion: 'Relevance', score: 4, evidence: 'Answers the question.' }, { criterion: 'Structure', score: 3, evidence: 'Some structure.' }], strengths: ['Specific situation'], weaknesses: ['No measurable result'], turn_notes: [{ turn: 0, note: 'Started well.' }], fact_check: [{ claim: 'Bank of England cut rates', status: 'verified', note: 'Correct.' }], model_answer: 'Situation, task, action, result.', rewrite: 'When I was treasurer, I [add the number]...', drill: 'Retell it in 90 seconds with a number.' });
    }
    else if (schema && schema.properties.priorities) { state.sums++; text = JSON.stringify({ overall: 3, verdict: 'Borderline', readiness: 'Not yet at the bar for Mishcon.', summary: 'Solid examples, thin commercial chain.', strengths: ['Composure'], priorities: [{ title: 'Walk the commercial chain', why: 'You stopped at the headline.', how: 'Story, client, practice areas, BD.' }], thinking_on_feet: 'You paused well.', next_session: ['Commercial awareness grill'] }); }
    else text = '{}';
    return json(200, { id: 'msg_' + state.calls.length, type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 300 } });
  });
}

async function newPage(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1366, height: 900 } }, opts || {}));
  await ctx.addInitScript(FAKE_SR);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_NAME|ERR_TUNNEL|Failed to load resource|401/.test(m.text())) page.errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  return { ctx, page };
}

async function setPractise(page, o) {
  await page.goto(BASE + '#/');
  await page.waitForSelector('#go');
  if (o.firm) await page.selectOption('#firm', o.firm);
  if (o.format) await page.click('.fmt[data-fmt="' + o.format + '"]');
  for (const k of ['length', 'depth', 'prep', 'answer', 'focus']) if (o[k] != null) await page.selectOption('#' + k, String(o[k]));
  const setCheck = async (id, v) => { if (v != null && (await page.isChecked('#' + id)) !== v) await page.click('#' + id); };
  await setCheck('tVoice', o.voice != null ? o.voice : false);
  await setCheck('tCam', o.camera);
  await setCheck('tRec', o.record);
  await setCheck('tType', o.type);
  await setCheck('tEach', o.each);
  await setCheck('tBreathe', false);
}

async function begin(page) {
  await page.click('#go');
  await page.waitForSelector('#begin');
  await page.waitForFunction(() => { const c = document.querySelector('#ckCam'); return c && c.textContent !== '…'; }, null, { timeout: 10000 });
  await page.click('#begin');
}

/* Answer the current question. Returns the question text. */
async function answer(page, sentences, opts) {
  await page.waitForSelector('#qtext', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('#startNow') || document.querySelector('#done'), null, { timeout: 15000 });
  const q = await page.textContent('#qtext');
  if (await page.$('#startNow')) await page.click('#startNow');
  await page.waitForSelector('#done');
  if (opts && opts.type) {
    await page.fill('#typed', sentences.join(' '));
  } else if (sentences.length) {
    await page.evaluate(s => { window.__sr.queue.push(...s); }, sentences);
    const last = sentences[sentences.length - 1];
    await page.waitForFunction(t => { const l = document.querySelector('#live'); return l && l.textContent.includes(t); }, last, { timeout: 15000 });
    await page.waitForTimeout(150);
  }
  await page.click('#done');
  return q;
}

async function waitEnd(page) {
  await page.waitForSelector('#toReport, a.btn[href="#/"]', { timeout: 30000 });
}

const STORY = ['When I was treasurer of the law society, I noticed membership had fallen by a third.', 'I surveyed 120 students and negotiated £2,000 of sponsorship, which meant I could halve the fee.', 'As a result membership rose 35%, and I learned to start with data.'];
const NEWS = ['The Bank of England cut interest rates last week because inflation fell.', 'That matters to clients because borrowing becomes cheaper, which means more private equity deals.', 'For the firm it means more M&A and finance work, and business development through client alerts.'];

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });

  /* ---- A: offline adaptive interview, spoken, camera and recording ---- */
  {
    const { ctx, page } = await newPage(browser);
    await setPractise(page, { firm: 'baker', format: 'adaptive', length: 2, depth: 2, camera: true, record: true, type: false });
    await begin(page);
    const asked = [];
    for (let i = 0; i < 6; i++) {
      const done = await page.$('#toReport');
      if (done) break;
      asked.push(await answer(page, i % 2 ? NEWS : STORY));
      await page.waitForFunction(() => document.querySelector('#toReport') || document.querySelector('#qtext') || document.querySelector('.phase .spin'), null, { timeout: 20000 });
      await page.waitForTimeout(300);
    }
    await waitEnd(page);
    ok(asked.length === 6, 'A: 2 questions × (1 + 2 follow-ups) asked, got ' + asked.length + ': ' + asked.join(' | '));
    ok(new Set(asked).size === asked.length, 'A: no repeated question');
    const sr = await page.evaluate(() => window.__sr.instances);
    ok(sr > 6, 'A: speech recogniser restarted after Chrome-style auto-stop (' + sr + ' sessions)');
    await page.click('#toReport');
    await page.waitForSelector('.verdict', { timeout: 30000 });
    const report = await page.textContent('main');
    ok(/estimated without AI/.test(report), 'A: report says estimated without AI');
    ok(report.includes('treasurer of the law society') && report.includes('halve the fee'), 'A: transcript stitched across recogniser restarts');
    const clips = await page.evaluate(() => new Promise(r => { const q = indexedDB.open('interview-trainer-media'); q.onsuccess = () => { const t = q.result.transaction('clips').objectStore('clips').getAllKeys(); t.onsuccess = () => r(t.result.length); }; }));
    ok(clips === 6, 'A: six recordings saved to IndexedDB, got ' + clips);
    await page.waitForSelector('video[src^="blob:"]', { timeout: 10000 });
    const dur = await page.evaluate(() => new Promise(r => { const v = document.querySelector('video[src^="blob:"]'); if (v.readyState >= 1) r(v.duration); else v.onloadedmetadata = () => r(v.duration); setTimeout(() => r(-1), 4000); }));
    ok(dur !== -1, 'A: recorded video plays back (duration ' + dur + ')');
    // Persistence across reload.
    await page.reload();
    await page.goto(BASE + '#/progress');
    await page.waitForSelector('table.hist');
    ok((await page.$$('table.hist tbody tr')).length === 1, 'A: session listed in history after reload');
    ok(/Mishcon de Reya/.test(await page.textContent('main')), 'A: today\'s real Mishcon interview is in the log');
    ok(page.errors.length === 0, 'A: no page errors: ' + page.errors.join(' | '));
    await ctx.close();
  }

  /* ---- B: AI on, Mishcon replay, fact check, cost ---- */
  {
    const { ctx, page } = await newPage(browser);
    const api = { mode: 'ok', calls: [], moves: 0, grades: 0, facts: 0, sums: 0 };
    await mockApi(page, api);
    await page.goto(BASE + '#/settings');
    await page.fill('#key', 'sk-ant-test-key');
    await page.click('#saveKey');
    await page.waitForFunction(() => /Key works/.test(document.querySelector('#keyMsg').textContent), null, { timeout: 10000 });
    ok(true, 'B: key test passes against the models endpoint');
    await page.fill('[data-p="experience"]', 'Paralegal at a high street firm for a year');
    await page.waitForTimeout(600);
    await setPractise(page, { format: 'replay', camera: false, record: false, type: false });
    await begin(page);
    const asked = [];
    for (let i = 0; i < 8; i++) {
      if (await page.$('#toReport')) break;
      asked.push(await answer(page, asked.length >= 3 ? NEWS : STORY));
      await page.waitForFunction(() => document.querySelector('#toReport') || document.querySelector('#qtext'), null, { timeout: 20000 });
      await page.waitForTimeout(300);
    }
    await waitEnd(page);
    ok(/integrity was challenged, and how you turned that setback into an advantage/.test(asked[0]), 'B: replay opens with the integrity question');
    ok(/^AI follow-up/.test(asked[1]) && /^AI follow-up/.test(asked[2]), 'B: AI follow-ups on the integrity answer');
    const ni = asked.findIndex(a => /news story you have been following/.test(a));
    ok(ni === 4, 'B: news question after three follow-ups, at ' + ni);
    ok(/impact a client of Mishcon de Reya/.test(asked[ni + 1]) && /Mishcon's business development/.test(asked[ni + 2]), 'B: real Mishcon chain asked in order');
    ok(/^AI follow-up/.test(asked[ni + 3] || ''), 'B: then an AI follow-up');
    const sys = api.calls.find(c => c.output_config && c.output_config.format && c.output_config.format.schema.properties.move).system;
    ok(/Paralegal at a high street firm/.test(sys), 'B: profile reaches the AI interviewer');
    ok(api.calls.every(c => c.model === 'claude-opus-5-5' && c.fallbacks === 'default'), 'B: every call uses Opus 5.5 with fallbacks');
    await page.click('#toReport');
    await page.waitForSelector('.verdict', { timeout: 30000 });
    const rep = await page.textContent('main');
    ok(api.grades === 2 && api.sums === 1, 'B: two answers graded and one debrief (' + api.grades + ', ' + api.sums + ')');
    ok(api.facts >= 1, 'B: fact check ran');
    ok(/Not yet at the bar for Mishcon/.test(rep) && /Walk the commercial chain/.test(rep), 'B: AI debrief shown');
    ok(/Fact check/.test(rep) && /verified/.test(rep), 'B: fact check table shown');
    ok(/AI cost about \$/.test(rep), 'B: cost shown');
    ok(/marked by AI/.test(rep), 'B: marked by AI label');
    ok(page.errors.length === 0, 'B: no page errors: ' + page.errors.join(' | '));
    await ctx.close();
  }

  /* ---- C: AI key rejected mid-way: interview continues offline, marking falls back ---- */
  {
    const { ctx, page } = await newPage(browser);
    const api = { mode: '401', calls: [], moves: 0, grades: 0, facts: 0, sums: 0 };
    await mockApi(page, api);
    await page.goto(BASE + '#/settings');
    await page.fill('#key', 'sk-ant-bad');
    await page.click('#saveKey');
    await page.waitForFunction(() => /rejected/.test(document.querySelector('#keyMsg').textContent), null, { timeout: 10000 });
    ok(true, 'C: bad key reported clearly');
    await setPractise(page, { firm: 'linklaters', format: 'adaptive', length: 1, depth: 2, camera: false, record: false, type: true });
    await begin(page);
    const asked = [];
    for (let i = 0; i < 4; i++) {
      if (await page.$('#toReport')) break;
      asked.push(await answer(page, STORY, { type: true }));
      await page.waitForFunction(() => document.querySelector('#toReport') || document.querySelector('#qtext'), null, { timeout: 20000 });
      await page.waitForTimeout(200);
    }
    await waitEnd(page);
    ok(asked.length === 3, 'C: follow-ups still asked offline, got ' + asked.length);
    await page.click('#toReport');
    await page.waitForSelector('.verdict', { timeout: 30000 });
    const rep = await page.textContent('main');
    ok(/fell back to the offline estimate/.test(rep) && /rejected/.test(rep), 'C: report explains the fallback');
    ok(page.errors.length === 0, 'C: no page errors: ' + page.errors.join(' | '));
    await ctx.close();
  }

  /* ---- D: speech blocked mid-answer, typing takes over; E: empty answer rescue ---- */
  {
    const { ctx, page } = await newPage(browser);
    await setPractise(page, { firm: 'generic', format: 'oneway', length: 2, camera: true, record: true, type: false });
    await page.evaluate(() => { window.__sr.mode = 'not-allowed'; });
    await begin(page).catch(() => {});
    // Readiness check reports the block and switches to typing.
    await page.waitForSelector('#qtext');
    if (await page.$('#startNow')) await page.click('#startNow');
    await page.waitForSelector('#typed', { timeout: 10000 });
    ok(true, 'D: typing box shown when speech recognition is blocked');
    await page.fill('#typed', 'I would bring curiosity and resilience, shown by my conversion to law.');
    await page.click('#done');
    // E: second answer left empty (one-way format: wait for the new question's thinking time)
    await page.waitForSelector('#startNow', { timeout: 20000 });
    await page.click('#startNow');
    await page.waitForSelector('#done');
    await page.click('#done');
    await page.waitForSelector('#rescue', { timeout: 10000 });
    await page.fill('#rescue', 'I said I want to specialise in disputes.');
    await page.click('#useTyped');
    await waitEnd(page);
    await page.click('#toReport');
    await page.waitForSelector('.verdict', { timeout: 30000 });
    const rep = await page.textContent('main');
    ok(/specialise in disputes/.test(rep) && /conversion to law/.test(rep), 'E: typed and rescued answers both saved');
    ok(page.errors.length === 0, 'D/E: no page errors: ' + page.errors.join(' | '));
    await ctx.close();
  }

  /* ---- F: timers: thinking time starts recording, answer time submits ---- */
  {
    const { ctx, page } = await newPage(browser);
    await page.clock.install();
    await setPractise(page, { firm: 'kirkland', format: 'quickfire', length: 1, prep: 5, answer: 60, camera: false, record: false, type: false });
    await begin(page);
    await page.waitForSelector('#startNow');
    await page.clock.runFor(6000);
    await page.waitForSelector('#done', { timeout: 5000 });
    ok(true, 'F: thinking time ran out and recording started by itself');
    await page.evaluate(() => { window.__sr.queue.push('My strength is persistence.'); });
    await page.clock.runFor(2000);
    await page.clock.runFor(60000);
    await page.waitForSelector('#toReport', { timeout: 10000 });
    ok(true, 'F: answer submitted when the clock ran out');
    await ctx.close();
  }

  /* ---- G: leaving mid-interview keeps answers; mark later ---- */
  {
    const { ctx, page } = await newPage(browser);
    await setPractise(page, { firm: 'freshfields', format: 'oneway', length: 3, camera: false, record: false, type: true });
    await begin(page);
    await answer(page, ['First answer about why law.'], { type: true });
    await page.waitForSelector('#qtext');
    await page.click('a[data-nav="progress"]'); // confirm dialog auto-accepted
    await page.waitForSelector('table.hist');
    const row = await page.textContent('table.hist tbody tr');
    ok(/Not marked/.test(row), 'G: abandoned interview listed as not marked');
    await page.click('[data-mark]');
    await page.waitForSelector('.verdict', { timeout: 20000 });
    ok(/First answer about why law/.test(await page.textContent('main')), 'G: marked later with the answer kept');
    ok(page.errors.length === 0, 'G: no page errors: ' + page.errors.join(' | '));
    await ctx.close();
  }

  /* ---- H: real interview log drives a practice; bank practice; backup round trip; self rating ---- */
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + '#/progress');
    await page.waitForSelector('[data-practlog]');
    await page.evaluate(() => { const s = window.IT.store.state.settings; s.voice = false; s.camera = false; s.record = false; s.answerMode = 'type'; s.breathe = false; window.IT.store.save(); });
    await page.click('[data-practlog]');
    await page.waitForSelector('#begin');
    await page.click('#begin');
    const first = await answer(page, ['Integrity story.'], { type: true });
    ok(/integrity was challenged/i.test(first), 'H: log practice asks the logged questions: ' + first);
    await page.click('#endEarly');
    await waitEnd(page);
    await page.click('#toReport');
    await page.waitForSelector('.verdict', { timeout: 20000 });
    const sel = await page.$('select[data-self]');
    if (sel) { await sel.selectOption('4'); await page.reload(); await page.waitForSelector('select[data-self]'); ok((await page.$eval('select[data-self]', s => s.value)) === '4', 'H: self rating saved'); }
    await page.goto(BASE + '#/bank');
    await page.fill('#qSearch', 'setback');
    await page.waitForTimeout(100);
    const n = (await page.$$('.qitem')).length;
    ok(n >= 3, 'H: bank search finds setback questions (' + n + ')');
    await page.click('.qitem summary');
    await page.click('.qitem [data-q]');
    await page.waitForSelector('#begin');
    ok(true, 'H: practise from the bank opens the interview room');
    await page.click('#cancel');
    await page.goto(BASE + '#/progress');
    await page.waitForSelector('#exp');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exp')]);
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    ok(Array.isArray(data.sessions) && data.sessions.length >= 1 && data.settings.apiKey === '', 'H: backup exported without the API key');
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload();
    await page.goto(BASE + '#/progress');
    await page.setInputFiles('#imp', await dl.path());
    await page.waitForSelector('table.hist tbody tr');
    ok((await page.$$('table.hist tbody tr')).length === data.sessions.length, 'H: backup restored');
    ok(page.errors.length === 0, 'H: no page errors: ' + page.errors.join(' | '));
    await ctx.close();
  }

  /* ---- I: phone-width interview room and coaching feedback ---- */
  {
    const { ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 } });
    await setPractise(page, { firm: 'mishcon', format: 'oneway', length: 2, camera: true, record: false, type: false, each: true });
    await begin(page);
    await answer(page, STORY);
    await page.waitForSelector('#cont', { timeout: 20000 });
    ok(/Feedback on question 1/.test(await page.textContent('.overlay')), 'I: feedback shown after the question');
    await page.click('#cont');
    await page.waitForSelector('#qtext');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(overflow <= 1, 'I: no horizontal scroll in the room on a phone (' + overflow + ')');
    ok(page.errors.length === 0, 'I: no page errors: ' + page.errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log((failures ? 'FAILED ' + failures : 'All passed') + ' (' + checks + ' end-to-end checks)');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
