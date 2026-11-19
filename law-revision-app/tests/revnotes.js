// Revision notes: choose sources → Claude writes "The Standard" in stages → stored → viewed in the app → downloaded as a PDF.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const { N } = require('./seedinfo');
const T = __dirname, LIBS = path.join(T, '..', 'libs');
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
const route = ctx => ctx.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, r => {
  const u = r.request().url();
  const f = u.includes('vfs_fonts') ? 'pdfmake-0.2.10/build/vfs_fonts.js' : u.includes('pdfmake') ? 'pdfmake-0.2.10/build/pdfmake.min.js' : null;
  if (!f) return r.abort();
  if (!fs.existsSync(path.join(LIBS, f))) return r.continue();
  r.fulfill({ path: path.join(LIBS, f), contentType: 'application/javascript' });
});
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  await route(ctx);
  await ctx.addInitScript({ path: path.join(T, 'sample_seed.js') });
  await ctx.addInitScript({ path: path.join(T, 'mockclaude.js') });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(T, 'online_wrapped.html'));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('lawRevisionApp.migrated', '1'); }); await page.reload();
  await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await page.evaluate(() => { window.__sampleDelay = 2; window.__rnOutcomes = true; });
  const prompts = () => page.evaluate(() => window.__mock.calls.map(c => typeof c.input === 'string' ? c.input : c.input.map(t => t.content).join('\n')).filter(t => t.includes('REVISION NOTES — ')));

  // 1. Write notes from two sources
  ok(await page.textContent('#rnCount') === '0', 'Revision notes section in the sidebar (0 so far)');
  await page.click('#rnBtn'); await page.waitForSelector('#rnModal:not([hidden])');
  ok((await page.textContent('#rnBody')).includes('No revision notes yet'), 'empty library to start with');
  await page.click('[data-rn="new"]');
  await page.check('[data-rnsrc="src-sample-tort"]'); await page.check('[data-rnsrc="src-sample-contract"]');
  await page.click('[data-rn="go"]');
  await page.waitForSelector('.rn-steps');
  await page.waitForSelector('.rn-doc', { timeout: 30000 });
  const ps = await prompts();
  const kinds = ps.map(p => (p.match(/REVISION NOTES — ([A-Z ]+)/) || [])[1].trim());
  console.log('   stages:', kinds.join(', '));
  ok(kinds.includes('PLAN') && kinds.filter(k => k === 'SECTION').length === 2 && kinds.includes('MEMORY HOOKS') && kinds.includes('PLAIN ENGLISH GLOSSARY') && kinds.includes('CASE GLOSSARY') && kinds.includes('LEARNING OUTCOMES CHECK'), 'written in stages: plan, each sub-topic, hooks, glossary, case glossary, outcomes');
  const plan = ps.find(p => p.includes('— PLAN'));
  ok(/=== \[S1:1\] ===/.test(plan) && /=== \[S2:1\] ===/.test(plan) && plan.includes('Bonnington') && plan.includes('Combe v Combe'), 'the plan sees every page of both sources, labelled by page');
  ok(plan.includes('Never invent a case') && plan.includes('"added": true') && plan.includes('Sweep EVERYTHING'), 'your Standard rules are in every prompt (sources only, flag additions, sweep everything)');
  ok(!ps.some(p => /flashcard|Question,Answer/i.test(p)), 'no flashcards asked for');
  const sec = ps.find(p => p.includes('— SECTION: Duty of care'));
  ok(sec && sec.includes('[S1:1]') && !sec.includes('[S2:2]'), 'each sub-topic call only gets its own pages (saves your allowance)');

  // 2. The document in the app
  const doc = await page.textContent('.rn-doc');
  ok(/Mock notes title/.test(doc) && /1\. Topic map/.test(doc) && /Duty → Breach → Causation/.test(doc), 'title and topic map');
  ok(/2\. Key principles with authorities/.test(doc) && /Authority:/.test(doc) && /ELI5:/.test(doc) && /Case: /.test(doc) && /Exam angle:/.test(doc), 'principles with authority, ELI5, case and exam angle');
  ok(/\(added, not in your reading\)/.test(doc), 'additions are flagged');
  ok(await page.$('.rn-pc .pro') && await page.$('.rn-pc .con'), 'pros in green, cons in red');
  ok(/Memory hooks/.test(doc) && /Plain English glossary/.test(doc) && /Ratio decidendi/.test(doc), 'memory hooks and plain English glossary');
  ok(/Case glossary/.test(doc) && /Nobody v Nothing[\s\S]{0,80}not found in your sources/.test(doc) && !/Combe v Combe[\s\S]{0,40}not found/.test(doc), 'case glossary checked against your sources: an invented case is flagged, real ones are not');
  ok(/Learning outcomes check/.test(doc) && /Explain causation/.test(doc), 'learning outcomes check');
  const store = await page.evaluate(() => Object.keys(window.__mock.store).filter(k => k.startsWith('rdoc')));
  ok(store.some(k => k.startsWith('rdoc/')) && store.some(k => k.startsWith('rdocpart/')), 'saved to your claude.ai account: ' + store.join(', '));
  ok(await page.textContent('#rnCount') === '1', 'sidebar count now 1');

  // 3. The PDF
  await page.click('[data-rn="pdf"]');
  await page.waitForFunction(() => window.__mock.saved && /\.pdf$/.test(window.__mock.saved.filename), null, { timeout: 30000 });
  const saved = await page.evaluate(async () => { const s = window.__mock.saved; const buf = new Uint8Array(await s.data.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]); return { name: s.filename, b64: btoa(bin) }; });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-')), pdf = path.join(tmp, 'notes.pdf');
  fs.writeFileSync(pdf, Buffer.from(saved.b64, 'base64'));
  ok(saved.name === 'Mock notes title.pdf', 'PDF named after the notes: ' + saved.name);
  const lay = cp.execFileSync('pdftotext', ['-layout', pdf, '-']).toString(), txt = cp.execFileSync('pdftotext', [pdf, '-']).toString().replace(/\s+/g, ' ');
  const pages = +(/Pages:\s+(\d+)/.exec(cp.execFileSync('pdfinfo', [pdf]).toString()) || [])[1];
  ok(pages >= 3, 'a real ' + pages + '-page PDF');
  ok(/Contents/.test(lay) && /1\.\s+Topic map/.test(lay) && /2\.\s+Key principles with authorities/.test(lay) && /2\.1\s+Duty of care/.test(lay), 'searchable text with contents and numbered sections');
  ok(/Duty » Breach » Causation/.test(txt) && !/Duty Breach/.test(txt) && /ELI5/.test(txt) && /Exam angle/.test(txt) && /Authority:/.test(txt), 'topic map arrows (as », which the PDF font has), ELI5, exam angle and authority all in the PDF text');
  ok(/Plain English glossary/.test(txt) && /Case glossary/.test(txt) && /not found in your sources/.test(txt) && /Learning outcomes check/.test(txt), 'glossaries, flags and outcomes in the PDF');
  ok(/1\s*\/\s*\d+/.test(lay), 'page numbers in the footer');
  cp.execFileSync('pdftoppm', ['-png', '-r', '60', '-f', '1', '-l', '3', pdf, path.join(T, 'rn_pdf')]);
  fs.copyFileSync(pdf, path.join(T, 'rn_sample.pdf'));

  // 4. Library: reload, open from storage, start from a source, failed section, delete
  await page.reload(); await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await page.waitForFunction(() => document.querySelector('#rnCount').textContent === '1', null, { timeout: 8000 });
  await page.click('#rnBtn'); await page.waitForSelector('.rn-item');
  ok((await page.textContent('.rn-item')).includes('From: Sample tort chapter'), 'library lists the notes and their sources after reloading');
  await page.click('.rn-item [data-rn="open"]'); await page.waitForSelector('.rn-doc');
  ok((await page.textContent('.rn-doc')).includes('Key principles with authorities'), 'opens from storage');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__sampleDelay = 2; window.__rnFailSection = true; window.__rnOutcomes = false; });
  await page.click('#sourcesBtn'); await page.waitForSelector('[data-src="rnotes"]');
  await page.locator('.src-item', { hasText: 'Sample criminal chapter' }).locator('[data-src="rnotes"]').click();
  await page.waitForSelector('#rnModal:not([hidden]) [data-rnsrc]');
  ok(await page.isChecked('[data-rnsrc="src-sample-criminal"]') && !(await page.isChecked('[data-rnsrc="src-sample-tort"]')), '📄 Notes on a source opens the generator with that source ticked');
  await page.fill('#rnTitle', 'Criminal – mens rea');
  await page.click('[data-rn="go"]'); await page.waitForSelector('.rn-doc', { timeout: 30000 });
  const d2 = await page.textContent('.rn-doc');
  ok(d2.includes('Criminal – mens rea') && /couldn't be written this time/.test(d2), 'your own title is used; a sub-topic that fails (even after a retry) is marked, the rest is kept');
  ok(!/Learning outcomes check/.test(d2), 'no outcomes section when the reading has no learning outcomes');
  await page.click('[data-rn="list"]');
  ok((await page.$$('.rn-item')).length === 2, 'two sets of notes in the library');
  await page.locator('.rn-item', { hasText: 'Criminal – mens rea' }).locator('[data-rn="delete"]').click();
  await page.click('#dialogButtons >> text=Delete'); await page.waitForTimeout(400);
  ok((await page.$$('.rn-item')).length === 1 && !(await page.evaluate(() => Object.keys(window.__mock.store).some(k => k.startsWith('rdoc/') && window.__mock.store[k].title === 'Criminal – mens rea'))), 'delete removes it from the library and storage');
  await page.keyboard.press('Escape');

  // 5. Backups include revision notes
  await page.click('#exportBtn'); await page.waitForFunction(() => window.__mock.saved && /backup/.test(window.__mock.saved.filename), null, { timeout: 10000 });
  ok(await page.evaluate(() => (JSON.parse(window.__mock.saved.data).rdocs || []).length === 1), 'backup includes revision notes');

  // 6. Browser-only mode (friends' edition / no claude.ai storage): saved in the browser
  const ctx2 = await b.newContext(); await route(ctx2);
  await ctx2.addInitScript({ path: path.join(T, 'sample_seed.js') }); await ctx2.addInitScript(() => { window.__noDb = true; }); await ctx2.addInitScript({ path: path.join(T, 'mockclaude.js') });
  const p2 = await ctx2.newPage(); await p2.goto('file://' + path.join(T, 'online_wrapped.html'));
  await p2.waitForSelector('#rnBtn'); await p2.waitForTimeout(500); await p2.evaluate(() => { window.__sampleDelay = 2; });
  await p2.evaluate(() => { const s = window.__mock.store; }); // sources aren't available without claude.ai storage, so add one by pasting
  await p2.click('#addNotesSideBtn'); await p2.waitForSelector('#ntPaste');
  await p2.fill('#ntTitle', 'Pasted tort notes');
  await p2.fill('#ntPaste', 'Negligence\n\nIn Donoghue v Stevenson a manufacturer owed a duty to the consumer. In Bolton v Stone the risk was tiny.');
  await p2.click('[data-nt="continue"]'); await p2.click('[data-nt="save-only"]'); await p2.waitForTimeout(600);
  await p2.waitForFunction(() => document.querySelector('#notesModal').hidden, null, { timeout: 8000 }).catch(() => {});
  await p2.click('#rnBtn'); await p2.click('[data-rn="new"]'); await p2.locator('[data-rnsrc]').first().check();
  await p2.click('[data-rn="go"]'); await p2.waitForSelector('.rn-doc', { timeout: 30000 });
  await p2.reload(); await p2.waitForSelector('#rnBtn'); await p2.waitForTimeout(800);
  ok(await p2.textContent('#rnCount') === '1', 'without claude.ai storage, notes are kept in the browser and survive a reload');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
