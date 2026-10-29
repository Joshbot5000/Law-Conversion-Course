const { chromium } = require('playwright');
const path = require('path');
const { N, SRC } = require('./seedinfo');
const T = __dirname;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.addInitScript({ path: path.join(T, 'sample_seed.js') });
  await ctx.addInitScript({ path: path.join(T, 'mockclaude.js') });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(T, 'online_wrapped.html'));
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); window.name = ''; localStorage.setItem('lawRevisionApp.migrated', '1'); }); await page.reload();
  await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  const store = () => page.evaluate(() => { const st = window.__mock.store, all = {}, prog = {}; Object.keys(st).forEach(k => { if (k.startsWith('lib/')) Object.assign(all, st[k].e || {}); if (k.startsWith('prog/')) Object.assign(prog, st[k].p || {}); }); return { all, prog, prefs: st['meta/prefs'] }; });

  // --- Duplicates
  await page.click('#dupBtn'); await page.waitForSelector('#dupModal:not([hidden])');
  const groups = await page.$$eval('.dup-group', gs => gs.map(g => [...g.querySelectorAll('.dup-item b')].map(x => x.textContent).join('  ||  ')));
  console.log('   groups:', groups.length); groups.forEach(g => console.log('     -', g));
  ok(groups.length > 0, 'duplicates found');
  const gi = groups.findIndex(g => g.startsWith('Combe v Combe'));
  ok(gi >= 0, 'Combe v Combe pair detected');
  await page.locator('.dup-group').nth(gi).locator('[data-dup=merge]').click(); await page.waitForTimeout(600);
  ok(await page.textContent('#statTotal') === String(N - 1), 'merge removed one copy: ' + await page.textContent('#statTotal'));
  let s = await store();
  ok(Object.values(s.all).filter(e => e.name === 'Combe v Combe').length === 1, 'cloud now holds a single Combe v Combe');
  await page.click('.toast button:has-text("Undo")'); await page.waitForTimeout(600);
  ok(await page.textContent('#statTotal') === String(N), 'undo restored it');
  const before = await page.$$eval('.dup-group', g => g.length);
  await page.locator('.dup-group').first().locator('[data-dup=not]').click(); await page.waitForTimeout(400);
  s = await store();
  ok((await page.$$eval('.dup-group', g => g.length)) === before - 1 && s.prefs && s.prefs.notDup.length === 1, '"Not duplicates" remembered in cloud prefs');
  await page.screenshot({ path: path.join(T, 'tool_dup.png') });
  await page.keyboard.press('Escape');

  // --- Verify queue
  await page.click('[data-filter=contract]');
  await page.click('#verifyBtn'); await page.waitForSelector('#verifyModal:not([hidden])');
  await page.waitForTimeout(800);
  let tries = 0; while (!(await page.$('#vqSource .vq-passage mark')) && tries++ < 8) { await page.keyboard.press('s'); await page.waitForTimeout(500); }
  ok(!!(await page.$('#vqSource .vq-passage mark')), 'source passage shown with the quote highlighted');
  const name1 = await page.textContent('#verifyBody .card-title');
  await page.screenshot({ path: path.join(T, 'tool_verify.png') });
  await page.keyboard.press('v'); await page.waitForTimeout(500);
  s = await store();
  ok(Object.values(s.all).find(e => e.name === name1 && e.module === 'contract').verified === true, 'V verified "' + name1 + '" and saved it');
  ok((await page.textContent('#verifyBody .card-title')) !== name1, 'moved to the next card');
  await page.keyboard.press('e'); await page.waitForSelector('#entryModal:not([hidden])');
  ok(true, 'E opens the edit form above the checker');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.click('[data-filter=all]');

  // --- Study plan
  const pill0 = +(await page.textContent('#reviewPill'));
  await page.click('#planBtn'); await page.waitForSelector('#planModal:not([hidden])');
  const d = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await page.fill('#exam-contract', d); await page.dispatchEvent('#exam-contract', 'change');
  await page.waitForTimeout(300);
  console.log('   plan:', (await page.textContent('.plan-verdict')).trim());
  await page.check('#autoPace'); await page.waitForTimeout(400);
  console.log('   plan:', (await page.textContent('.plan-verdict')).trim());
  await page.screenshot({ path: path.join(T, 'tool_plan.png') });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const pill1 = +(await page.textContent('#reviewPill'));
  s = await store();
  ok(pill1 > pill0 && s.prefs.autoPace === true && s.prefs.exams.contract === d && s.prefs.newPerDay === 15, `auto-pacing raised today's cards ${pill0} → ${pill1}; prefs saved`);
  console.log('   today:', (await page.textContent('.exam-line')).trim());
  await page.click('#reviewBtn'); await page.waitForSelector('#reviewModal:not([hidden])'); await page.waitForTimeout(300);
  const firstMod = await page.textContent('#reviewBody .chip');
  console.log('   first review card module chip:', firstMod);
  await page.keyboard.press('Escape');

  // --- Related cards
  await page.fill('#searchInput', 'Promissory estoppel — the four conditions'); await page.waitForTimeout(400);
  const rel = await page.$$eval('.card .related-line button', bs => bs.map(x => x.textContent));
  console.log('   related:', rel.join(', '));
  ok(rel.length >= 2, 'principle card lists its authorities');
  await page.locator('.card .related-line button').first().click(); await page.waitForSelector('#peekModal:not([hidden])');
  ok(true, 'clicking an authority opens it');
  await page.screenshot({ path: path.join(T, 'tool_related.png') });
  await page.keyboard.press('Escape');
  await page.fill('#searchInput', 'Combe v Combe'); await page.waitForTimeout(400);
  console.log('   used in:', (await page.$$eval('.card .related-line', ls => ls.map(l => l.textContent))).join(' / '));
  // timing
  const ms = await page.evaluate(() => { const t = performance.now(); document.querySelector('#clearSearch').click(); return performance.now() - t; });
  console.log('   full render ms:', Math.round(ms));
  ok(errs.length === 0, 'no errors ' + JSON.stringify(errs));
  await b.close();
})();
