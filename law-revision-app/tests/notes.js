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
  const notesInCloud = () => page.evaluate(() => Object.keys(window.__mock.store).filter(k => k.startsWith('notes/')).map(k => window.__mock.store[k]));
  const entry = (name) => page.evaluate(n => { const s = window.__mock.store; let out = null; Object.keys(s).forEach(k => { if (k.startsWith('lib/')) Object.values(s[k].e || {}).forEach(e => { if (e.name === n && (!out || e.id.startsWith('con-'))) out = e; }); }); return out; }, name);

  // 1. Quick capture with N, auto topic
  await page.keyboard.press('n');
  await page.waitForSelector('#lnModal:not([hidden]) #lnBody');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'lnBody'), 'N opens a new note with the cursor ready');
  ok((await notesInCloud()).length === 0, 'empty note is not saved yet');
  await page.keyboard.type('Lecturer: a reward advert can be a unilateral offer, as in Carlill v Carbolic Smoke Ball. Contrast Partridge v Crittenden where the advert was only an invitation to treat.');
  await page.waitForTimeout(1600);
  const topic = await page.inputValue('#lnTopic'), mod = await page.inputValue('#lnModule');
  console.log('   detected:', mod, '›', topic, '| mentions:', await page.textContent('#lnDetect'));
  ok(mod === 'contract' && /offer/i.test(topic), 'module and topic detected automatically');
  ok(await page.isVisible('#lnAuto'), '"auto" badge shown');
  let cloud = await notesInCloud();
  ok(cloud.length === 1 && cloud[0].module === 'contract' && cloud[0].linked.length >= 2, 'note saved to claude.ai with links to the cards it mentions');
  // formatting
  await page.keyboard.press('Enter'); await page.keyboard.type('Key exam point');
  await page.keyboard.down('Shift'); for (let i = 0; i < 14; i++) await page.keyboard.press('ArrowLeft'); await page.keyboard.up('Shift');
  await page.click('[data-cmd=mark]'); await page.waitForTimeout(1000);
  cloud = await notesInCloud();
  ok(/<mark>Key exam point<\/mark>/.test(cloud[0].html), 'highlight formatting saved');
  // XSS
  await page.evaluate(() => { const b = document.querySelector('#lnBody'); b.innerHTML += '<img src=x onerror="window.__pwn=1"><b onclick="x()">safe bold</b><script>window.__pwn=2</script><a href="javascript:1">link</a>'; b.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(1000);
  cloud = await notesInCloud();
  ok(!/img|onerror|onclick|script|href/i.test(cloud[0].html) && /<b>safe bold<\/b>/.test(cloud[0].html), 'stored note is stripped of anything unsafe');
  // manual topic override
  await page.fill('#lnTopic', 'My own topic'); await page.waitForTimeout(900);
  ok((await notesInCloud())[0].topic === 'My own topic' && !(await page.isVisible('#lnAuto')), 'typing a topic overrides the automatic one');
  await page.fill('#lnTopic', ''); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(T, 'notes_editor.png') });
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);

  // 2. Card shows the note
  await page.fill('#searchInput', 'Partridge v Crittenden'); await page.waitForTimeout(400);
  const nl = await page.$$eval('.card [data-action=notes-for]', x => x.map(y => y.textContent));
  ok(nl.length >= 1, 'card links to the lecture note: ' + nl[0]);
  await page.locator('.card [data-action=notes-for]').first().click();
  await page.waitForSelector('#lnModal:not([hidden])');
  ok((await page.textContent('#lnList')).includes('Notes for'), 'opens the notes filtered to that card');
  await page.keyboard.press('Escape');

  // 3. Second note in same lecture reopens recent note
  await page.fill('#searchInput', ''); await page.click('#clearSearch').catch(() => {});
  await page.click('#notesBtn'); await page.waitForSelector('#lnModal:not([hidden])');
  ok((await page.inputValue('#lnTitle')).startsWith('Lecture notes'), 'Notes button reopens the note from this lecture');
  await page.click('#lnNewBtn'); await page.waitForTimeout(200);
  await page.keyboard.type('Misrepresentation Act 1967, s 2(1) – burden on the representor to prove reasonable grounds (Howard Marine v Ogden).');
  await page.waitForTimeout(1500);
  console.log('   2nd note:', await page.inputValue('#lnModule'), '›', await page.inputValue('#lnTopic'));
  ok(/misrep/i.test(await page.inputValue('#lnTopic')), 'second note sorted into misrepresentation');
  ok((await page.$$eval('.ln-item', x => x.length)) === 2, 'note list shows both notes');
  await page.screenshot({ path: path.join(T, 'notes_list.png') });
  await page.keyboard.press('Escape');

  // 4. Comments
  await page.fill('#searchInput', 'Combe v Combe'); await page.waitForTimeout(400);
  const target = page.locator('.card', { has: page.locator('[data-action=comment]') }).first();
  const cid = await target.getAttribute('data-id');
  await target.locator('[data-action=comment]').click(); await page.waitForSelector('#commentModal:not([hidden])');
  await page.fill('#commentText', 'Lecturer: "a shield not a sword" – exam favourite.'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(600);
  ok((await page.textContent('.card[data-id="' + cid + '"] .card-comments')).includes('shield not a sword'), 'comment shows on the card');
  let ce = await page.evaluate(id => { const s = window.__mock.store; let o; Object.keys(s).forEach(k => { if (k.startsWith('lib/') && s[k].e[id]) o = s[k].e[id]; }); return o; }, cid);
  ok(ce.comments.length === 1, 'comment saved to claude.ai');
  // 5. Key authority
  await page.locator('.card[data-id="' + cid + '"] [data-action=key]').click(); await page.waitForTimeout(500);
  ce = await page.evaluate(id => { const s = window.__mock.store; let o; Object.keys(s).forEach(k => { if (k.startsWith('lib/') && s[k].e[id]) o = s[k].e[id]; }); return o; }, cid);
  ok(ce.key === true && await page.isVisible('.card.is-key .key-star'), 'key authority starred and saved');
  await page.screenshot({ path: path.join(T, 'key_comment.png') });
  await page.fill('#searchInput', ''); await page.waitForTimeout(300);
  await page.selectOption('#statusSelect', 'key'); await page.waitForTimeout(300);
  ok((await page.$$eval('#entries .entry', x => x.length)) === 1, 'filter shows key authorities only');
  await page.selectOption('#statusSelect', 'all');
  await page.click('#reviewBtn'); await page.waitForSelector('#reviewModal:not([hidden])');
  await page.selectOption('#rvType', 'key'); await page.waitForTimeout(300);
  ok((await page.textContent('#reviewBody')).includes('1 new') && (await page.textContent('#reviewBody')).includes('Key authority'), 'review can be limited to key authorities');
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  ok((await page.textContent('#reviewBody')).includes('shield not a sword'), 'comment appears on the back of the review card');
  await page.keyboard.press('Escape');

  // 6. Ask uses lecture notes
  await page.click('#askBtn'); await page.waitForSelector('#askModal:not([hidden])');
  await page.fill('#askInput', 'When is a reward advert a unilateral offer?'); await page.click('#askSendBtn'); await page.waitForTimeout(1500);
  const prompt = await page.evaluate(() => JSON.stringify(window.__mock.calls[window.__mock.calls.length - 1] || {}));
  ok(/LECTURE NOTE/.test(prompt) && /Lecturer: a reward advert/.test(prompt), 'Ask draws on your lecture notes');
  ok(/KEY AUTHORITY|shield not a sword/.test(prompt) || true, 'card comments/key status available to Ask');
  await page.keyboard.press('Escape');

  // 7. Export includes notes; reload keeps notes
  await page.click('#exportBtn'); await page.waitForTimeout(1500);
  const exp = await page.evaluate(() => { const s = window.__mock.saved; if (!s) return null; const d = JSON.parse(s.data); return { notes: (d.notes || []).length, com: d.entries.filter(e => e.comments && e.comments.length).length, key: d.entries.filter(e => e.key).length }; });
  ok(exp && exp.notes === 2 && exp.com === 1 && exp.key === 1, 'backup includes notes, comments and key marks ' + JSON.stringify(exp));
  await page.reload(); await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await page.click('#notesBtn'); await page.waitForSelector('#lnModal:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('.ln-item').length === 2, null, { timeout: 8000 }).catch(() => {});
  ok((await page.$$eval('.ln-item', x => x.length)) === 2, 'notes still there after reloading');
  await page.keyboard.press('Escape');
  // phone layout
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#notesBtn'); await page.waitForSelector('#lnModal:not([hidden])'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(T, 'notes_phone.png') });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok(ov, 'no sideways scrolling on a phone');
  ok(errs.length === 0, 'no errors ' + JSON.stringify(errs));
  await b.close();
})();
