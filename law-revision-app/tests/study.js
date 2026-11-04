// Study buddy features: end-of-quiz review, the saved mistakes log, practice aimed at mistakes,
// source-limited quizzes, Quick test flashcards, study memory, and "Work on next" suggestions.
const { chromium } = require('playwright');
const path = require('path');
const { N } = require('./seedinfo');
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
  await page.evaluate(() => { window.__sampleDelay = 2; });
  const store = () => page.evaluate(() => { const s = window.__mock.store, m = []; Object.keys(s).forEach(k => { if (k.startsWith('mistakes/')) m.push(s[k]); }); return { mistakes: m, perf: s['memory/perf'] || null }; });
  const prompts = () => page.evaluate(() => window.__mock.calls.map(c => typeof c.input === 'string' ? c.input : c.input.map(t => t.content).join('\n')).filter(t => t.includes('single-best-answer (SBA)')));
  const answer = async (wrongAt) => {
    for (let i = 0; ; i++) {
      const done = await Promise.race([page.waitForSelector('.quiz-opt:not([disabled])', { timeout: 15000 }).then(() => false), page.waitForSelector('#quizBody .qz-results', { timeout: 15000 }).then(() => true)]);
      if (done) return i;
      const opts = await page.$$eval('.quiz-opt', x => x.map(o => o.textContent));
      const right = opts.findIndex(o => o.includes('Right answer'));
      await page.click(`.quiz-opt[data-opt="${wrongAt.includes(i) ? (right + 1) % 5 : right}"]`);
      if (wrongAt.includes(i)) ok(i > 0 || await page.isVisible('.qz-saved'), i === 0 ? 'wrong answer tells you it was saved to your mistakes log' : 'wrong answer');
      await page.click('[data-qz="next"]');
    }
  };

  // 1. Quiz: two wrong answers, then go over them at the end
  await page.click('#quizBtn'); await page.selectOption('#qzModule', 'contract'); await page.selectOption('#qzN', '5');
  await page.click('[data-qz="go"]');
  await answer([0, 2]);
  const done = await page.textContent('#quizBody');
  ok(done.includes('3 / 5'), 'quiz scored 3/5');
  ok((await page.$$('#quizBody .qr-item.is-wrong')).length === 2 && (await page.$$('#quizBody .qr-item[open]')).length === 2, 'both wrong questions shown, opened, at the end');
  const item = await page.textContent('#quizBody .qr-item.is-wrong');
  ok(/Your answer/.test(item) && /Best answer/.test(item) && /Why:/.test(item), 'each shows your answer, the best answer and why');
  await page.click('[data-qz="show-all"]');
  ok((await page.$$('#quizBody .qr-item')).length === 5, '"All" shows every question to go over');
  let s = await store();
  ok(s.mistakes.length === 2 && s.mistakes.every(m => m.options.length === 5 && m.chosen !== m.answer), 'both mistakes saved to claude.ai with the full question');
  await page.waitForTimeout(1500);
  s = await store();
  ok(s.perf && Object.keys(s.perf.c).length >= 3 && s.perf.s.length === 1 && s.perf.s[0].kind === 'quiz' && s.perf.s[0].r === 3, 'study memory saved: card results and the session');

  // 2. Practise the mistakes: questions aimed at the same point; two right answers = mastered
  await page.click('[data-qz="practise-all"]');
  const n2 = await answer([]);
  const pr = (await prompts()).slice(-1)[0];
  ok(n2 === 5, 'practice quiz of 5 questions');
  ok(/PRACTICE ON AN EARLIER MISTAKE/.test(pr) && pr.includes(s.mistakes[0].options[s.mistakes[0].chosen].slice(0, 15)), 'practice prompt carries what you got wrong and what you chose');
  await page.waitForTimeout(600);
  s = await store();
  ok(s.mistakes.every(m => m.resolved && m.wins >= 2), 'both mistakes marked as mastered after two right answers each');
  await page.keyboard.press('Escape');

  // 3. A quiz limited to one source
  await page.click('#quizBtn'); await page.click('[data-qz="again"]').catch(() => {});
  await page.waitForSelector('#qzModule');
  await page.selectOption('#qzModule', 'all'); await page.selectOption('#qzN', '5');
  await page.click('.qz-srcbox > summary');
  await page.check('[data-qsrc="src-sample-tort"]');
  ok((await page.textContent('#qzSrcCount')).includes('1 selected'), 'source ticked');
  await page.click('[data-qz="go"]');
  await page.waitForSelector('.quiz-opt', { timeout: 15000 });
  const sp = (await prompts()).slice(-1)[0];
  const ids = (sp.match(/mainly tests card \[([^\]]+)\]/g) || []).map(x => x.slice(19, -1));
  const tortIds = await page.evaluate(() => { const s = window.__mock.store, out = []; Object.keys(s).forEach(k => { if (k.startsWith('lib/')) Object.values(s[k].e).forEach(e => { if (e.sourceId === 'src-sample-tort' || /Donoghue|Robinson|Barnett|Bonnington/.test(e.name)) out.push(e.id); }); }); return out; });
  ok(ids.length && ids.every(id => tortIds.includes(id)), 'every question comes from cards in that source: ' + ids.join(', '));
  ok(/SOURCE EXTRACTS/.test(sp) && /STAY WITHIN THE CHOSEN SOURCES/.test(sp) && /material contribution|but-for|ultimate consumer|analogy/.test(sp), 'prompt includes passages from the source and the stay-within rule');
  await page.click('[data-qz="finish"]').catch(() => {}); await page.keyboard.press('Escape');

  // 4. Quick test
  await page.click('#flashBtn'); await page.waitForSelector('#flashModal:not([hidden]) .fl-gen');
  ok((await page.$$('[data-flgen="principle"], [data-flgen="case"], [data-flgen="statute"]')).length === 3, 'buttons to generate a principle, case and statute');
  await page.click('[data-flgen="case"]');
  await page.waitForSelector('.fl-title');
  ok((await page.textContent('.fl-meta')).includes('Case') && !(await page.$('.fl-back')), 'a random case appears, answer hidden');
  await page.keyboard.press('Space'); await page.waitForSelector('.fl-back');
  ok((await page.textContent('.fl-back')).length > 20, 'Space shows the answer');
  await page.keyboard.press('1'); await page.waitForTimeout(150);
  await page.keyboard.press('Space'); await page.keyboard.press('3'); await page.waitForTimeout(150);
  await page.click('[data-flgen="principle"]'); await page.waitForSelector('.fl-title');
  ok((await page.textContent('.fl-meta')).includes('Principle') && !(await page.textContent('.fl-card')).includes('Key authorities:'), 'principle card hides its authorities until revealed');
  await page.keyboard.press('Space'); await page.keyboard.press('2');
  await page.click('[data-fl="change"]'); await page.click('[data-fl="end"]');
  ok((await page.textContent('#flashBody')).includes('1.5 / 3'), 'session summary: 1.5 of 3');
  await page.waitForTimeout(1500);
  s = await store();
  const fn = Object.values(s.perf.c).reduce((a, c) => a + c[2], 0);
  ok(fn === 3 && s.perf.s.some(x => x.kind === 'flash'), 'quick-test results saved to study memory');
  await page.keyboard.press('Escape');

  // 5. Work on next + My progress
  await page.click('#quizBtn'); await page.click('[data-qz="again"]').catch(() => {}); await page.waitForSelector('#qzModule');
  await page.click('.qz-srcbox > summary').catch(() => {}); await page.uncheck('[data-qsrc="src-sample-tort"]').catch(() => {});
  await page.selectOption('#qzModule', 'criminal'); await page.selectOption('#qzN', '5'); await page.click('[data-qz="go"]');
  await answer([0, 1, 2, 3]);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  const today = await page.textContent('#today');
  ok(/Work on next/.test(today) && /quiz mistake/.test(today), 'home screen suggests what to work on, with reasons: ' + (await page.textContent('#today .sg-list')).slice(0, 120));
  await page.click('#today [data-today="progress"]'); await page.waitForSelector('#progressModal:not([hidden])');
  ok((await page.$$('#progressBody .sg-item')).length >= 1, 'My progress lists suggestions');
  await page.click('[data-pgtab="mistakes"]');
  ok((await page.$$('#progressBody .qr-item')).length === 4, 'mistakes log shows the 4 to master');
  await page.locator('#progressBody .qr-item').first().locator('summary').click();
  await page.locator('#progressBody [data-pg="m-resolve"]').first().click();
  ok((await page.$$('#progressBody .qr-item')).length === 3, '"I\'ve got it now" moves one to mastered');
  await page.click('[data-pg="m-done"]');
  ok((await page.$$('#progressBody .qr-item')).length === 3, 'mastered tab: 2 from practice + 1 ticked off');
  await page.click('[data-pgtab="topics"]');
  ok((await page.$$('#progressBody .pg-tr')).length >= 3, 'by-topic table');
  await page.click('[data-pgtab="activity"]');
  ok((await page.$$('#progressBody .pg-sess-row')).length === 4, 'activity lists the 4 sessions with answers (quizzes ended before answering are not logged)');
  await page.click('[data-pgtab="suggest"]');
  await page.locator('#progressBody [data-pg="sg-practise"]').first().click();
  await page.waitForSelector('#quizModal:not([hidden]) .quiz-opt', { timeout: 15000 });
  const tp = (await prompts()).slice(-1)[0];
  ok(/PRACTICE ON AN EARLIER MISTAKE/.test(tp), 'Practise on a suggestion starts questions aimed at that topic\'s mistakes');
  await page.click('[data-qz="finish"]').catch(() => {}); await page.keyboard.press('Escape');

  // 6. Everything survives a reload
  await page.reload(); await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await page.waitForFunction(() => /quiz mistake/.test(document.querySelector('#today').textContent), null, { timeout: 8000 }).catch(() => {});
  ok(/quiz mistake/.test(await page.textContent('#today')), 'suggestions still there after reloading');
  await page.click('#progressBtn'); await page.click('[data-pgtab="mistakes"]');
  ok((await page.$$('#progressBody .qr-item')).length === 3, 'mistakes log kept');
  await page.keyboard.press('Escape');

  // 7. Backup includes study memory
  await page.click('#exportBtn'); await page.waitForFunction(() => window.__mock.saved, null, { timeout: 10000 });
  const exp = await page.evaluate(() => { const d = JSON.parse(window.__mock.saved.data); return { m: (d.mistakes || []).length, s: d.perf && d.perf.s.length }; });
  ok(exp.m === 6 && exp.s === 4, 'backup includes the mistakes log and study memory ' + JSON.stringify(exp));
  // phone layout
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#menuBtn'); await page.click('#progressBtn'); await page.click('[data-pgtab="topics"]');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'My progress fits a phone');
  await page.screenshot({ path: path.join(T, 'study_phone.png') });
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
