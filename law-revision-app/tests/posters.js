// Revision posters: choose sources → Claude lists every point → plans up to 4 pages in mixed layouts → writes each page →
// a separate check (and fix) per page → coverage report → landscape PDF + coverage PDF. Older long-form notes still open.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { N } = require('./seedinfo');
const T = __dirname, LIBS = path.join(T, '..', 'libs');
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
const route = ctx => ctx.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, r => {
  const u = r.request().url();
  const f = u.includes('vfs_fonts') ? 'pdfmake-0.2.10/build/vfs_fonts.js' : u.includes('pdfmake') ? 'pdfmake-0.2.10/build/pdfmake.min.js'
    : u.includes('pdf.worker') ? 'pdfjs-dist-3.11.174/build/pdf.worker.min.js' : u.includes('pdf.min.js') ? 'pdfjs-dist-3.11.174/build/pdf.min.js' : null;
  if (!f) return r.abort();
  if (!fs.existsSync(path.join(LIBS, f))) return r.continue();
  r.fulfill({ path: path.join(LIBS, f), contentType: 'application/javascript' });
});
const OLD = { v: 1, id: 'rn-old', title: 'Old long notes', module: '', createdAt: '2026-10-01T10:00:00.000Z', sources: [{ id: 'src-sample-tort', title: 'Sample tort chapter' }],
  topicMap: ['Duty → Breach'], sections: [{ title: 'Duty', entries: [{ principle: 'An old principle.', authority: 'Old authority', eli5: 'Simple.', case: null, examAngle: '', pros: [], cons: [] }] }], hooks: [], terms: [], cases: [], outcomes: [] };
