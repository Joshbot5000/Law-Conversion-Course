// Phone voice: where the Claude voice isn't offered, a neural voice (Kokoro) runs on the device. Served here from an https
// address with claude.ai's exact content security policy, the model files next to the page under tts/ (libs/phone-voice),
// and onnxruntime-web + phonemizer from local copies of their jsDelivr files.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { N } = require('./seedinfo');
const T = __dirname, LIBS = path.join(T, '..', 'libs');
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net/npm/ https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: blob: https://fonts.gstatic.com; media-src 'self' data: blob:; connect-src 'self' blob: https://fonts.googleapis.com https://fonts.gstatic.com; worker-src 'self' blob:";
if (!fs.existsSync(path.join(LIBS, 'phone-voice', 'manifest.json'))) { console.log('skip: libs/phone-voice is missing (see scripts/fetch_libs.sh)'); process.exit(0); }
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  let served = 0;
  await ctx.route(/fonts\.g/, r => r.abort());
  // (routes registered later take priority, so the catch-all goes first)
  await ctx.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, r => r.abort());
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/(onnxruntime-web@1\.20\.1|phonemizer@1\.2\.1)\/dist\/(.+)$/, r => {
    const m = /npm\/(onnxruntime-web|phonemizer)@([\d.]+)\/dist\/(.+)$/.exec(r.request().url());
    r.fulfill({ path: path.join(LIBS, m[1] + '-' + m[2], 'dist', m[3]), contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } });
  });
  await ctx.route('https://app.test/**', r => {
    const u = new URL(r.request().url());
    if (u.pathname === '/app/index.html') return r.fulfill({ path: path.join(T, 'online_wrapped.html'), contentType: 'text/html', headers: { 'content-security-policy': CSP } });
    const m = /^\/app\/tts\/(.+)$/.exec(u.pathname);
    if (m && fs.existsSync(path.join(LIBS, 'phone-voice', m[1]))) { served++; return r.fulfill({ path: path.join(LIBS, 'phone-voice', m[1]), contentType: m[1].endsWith('.json') ? 'application/json' : 'application/wasm' }); }
    r.fulfill({ status: 404, body: '' });
  });
  await ctx.addInitScript({ path: path.join(T, 'sample_seed.js') });
  await ctx.addInitScript(() => { window.__noTts = true; });
  await ctx.addInitScript({ path: path.join(T, 'mockclaude.js') });
  const page = await ctx.newPage(); const errs = [], csp = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /Content Security Policy/.test(m.text())) csp.push(m.text().slice(0, 200)); });
  await page.goto('https://app.test/app/index.html');
  await page.waitForFunction(n => document.querySelector('#statTotal').textContent === String(n), N, { timeout: 15000 });
  await page.evaluate(() => { window.__sampleDelay = 2; window.__vdAll = true; });
  await page.click('#vdBtn'); await page.click('[data-vd="new"]'); await page.selectOption('#vdTopic', 'contract|Promissory Estoppel'); await page.click('[data-vd="make"]');
  await page.waitForSelector('#vdStage svg', { timeout: 20000 });
  await page.waitForSelector('[data-vd="pvon"]', { timeout: 8000 });
  ok(/isn.t offered on this device/.test(await page.textContent('#vdCtl')), 'no Claude voice here: offers the phone voice instead');
  const t0 = Date.now();
  await page.click('[data-vd="pvon"]');
  await page.waitForFunction(() => /Phone voice on/.test(document.querySelector('#vdCtl').textContent) || /couldn.t start/.test(document.querySelector('#vdCtl').textContent), null, { timeout: 180000 });
  const note = await page.textContent('#vdCtl');
  console.log('   ready after ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s; files served: ' + served);
  ok(/Phone voice on/.test(note), 'the phone voice downloads and starts under claude.ai\'s security rules ' + (/couldn.t start/.test(note) ? note.slice(0, 300) : ''));
  ok(csp.length === 0, 'nothing blocked by the security policy ' + csp.join(' | '));
  ok(await page.$('#vdPVoice'), 'voice picker: Emma, George, Heart');
  // Make and play the first two scenes, timing how long the audio takes to make.
  await page.evaluate(() => {
    window.__played = []; const AC = window.AudioContext;
    const orig = AC.prototype.createBufferSource;
    AC.prototype.createBufferSource = function () { const s = orig.call(this); const st = s.start.bind(s); s.start = (...a) => { window.__played.push({ at: Date.now(), secs: s.buffer.duration, rms: Math.sqrt(s.buffer.getChannelData(0).reduce((x, y) => x + y * y, 0) / s.buffer.length) }); return st(...a); }; return s; };
  });
  const p0 = Date.now();
  await page.click('[data-vd="play"]');
  await page.waitForFunction(() => window.__played.length >= 3, null, { timeout: 180000 });
  const played = await page.evaluate(() => window.__played);
  const first = (played[0].at - p0) / 1000;
  console.log('   first audio after ' + first.toFixed(1) + ' s; pieces: ' + played.map(p => p.secs.toFixed(1) + 's rms ' + p.rms.toFixed(3)).join(', '));
  ok(played.every(p => p.secs > 0.5 && p.rms > 0.01), 'real speech is played (not silence)');
  ok(/^[2-4] \/ 10$/.test(await page.textContent('#vdStage .vd-count')), 'the picture follows the voice (' + await page.textContent('#vdStage .vd-count') + ')');
  ok(/Preparing the voice for this video|Voice ready for the whole video/.test(await page.textContent('#vdCtl')), 'shows how much of the video\'s voice is prepared');
  await page.click('#vdStage');
  ok(await page.evaluate(() => window.__pvState = document.querySelector('#vdStage').classList.contains('paused')), 'pause works with the phone voice');
  await page.click('#vdStage');
  await page.keyboard.press('Escape');
  const n = await page.evaluate(() => window.__played.length); await page.waitForTimeout(2500);
  ok(await page.evaluate(n => window.__played.length === n, n), 'closing the window stops the phone voice');
  // Replays use the saved audio: no waiting.
  await page.click('#vdBtn'); await page.waitForSelector('#vdStage svg');
  const r0 = Date.now(); await page.click('[data-vd="play"]');
  await page.waitForFunction(n => window.__played.length > n, n, { timeout: 30000 });
  const again = (await page.evaluate(() => window.__played.at(-1).at)) - r0;
  console.log('   replay started after ' + (again / 1000).toFixed(2) + ' s');
  ok(again < 1500, 'a replay starts at once (audio kept on the device)');
  await page.keyboard.press('Escape');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
