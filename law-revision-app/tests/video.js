// Explainer videos: pick a topic → ONE Claude request writes the script → coverage check fills gaps from the cards →
// hand-drawn scenes play in sync with the platform voice (tts) → saved, replayed for free; captions when there's no voice.
const { chromium } = require('playwright');
const path = require('path');
const { N } = require('./seedinfo');
const T = __dirname;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.route(/fonts\.googleapis|fonts\.gstatic/, r => r.abort());
  await ctx.addInitScript({ path: path.join(T, 'sample_seed.js') });
  await ctx.addInitScript({ path: path.join(T, 'mockclaude.js') });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(T, 'online_wrapped.html'));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('lawRevisionApp.migrated', '1'); }); await page.reload();
  await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await page.evaluate(() => { window.__sampleDelay = 2; window.__ttsLineMs = 400; });
  const calls = () => page.evaluate(() => window.__mock.calls.map(c => typeof c.input === 'string' ? c.input : '').filter(t => t.includes('EXPLAINER VIDEO SCRIPT')));

  // 1. Pick a topic
  ok(await page.textContent('#vdCount') === '0', 'sidebar has Explainer videos (0 so far)');
  await page.click('#vdBtn'); await page.waitForSelector('#vdModal:not([hidden])');
  ok((await page.textContent('#vdBody')).includes('No videos yet'), 'empty to start with');
  await page.click('[data-vd="new"]');
  ok(await page.isDisabled('[data-vd="make"]'), 'Make video waits for a topic');
  await page.selectOption('#vdTopic', 'contract|Promissory Estoppel');
  const poolTxt = await page.textContent('#vdPool');
  ok(/Made from 4 cards/.test(poolTxt) && /Combe v Combe/.test(poolTxt), 'shows which of your cards it will use: ' + poolTxt.slice(0, 60));
  await page.click('[data-vd="make"]');
  await page.waitForSelector('#vdStage svg', { timeout: 20000 });
  const ps = await calls();
  ok(ps.length === 1, 'ONE Claude request for the whole video');
  const p = ps[0];
  ok(/Cover EVERY card/.test(p) && /Never invent a case/.test(p) && /clearly made up/.test(p) && /tiny story/.test(p), 'prompt: only your cards, every card, cases as stories, the example clearly made up');
  ok(/friendly, engaging law tutor/.test(p) && /ELI5/.test(p) && /written exactly as spoken|exactly as spoken/.test(p), 'prompt: warm human tutor voice, written to be spoken');
  ok(/Combe v Combe/.test(p) && /quick refresher, 6-10 scenes/.test(p), 'cards and length are in the prompt');
  const call = await page.evaluate(() => window.__mock.calls.find(c => typeof c.input === 'string' && c.input.includes('EXPLAINER')).opts);
  ok(call.modelTier === 'default', 'uses the standard model tier (not the most expensive)');

  // 2. Coverage and accuracy checks
  const head = await page.textContent('.vd-head');
  console.log('   ' + head.replace(/\s+/g, ' ').trim());
  ok(/Covers 3 \+ 1 of 4 cards/.test(head) && /1 added by the coverage check/.test(head), 'the card the script left out was added by the coverage check');
  ok(/1 to check/.test(head) && !/2 to check/.test(head), 'a case not in your cards is counted for you to check');
  const v = await page.evaluate(() => { const st = window.__mock.store; const k = Object.keys(st).find(k => k.startsWith('video/')); return st[k]; });
  ok(v && v.scenes.length === 10 && v.scenes.some(s => s.auto && s.kind !== 'recap') && v.scenes[v.scenes.length - 1].kind === 'recap', 'saved to your claude.ai account; the added scene goes before the recap');
  const auto = v.scenes.find(s => s.auto);
  ok(/The rule:/.test(auto.narration) || /One more rule/.test(auto.narration), 'the added scene is built from your card: ' + auto.narration.slice(0, 70));
  ok(v.scenes.some(s => s.warn && s.warn.includes('Invented v Nobody')), 'the invented case is flagged on its scene');

  // 3. The drawing
  const strokes = await page.$$eval('#vdStage .vd-ink', l => l.length);
  ok(strokes > 20 && await page.$('#vdStage .vd-title'), 'title scene drawn by hand (' + strokes + ' strokes)');
  await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
  await page.screenshot({ path: path.join(T, 'vd_title.png'), clip: await page.$eval('#vdStage', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });

  // 4. Playing with the voice
  ok(/Tutor voice on/.test(await page.textContent('#vdCtl')) && await page.$('#vdVoice'), 'says the tutor voice is on, with a voice picker');
  await page.click('[data-vd="play"]');
  await page.waitForFunction(() => window.__mock.tts && window.__mock.tts.length === 1);
  const sp = await page.evaluate(() => window.__mock.tts[0]);
  ok(sp.lines.length === 10 && sp.lines[0].id === 's0' && sp.lines.every(l => l.len <= 2000 && l.voice === 'buttery'), 'one reading, a line per scene, in a natural Claude voice');
  await page.waitForFunction(() => /^3 \/ 10$/.test(document.querySelector('#vdStage svg text:last-of-type').textContent), null, { timeout: 5000 });
  ok(true, 'scenes change as the voice reaches each one');
  await page.click('[data-vd="pause"]');
  ok(await page.$('#vdStage.paused') && (await page.textContent('#vdCtl')).includes('Resume'), 'pause holds the voice and the drawing');
  const atPause = await page.textContent('#vdStage svg text:last-of-type'); await page.waitForTimeout(900);
  ok(atPause === await page.textContent('#vdStage svg text:last-of-type'), 'nothing moves while paused');
  await page.click('[data-vd="pause"]');
  await page.selectOption('#vdRate', '1.15');
  ok(await page.evaluate(() => window.__mock.rate === 1.15), 'speed control changes the pace');
  await page.click('.vd-dot[data-i="7"]');
  await page.waitForFunction(() => window.__mock.tts.length === 2);
  ok(await page.evaluate(() => window.__mock.tts[1].lines[0].id === 's7' && window.__mock.tts[1].lines.length === 3), 'clicking a scene plays from there');
  for (const i of [1, 2, 3, 4, 5, 6, 7, 8]) { // screenshots of each kind of scene, for checking the look
    await page.click('[data-vd="stop"]').catch(() => {}); await page.click('.vd-dot[data-i="' + i + '"]'); await page.waitForTimeout(150);
    await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
    await page.locator('#vdStage').screenshot({ path: path.join(T, 'vd_scene' + i + '.png') });
  }
  await page.click('[data-vd="stop"]').catch(() => {});
  await page.waitForFunction(() => !/Pause/.test(document.querySelector('#vdCtl').textContent));
  ok(true, 'stop ends the reading');
  ok((await page.textContent('#vdCap')).length > 10, 'captions show the words too');

  // 5. Replay costs nothing; reload keeps it
  await page.reload(); await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await page.waitForFunction(() => document.querySelector('#vdCount').textContent === '1', null, { timeout: 8000 });
  await page.click('#vdBtn'); await page.click('.rn-item [data-vd="open"]'); await page.waitForSelector('#vdStage svg');
  await page.click('[data-vd="play"]'); await page.waitForTimeout(600);
  ok((await calls()).length === 0, 'watching a saved video again uses no Claude requests');
  await page.click('[data-vd="stop"]');
  await page.keyboard.press('Escape');
  ok(await page.evaluate(() => document.querySelector('#vdModal').hidden), 'closing the window stops the video');

  // 6. A concept instead of a topic
  await page.click('#vdBtn'); await page.click('[data-vd="list"]').catch(() => {}); await page.click('[data-vd="new"]');
  await page.click('[data-vd="mode"][data-m="concept"]'); await page.fill('#vdConcept', 'acceptance');
  await page.waitForFunction(() => /Made from \d+ card/.test(document.querySelector('#vdPool').textContent));
  ok(/Hyde v Wrench|Felthouse|Adams v Lindsell|Entores/.test(await page.textContent('#vdPool')), 'typing a concept finds the matching cards');
  await page.keyboard.press('Escape');

  // 7. Backup
  await page.click('#exportBtn'); await page.waitForFunction(() => window.__mock.saved && /backup/.test(window.__mock.saved.filename), null, { timeout: 10000 });
  ok(await page.evaluate(() => (JSON.parse(window.__mock.saved.data).videos || []).length === 1), 'backup includes your videos');

  // 8. Where the voice isn't available (Safari, mobile apps, friends outside your organisation): captions, auto-advancing
  const ctx2 = await b.newContext(); await ctx2.route(/fonts\.googleapis|fonts\.gstatic/, r => r.abort());
  await ctx2.addInitScript({ path: path.join(T, 'sample_seed.js') }); await ctx2.addInitScript(() => {
    window.__noTts = true; window.__vdFast = 20; window.__vdAll = true; window.__said = [];
    // A stand-in for the device's own speech: each sentence "plays" for 20 ms.
    const q = []; let busy = false;
    const run = () => { if (busy || !q.length) return; busy = true; const u = q.shift(); window.__said.push(u.text); u.onstart && u.onstart(); setTimeout(() => { busy = false; u.onend && u.onend(); run(); }, 20); };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak: u => { q.push(u); run(); }, cancel: () => { q.length = 0; }, pause: () => {}, resume: () => {}, getVoices: () => [{ name: 'Daniel (Enhanced)', lang: 'en-GB', localService: true }, { name: 'Fred', lang: 'en-US', localService: true }] } });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  }); await ctx2.addInitScript({ path: path.join(T, 'mockclaude.js') });
  const q = await ctx2.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.goto('file://' + path.join(T, 'online_wrapped.html'));
  await q.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N);
  await q.evaluate(() => { window.__sampleDelay = 2; });
  await q.click('#vdBtn'); await q.click('[data-vd="new"]'); await q.selectOption('#vdTopic', 'contract|Promissory Estoppel'); await q.click('[data-vd="make"]');
  await q.waitForSelector('#vdStage svg', { timeout: 20000 });
  ok(/Covers 4 of 4 cards/.test(await q.textContent('.vd-head')), 'nothing added when the script covers every card');
  ok(/isn't offered in this view/.test(await q.textContent('#vdCtl')) && /Chrome or Edge on a computer/.test(await q.textContent('#vdCtl')) && !(await q.$('#vdVoice')), 'no Claude voice here: says so clearly and where it works');
  ok(!(await q.$('#vdDevice')), 'never switches to the robotic device voice');
  await q.click('[data-vd="play"]');
  await q.waitForFunction(() => /^3 \/ 9$/.test(document.querySelector('#vdStage svg text:last-of-type').textContent), null, { timeout: 8000 });
  ok(await q.isVisible('#vdCap'), 'plays with captions, moving through the scenes on its own');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
