// Friends' edition: built with a starter library (here made from the made-up sample seed), saved in the
// browser's IndexedDB, never touching claude.ai storage, with Claude features still working.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), vm = require('vm'), cp = require('child_process'), os = require('os');
const T = __dirname;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
// Build a friends' page from the sample library
const sb = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(T, 'sample_seed.js'), 'utf8'), sb);
const seed = sb.window.__SEED, entries = [], meta = [], text = {};
Object.keys(seed).forEach(k => {
  if (k.startsWith('lib/')) entries.push(...Object.values(seed[k].e));
  if (k.startsWith('src/')) meta.push(seed[k]);
  if (k.startsWith('srctext/')) text[seed[k].sid] = (text[seed[k].sid] || '') + seed[k].text;
});
entries[0].comments = [{ id: 'c1', text: 'A comment </script><script>window.__pwn=1</script>', at: '2026-01-10T09:00:00Z' }];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'friends-'));
const starterPath = path.join(tmp, 'starter.json'), built = path.join(tmp, 'friends.html'), page1 = path.join(T, 'online_friends.html');
fs.writeFileSync(starterPath, JSON.stringify({ entries, sources: { meta, text } }));
cp.execFileSync('python3', [path.join(T, '..', 'src', 'build.py'), '--friends', starterPath, built]);
fs.writeFileSync(page1, '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(built, 'utf8') + '</body></html>');

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.addInitScript({ path: path.join(T, 'mockclaude.js') });   // claude.ai stand-in: db available but must not be used
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => { errs.push('dialog ' + d.message()); d.dismiss(); });
  await page.goto('file://' + page1);
  await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), entries.length);
  ok(true, 'friend starts with the whole starter library (' + entries.length + ' cards)');
  ok(await page.textContent('#sourceCount') === String(meta.length), 'and all ' + meta.length + ' sources');
  ok((await page.textContent('#syncText')).trim() === 'Saved in this browser', 'sync line: ' + await page.textContent('#syncText'));
  await page.waitForSelector('.toast >> text=Welcome!');
  ok(true, 'welcome message shown');
  ok(!(await page.evaluate(() => window.__pwn)), 'starter text cannot break out of the page');
  ok(await page.title() === 'Law Revision – Friends', 'page title marks the friends\' edition');

  // Make changes: edit a card, add a comment, review one card
  await page.fill('#searchInput', 'Donoghue v Stevenson'); await page.waitForTimeout(400);
  const card = page.locator('.card.entry', { hasText: 'Donoghue v Stevenson' }).first();
  const cid = await card.getAttribute('data-id');
  await card.locator('[data-action="edit"]').click(); await page.waitForSelector('#entryModal:not([hidden])'); await page.waitForTimeout(150);
  await page.evaluate(() => { const ed = document.getElementById('fStrategy'); ed.focus(); const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await page.keyboard.type(' Friend\'s own addition.');
  await page.click('#saveEntryBtn'); await page.waitForTimeout(400);
  await page.fill('#searchInput', ''); await page.waitForTimeout(200);
  await page.click('#reviewBtn'); await page.waitForSelector('#rvShow'); await page.keyboard.press('Space'); await page.waitForSelector('.rate-btn'); await page.keyboard.press('3'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Claude features work (quiz)
  await page.click('#quizBtn'); await page.selectOption('#qzN', '5'); await page.click('[data-qz="go"]');
  await page.waitForSelector('.quiz-opt', { timeout: 15000 });
  ok(true, 'quiz questions written by Claude');
  await page.keyboard.press('Escape');

  const writes = await page.evaluate(() => window.__mock.writes.length);
  ok(writes === 0, 'nothing written to claude.ai storage (' + writes + ' writes)');
  const where = await page.evaluate(() => ({ ls: localStorage.getItem('lawRevisionApp.v1'), idb: null }));
  ok(where.ls === null, 'library is not in localStorage (kept in IndexedDB instead)');

  // Reload: changes kept, not re-seeded
  await page.reload();
  await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), entries.length);
  await page.waitForTimeout(500);
  ok(await page.locator('.toast >> text=Welcome!').count() === 0, 'no second welcome: library is not reset on reload');
  await page.fill('#searchInput', 'Donoghue v Stevenson'); await page.waitForTimeout(400);
  ok((await page.locator('.card.entry[data-id="' + cid + '"]').textContent()).includes("Friend's own addition."), 'card edit kept after reload');
  ok((await page.textContent('#reviewPill')) !== '' , 'review state loads');
  const reviewed = await page.evaluate(() => new Promise(res => { const r = indexedDB.open('lawRevisionApp', 1); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('lawRevisionApp.v1'); g.onsuccess = () => { const d = JSON.parse(g.result); res(Object.keys(d.progress).length); }; }; }));
  ok(reviewed === 1, 'review progress saved in IndexedDB');

  // Export works
  await page.click('#exportBtn');
  await page.waitForFunction(() => window.__mock.saved, null, { timeout: 10000 });
  const exp = await page.evaluate(() => { const d = JSON.parse(window.__mock.saved.data); return { n: d.entries.length, s: d.sources.length }; });
  ok(exp.n === entries.length && exp.s === meta.length, 'backup export includes every card and source');

  // A different friend (fresh browser) gets their own untouched copy
  const ctx2 = await b.newContext(); await ctx2.addInitScript({ path: path.join(T, 'mockclaude.js') });
  const p2 = await ctx2.newPage(); await p2.goto('file://' + page1);
  await p2.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), entries.length);
  await p2.fill('#searchInput', 'Donoghue v Stevenson'); await p2.waitForTimeout(400);
  ok(!(await p2.locator('.card.entry[data-id="' + cid + '"]').textContent()).includes("Friend's own addition."), 'another friend\'s copy is separate');

  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})();
