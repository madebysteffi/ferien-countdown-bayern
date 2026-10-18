// Dependency-free lifecycle tests: node --test tests/*.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const workerSource = fs.readFileSync(path.join(__dirname, '../service-worker.js'), 'utf8');
const updateSource = fs.readFileSync(path.join(__dirname, '../pwa-update.js'), 'utf8');
const scope = 'https://example.test/ferien-countdown-bayern/';

function worker() {
  const handlers = {};
  const stored = new Map();
  const deleted = [];
  const state = { skipped: false, claimed: false, failInstall: false, requests: [] };
  const cache = {
    async addAll(requests) {
      state.requests = requests;
      if (state.failInstall) throw Error('download failed');
    },
    async put(key, response) { stored.set(typeof key === 'string' ? key : key.url, response); },
    async match(key) { return stored.get(typeof key === 'string' ? key : key.url); }
  };
  const context = {
    self: { registration: { scope }, location: { origin: 'https://example.test' },
      addEventListener: (type, fn) => handlers[type] = fn,
      skipWaiting: async () => state.skipped = true,
      clients: { claim: async () => state.claimed = true } },
    caches: { open: async () => cache,
      keys: async () => ['ferien-countdown-v3', 'unrelated-app', `ferien-countdown:${scope}:v3`, `ferien-countdown:${scope}:v4`],
      delete: async name => deleted.push(name) },
    fetch: async (...args) => { state.fetchArgs = args; return state.response || new Response('fresh'); },
    URL, Request, Response, AbortController, setTimeout, clearTimeout, console
  };
  vm.runInNewContext(workerSource, context);
  return { handlers, state, context, stored, deleted };
}
async function lifecycle(w, type) {
  let work;
  w.handlers[type]({ waitUntil: promise => work = promise });
  await work;
}
function request(w, file, mode = 'cors', destination = 'script') {
  let response;
  w.handlers.fetch({ request: { method: 'GET', url: scope + file, mode, destination },
    respondWith: promise => response = promise });
  return response;
}

test('complete fresh precache before skipWaiting; failed install keeps old worker', async () => {
  const w = worker();
  await lifecycle(w, 'install');
  assert.equal(w.state.skipped, true);
  assert.equal(w.state.requests.length, 6);
  assert.ok(w.state.requests.every(r => r.cache === 'reload'));
  const failed = worker();
  failed.state.failInstall = true;
  await assert.rejects(lifecycle(failed, 'install'));
  assert.equal(failed.state.skipped, false);
});

test('activation only removes app caches and claims clients', async () => {
  const w = worker();
  await lifecycle(w, 'activate');
  assert.deepEqual(w.deleted, ['ferien-countdown-v3', `ferien-countdown:${scope}:v3`]);
  assert.equal(w.state.claimed, true);
});

test('HTML, CSS and JS revalidate HTTP cache, then update offline copy', async () => {
  for (const [file, mode, destination] of [['', 'navigate', 'document'], ['style.css', 'cors', 'style'], ['script.js', 'cors', 'script']]) {
    const w = worker();
    const response = await request(w, file, mode, destination);
    assert.equal(await response.text(), 'fresh');
    assert.equal(w.state.fetchArgs[1].cache, 'no-cache');
    assert.equal(await w.stored.get(scope + (file || 'index.html')).text(), 'fresh');
  }
});

test('offline and HTTP errors use working cache without overwriting it', async () => {
  for (const status of [null, 404, 503]) {
    const w = worker();
    w.stored.set(scope + 'index.html', new Response('offline shell'));
    if (status) w.state.response = new Response('error', { status });
    else w.context.fetch = async () => { throw Error('offline'); };
    assert.equal(await (await request(w, '?homescreen=1', 'navigate', 'document')).text(), 'offline shell');
  }
});

test('missing CSS/JS never receive cached HTML; unrelated navigations bypass worker', async () => {
  const w = worker();
  w.stored.set(scope + 'index.html', new Response('<html>'));
  w.context.fetch = async () => { throw Error('offline'); };
  assert.equal((await request(w, 'missing.js')).type, 'error');
  assert.equal(request(w, 'README.md', 'navigate', 'document'), undefined);
});

test('storage write failure does not prevent online rendering', async () => {
  const w = worker();
  w.context.caches.open = async () => ({ put: async () => { throw Error('quota'); } });
  w.context.console = { warn() {} };
  assert.equal(await (await request(w, 'script.js')).text(), 'fresh');
});

function page(controlled = true) {
  const events = {};
  const state = { reloads: 0, checks: 0, now: 120000 };
  const on = target => (type, fn) => events[target + ':' + type] = fn;
  const registration = { async update() { state.checks++; } };
  const navigator = { onLine: true, serviceWorker: {
    controller: controlled ? {} : null, addEventListener: on('sw'),
    async register(url, options) { state.options = options; return registration; }
  } };
  const document = { visibilityState: 'visible', readyState: 'complete', addEventListener: on('document') };
  vm.runInNewContext(updateSource, { navigator, document,
    window: { addEventListener: on('window'), location: { reload: () => state.reloads++ } },
    Date: { now: () => state.now }, console });
  return { events, state, document, navigator, registration };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('registration bypasses worker HTTP cache; first claim does not reload', async () => {
  const p = page(false);
  await settle();
  assert.equal(p.state.options.updateViaCache, 'none');
  p.events['sw:controllerchange']();
  assert.equal(p.state.reloads, 0);
});

test('real controller update reloads once; hidden pages defer until visible', () => {
  const p = page();
  p.document.visibilityState = 'hidden';
  p.events['sw:controllerchange']();
  assert.equal(p.state.reloads, 0);
  p.document.visibilityState = 'visible';
  p.events['document:visibilitychange']();
  p.events['sw:controllerchange']();
  p.events['window:pageshow']();
  assert.equal(p.state.reloads, 1);
});

test('foreground/pageshow/online checks are throttled; offline failures are safe', async () => {
  const p = page();
  await settle();
  assert.equal(p.state.checks, 1);
  p.events['window:pageshow']();
  p.events['window:online']();
  await settle();
  assert.equal(p.state.checks, 1);
  p.state.now += 60000;
  p.navigator.onLine = false;
  p.events['document:visibilitychange']();
  await settle();
  assert.equal(p.state.checks, 1);
  p.navigator.onLine = true;
  p.events['window:online']();
  await settle();
  assert.equal(p.state.checks, 2);
  assert.equal(p.state.reloads, 0);
});

test('stalled network aborts after five seconds and returns offline shell', async () => {
  const w = worker();
  let delay;
  w.context.setTimeout = (callback, milliseconds) => {
    delay = milliseconds;
    return setTimeout(callback, 0);
  };
  w.context.fetch = (request, { signal }) => new Promise((resolve, reject) =>
    signal.addEventListener('abort', () => reject(Error('timeout'))));
  w.stored.set(scope + 'index.html', new Response('offline shell'));
  assert.equal(await (await request(w, '', 'navigate', 'document')).text(), 'offline shell');
  assert.equal(delay, 5000);
});

test('unsupported service workers leave the app running', () => {
  assert.doesNotThrow(() => vm.runInNewContext(updateSource, { navigator: {} }));
});
