const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const page = await b.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + require('path').join(__dirname, '../law_revision_app.html'));
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(800);
  await page.keyboard.press('n'); await page.waitForSelector('#lnBody');
  await page.keyboard.type('Donoghue v Stevenson neighbour principle – duty of care.'); await page.waitForTimeout(1500);
  await page.keyboard.press('Escape'); await page.reload(); await page.waitForTimeout(800);
  const n = await page.evaluate(() => JSON.parse(localStorage.getItem('lawRevisionApp.v1.notes') || '[]'));
  console.log('   offline note:', n.length && n[0].module, '›', n.length && n[0].topic);
  ok(n.length === 1, 'offline copy keeps notes in this browser');
  ok(errs.length === 0, 'no errors ' + JSON.stringify(errs));
  await b.close();
})();
