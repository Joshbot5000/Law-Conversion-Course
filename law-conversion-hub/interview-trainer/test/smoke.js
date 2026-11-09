/*
 * Opens every page in Chromium and fails on any console error or page crash.
 * Run with the hub served locally:  python3 -m http.server 8765  (from law-conversion-hub)
 * then:  node test/smoke.js [base-url]
 */
'use strict';
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/interview-trainer/';

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const errors = [];
  for (const scheme of ['light', 'dark']) {
    for (const vp of [{ width: 1366, height: 820 }, { width: 390, height: 844 }]) {
      const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme });
      const page = await ctx.newPage();
      page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_NAME_NOT_RESOLVED|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(scheme + ' ' + vp.width + ' console: ' + m.text()); });
      page.on('pageerror', e => errors.push(scheme + ' ' + vp.width + ' pageerror: ' + e.message));
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      for (const hash of ['#/', '#/progress', '#/bank', '#/firms', '#/firm/mishcon', '#/firm/baker', '#/learn', '#/settings', '#/interview', '#/report/nope']) {
        await page.evaluate(h => { location.hash = h; }, hash);
        await page.waitForTimeout(150);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 1) errors.push(scheme + ' ' + vp.width + ' ' + hash + ' horizontal overflow ' + overflow + 'px');
        const txt = await page.evaluate(() => document.body.innerText);
        if (/undefined|NaN|\[object Object\]/.test(txt)) errors.push(scheme + ' ' + vp.width + ' ' + hash + ' shows undefined/NaN');
      }
      await ctx.close();
    }
  }
  await browser.close();
  if (errors.length) { console.log(Array.from(new Set(errors)).join('\n')); process.exit(1); }
  console.log('Smoke test passed: every page, light and dark, laptop and phone widths.');
})().catch(e => { console.error(e); process.exit(1); });
