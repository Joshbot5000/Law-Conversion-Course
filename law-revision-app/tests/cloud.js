const { chromium } = require('playwright');
const path = require('path');
const { N, SRC } = require('./seedinfo');
const T = __dirname, LIBS = path.join(T, '..', 'libs');
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, route => {
    const u = route.request().url();
    const f = u.includes('pdf.worker') ? 'pdfjs-dist-3.11.174/build/pdf.worker.min.js' : u.includes('pdf.min') ? 'pdfjs-dist-3.11.174/build/pdf.min.js' : u.includes('mammoth') ? 'mammoth-1.6.0/mammoth.browser.min.js' : null;
    if (!f) return route.abort();
    if (!require('fs').existsSync(path.join(LIBS, f))) return route.continue();
    route.fulfill({ path: path.join(LIBS, f), contentType: 'application/javascript' });
  });
  await ctx.addInitScript({ path: path.join(T, 'sample_seed.js') });
  await ctx.addInitScript({ path: path.join(T, 'mockclaude.js') });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const URL = 'file://' + path.join(T, 'online_wrapped.html');
  // Simulate the earlier browser-only version having a memorised tick saved
  await page.goto(URL);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.removeItem('__mockdb'); window.name = ''; localStorage.setItem('lawRevisionApp.v1', JSON.stringify({ version: 1, entries: [{ id: 'contract-ch3-hutton-v-warren', module: 'contract', type: 'case', name: 'Hutton v Warren', memorised: true, updatedAt: '2000-01-01T00:00:00Z', createdAt: '2000-01-01T00:00:00Z' }] })); });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#statTotal').textContent !== '0');
  await page.waitForTimeout(400);
  ok(await page.textContent('#statTotal') === String(N), 'cloud library loaded: ' + await page.textContent('#statTotal'));
  ok((await page.textContent('#syncText')).includes('claude.ai account'), 'sync status: ' + await page.textContent('#syncText'));
  ok(await page.textContent('#sourceCount') === String(SRC), 'sources listed: ' + await page.textContent('#sourceCount'));
  const mem = await page.evaluate(() => { const s = window.__mock.store; for (const k in s) if (k.startsWith('lib/') && s[k].e['contract-ch3-hutton-v-warren']) return s[k].e['contract-ch3-hutton-v-warren'].memorised; });
  ok(mem === true, 'earlier browser tick migrated to claude.ai storage');
  ok(await page.locator('.toast', { hasText: 'Brought over' }).count() === 1, 'migration toast shown');
  // Today panel
  ok((await page.textContent('#today')).includes('new to learn'), 'today panel renders');
  ok(await page.textContent('#reviewPill') === '15', 'review pill = 15 new: ' + await page.textContent('#reviewPill'));
  await page.screenshot({ path: path.join(T, 'c1_home.png') });

  // Review: 3 cards
  await page.click('#reviewBtn');
  await page.waitForSelector('#rvShow');
  ok((await page.textContent('.review-counts')).includes('15'), 'review queue has 15 new');
  await page.keyboard.press('Space');
  await page.waitForSelector('.rate-btn.good');
  const goodLabel = await page.textContent('.rate-btn.good small');
  ok(goodLabel === '1 day', 'Good on new card = 1 day: ' + goodLabel);
  await page.screenshot({ path: path.join(T, 'c2_review.png') });
  await page.keyboard.press('3');
  await page.waitForSelector('#rvShow');
  await page.fill('#rvRecall', 'Some recall text');
  await page.click('#rvShow');
  await page.click('#rvCheck');
  await page.waitForFunction(() => document.querySelector('#rvFeedback') && document.querySelector('#rvFeedback').textContent.includes('Suggested'));
  ok(true, 'check recall feedback shown');
  await page.keyboard.press('1');  // Again -> requeued
  await page.waitForTimeout(100);
  const done = await page.textContent('.review-counts');
  ok(done.includes('2 done'), 'two ratings recorded: ' + done);
  await page.waitForTimeout(300);
  const progWrites = await page.evaluate(() => window.__mock.writes.filter(w => w[1].startsWith('prog/')).length);
  ok(progWrites >= 2, 'progress written to claude.ai storage (' + progWrites + ' writes)');
  const statsDoc = await page.evaluate(() => window.__mock.store['meta/stats']);
  ok(statsDoc && Object.values(statsDoc.days)[0][0] === 2, 'stats doc: ' + JSON.stringify(statsDoc));
  await page.keyboard.press('Escape');

  // Edit + verify + delete
  await page.click('[data-filter=contract]');
  await page.selectOption('#statusSelect', 'all');
  const firstId = await page.getAttribute('.card', 'data-id');
  await page.click(`.card[data-id="${firstId}"] [data-action=verify]`);
  await page.waitForTimeout(200);
  const verified = await page.evaluate(id => { const s = window.__mock.store; for (const k in s) if (k.startsWith('lib/') && s[k].e[id]) return s[k].e[id].verified; }, firstId);
  ok(verified === true, 'verify toggle saved to cloud');
  const lastLibWrite = await page.evaluate(() => window.__mock.writes.filter(w => w[1].startsWith('lib/')).slice(-1)[0]);
  ok(lastLibWrite[0] === 'update' && lastLibWrite[2] < 5000, 'small merge-update used for an edit: ' + JSON.stringify(lastLibWrite));
  await page.click(`.card[data-id="${firstId}"] [data-action=delete]`);
  await page.waitForTimeout(250);
  const gone = await page.evaluate(id => { const s = window.__mock.store; for (const k in s) if (k.startsWith('lib/') && s[k].e[id]) return false; return true; }, firstId);
  ok(gone, 'delete removed card from cloud shard');
  await page.click('.toast button:has-text("Undo")');
  await page.waitForTimeout(250);
  ok(await page.textContent('#statTotal') === String(N), 'undo restored card');

  // Source link on a card opens viewer at quote
  await page.fill('#searchInput', 'Bonnington Castings');
  await page.waitForTimeout(250);
  await page.click('[data-filter=all]');
  await page.click('.card .source-line button');
  await page.waitForSelector('#viewerText mark.focus');
  const focusTxt = await page.textContent('#viewerText mark.focus');
  ok(/Bonnington/.test(focusTxt), 'viewer highlights the quote: ' + focusTxt.slice(0, 60));
  await page.fill('#viewerSearch', 'pneumoconiosis');
  await page.waitForTimeout(400);
  ok(/of \d+/.test(await page.textContent('#viewerCount')), 'find in source: ' + await page.textContent('#viewerCount'));
  await page.screenshot({ path: path.join(T, 'c3_viewer.png') });
  await page.keyboard.press('Escape');
  await page.click('#clearSearch');

  // Ask (notes only) with citations
  await page.fill('#searchInput', 'Bonnington');
  await page.waitForTimeout(250);
  await page.click('.card [data-action=ask]');
  await page.click('[data-preset="0"]');
  await page.waitForSelector('.cite-list');
  const call = await page.evaluate(() => window.__mock.calls.slice(-1)[0].input[0].content);
  ok(call.includes('ONLY the material') && call.includes('[S1] SOURCE EXTRACT') && call.includes('[C1] CARD'), 'notes-only prompt carries cards and source extracts');
  ok(await page.locator('.ask-a .cite').count() >= 3, 'citation chips rendered');
  await page.screenshot({ path: path.join(T, 'c4_ask.png') });
  await page.click('.cite-list button[data-cite="S1"]');
  await page.waitForSelector('#viewerModal:not([hidden]) #viewerText mark.focus', { timeout: 5000 }).then(() => ok(true, 'S1 opens source at passage'), () => ok(false, 'S1 opens source at passage'));
  await page.keyboard.press('Escape');
  await page.click('.cite-list button[data-cite="C1"]');
  ok(await page.isVisible('#peekModal'), 'C1 opens the card');
  await page.keyboard.press('Escape');
  await page.click('.ask-actions >> text=Save to card');
  await page.keyboard.press('Escape');
  await page.click('#clearSearch');

  // Add notes from a real PDF
  await page.click('#fab'); await page.click('#fabAddNotes');
  await page.setInputFiles('#notesFile', path.join(T, 'fixtures', 'sample-chapter.pdf'));
  await page.waitForSelector('[data-nt="draft"]', { timeout: 60000 });
  const checkTxt = await page.textContent('#notesBody');
  ok(/pages/.test(checkTxt) && /words/.test(checkTxt), 'PDF read: ' + checkTxt.slice(0, 120).replace(/\s+/g, ' '));
  await page.click('[data-nt="draft"]');
  await page.waitForSelector('.prop-list', { timeout: 60000 });
  const props = await page.locator('.prop').count();
  const okFlags = await page.locator('.flag.ok').count(), badFlags = await page.locator('.flag.bad').count();
  ok(props > 3 && okFlags > 0 && badFlags > 0, `drafted ${props} cards, ${okFlags} quotes verified, ${badFlags} flagged`);
  const dups = await page.locator('.flag.dup').count();
  console.log('   duplicates flagged:', dups);
  await page.screenshot({ path: path.join(T, 'c5_drafts.png') });
  const addLabel = await page.textContent('[data-nt="add"]');
  await page.click('[data-nt="add"]');
  await page.waitForTimeout(400);
  const nAdded = +addLabel.match(/\d+/)[0];
  ok(+await page.textContent('#statTotal') === N + nAdded, 'added ' + nAdded + ' approved cards');
  const newCard = await page.evaluate(() => { const s = window.__mock.store; let out = null; for (const k in s) if (k.startsWith('lib/')) for (const id in s[k].e) if (s[k].e[id].sourceId && s[k].e[id].sourceId.indexOf('sample-chapter') !== -1) out = s[k].e[id]; return out; });
  ok(newCard && /^p\. \d+$/.test(newCard.sourceRef) && newCard.verified === false, 'new card linked to new source with page: ' + (newCard && newCard.sourceRef));
  ok(await page.textContent('#sourceCount') === String(SRC + 1), 'new source saved: ' + await page.textContent('#sourceCount'));
  const srcParts = await page.evaluate(() => Object.keys(window.__mock.store).filter(k => k.startsWith('srctext/') && k.indexOf('sample-chapter') !== -1).length);
  ok(srcParts >= 1, 'source text stored in ' + srcParts + ' part(s)');

  // Quiz
  await page.click('#quizBtn');
  await page.selectOption('#qzN', '5');
  await page.click('[data-qz="go"]');
  await page.waitForSelector('.quiz-opt');
  for (let i = 0; i < 5; i++) {
    const right = await page.evaluate(() => { const b = [...document.querySelectorAll('.quiz-opt')]; return b.findIndex(x => x.textContent.includes('Right answer')); });
    await page.click(`.quiz-opt[data-opt="${i === 0 ? (right + 1) % 5 : right}"]`);
    await page.click('[data-qz="next"]');
  }
  ok((await page.textContent('#quizBody')).includes('4 / 5'), 'quiz scored 4/5 (options shuffled correctly)');
  await page.click('[data-qz="due"]');
  await page.keyboard.press('Escape');

  // Mock exam: write from notes + grade
  await page.click('#mockBtn');
  await page.click('#aiScenarioBtn');
  await page.waitForFunction(() => document.querySelector('#scenarioTitle').textContent === 'The Test Problem');
  ok(true, 'AI scenario rendered');
  await page.fill('#mockAnswer', 'ISSUE: offer. RULE: Carlill. APPLICATION: yes. CONCLUSION: contract.');
  await page.click('#gradeBtn');
  await page.waitForFunction(() => !document.querySelector('#gradeStopBtn') && /Mark/.test(document.querySelector('#gradeNote').textContent));
  ok(true, 'grading feedback shown');
  await page.keyboard.press('Escape');

  // Export
  await page.click('#exportBtn');
  await page.waitForFunction(() => window.__mock.saved, null, { timeout: 10000 });
  const exp = await page.evaluate(() => { const d = JSON.parse(window.__mock.saved.data); return { v: d.version, n: d.entries.length, s: d.sources.length, p: Object.keys(d.progress).length, chars: d.sources.reduce((a, x) => a + x.text.length, 0) }; });
  ok(exp.v === 2 && exp.n === N + nAdded && exp.s === SRC + 1 && exp.p >= 2, 'export v2: ' + JSON.stringify(exp));

  // Reload: everything persists from cloud store
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#statTotal').textContent !== '0');
  await page.waitForFunction(n => +document.querySelector('#statTotal').textContent === n, N + nAdded, { timeout: 8000 }).catch(() => {});
  ok(+await page.textContent('#statTotal') === N + nAdded, 'after reload: ' + await page.textContent('#statTotal'));
  ok(await page.locator('.toast', { hasText: 'Brought over' }).count() === 0, 'migration runs only once');
  // dark + phone
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: path.join(T, 'c6_dark.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no sideways scroll on phone');
  await page.screenshot({ path: path.join(T, 'c7_phone.png') });
  await page.click('#reviewBtn');
  await page.waitForSelector('#rvShow');
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'review fits phone');
  await page.screenshot({ path: path.join(T, 'c8_phone_review.png') });
  const maxShard = await page.evaluate(() => Math.max(...Object.keys(window.__mock.store).filter(k => k.startsWith('lib/')).map(k => JSON.stringify(window.__mock.store[k]).length)));
  console.log('   largest shard bytes:', maxShard);
  ok(errs.length === 0, 'no errors ' + JSON.stringify(errs.slice(0, 5)));
  await b.close();
})();
