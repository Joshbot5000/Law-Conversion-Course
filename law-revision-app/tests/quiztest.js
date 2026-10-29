const { chromium } = require('playwright');
const path = require('path');
const { N, SRC } = require('./seedinfo');
const T = __dirname;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.addInitScript({ path: path.join(T, 'sample_seed.js') });
  await ctx.addInitScript({ path: path.join(T, 'mockclaude.js') });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => { errs.push('dialog ' + d.message()); d.dismiss(); });
  await page.goto('file://' + path.join(T, 'online_wrapped.html'));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('lawRevisionApp.migrated', '1'); }); await page.reload();
  await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await page.evaluate(() => { window.__sampleDelay = 2; window.__giveaways = true; });

  const sbaCalls = () => page.evaluate(() => window.__mock.calls.map(c => typeof c.input === 'string' ? c.input : c.input.map(t => t.content).join('\n')).filter(t => t.includes('single-best-answer (SBA)')));
  const cardTopics = () => page.evaluate(() => { const out = {}; Object.keys(window.__mock.store).forEach(k => { if (k.startsWith('lib/')) Object.values(window.__mock.store[k].e || {}).forEach(e => { out[e.id] = e.module + '|' + e.topic; }); }); return out; });

  // Setup: multi-topic selection, up to 40 questions
  await page.click('#quizBtn');
  await page.selectOption('#qzModule', 'contract');
  const ns = await page.$$eval('#qzN option', o => o.map(x => x.textContent));
  ok(ns.join(',') === '5,10,15,20,30,40', 'question counts offered: ' + ns.join(','));
  const boxes = await page.$$('[data-topic]');
  ok(boxes.length > 5, boxes.length + ' contract topics to tick');
  await page.click('[data-qz="all-topics"]');
  ok((await page.$$eval('[data-topic]', x => x.filter(b => b.checked).length)) === boxes.length, 'Select all ticks every topic');
  await page.click('[data-qz="no-topics"]');
  const picks = [];
  for (const i of [0, 3, 6]) { const bx = (await page.$$('[data-topic]'))[i]; picks.push(await bx.getAttribute('data-topic')); await bx.check(); }
  ok((await page.textContent('.qz-topics-head')).includes('3 selected'), 'counter shows 3 selected');
  await page.selectOption('#qzN', '20');
  await page.click('[data-qz="go"]');
  await page.waitForSelector('.quiz-opt');

  const topics = await cardTopics();
  const seenTopics = {}, levels = [];
  let giveawaysShown = 0, lvChanges = 0;
  for (let i = 0; i < 20; i++) {
    await page.waitForSelector('.quiz-opt:not([disabled])', { timeout: 15000 });
    const info = await page.evaluate(() => ({
      opts: [...document.querySelectorAll('.quiz-opt')].map(x => x.textContent.slice(1)),
      chip: document.querySelector('.qz-meta .chip').textContent, lv: document.querySelector('.qz-lv').textContent,
      prog: document.querySelector('.review-progress span').textContent
    }));
    if (i === 0) ok(/Question 1 of 20/.test(info.prog), 'progress shows "of 20"');
    seenTopics[info.chip] = 1; levels.push(info.lv);
    const words = info.opts.map(o => o.split(/\s+/).filter(Boolean).length);
    if (Math.max(...words) > 2.2 * Math.max(3, Math.min(...words)) || info.opts.some(o => o.includes('exact facts'))) giveawaysShown++;
    const right = info.opts.findIndex(o => o.includes('Right answer'));
    const pick = i < 12 ? right : (right + 1) % 5; // right for 12, then wrong for 8
    await page.keyboard.press(String(pick + 1));
    if (await page.$('.qz-lvchange')) lvChanges++;
    await page.keyboard.press('Enter');
  }
  await page.waitForSelector('.qz-results');
  const body = await page.textContent('#quizBody');
  ok(body.includes('12 / 20'), 'all 20 questions delivered and scored 12/20');
  ok(Object.keys(seenTopics).length === 3, 'questions came from all 3 ticked topics: ' + Object.keys(seenTopics).join(' | '));
  ok((await page.$$('.qz-res')).length === 3, 'per-topic results shown');

  const calls = await sbaCalls();
  ok(calls.length === 4, 'written in ' + calls.length + ' batches of 5');
  const ids = calls.join('\n').match(/mainly tests card \[([^\]]+)\]/g).map(s => s.slice(19, -1));
  ok(ids.every(id => picks.includes(topics[id])), 'every question tests a card from the ticked topics only');
  ok(calls.slice(1).every(c => /Scenario \d+: Ann/.test(c)), 'later batches are told to avoid earlier scenarios');
  const styles = new Set(calls.join('\n').match(/Question style: [^?]+\?/g));
  ok(styles.size >= 6, styles.size + ' different question styles used');
  ok(calls.every(c => c.includes('MUST NOT STAND OUT')), 'every prompt carries the option-parity rules');
  const reps = await page.evaluate(() => window.__mock.repairs || 0);
  ok(reps > 0 && giveawaysShown === 0, 'give-away options were rewritten (' + reps + ' repair calls) and none reached you');

  // Adaptive difficulty saved to claude.ai
  const qstats = await page.evaluate(() => (window.__mock.store['meta/prefs'] || {}).qstats || {});
  const keys = Object.keys(qstats);
  ok(keys.length === 3 && keys.every(k => picks.includes(k)), 'topic levels saved to claude.ai prefs');
  ok(keys.reduce((a, k) => a + qstats[k].n, 0) === 20, 'every answer recorded');
  console.log('   levels:', JSON.stringify(qstats), '| shown:', levels.join(','), '| change notices:', lvChanges);
  ok(lvChanges >= 1, 'level change shown to you');
  const lvNums = { Foundation: 1, Developing: 2, Standard: 3, Hard: 4, Expert: 5 };
  const firstPrompt = calls[0].match(/Difficulty (\d)/g).map(s => +s.slice(-1)), thirdPrompt = calls[2].match(/Difficulty (\d)/g).map(s => +s.slice(-1));
  ok(Math.max(...thirdPrompt) > Math.max(...firstPrompt) || thirdPrompt.reduce((a, b) => a + b) > firstPrompt.reduce((a, b) => a + b), 'difficulty rose after a run of right answers: ' + firstPrompt + ' → ' + thirdPrompt);

  // Second quiz: a level that falls after wrong answers; give-aways that can't be fixed are dropped
  await page.click('[data-qz="again"]');
  ok((await page.$$eval('[data-topic]', x => x.filter(b => b.checked).length)) === 3, 'New quiz keeps your topic choice');
  const before = JSON.parse(JSON.stringify(qstats));
  await page.evaluate(() => { window.__badRepair = true; });
  await page.selectOption('#qzN', '10');
  await page.click('[data-qz="go"]');
  let answered = 0;
  for (let i = 0; i < 10; i++) {
    const done = await Promise.race([page.waitForSelector('.quiz-opt:not([disabled])', { timeout: 15000 }).then(() => false), page.waitForSelector('.qz-results', { timeout: 15000 }).then(() => true)]);
    if (done) break;
    const opts = await page.$$eval('.quiz-opt', x => x.map(o => o.textContent));
    if (opts.some(o => o.includes('exact facts'))) giveawaysShown++;
    const right = opts.findIndex(o => o.includes('Right answer'));
    await page.click(`.quiz-opt[data-opt="${(right + 1) % 5}"]`); answered++;
    await page.click('[data-qz="next"]');
  }
  await page.waitForSelector('.qz-results');
  ok(giveawaysShown === 0, 'unfixable give-aways were dropped, not shown');
  ok(answered === 10, 'still got 10 questions (extra written to replace dropped ones)');
  const after = await page.evaluate(() => window.__mock.store['meta/prefs'].qstats);
  ok(Object.keys(after).every(k => after[k].lv <= before[k].lv) && Object.keys(after).some(k => after[k].lv < before[k].lv), 'levels fell after wrong answers');

  // Levels survive a reload
  await page.reload();
  await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await page.click('#quizBtn'); await page.selectOption('#qzModule', 'contract');
  await page.waitForFunction(() => /right · (Foundation|Developing|Standard|Hard|Expert)/.test(document.querySelector('.qz-topics').textContent), null, { timeout: 8000 }).catch(() => {});
  ok(/right · (Foundation|Developing|Standard|Hard|Expert)/.test(await page.textContent('.qz-topics')), 'topic list shows your record and level after reload');

  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
