// Optional browser integration test: npm install --no-save --package-lock=false playwright
// Then: node tests/pwa-browser.cjs (requires an installed Chromium).
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const base = '/ferien-countdown-bayern/';
let version = 'v4';
let failScript = false;
let legacy = true;
const originalHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const originalWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const server = http.createServer((req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(base.length) || 'index.html';
  if (!req.url.startsWith(base) || file.includes('..')) { res.writeHead(404).end(); return; }
  if (failScript && file === 'script.js') { res.writeHead(503).end('unavailable'); return; }
  let data;
  if (file === 'service-worker.js' && legacy) {
    data = `const NAME='ferien-countdown-v3';
      self.addEventListener('install',e=>e.waitUntil(caches.open(NAME).then(c=>c.addAll(['./','./index.html','./style.css','./script.js'])).then(()=>self.skipWaiting())));
      self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
      self.addEventListener('fetch',e=>{if(e.request.method==='GET')e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});`;
  } else if (file === 'service-worker.js') data = originalWorker.replace('"v4"', JSON.stringify(version));
  else if (file === 'index.html') data = legacy ? originalHtml.replace('<script src="pwa-update.js"></script>', '<script>navigator.serviceWorker.register("./service-worker.js")</script>') : originalHtml;
  else { try { data = fs.readFileSync(path.join(root, file)); } catch { res.writeHead(404).end(); return; } }
  const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : file.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000' });
  res.end(data);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}${base}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-10-18T12:00:00Z'));
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    assert.equal(await page.locator('#days').innerText(), '12');
    await page.evaluate(() => caches.open('unrelated-app'));
    legacy = false;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.waitForFunction(async () => (await caches.keys()).some(n => n.endsWith(':v4')) && !(await caches.keys()).includes('ferien-countdown-v3'));
    // The old HTML had no controllerchange handler. Its next navigation loads the new lifecycle code.
    await page.reload();
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration()).updateViaCache === 'none');
    assert.equal(await page.locator('#days').innerText(), '12');
    assert.ok(await page.evaluate(async () => (await caches.keys()).includes('unrelated-app')));
    console.log('PASS: migration from legacy v3 despite long HTTP cache lifetime');

    await context.setOffline(true);
    await page.reload();
    assert.equal(await page.locator('#days').innerText(), '12');
    assert.ok((await page.locator('#countdownDetails').innerText()).includes('Schultage'));
    console.log('PASS: offline shell, styles, scripts and countdown after migration');
    await context.setOffline(false);

    let navigations = 0;
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
    const nextLoad = page.waitForEvent('load');
    version = 'v5';
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.waitForFunction(async () => {
      const names = await caches.keys();
      return names.some(n => n.endsWith(':v5')) && !names.some(n => n.endsWith(':v4'));
    });
    await nextLoad;
    await page.waitForTimeout(300);
    assert.equal(navigations, 1);
    assert.equal(await page.locator('#days').innerText(), '12');
    console.log('PASS: next release activates and reloads exactly once');

    version = 'v6'; failScript = true;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.waitForTimeout(800);
    const activeScript = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return fetch(reg.active.scriptURL, { cache: 'reload' }).then(r => r.text());
    });
    // Fetching the URL sees v6; active worker still serves requests from the v5 cache.
    assert.ok(activeScript.includes('v6'));
    await context.setOffline(true);
    await page.reload();
    assert.equal(await page.locator('#days').innerText(), '12');
    assert.ok(await page.evaluate(async () => (await caches.keys()).some(n => n.endsWith(':v5'))));
    console.log('PASS: failed future installation retains working offline app');
    await context.setOffline(false);
    failScript = false;
    const recoveryLoad = page.waitForEvent('load');
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.waitForFunction(async () => !(await caches.keys()).some(n => n.endsWith(':v5')));
    await recoveryLoad;
    await context.setOffline(true);
    await page.reload();
    assert.equal(await page.locator('#days').innerText(), '12');
    assert.deepEqual(errors, []);
    console.log('PASS: failed release retries successfully and remains offline-capable');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