const pdfOf = async (page, name) => {
  const saved = await page.evaluate(async () => { const s = window.__mock.saved; const buf = new Uint8Array(await s.data.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]); return { name: s.filename, b64: btoa(bin) }; });
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ps-')), name); fs.writeFileSync(f, Buffer.from(saved.b64, 'base64'));
  return { name: saved.name, file: f, info: cp.execFileSync('pdfinfo', [f]).toString(), text: cp.execFileSync('pdftotext', [f, '-']).toString().replace(/\s+/g, ' ') };
};
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  await route(ctx);
  await ctx.addInitScript({ path: path.join(T, 'sample_seed.js') });
  await ctx.addInitScript(old => { window.__SEED['rdoc/rn-old'] = { id: old.id, title: old.title, sources: old.sources, createdAt: old.createdAt, parts: 1, counts: { principles: 1, terms: 0, cases: 0 } }; window.__SEED['rdocpart/rn-old_0'] = { rid: old.id, n: 0, text: JSON.stringify(old) }; }, OLD);
  await ctx.addInitScript({ path: path.join(T, 'mockclaude.js') });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(T, 'online_wrapped.html'));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('lawRevisionApp.migrated', '1'); }); await page.reload();
  await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await page.evaluate(() => { window.__sampleDelay = 2; window.__rnOutcomes = true; window.__psForget = true; });
  const prompts = () => page.evaluate(() => window.__mock.calls.map(c => typeof c.input === 'string' ? c.input : c.input.map(t => t.content).join('\n')).filter(t => t.includes('REVISION POSTERS — ')));
  const docOf = () => page.evaluate(() => { const st = window.__mock.store; const k = Object.keys(st).filter(k => k.startsWith('rdocpart/ps')).sort().pop(); const id = st[k].rid; return JSON.parse(Object.keys(st).filter(x => x.startsWith('rdocpart/' + id + '_')).sort().map(x => st[x].text).join('')); });

  // 1. The sidebar section replaces Revision notes; old long notes are kept
  ok((await page.textContent('#rnBtn')).includes('Revision posters'), 'sidebar now says Revision posters');
  ok(await page.textContent('#rnCount') === '0', 'no posters yet (old long notes are not counted)');
  await page.click('#rnBtn'); await page.waitForSelector('#rnModal:not([hidden])');
  ok((await page.textContent('#rnBody')).includes('No revision posters yet') && (await page.textContent('.rn-old summary')).includes('Older long-form notes (1)'), 'old long notes kept under "Older long-form notes"');

  // 2. Make posters from two sources
  await page.click('[data-rn="new"]');
  ok((await page.textContent('#rnBody')).includes('The coverage check.'), 'the coverage check is explained before you start');
  await page.check('[data-rnsrc="src-sample-tort"]'); await page.check('[data-rnsrc="src-sample-contract"]');
  await page.click('[data-rn="go"]');
  await page.waitForSelector('.rn-steps');
  await page.waitForSelector('.ps-view', { timeout: 40000 });
  const ps = await prompts();
  const kinds = ps.map(p => (p.match(/REVISION POSTERS — ([A-Z]+)/) || [])[1]);
  console.log('   stages:', kinds.join(', '));
  ok(kinds[0] === 'INVENTORY' && kinds[1] === 'PLAN' && kinds.filter(k => k === 'PAGE').length === 2 && kinds.filter(k => k === 'CHECK').length >= 2 && kinds.includes('FIX') && kinds.includes('OUTCOMES'), 'stages: list every point, plan, write each page, check each page, fix, outcomes');
  const inv = ps.find(p => p.includes('— INVENTORY'));
  ok(/=== \[S1:1\] ===/.test(inv) && /=== \[S2:1\] ===/.test(inv) && inv.includes('Bonnington') && inv.includes('Combe v Combe'), 'the inventory sees every page of both sources');
  ok(inv.includes('Miss nothing') && inv.includes('"must"') && inv.includes('"detail"') && inv.includes('Never invent a case'), 'inventory asks for every point with a priority, from the sources only');
  const plan = ps.find(p => p.includes('— PLAN'));
  ok(/"tiles"/.test(plan) && /"flow"/.test(plan) && /"mindmap"/.test(plan) && /"cases"/.test(plan) && /never more than 4/.test(plan), 'plan chooses a mix of the four layouts, max 4 pages');
  const pg = ps.find(p => p.includes('— PAGE 1'));
  ok(/380-480 words/.test(pg) && /Never drop a point/.test(pg) && /must appear in the "ids"/.test(pg), 'each page has a word budget, and must cover every point it was given');
  ok(!ps.some(p => /flashcard/i.test(p)), 'no flashcards asked for');
  const chk = ps.find(p => p.includes('— CHECK'));
  ok(/Be strict/.test(chk) && /SOURCE PAGES:/.test(chk) && /"missing"/.test(chk) && /"wrong"/.test(chk), 'the check compares each page with its points and the source');

  // 3. Coverage: every point found is on the posters
  const d = await docOf();
  const pts = d.items.filter(i => i.type !== 'outcome');
  console.log('   statuses:', JSON.stringify(pts.map(i => i.status)));
  ok(d.kind === 'poster' && d.pages.length === 2 && d.pages[0].style === 'tiles' && d.pages[1].style === 'cases', 'two pages: tile grid + timeline/case table');
  ok(pts.length >= 10 && pts.every(i => ['full', 'short', 'restored'].includes(i.status) && i.where), 'every one of the ' + pts.length + ' points is on the posters, with where it is');
  ok(pts.every(i => i.status === 'full'), 'points the first draft left out (and the one the plan forgot) were added back in full by the fix');
  ok(pts.find(i => i.name === 'Nobody v Nothing').notFound && pts.filter(i => i.type === 'case' && i.name !== 'Nobody v Nothing').every(i => !i.notFound), 'a case not in your sources is flagged; real ones are not');
  ok(d.outcomes.length === 1 && d.outcomes[0].covered, 'learning outcomes checked');
  const view = await page.textContent('.ps-view');
  ok(/points found in your sources/.test(view) && new RegExp(pts.length + '/' + pts.length + '\\s*on the posters').test(view), 'summary in the app: ' + pts.length + '/' + pts.length + ' on the posters');
  await page.click('.ps-cov summary');
  ok((await page.$$('.ps-cov .ps-tr:not(.ps-th)')).length >= pts.length && /Not found in your sources — check/.test(await page.textContent('.ps-cov')), 'coverage table lists every point, with flags');
  await page.waitForFunction(() => document.querySelectorAll('#psPreview canvas').length === 2, null, { timeout: 30000 });
  ok(true, 'the two poster pages are drawn in the app');
  await page.screenshot({ path: path.join(T, 'ps_view.png') });

  // 4. The PDFs
  await page.click('[data-rn="pdf"]');
  await page.waitForFunction(() => window.__mock.saved && /posters\.pdf$/.test(window.__mock.saved.filename), null, { timeout: 30000 });
  const P = await pdfOf(page, 'posters.pdf');
  ok(P.name === 'Mock poster title – posters.pdf', 'PDF named after the posters: ' + P.name);
  ok(/Pages:\s+2\b/.test(P.info) && /841\.89 x 595\.28/.test(P.info), 'exactly one landscape A4 page per poster (' + (/Pages:\s+(\d+)/.exec(P.info) || [])[1] + ' pages)');
  ok(/The overview/.test(P.text) && /The cases/.test(P.text) && /Bonnington/.test(P.text) && /EXAM TRAP/.test(P.text) && /THE TEST/.test(P.text) && /Use it when/i.test(P.text), 'searchable text: titles, cases, tests, traps, case table');
  ok(/\(not in/.test(P.text) && /sources — check\)/.test(P.text), 'flag for the invented case is on the poster');
  cp.execFileSync('pdftoppm', ['-png', '-r', '70', P.file, path.join(T, 'ps_pdf')]);
  fs.copyFileSync(P.file, path.join(T, 'ps_sample.pdf'));
  await page.click('[data-rn="cov"]');
  await page.waitForFunction(() => window.__mock.saved && /coverage check\.pdf$/.test(window.__mock.saved.filename), null, { timeout: 30000 });
  const C = await pdfOf(page, 'cov.pdf');
  ok(/Coverage check: Mock poster title/.test(C.text) && /points found in your sources/.test(C.text) && /Learning outcomes/.test(C.text) && /Nobody v Nothing/.test(C.text), 'coverage check downloads as its own PDF');

  // 5. When the fix doesn't work, missing points are put back word for word; wrong ones are flagged
  await page.click('[data-rn="list"]');
  await page.evaluate(() => { window.__psForget = false; window.__psBadFix = true; window.__psWrong = true; window.__rnOutcomes = false; window.__psStyle2 = 'flow'; window.__mock.calls = []; });
  await page.click('[data-rn="new"]'); await page.check('[data-rnsrc="src-sample-criminal"]');
  await page.fill('#rnTitle', 'Criminal – mens rea');
  await page.click('[data-rn="go"]'); await page.waitForSelector('.ps-view', { timeout: 40000 });
  const d2 = await docOf();
  const p2 = d2.items.filter(i => i.type !== 'outcome');
  ok(d2.title === 'Criminal – mens rea' && d2.pages[1].style === 'flow', 'your own title is used; flow map page');
  ok(p2.some(i => i.status === 'restored') && p2.every(i => i.status !== 'restored' || d2.pages.some(pg => pg.content.also.some(a => a.ids.includes(i.id) && a.restored))), 'points still missing after the fix are put back in "Also know"');
  ok(p2.some(i => i.status === 'flag' && /wrong outcome/.test(i.issue)), 'a point the check says is wrong is flagged for you to check');
  ok(p2.every(i => i.where), 'still nothing missing: every point has a place');
  ok(/to check yourself/.test(await page.textContent('.ps-sum')) && await page.isVisible('.ps-cov[open]'), 'the coverage table opens by itself when something needs checking');
  await page.click('[data-rn="pdf"]');
  await page.waitForFunction(() => window.__mock.saved && /mens rea – posters\.pdf$/.test(window.__mock.saved.filename), null, { timeout: 30000 });
  const P2 = await pdfOf(page, 'p2.pdf');
  ok(/Pages:\s+2\b/.test(P2.info) && /ALSO KNOW/i.test(P2.text) && /SPECIAL RULES/.test(P2.text), 'flow-map PDF with an Also know strip (' + (/Pages:\s+(\d+)/.exec(P2.info) || [])[1] + ' pages)');
  cp.execFileSync('pdftoppm', ['-png', '-r', '70', P2.file, path.join(T, 'ps_pdf2')]);

  // 6. Library: reload, old notes still open, delete
  await page.reload(); await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await page.waitForFunction(() => document.querySelector('#rnCount').textContent === '2', null, { timeout: 8000 });
  await page.click('#rnBtn'); await page.waitForSelector('.rn-item');
  ok((await page.$$('#rnBody > .rn-list > .rn-item')).length === 2 && /2 pages · \d+ points checked/.test(await page.textContent('.rn-item')), 'library lists both sets of posters after reloading');
  await page.click('.rn-old summary'); await page.click('.rn-old [data-rn="open"]'); await page.waitForSelector('.rn-doc');
  ok((await page.textContent('.rn-doc')).includes('An old principle.'), 'older long-form notes still open');
  await page.click('[data-rn="list"]');
  await page.locator('.rn-item', { hasText: 'Criminal – mens rea' }).locator('[data-rn="delete"]').click();
  await page.click('#dialogButtons >> text=Delete'); await page.waitForTimeout(400);
  ok((await page.$$('#rnBody > .rn-list > .rn-item')).length === 1 && await page.textContent('#rnCount') === '1', 'delete removes posters from the library');
  await page.keyboard.press('Escape');
  await page.click('#sourcesBtn'); await page.waitForSelector('[data-src="rnotes"]');
  ok((await page.textContent('[data-src="rnotes"]')).includes('Poster'), 'sources have a 🗺 Poster button');
  await page.locator('.src-item', { hasText: 'Sample criminal chapter' }).locator('[data-src="rnotes"]').click();
  await page.waitForSelector('#rnModal:not([hidden]) [data-rnsrc]');
  ok(await page.isChecked('[data-rnsrc="src-sample-criminal"]'), 'it opens the poster maker with that source ticked');
  await page.keyboard.press('Escape');

  // 7. Backups include posters (and the old notes)
  await page.click('#exportBtn'); await page.waitForFunction(() => window.__mock.saved && /backup/.test(window.__mock.saved.filename), null, { timeout: 10000 });
  ok(await page.evaluate(() => { const r = JSON.parse(window.__mock.saved.data).rdocs || []; return r.length === 2 && r.some(x => x.kind === 'poster'); }), 'backup includes posters');

  // 8. Browser-only mode (friends' edition): kept in the browser
  const ctx2 = await b.newContext(); await route(ctx2);
  await ctx2.addInitScript({ path: path.join(T, 'sample_seed.js') }); await ctx2.addInitScript(() => { window.__noDb = true; }); await ctx2.addInitScript({ path: path.join(T, 'mockclaude.js') });
  const q = await ctx2.newPage(); await q.goto('file://' + path.join(T, 'online_wrapped.html'));
  await q.waitForSelector('#rnBtn'); await q.waitForTimeout(500); await q.evaluate(() => { window.__sampleDelay = 2; });
  await q.click('#addNotesSideBtn'); await q.waitForSelector('#ntPaste');
  await q.fill('#ntTitle', 'Pasted tort notes');
  await q.fill('#ntPaste', 'Negligence\n\nIn Donoghue v Stevenson a manufacturer owed a duty to the consumer. In Bolton v Stone the risk was tiny.');
  await q.click('[data-nt="continue"]'); await q.click('[data-nt="save-only"]'); await q.waitForTimeout(600);
  await q.waitForFunction(() => document.querySelector('#notesModal').hidden, null, { timeout: 8000 }).catch(() => {});
  await q.click('#rnBtn'); await q.click('[data-rn="new"]'); await q.locator('[data-rnsrc]').first().check();
  await q.click('[data-rn="go"]'); await q.waitForSelector('.ps-view', { timeout: 40000 });
  await q.reload(); await q.waitForSelector('#rnBtn'); await q.waitForTimeout(800);
  ok(await q.textContent('#rnCount') === '1', 'without claude.ai storage, posters are kept in the browser and survive a reload');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
