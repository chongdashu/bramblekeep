import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { configuredDeployment } from '../analytics/deployments.mjs';
import { devAnalyticsPlugin } from '../analytics/dev-vite.mjs';

const config = { web: { site: 'https://fixture-dev.convex.site' }, wavedash: { productionSite: 'https://fixture-live.convex.site' } };
const header = { 'X-Bramblekeep-Dev': '1' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('development and live reports resolve their own deployments', () => {
  assert.equal(configuredDeployment(config, 'live'), 'fixture-live');
  for (const traffic of ['playtest', 'test', 'unknown', 'all']) assert.equal(configuredDeployment(config, traffic), 'fixture-dev');
  assert.equal(configuredDeployment({ web: { site: 'https://fixture-dev.convex.site.evil.test' } }, 'all'), undefined);
  assert.equal(configuredDeployment({ web: { site: 'https://fixture-dev.convex.site/path' } }, 'all'), undefined);
});

test('the dev report bridge is local, same-origin, bounded, and preserves the environment filter', async () => {
  let handler, failure = false, pending = false, wasAborted = false, calls = [];
  const plugin = devAnalyticsPlugin({
    loadConfig: () => config,
    runReport: async ({ deployment, args, signal }) => {
      calls.push({ deployment, args });
      if (failure) throw new Error('private diagnostics must not reach the browser');
      if (pending) await new Promise(resolve => signal.addEventListener('abort', () => { wasAborted = true; resolve(); }, { once: true }));
      return { ...args, traffic: args.traffic, build: args.build ?? 'all', sessions: 3 };
    },
  });
  assert.equal(plugin.apply, 'serve');
  plugin.configureServer({ middlewares: { use(prefix, fn) { assert.equal(prefix, '/__dev/player-kpis'); handler = fn; } } });
  const server = createServer((req, res) => {
    if (!req.url.startsWith('/__dev/player-kpis')) { res.writeHead(404).end(); return; }
    req.url = req.url.slice('/__dev/player-kpis'.length); void handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/__dev/player-kpis`;
  const get = (path, headers = header) => fetch(`${base}${path}`, { headers });
  try {
    assert.equal((await get('/report', {})).status, 403);
    assert.equal((await get('/report', { ...header, Origin: 'https://attacker.example' })).status, 403);
    assert.equal((await get('/report', { ...header, 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    const guardedStatus = (address, host) => new Promise(resolve => {
      const req = { socket: { remoteAddress: address }, headers: { host, 'x-bramblekeep-dev': '1' }, method: 'GET', url: '/report' };
      const res = { setHeader() {}, end() { resolve(this.statusCode); } };
      void handler(req, res);
    });
    assert.equal(await guardedStatus('127.0.0.1', 'attacker.example'), 403);
    assert.equal(await guardedStatus('192.0.2.1', '127.0.0.1:5173'), 403);
    assert.equal((await fetch(`${base}/report`, { method: 'POST', headers: header })).status, 405);
    for (const query of ['traffic=other', 'days=0', 'days=31', 'days=1.5', 'build=bad%3Bcommand', 'days=7&days=1', 'unexpected=yes']) {
      assert.equal((await get(`/report?${query}`)).status, 400, query);
    }
    const live = await get('/report?traffic=live&days=1&build=release-42');
    assert.equal(live.status, 200); assert.equal(live.headers.get('cache-control'), 'no-store');
    assert.equal((await live.json()).sessions, 3);
    assert.equal(calls.at(-1).deployment, 'fixture-live');
    assert.equal(calls.at(-1).args.until - calls.at(-1).args.since, 86_400_000);
    assert.equal(calls.at(-1).args.build, 'release-42');
    const dev = await get('/report?traffic=all&days=7');
    assert.equal(dev.status, 200); assert.equal(calls.at(-1).deployment, 'fixture-dev');
    assert.equal(calls.at(-1).args.traffic, 'all');
    failure = true;
    const failed = await get('/report?traffic=playtest');
    assert.equal(failed.status, 502); assert.ok(!(await failed.text()).includes('private diagnostics'));
    failure = false; pending = true;
    const controller = new AbortController();
    // Use an actual abortable request to verify a closed browser request stops the query.
    const separate = fetch(`${base}/report?traffic=playtest`, { headers: header, signal: controller.signal }).catch(() => {});
    await sleep(50); controller.abort(); await separate;
    for (let i = 0; i < 20 && !wasAborted; i++) await sleep(25);
    assert.equal(wasAborted, true); pending = false;
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
