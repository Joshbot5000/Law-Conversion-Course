// Timed exam mode, Claude checking Quick test answers, Distinguish two cases, Fill in the blank,
// the weekly summary, and Today's session.
const { chromium } = require('playwright');
const path = require('path');
const { N } = require('./seedinfo');
const T = __dirname;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.addInitScript({ path: path.join(T, 'sample_seed.js') });
  await ctx.addInitScript({ path: path.join(T, 'mockclaude.js') });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(T, 'online_wrapped.html'));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('lawRevisionApp.migrated', '1'); }); await page.reload();
  await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await page.evaluate(() => { window.__sampleDelay = 2; });
  const store = () => page.evaluate(() => { const s = window.__mock.store, m = []; Object.keys(s).forEach(k => { if (k.startsWith('mistakes/')) m.push(s[k]); }); return { mistakes: m, perf: s['memory/perf'] || null }; });
  const rightIdx = () => page.$$eval('.quiz-opt', x => x.findIndex(o => o.textContent.includes('Right answer')));

  // 1. Timed exam
  await page.click('#quizBtn'); await page.selectOption('#qzModule', 'contract'); await page.selectOption('#qzN', '5');
  await page.selectOption('#qzTimed', 'timed');
  await page.click('[data-qz="go"]'); await page.waitForSelector('.quiz-opt');
  const c1 = await page.textContent('#qzClock');
  ok(/8:30|8:29|8:28/.test(c1), 'clock starts at 5 × 1:42 = 8:30: ' + c1);
  let r = await rightIdx();
  await page.click(`.quiz-opt[data-opt="${(r + 1) % 5}"]`);
  ok(!(await page.$('.quiz-expl')) && await page.$('.quiz-opt.picked'), 'no feedback in exam mode, just your pick');
  await page.click('[data-qz="next"]'); await page.waitForSelector('.quiz-opt');
  await page.click('[data-qz="back"]');
  r = await rightIdx();
  await page.click(`.quiz-opt[data-opt="${r}"]`);
  ok((await page.$$('.quiz-opt.picked')).length === 1, 'going back lets you change your answer');
  for (let i = 1; i < 5; i++) {
    await page.click('[data-qz="next"]'); await page.waitForSelector('.quiz-opt', { timeout: 15000 });
    if (i < 3) { r = await rightIdx(); await page.click(`.quiz-opt[data-opt="${i === 1 ? r : (r + 1) % 5}"]`); }   // Q2 right, Q3 wrong, Q4–Q5 skipped
  }
  await page.waitForTimeout(1200);
  ok(await page.textContent('#qzClock') !== c1, 'the clock counts down');
  await page.click('[data-qz="submit"]');
  await page.waitForSelector('#dialogModal:not([hidden])');
  ok((await page.textContent('#dialogMessage')).includes('2 questions not answered'), 'warned about unanswered questions before submitting');
  await page.click('#dialogButtons >> text=Submit');
  await page.waitForSelector('#quizBody .qz-results');
  const ex = await page.textContent('#quizBody');
  ok(/Timed exam · time used \d+:\d\d of 8:30 · 2 questions not answered/.test(ex) && ex.includes('2 / 5'), 'results: 2 / 5, time used, 2 unanswered');
  let s = await store();
  ok(s.mistakes.length === 1, 'the wrong answer went into the mistakes log after submitting (skipped ones don\'t)');
  await page.keyboard.press('Escape');

  // 1b. Time running out submits automatically
  const p2 = await ctx.newPage(); await p2.clock.install();
  await p2.goto('file://' + path.join(T, 'online_wrapped.html'));
  await p2.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await p2.evaluate(() => { window.__sampleDelay = 2; });
  await p2.click('#quizBtn'); await p2.selectOption('#qzModule', 'contract'); await p2.selectOption('#qzN', '5'); await p2.selectOption('#qzTimed', 'timed');
  await p2.click('[data-qz="go"]');
  for (let i = 0; i < 40 && !(await p2.$('.quiz-opt')); i++) await p2.clock.runFor(200);
  await p2.click('.quiz-opt[data-opt="0"]');
  await p2.clock.runFor(9 * 60 * 1000);
  ok(!!(await p2.$('#quizBody .qz-results')) && (await p2.textContent('#quizBody')).includes('4 questions not answered'), 'when time runs out, answers are submitted automatically');
  await p2.close();

  // 2. Quick test: Claude checks a typed answer
  await page.click('#flashBtn'); await page.waitForSelector('#flashModal:not([hidden])');
  ok((await page.$$('.fl-gen-btn')).length === 5, 'Quick test now has 5 options');
  await page.click('[data-flgen="case"]'); await page.waitForSelector('#flRecall');
  await page.fill('#flRecall', 'The rule is that the defendant is liable because of the card principle.');
  await page.click('[data-fl="show"]');
  await page.waitForSelector('.fl-check-head');
  const chk = await page.textContent('.fl-check');
  ok(/Partly there/.test(chk) && /You got/.test(chk) && /You missed/.test(chk), 'Claude\'s check shows what you got and what you missed');
  ok(await page.$('[data-flrate="0.5"].suggested'), 'suggested rating highlighted');
  const lastPrompt = await page.evaluate(() => { const c = window.__mock.calls.slice(-1)[0]; return typeof c.input === 'string' ? c.input : c.input.map(t => t.content).join('\n'); });
  ok(/Judge ONLY against the card/.test(lastPrompt) && lastPrompt.includes('defendant is liable because'), 'the check is against your card only, with your answer');
  await page.keyboard.press('2'); await page.waitForTimeout(150);
  // without typing: no check, self-marking as before
  const callsBefore = await page.evaluate(() => window.__mock.calls.length);
  await page.keyboard.press('Space'); await page.waitForSelector('.fl-back');
  ok(!(await page.$('.fl-check')) && (await page.evaluate(() => window.__mock.calls.length)) === callsBefore, 'with nothing typed, no Claude call — you mark yourself');
  await page.keyboard.press('3'); await page.waitForTimeout(150);

  // 3. Distinguish two cases
  await page.click('[data-flgen="pair"]'); await page.waitForSelector('.fl-pair');
  const names = await page.$$eval('.fl-pair .fl-title', x => x.map(e => e.textContent));
  const sameTopic = await page.evaluate(n => { const s = window.__mock.store, all = []; Object.keys(s).forEach(k => { if (k.startsWith('lib/')) all.push(...Object.values(s[k].e)); }); const a = all.find(e => e.name === n[0]), b = all.find(e => e.name === n[1] && e !== a); return a && b && a.topic === b.topic && a.module === b.module && a.type === 'case' && b.type === 'case'; }, names);
  ok(names.length === 2 && names[0] !== names[1] && sameTopic, 'two different cases from the same topic: ' + names.join(' / '));
  await page.fill('#flRecall', 'The first case concerns destruction of the subject matter, the second only hardship.');
  await page.click('[data-fl="check"]'); await page.waitForSelector('.fl-check-head');
  ok((await page.textContent('.fl-check')).includes('Model answer') && (await page.$$('.fl-pair-back .fl-back')).length === 2, 'check gives a model answer and shows both cards');
  await page.click('[data-flrate="1"]'); await page.waitForTimeout(150);

  // 4. Fill in the blank
  await page.click('[data-flgen="blank"]'); await page.waitForSelector('[data-blank]');
  const blanks = await page.$$('[data-blank]');
  ok(blanks.length >= 1, plural(blanks.length) + ' to fill in');
  const answers = await page.evaluate(() => {
    const title = document.querySelector('.fl-title').textContent, s = window.__mock.store; let card;
    Object.keys(s).forEach(k => { if (k.startsWith('lib/')) Object.values(s[k].e).forEach(e => { if (e.name === title) card = e; }); });
    const box = document.querySelector('.fl-blank-text'); let txt = '';
    box.childNodes.forEach(n => { txt += n.nodeType === 3 ? n.nodeValue : '\u0000'; });
    const want = card.ratio.split(/\s+/), got = txt.split(/\s+/), out = [];
    got.forEach((t, i) => { if (t.includes('\u0000')) out.push(want[i].replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')); });
    return out;
  });
  for (let i = 0; i < answers.length; i++) {
    let a = answers[i];
    if (i === 0 && a.length >= 6) a = a.slice(0, -2) + a.slice(-1) ; // one-letter typo
    await page.fill(`[data-blank="${i}"]`, a);
  }
  await page.locator('[data-blank]').last().press('Enter');
  await page.waitForSelector('.fl-blank-res');
  ok((await page.$$('.fl-blank-res.ok')).length === answers.length, 'all blanks marked right (a one-letter typo is allowed)');
  ok(await page.$('[data-flrate="1"].suggested'), '"Knew it" suggested');
  await page.keyboard.press('3'); await page.waitForTimeout(150);
  await page.waitForSelector('[data-blank]');
  await page.click('[data-fl="giveup"]'); await page.waitForSelector('.fl-blank-res.bad');
  ok(true, '"Show me" reveals the missing words');
  await page.keyboard.press('1');
  await page.click('[data-fl="change"]'); await page.click('[data-fl="end"]');
  await page.waitForTimeout(1400);
  s = await store();
  ok(s.perf.s.some(x => x.kind === 'flash' && x.n === 5), 'quick-test session of 5 saved');
  await page.keyboard.press('Escape');

  // 5. Weekly summary: pretend last week had a snapshot and some activity
  await page.evaluate(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7 - 7);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const s = window.__mock.store;
    const perf = s['memory/perf'];
    perf.w = { wk: key, sc: { 'contract|Frustration': 3.5, 'contract|Formation – Offer': 0.2 } };
    perf.s.push({ at: d.getTime() + 2 * 86400000, kind: 'quiz', n: 10, r: 6, topics: ['contract|Frustration'] });
    window.name = '__mockdb:' + JSON.stringify(s);
  });
  await page.reload(); await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await page.waitForSelector('.toast >> text=weekly summary is ready', { timeout: 8000 });
  ok((await page.textContent('.toast >> nth=-1')).includes('6/10 quiz questions right'), 'new week: a reminder that the weekly summary is ready');
  await page.locator('.toast button:has-text("Open")').click();
  await page.waitForSelector('#progressModal:not([hidden])');
  const wk = await page.textContent('#progressBody');
  ok(/Last week/.test(wk) && /6\/10/.test(wk) && /Improved/.test(wk) && /Frustration/.test(wk), 'This week tab: last week\'s results, with Frustration improved');
  ok(/Needs attention/.test(wk) && /Focus for this week/.test(wk) && /This week so far/.test(wk), 'shows what slipped, focus for this week and this week so far');
  s = await store();
  ok(s.perf.wPrev && s.perf.w && s.perf.w.wk > s.perf.wPrev.wk, 'weekly snapshot rolled over and saved');
  await page.keyboard.press('Escape');
  await page.reload(); await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N); await page.waitForTimeout(2200);
  ok(await page.locator('.toast >> text=weekly summary is ready').count() === 0, 'the reminder only appears once a week');

  // 6. Today's session
  await page.evaluate(() => { window.__sampleDelay = 2; });
  await page.click('[data-today="session"]'); await page.waitForSelector('#dialogModal:not([hidden])');
  const plan = await page.textContent('#dialogMessage');
  ok(/1\. Reviews/.test(plan) && /Quiz — 5 questions on/.test(plan) && /Mistakes — practise/.test(plan) && /Quick test — 5 cards/.test(plan), 'session plan: reviews, quiz, mistakes, quick test');
  await page.click('#dialogButtons >> text=Start');
  await page.waitForSelector('#reviewModal:not([hidden])');
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); await page.waitForSelector('.rate-btn'); await page.keyboard.press('3'); await page.waitForTimeout(80); }
  await page.keyboard.press('Escape');
  await page.waitForSelector('#sessionBar:not([hidden]) [data-ts="next"]');
  ok((await page.textContent('#sessionBar')).includes('step 1 of 4'), 'session bar shows step 1 done');
  await page.click('[data-ts="next"]');
  await page.waitForSelector('#quizModal:not([hidden]) .quiz-opt', { timeout: 15000 });
  for (let i = 0; i < 5; i++) {
    await page.waitForSelector('.quiz-opt:not([disabled])', { timeout: 15000 });
    r = await rightIdx(); await page.click(`.quiz-opt[data-opt="${i === 0 ? (r + 1) % 5 : r}"]`); await page.click('[data-qz="next"]');
  }
  await page.waitForSelector('#quizBody .qz-results'); await page.keyboard.press('Escape');
  await page.click('#sessionBar [data-ts="next"]');
  await page.waitForSelector('#quizModal:not([hidden]) .qz-practice', { timeout: 15000 });
  ok(true, 'step 3 practises mistakes');
  await page.keyboard.press('Escape');   // closing a step's window moves you on
  await page.click('#sessionBar [data-ts="next"]');
  await page.waitForSelector('#flashModal:not([hidden]) .fl-title', { timeout: 8000 });
  ok((await page.textContent('#sessionBar')).includes('step 4 of 4'), 'closing the practice moves on to the quick test');
  for (let i = 0; i < 5; i++) { await page.waitForSelector('#flShow'); await page.keyboard.press('Space'); await page.waitForSelector('.fl-back'); await page.keyboard.press('3'); await page.waitForTimeout(80); }
  ok((await page.textContent('#flashBody')).includes('5 / 5'), 'quick test stops after 5 cards');
  await page.keyboard.press('Escape');
  await page.click('#sessionBar [data-ts="next"]');
  await page.waitForSelector('#dialogModal:not([hidden])');
  const sum = await page.textContent('#dialogMessage');
  ok(/3 cards reviewed/.test(sum) && /4 of 5 quiz questions right/.test(sum) && /5 of 5 quick-test cards known/.test(sum), 'session summary: ' + sum.replace(/\s+/g, ' ').slice(0, 140));
  await page.click('#dialogButtons >> text=Done');
  ok(await page.isHidden('#sessionBar'), 'session bar gone at the end');

  // phone layout of the new quick-test screens
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#flashBtn'); await page.click('[data-flgen="pair"]'); await page.waitForSelector('.fl-pair');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'distinguish fits a phone');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
function plural(n) { return n + (n === 1 ? ' blank' : ' blanks'); }
