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
  const cloudEntry = name => page.evaluate(n => { const s = window.__mock.store; let out = null; Object.keys(s).forEach(k => { if (k.startsWith('lib/')) Object.values(s[k].e || {}).forEach(e => { if (e.name === n) out = e; }); }); return out; }, name);
  const select = (id, str) => page.evaluate(([id, str]) => {
    const ed = document.getElementById(id); ed.focus();
    const w = document.createTreeWalker(ed, 4); let n;
    while ((n = w.nextNode())) { const i = n.nodeValue.indexOf(str); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + str.length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; } }
    return false;
  }, [id, str]);

  await page.fill('#searchInput', 'Donoghue v Stevenson'); await page.waitForTimeout(400);
  const card = page.locator('.card.entry', { hasText: 'Donoghue v Stevenson' }).first();
  const name = (await card.locator('.card-title, h3').first().textContent()).trim();
  await page.fill('#searchInput', ''); await page.waitForTimeout(300);
  const before = await cloudEntry(name);
  console.log('   card:', name);
  await page.fill('#searchInput', name); await page.waitForTimeout(400);
  await page.locator('.card.entry', { hasText: name }).first().locator('[data-action="edit"]').click();
  await page.waitForSelector('#entryModal:not([hidden]) #rtBar .rt-btn');
  ok((await page.textContent('#fRatio')).trim() === before.ratio.replace(/\s+$/, '').trim() || (await page.evaluate(() => document.getElementById('fRatio').innerText)).trim() === before.ratio.trim(), 'existing rule loads into the editor unchanged');
  ok(await page.isVisible('#rtBar'), 'formatting toolbar shown');

  // Bold, italic, underline, strikethrough via toolbar and keyboard
  const words = before.ratio.split(/\s+/);
  const w1 = words.slice(0, 2).join(' '), w2 = words.slice(3, 5).join(' '), w3 = words.slice(6, 8).join(' ');
  await select('fRatio', w1); await page.click('[data-rt="bold"]');
  ok(await page.getAttribute('[data-rt="bold"]', 'aria-pressed') === 'true', 'Bold button shows as on');
  await select('fRatio', w2); await page.keyboard.press('Control+i');
  await select('fRatio', w3); await page.click('[data-rt="underline"]');
  // Highlight: default yellow, then choose green from the palette
  await select('fFacts', (await page.evaluate(() => document.getElementById('fFacts').innerText)).split(/\s+/).slice(0, 3).join(' '));
  await page.click('[data-rt="hl"]');
  const factsW = (await page.evaluate(() => document.getElementById('fFacts').innerText)).split(/\s+/).slice(4, 6).join(' ');
  await select('fFacts', factsW);
  await page.click('[data-rt-open="rtHlPal"]'); ok(await page.isVisible('#rtHlPal'), 'highlighter colour palette opens');
  await page.click('#rtHlPal [data-v="green"]');
  ok(await page.isHidden('#rtHlPal'), 'palette closes after choosing');
  // Text colour red, strikethrough
  const sW = (await page.evaluate(() => document.getElementById('fStrategy').innerText)).split(/\s+/).slice(0, 2).join(' ');
  if (sW) { await select('fStrategy', sW); await page.click('[data-rt-open="rtTcPal"]'); await page.click('#rtTcPal [data-v="red"]'); }
  // A bullet list typed at the end of the strategy
  await page.evaluate(() => { const ed = document.getElementById('fStrategy'); ed.focus(); const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await page.keyboard.press('Enter'); await page.click('[data-rt="insertUnorderedList"]');
  await page.keyboard.type('First exam point'); await page.keyboard.press('Enter'); await page.keyboard.type('Second exam point');
  await page.click('#saveEntryBtn'); await page.waitForTimeout(800);

  const after = await cloudEntry(name);
  console.log('   fmt.ratio:', after.fmt && after.fmt.ratio.slice(0, 200));
  console.log('   fmt.facts:', after.fmt && after.fmt.facts.slice(0, 200));
  ok(after.fmt && /<b>[^<]*<\/b>/.test(after.fmt.ratio) && /<i>/.test(after.fmt.ratio) && /<u>/.test(after.fmt.ratio), 'bold, italic and underline saved to claude.ai');
  ok(after.fmt.facts && /<mark class="hl-yellow">/.test(after.fmt.facts) && /<mark class="hl-green">/.test(after.fmt.facts), 'yellow and green highlights saved');
  if (sW) ok(/<span class="tc-red">/.test(after.fmt.strategy), 'red text saved');
  ok(/<ul><li>First exam point<\/li><li>Second exam point<\/li><\/ul>/.test(after.fmt.strategy), 'bullet list saved');
  ok(after.ratio === before.ratio.trim(), 'plain rule text unchanged (search, Ask and quizzes still use it)');
  ok(/• First exam point\n• Second exam point/.test(after.strategy), 'plain strategy includes the bullets');
  ok(!/style=|on\w+=/.test(JSON.stringify(after.fmt)), 'no inline styles or scripts stored');

  // Displayed on the card
  await page.fill('#searchInput', ''); await page.fill('#searchInput', name); await page.waitForTimeout(400);
  const c2 = page.locator('.card.entry', { hasText: name }).first();
  await c2.click({ position: { x: 20, y: 20 } }).catch(() => {});
  const html = await c2.innerHTML();
  ok(/<b>/.test(html) && /mark class="hl-green"/.test(html) && /<ul><li>/.test(html), 'formatting shown on the card');
  const bg = await c2.locator('mark.hl-green').first().evaluate(el => getComputedStyle(el).backgroundColor);
  ok(bg === 'rgb(166, 231, 160)', 'green highlighter colour rendered: ' + bg);
  ok(/mark class="hit"/.test(html), 'search terms still highlighted inside formatted text');

  // Re-open: formatting comes back, editing again keeps it
  await c2.locator('[data-action="edit"]').click(); await page.waitForSelector('#entryModal:not([hidden])'); await page.waitForTimeout(150);
  const edHtml = await page.innerHTML('#fFacts');
  ok(/background-color/.test(edHtml), 'highlights reload into the editor');
  // Remove the green highlight
  await select('fFacts', factsW); console.log('   editor:', await page.innerHTML('#fFacts'), await page.evaluate(() => String(getSelection()))); await page.click('[data-rt-open="rtHlPal"]'); await page.click('#rtHlPal [data-rt="hl-none"]');
  await page.click('#saveEntryBtn'); await page.waitForTimeout(800);
  let e3 = await cloudEntry(name); console.log('   after none:', e3.fmt.facts);
  ok(!/hl-green/.test(e3.fmt.facts) && /hl-yellow/.test(e3.fmt.facts), '"No highlight" removes just that highlight');

  // Clear formatting removes everything from a selection
  await page.locator('.card.entry', { hasText: name }).first().locator('[data-action="edit"]').click(); await page.waitForSelector('#entryModal:not([hidden])'); await page.waitForTimeout(150);
  await page.evaluate(() => { const ed = document.getElementById('fRatio'); ed.focus(); const r = document.createRange(); r.selectNodeContents(ed); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  console.log('   sel before clear:', (await page.evaluate(() => String(getSelection()))).slice(0,60), await page.evaluate(() => document.activeElement.id)); await page.click('[data-rt="clear"]'); console.log('   ed after clear:', (await page.innerHTML('#fRatio')).slice(0,200));
  await page.click('#saveEntryBtn'); await page.waitForTimeout(800);
  e3 = await cloudEntry(name);
  console.log('   after clear:', e3.fmt.ratio && e3.fmt.ratio.slice(0,300)); ok(!e3.fmt.ratio, 'Clear formatting leaves plain text (fmt.ratio removed)');
  ok(e3.ratio === before.ratio.trim(), 'and the words are unchanged');

  // Pasting from Word keeps bold / highlight, strips anything unsafe
  await page.locator('.card.entry', { hasText: name }).first().locator('[data-action="edit"]').click(); await page.waitForSelector('#entryModal:not([hidden])'); await page.waitForTimeout(150);
  await page.evaluate(() => { const ed = document.getElementById('fRatio'); ed.focus(); const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const dt = new DataTransfer(); dt.setData('text/html', '<!--StartFragment--><p class=MsoNormal><b>Pasted bold</b> <span style="background:yellow;mso-highlight:yellow">pasted hl</span> <img src=x onerror="window.__pwn=1"><a href="javascript:alert(1)">link</a><script>window.__pwn=2</script></p>'); dt.setData('text/plain', 'Pasted bold pasted hl link');
    ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await page.click('#saveEntryBtn'); await page.waitForTimeout(800);
  e3 = await cloudEntry(name);
  ok(/<b>Pasted bold<\/b>/.test(e3.fmt.ratio) && /hl-yellow">pasted hl/.test(e3.fmt.ratio), 'paste from Word keeps bold and highlight');
  ok(!/img|script|href|onerror/.test(e3.fmt.ratio) && !(await page.evaluate(() => window.__pwn)), 'pasted HTML is made safe');

  // Tampered stored data is sanitised on load
  await page.evaluate(n => { const s = window.__mock.store; Object.keys(s).forEach(k => { if (k.startsWith('lib/')) Object.values(s[k].e || {}).forEach(e => { if (e.name === n) e.fmt.ratio = e.fmt.ratio + '<img src=x onerror="window.__pwn=3"><b onclick="x()">X</b>'; }); }); }, name);
  await page.reload(); await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await page.fill('#searchInput', name); await page.waitForTimeout(500);
  ok(!(await page.evaluate(() => window.__pwn)) && !/onerror|onclick/.test(await page.innerHTML('#cards, main')), 'tampered formatting cannot run code');

  // Review shows formatting
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await page.screenshot({ path: path.join(T, 'rich_card.png') });
  await b.close();
})();
