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
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('crash', () => console.log('   PAGE CRASHED'));
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
  ok((await page.$$('.vd-sty')).length === 6, 'six styles to choose from');
  await page.click('.vd-sty[data-s="papercraft"]');
  await page.selectOption('#vdTopic', 'contract|Promissory Estoppel');
  const poolTxt = await page.textContent('#vdPool');
  ok(/will teach <b>4 cards<\/b>|will teach 4 cards/.test(poolTxt) && /Combe v Combe/.test(poolTxt), 'shows which of your cards it will use: ' + poolTxt.slice(0, 60));
  await page.click('[data-vd="make"]');
  await page.waitForSelector('#vdStage svg', { timeout: 20000 });
  const ps = await calls();
  ok(ps.length === 1, 'ONE Claude request for the whole video');
  const p = ps[0];
  ok(/Cover every on-topic card/.test(p) && /never invent a case/.test(p) && /clearly made up/.test(p) && /say every case.s name aloud/.test(p), 'prompt: only your cards, every on-topic card, the example clearly made up');
  ok(/Rule second, understanding first/.test(p) && /everyday analogy/.test(p) && /when the rule does not apply/.test(p), 'prompt: builds understanding first, analogies, and the edges of each rule');
  ok(/Calm and unhurried/.test(p) && /QUIZ CHECK-INS: exactly 1/.test(p) && /how that law applies to the made-up example/.test(p) && /never give the answer away/.test(p), 'prompt: calm, warm tutor; a quiz check-in applying the law to the example');
  ok(/outstanding law lecturer/.test(p) && /broad and deep command/.test(p) && /write for the ear/.test(p) && /WHY the court decided/.test(p) && /misconceptions/.test(p) && /THINK FIRST/.test(p), 'prompt: an expert teacher who explains the why, plans first, flags misconceptions');
  ok(/STAY ON TOPIC/.test(p) && /offTopic/.test(p), 'prompt: stays strictly on the topic and lists any off-topic cards');
  ok(/Combe v Combe/.test(p) && /500-650 words of narration in total/.test(p), 'cards and a word budget (about 4-5 minutes) are in the prompt');
  const call = await page.evaluate(() => window.__mock.calls.find(c => typeof c.input === 'string' && c.input.includes('EXPLAINER')).opts);
  ok(call.modelTier === 'default', 'uses the standard model tier (not the most expensive)');

  ok(await page.$('#vdStage.vd-st-papercraft'), 'the video opens in the style you chose');
  await page.selectOption('#vdStyle', 'whiteboard');
  ok(/about \d+ min \+ 1 quiz check-in/.test(await page.textContent('.vd-head')), 'running time leaves out the quiz check-in, which is listed separately');
  // 2. Coverage and accuracy checks
  const head = await page.textContent('.vd-head');
  console.log('   ' + head.replace(/\s+/g, ' ').trim());
  ok(/Covers 3 \+ 1 of 4 cards/.test(head) && /1 added by the coverage check/.test(head), 'the card the script left out was added by the coverage check');
  ok(/1 to check/.test(head) && !/2 to check/.test(head), 'a case not in your cards is counted for you to check');
  const v = await page.evaluate(() => { const st = window.__mock.store; const k = Object.keys(st).find(k => k.startsWith('video/')); return st[k]; });
  ok(v && v.scenes.length === 11 && v.scenes.some(s => s.auto && s.kind !== 'recap') && v.scenes[v.scenes.length - 1].kind === 'recap', 'saved to your claude.ai account; the added scene goes before the recap');
  const auto = v.scenes.find(s => s.auto);
  ok(/the rule it gives us/.test(auto.narration) || /One more rule/.test(auto.narration), 'the added scene is built from your card: ' + auto.narration.slice(0, 70));
  ok(v.scenes.some(s => s.warn && s.warn.includes('Invented v Nobody')), 'the invented case is flagged on its scene');

  // 3. The drawing
  const strokes = await page.$$eval('#vdStage .vd-ink', l => l.length);
  ok(strokes > 20 && await page.$('#vdStage .vd-title'), 'title scene drawn by hand (' + strokes + ' strokes)');
  await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
  await page.screenshot({ path: path.join(T, 'vd_title.png'), clip: await page.$eval('#vdStage', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });

  // 4. Playing with the voice
  ok(/Tutor voice on/.test(await page.textContent('#vdCtl')) && await page.$('#vdVoice'), 'says the tutor voice is on, with a voice picker');
  await page.click('[data-vd="play"]');
  await page.waitForFunction(() => window.__mock.tts && window.__mock.tts.length >= 2);
  const sp = await page.evaluate(() => ({ lines: window.__mock.tts.flatMap(t => t.lines), opts: window.__mock.tts[0].opts, first: window.__mock.tts[0].lines.map(l => l.id), added: window.__mock.tts[1].added }));
  ok(sp.first[0] === 's0_0' && sp.first.every(id => /^s0_/.test(id)) && sp.added && sp.lines.every(l => l.len <= 300 && l.voice === 'buttery'), 'the Claude voice gets a scene at a time, each in short breaths');
  ok(sp.opts.rate === 0.78, 'starts at a calm tutor pace (0.78)');
  await page.waitForFunction(() => /^3 \/ 11$/.test(document.querySelector('#vdStage .vd-count').textContent), null, { timeout: 8000 });
  ok(true, 'scenes change as the voice reaches each one');
  await page.click('[data-vd="pause"]');
  ok(await page.$('#vdStage.paused') && (await page.textContent('#vdCtl')).includes('Resume'), 'pause holds the voice and the drawing');
  const atPause = await page.textContent('#vdStage .vd-count'); await page.waitForTimeout(900);
  ok(atPause === await page.textContent('#vdStage .vd-count'), 'nothing moves while paused');
  await page.click('[data-vd="pause"]');
  await page.selectOption('#vdRate', '0.88');
  ok(await page.evaluate(() => window.__mock.rate === 0.88), 'speed control changes the pace');
  await page.click('.vd-dot[data-i="8"]');
  await page.waitForFunction(() => window.__mock.tts.filter(t => !t.added).length === 2);
  await page.waitForTimeout(700);
  ok(/Pause/.test(await page.textContent('#vdCtl')) && await page.evaluate(() => window.claude && true), 'jumping to another scene keeps the Pause button working (the old reading ending is ignored)');
  await page.click('#vdStage');
  ok(await page.$('#vdStage.paused') && /Resume/.test(await page.textContent('#vdCtl')), 'clicking the picture pauses');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => { const st = document.querySelector('#vdStage'); return document.getAnimations().filter(a => a.effect && a.effect.target && st.contains(a.effect.target) && a.playState === 'running' && getComputedStyle(a.effect.target).animationPlayState !== 'paused').length === 0; }), 'while paused, nothing on the picture keeps drawing');
  await page.keyboard.press('Space');
  ok(!(await page.$('#vdStage.paused')) && /Pause/.test(await page.textContent('#vdCtl')), 'the space bar resumes');
  ok(await page.evaluate(() => window.__mock.tts.filter(t => !t.added)[1].lines[0].id === 's8_0'), 'clicking a scene plays from there');
  for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 9]) { // screenshots of each kind of scene, for checking the look
    await page.click('[data-vd="stop"]', { timeout: 1500 }).catch(() => {}); await page.click('.vd-dot[data-i="' + i + '"]'); await page.waitForTimeout(150);
    await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
    await page.locator('#vdStage').screenshot({ path: path.join(T, 'vd_scene' + i + '.png') });
  }
  // 4a. A video longer than the voice will take in one go still plays: it's fed a scene or two at a time
  await page.click('[data-vd="stop"]', { timeout: 1500 }).catch(() => {});
  await page.evaluate(() => { window.__ttsMaxChars = 600; window.__ttsLineMs = 60; window.__mock.tts = []; window.__mock.ttsRefused = 0; });
  await page.click('.vd-dot[data-i="0"]'); await page.click('[data-vd="play"]');
  await page.waitForSelector('#vdAsk:not([hidden]) .vd-ask-opt', { timeout: 20000 });
  ok(/^8 \/ 11$/.test(await page.textContent('#vdStage .vd-count')) && !/Pause/.test(await page.textContent('#vdCtl')), 'the video stops at the quiz check-in and waits for you');
  ok(/Priya now sues Sam/.test(await page.textContent('#vdAsk')) && (await page.$$('.vd-ask-opt')).length === 3, 'the question applies the law to the made-up example, with options to choose from');
  const ttsBefore = await page.evaluate(() => window.__mock.tts.length);
  await page.click('.vd-ask-opt[data-o="0"]');
  ok(await page.$('.vd-ask-opt.wrong[data-o="0"]') && await page.$('.vd-ask-opt.right[data-o="1"]') && /Not quite/.test(await page.textContent('.vd-ask-fb')) && /Combe v Combe/.test(await page.textContent('.vd-ask-fb')), 'a wrong answer is marked, the right one shown, with the reason');
  await page.waitForFunction(n => window.__mock.tts.length > n, ttsBefore);
  ok(await page.evaluate(n => window.__mock.tts[n].lines[0].len > 20, ttsBefore), 'the tutor reads out the explanation');
  await page.click('[data-vd="cont"]');
  ok(await page.evaluate(() => document.querySelector('#vdAsk').hidden) && /^9 \/ 11$/.test(await page.textContent('#vdStage .vd-count')), 'Continue carries on from the next scene');
  await page.waitForFunction(() => /Play again/.test(document.querySelector('#vdCtl').textContent), null, { timeout: 20000 });
  const fed = await page.evaluate(() => ({ calls: window.__mock.tts.length, refused: window.__mock.ttsRefused, ids: window.__mock.tts.flatMap(t => t.lines.map(l => l.id)) }));
  ok(fed.refused === 0 && fed.calls >= 5 && [...Array(11).keys()].every(i => fed.ids.includes('s' + i + '_0')), 'a long video plays to the end, fed to the voice a scene or two at a time (' + fed.calls + ' calls, none refused)');
  await page.evaluate(() => { window.__ttsMaxChars = 40; window.__mock.ttsRefused = 0; });
  await page.click('.vd-dot[data-i="8"]'); await page.click('[data-vd="play"]');
  await page.waitForFunction(() => window.__mock.ttsRefused > 0, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  ok(/Pause/.test(await page.textContent('#vdCtl')), 'if the voice refuses a part anyway, the video keeps going with captions instead of getting stuck');
  await page.click('[data-vd="stop"]', { timeout: 1500 }).catch(() => {});
  await page.evaluate(() => { window.__ttsMaxChars = 0; window.__ttsLineMs = 400; });
  // 4c. Ask about the video: free search of all cards, then an optional small tutor answer
  await page.click('[data-vd="stop"]', { timeout: 1500 }).catch(() => {});
  const calls0 = await page.evaluate(() => window.__mock.calls.length);
  await page.fill('#vdChatQ', 'can a promise be used as a sword to sue?'); await page.press('#vdChatQ', 'Enter');
  await page.waitForSelector('.vd-chat-card');
  ok(/Combe v Combe/.test(await page.textContent('#vdChatOut')) && await page.evaluate(n => window.__mock.calls.length === n, calls0), 'the chat finds the right card across your library, for free');
  await page.click('[data-vd="chatask"]'); await page.waitForSelector('.vd-chat-ans');
  const chatCall = await page.evaluate(() => window.__mock.calls.at(-1));
  ok(/shield, not a sword/.test(await page.textContent('.vd-chat-ans')) && chatCall.opts.modelTier === 'quick' && /Combe v Combe/.test(chatCall.input) && /What you were just saying/.test(chatCall.input), 'Explain it to me: one small request using only those cards and what the video was saying');
  // 4b. Styles: any style, switched while watching, at no cost
  const before = (await calls()).length;
  for (const st of ['watercolour', 'papercraft', 'anime', 'retro', 'chalkboard', 'whiteboard']) {
    await page.click('[data-vd="stop"]', { timeout: 2000 }).catch(() => {});
    await page.selectOption('#vdStyle', st);
    for (const i of [1, 3, 8]) {
      await page.click('.vd-dot[data-i="' + i + '"]'); await page.waitForTimeout(80);
      await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
      await page.locator('#vdStage').screenshot({ path: path.join(T, 'vd_' + st + i + '.png') });
    }
  }
  const html = await page.evaluate(() => { const out = {}; for (const st of ['anime', 'retro', 'watercolour', 'papercraft', 'chalkboard']) { const sel = document.querySelector('#vdStyle'); sel.value = st; sel.dispatchEvent(new Event('change', { bubbles: true })); out[st] = document.querySelector('#vdStage').innerHTML; } return out; });
  ok(/url\(#vdSky\)/.test(html.anime) && /url\(#vdHt\d\)/.test(html.retro) && /url\(#vdWash\)/.test(html.watercolour) && /url\(#vdSh\)/.test(html.papercraft) && /url\(#vdChalk\)/.test(html.chalkboard), 'six styles: whiteboard, watercolour, papercraft, anime, retro print, chalkboard');
  ok((await calls()).length === before, 'switching style costs nothing');
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('lawRevisionApp.v1.videoPrefs')).style === 'chalkboard'), 'remembers your style');
  await page.selectOption('#vdStyle', 'whiteboard');
  await page.click('[data-vd="stop"]', { timeout: 1500 }).catch(() => {});
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
  await page.click('[data-vd="play"]', { timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400);
  await page.click('.vd-dot[data-i="4"]'); await page.waitForTimeout(500);
  const stopsBefore = await page.evaluate(() => window.__mock.ttsStops || 0);
  await page.keyboard.press('Escape');
  ok(await page.evaluate(() => document.querySelector('#vdModal').hidden), 'closing the window closes the video');
  ok(await page.evaluate(n => (window.__mock.ttsStops || 0) > n, stopsBefore), 'closing the window always stops the voice, even after jumping scenes');

  // 6. A concept instead of a topic
  await page.click('#vdBtn'); await page.click('[data-vd="list"]').catch(() => {}); await page.click('[data-vd="new"]');
  await page.click('[data-vd="mode"][data-m="concept"]'); await page.fill('#vdConcept', 'acceptance');
  await page.waitForFunction(() => /will teach \d+ card/.test(document.querySelector('#vdPool').textContent));
  ok(/Hyde v Wrench|Felthouse|Adams v Lindsell|Entores/.test(await page.textContent('#vdPool')), 'typing a concept finds the matching cards');
  await page.fill('#vdConcept', 'misrepresentation act');
  await page.waitForTimeout(500);
  const mis = await page.$$eval('[data-vdcard]', l => l.map(x => x.closest('label').textContent));
  ok(mis.length === 3 && mis.every(t => /Misrepresentation/.test(t)) && !mis.some(t => /Jackson|Parliament|Theft/.test(t)), '"misrepresentation act" finds only the misrepresentation cards (not the Parliament Acts or other Acts): ' + mis.length);
  await page.uncheck('[data-vdcard]:first-of-type'); await page.waitForTimeout(100);
  ok(/will teach 2 cards/.test(await page.textContent('#vdPool')), 'you can untick a card to leave it out');
  await page.keyboard.press('Escape');

  // 7. Backup
  await page.click('#exportBtn'); await page.waitForFunction(() => window.__mock.saved && /backup/.test(window.__mock.saved.filename), null, { timeout: 10000 });
  ok(await page.evaluate(() => (JSON.parse(window.__mock.saved.data).videos || []).length === 1), 'backup includes your videos');

  // 7a. More kinds of picture: diagrams, scales, timelines, overlapping circles; people in case panels
  await page.evaluate(() => { window.__vdKinds = true; });
  await page.click('#vdBtn'); await page.click('[data-vd="list"]', { timeout: 1500 }).catch(() => {}); await page.click('[data-vd="new"]');
  await page.click('[data-vd="mode"][data-m="topic"]'); await page.click('[data-vd="len"][data-l="quick"]'); await page.selectOption('#vdTopic', 'contract|Promissory Estoppel'); await page.click('[data-vd="make"]');
  await page.waitForSelector('#vdStage svg', { timeout: 20000 });
  for (const st of ['whiteboard', 'anime']) { await page.selectOption('#vdStyle', st); for (const i of [2, 3, 4, 5, 6, 8]) { await page.click('.vd-dot[data-i="' + i + '"]'); await page.waitForTimeout(60); await page.evaluate(() => document.getAnimations().forEach(a => a.finish())); await page.locator('#vdStage').screenshot({ path: path.join(T, 'vd_kind_' + st + i + '.png') }); } }
  ok(await page.$$eval('#vdStage .vd-ink', l => l.length) > 30, 'diagrams, scales, timelines and overlapping circles are drawn');
  await page.evaluate(() => { window.__vdKinds = false; });
  await page.keyboard.press('Escape');
  // 7b. A full lesson that comes back over 12 minutes is tightened (one extra request, only then)
  await page.evaluate(() => { window.__vdLong = true; window.__mock.calls = []; window.__mock.shortened = 0; });
  await page.click('#vdBtn'); await page.click('[data-vd="list"]', { timeout: 1500 }).catch(() => {}); await page.click('[data-vd="new"]');
  await page.click('[data-vd="mode"][data-m="topic"]'); await page.click('[data-vd="len"][data-l="full"]'); await page.selectOption('#vdTopic', 'contract|Promissory Estoppel'); await page.click('[data-vd="make"]');
  await page.waitForSelector('#vdStage svg', { timeout: 20000 });
  const fp = (await calls())[0];
  ok(/1,150-1,400 words/.test(fp) && /not counting quiz scenes \(never more than 1,400\)/.test(fp) && /QUIZ CHECK-INS: 2 or 3 \(never more\)/.test(fp), 'full lesson: 12-minute budget (quizzes not counted) and 2-3 quiz check-ins');
  const mins = +/about (\d+) min/.exec(await page.textContent('.vd-head'))[1];
  ok(await page.evaluate(() => window.__mock.shortened === 1 && window.__mock.calls.filter(c => typeof c.input === 'string' && /EXPLAINER VIDEO (SCRIPT|SHORTEN)/.test(c.input)).length === 2) && mins <= 12, 'a script over 12 minutes is tightened before you see it (now about ' + mins + ' min)');
  await page.evaluate(() => { window.__vdLong = false; });
  await page.keyboard.press('Escape');
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
  await q.waitForFunction(() => /^3 \/ 10$/.test(document.querySelector('#vdStage .vd-count').textContent), null, { timeout: 8000 });
  ok(await q.isVisible('#vdCap'), 'plays with captions, moving through the scenes on its own');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
