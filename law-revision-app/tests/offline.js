const { chromium } = require('playwright');
const path = require('path');
const T = __dirname;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('file://' + require('path').join(__dirname, '../law_revision_app.html'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(300);
  ok(await page.textContent('#statTotal') === '3', 'offline copy starts with 3 samples');
  ok((await page.textContent('#syncText')).includes('this browser only'), 'sync line: ' + await page.textContent('#syncText'));
  ok(await page.textContent('#reviewPill') === '3', 'review pill 3');
  // Import the user's backup files (v1 format)
  const imp = async f => { await page.evaluate(() => document.querySelector('#importFile').value = ''); await page.setInputFiles('#importFile', f);
    await page.waitForSelector('#dialogModal:not([hidden])'); await page.click('#dialogButtons >> text=Merge'); await page.waitForTimeout(200);
    return page.locator('.toast').last().textContent(); };
  console.log('   ', await imp(path.join(__dirname, 'fixtures', 'sample-import.json')));
  console.log('   ', await imp(path.join(__dirname, 'fixtures', 'sample-rules.json')));
  ok(await page.textContent('#statTotal') === '33', 'v1 imports merged: ' + await page.textContent('#statTotal'));
  // Review flow
  await page.click('#reviewBtn');
  await page.waitForSelector('#rvShow');
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForSelector('.rate-btn'); await page.keyboard.press(i === 1 ? '1' : '3'); await page.waitForTimeout(50); }
  ok((await page.textContent('.review-counts')).includes('4 done'), 'offline review: 4 rated');
  await page.keyboard.press('Escape');
  const saved = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('lawRevisionApp.v1')); return { p: Object.keys(d.progress).length, s: d.stats }; });
  ok(saved.p === 4, 'progress saved locally: ' + JSON.stringify(saved));
  // Status filter + sort
  await page.selectOption('#statusSelect', 'learning');
  ok((await page.textContent('#viewSubtitle')).startsWith('4 cards'), 'learning filter (incl. the forgotten card): ' + await page.textContent('#viewSubtitle'));
  await page.selectOption('#statusSelect', 'due');
  ok((await page.textContent('#viewSubtitle')).startsWith('0 cards') || (await page.textContent('#viewSubtitle')).startsWith('1 card'), 'due filter: ' + await page.textContent('#viewSubtitle'));
  await page.selectOption('#statusSelect', 'all');
  // Add a card with source fields, verify, edit
  await page.click('#fab'); await page.click('#fabAddCard');
  await page.fill('#fName', 'Zebra v Quokka'); await page.fill('#fRatio', 'A test rule.'); await page.fill('#fSourceRef', 'p. 9'); await page.check('#fVerified');
  await page.click('#saveEntryBtn');
  await page.fill('#searchInput', 'Zebra v Quokka'); await page.waitForTimeout(250);
  ok(await page.locator('.card').count() === 1 && (await page.textContent('.card')).includes('Verified'), 'added card shows as verified');
  ok((await page.textContent('.card .source-line')).includes('p. 9'), 'source ref shown');
  // Ask fallback copies prompt
  await page.click('.card [data-action=ask]');
  ok((await page.textContent('#askSendBtn')).includes('Copy'), 'ask offers copy offline');
  await page.click('[data-preset="1"]');
  await page.waitForTimeout(300);
  ok((await page.locator('.toast').last().textContent()).includes('Copied') || await page.isVisible('#clipboardModal'), 'ask copied prompt');
  await page.keyboard.press('Escape'); if (await page.isVisible('#askModal')) await page.keyboard.press('Escape');
  await page.click('#clearSearch');
  // Add notes offline: paste text -> save as source only
  await page.click('#addNotesSideBtn');
  await page.fill('#ntTitle', 'Pasted notes');
  await page.fill('#ntPaste', 'Offer and acceptance.\n\nIn Hyde v Wrench a counter-offer destroyed the original offer.');
  await page.click('[data-nt="continue"]');
  ok(await page.isDisabled('[data-nt="draft"]'), 'drafting disabled offline');
  await page.click('[data-nt="save-only"]');
  await page.waitForTimeout(200);
  ok(await page.textContent('#sourceCount') === '1', 'pasted source saved locally');
  await page.click('#sourcesBtn'); await page.click('[data-src="view"]');
  await page.waitForSelector('#viewerText');
  ok((await page.textContent('#viewerText')).includes('Hyde v Wrench'), 'viewer shows pasted text');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  // Mock exam fallback
  await page.click('#mockBtn');
  ok(await page.isDisabled('#aiScenarioBtn'), 'AI scenario disabled offline');
  await page.fill('#mockAnswer', 'ISSUE: x');
  await page.click('#gradeBtn'); await page.waitForTimeout(300);
  ok(await page.isVisible('#gradeNote') || await page.isVisible('#clipboardModal'), 'grade copies prompt offline');
  await page.keyboard.press('Escape'); if (await page.isVisible('#mockModal')) await page.keyboard.press('Escape');
  // Export download
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
  const fs = require('fs'); const p = await dl.path(); const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  ok(d.version === 2 && d.entries.length === 34 && Object.keys(d.progress).length === 4 && d.sources.length === 1, 'export file v2 complete');
  // Reimport into fresh profile (replace)
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('#importFile').value = ''); await page.setInputFiles('#importFile', p);
  await page.waitForSelector('#dialogModal:not([hidden])'); await page.click('#dialogButtons >> text=Replace everything'); await page.waitForTimeout(400);
  ok(await page.textContent('#statTotal') === '34', 'restore from backup: ' + await page.textContent('#statTotal'));
  const r2 = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('lawRevisionApp.v1')); return Object.keys(d.progress).length; });
  ok(r2 === 4, 'progress restored');
  ok(await page.textContent('#sourceCount') === '1', 'source restored');
  // List view + cram
  await page.click('#viewListBtn'); await page.click('.cram-wrap');
  ok(await page.locator('.row').count() >= 30, 'list view renders');
  await page.setViewportSize({ width: 390, height: 800 });
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'offline phone: no sideways scroll');
  ok(errs.length === 0, 'no errors ' + JSON.stringify(errs.slice(0, 5)));
  await b.close();
})();
