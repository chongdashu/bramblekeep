// Exercise the dev-only player KPI view with disposable, intercepted reports.
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';

const port = await new Promise((resolve, reject) => {
  const probe = createServer(); probe.on('error', reject);
  probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(() => resolve(value)); });
});
const origin = `http://127.0.0.1:${port}`;
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  env: { ...process.env, VITE_BRAMBLEKEEP_ANALYTICS_TEST: '' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '', chrome, cdp, failure = false, delayedLive = false;
const requests = [];
vite.stdout.on('data', chunk => { output += chunk; }); vite.stderr.on('data', chunk => { output += chunk; });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function report(query) {
  const traffic = query.get('traffic'), build = query.get('build') || 'all', now = Date.now(), production = traffic === 'live';
  return {
    since: now - 86_400_000, until: now, traffic, build, truncated: false,
    sessions: production ? 12 : 22, pageLoads: production ? 10 : 18, playedSessions: production ? 5 : 7, uniquePlayers: production ? 3 : 6,
    completedSessions: 4, incompleteSessions: 8, medianCompletedSessionMs: 65_000, medianObservedActivePlayMs: 20_344.5,
    titleShown: 9, menuShown: 8, playClicked: 7, heroSelected: 6, firstMove: 4, firstAttack: 3,
    gateBreachedEligibleSessions: 2, gateEligibleSessions: 5, castleClearedEligibleSessions: 1, clearEligibleSessions: 4,
    joinedWithGateOpen: 1, joinedAfterClear: 0, enemyDefeats: 14, playerDefeated: 2, connectionLost: 1,
    joinFailures: 1, loadFailures: 0, unexpectedErrors: 0,
    features: { worldStatus: 1, settings: 2, pause: 3, scores: 4, chatOpened: 1, chatSent: 1, profileOpened: 2, profileEditAttempted: 1 },
  };
}
async function openDebug(page) {
  await page.waitFor("!!document.querySelector('#dbg-toggle')", 30000, 'debug panel');
  await page.evalJS("if(document.querySelector('#dbg').hidden)document.querySelector('#dbg-toggle').click()");
  await page.waitFor("!![...document.querySelectorAll('#dbg button')].find(e=>e.textContent==='Player KPIs')", 5000, 'player KPI action');
  await page.evalJS("[...document.querySelectorAll('#dbg button')].find(e=>e.textContent==='Player KPIs').click()");
  await page.waitFor("!!document.querySelector('.player-kpis-overlay:not([hidden]) .player-kpis-card')", 10000, 'player KPI report');
}
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) break; } catch {}
    if (vite.exitCode !== null || i === 99) throw new Error(`Dev server failed: ${output}`);
    await sleep(100);
  }
  chrome = await launchChrome(); cdp = await connect(chrome.wsUrl);
  const [target] = await cdp.pages(), page = await cdp.attach(target.targetId);
  await page.S('Runtime.enable'); await page.S('Page.enable');
  await page.S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await page.S('Fetch.enable', { patterns: [{ urlPattern: `${origin}/__dev/player-kpis/report*` }] });
  page.on('Fetch.requestPaused', event => {
    void (async () => {
      const url = new URL(event.request.url), query = url.searchParams;
      requests.push({ traffic: query.get('traffic'), days: query.get('days'), build: query.get('build'), headers: event.request.headers });
      if (query.get('traffic') === 'live' && delayedLive) await sleep(500);
      const status = failure ? 502 : 200, body = failure ? { error: 'Fixture report unavailable.' } : report(query);
      await page.S('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: btoa(JSON.stringify(body)) }).catch(() => {});
    })();
  });
  await page.S('Page.navigate', { url: `${origin}/?capture=1` });
  await openDebug(page);
  let text = await page.evalJS("document.querySelector('.player-kpis-content').textContent");
  for (const expected of ['Production · live Wavedash', 'Page loads', 'Sessions that played', 'Unique players', 'Median session length', 'Median active play', 'First movement', 'First attack', 'Gate breached', 'Castle cleared', 'Feature use', 'Join failures']) if (!text.includes(expected)) throw new Error(`Missing ${expected}`);
  if (!text.includes('1m 5s') || !text.includes('20s')) throw new Error('Session medians were not displayed');
  if (requests[0]?.traffic !== 'live' || requests[0]?.days !== '7' || !Object.keys(requests[0].headers).some(key => key.toLowerCase() === 'x-bramblekeep-dev')) throw new Error('Production request did not use the local-only bridge');

  await page.evalJS("(()=>{const e=document.querySelector('#player-kpis-traffic');e.value='playtest';e.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await page.waitFor("document.querySelector('.player-kpis-status').textContent.includes('Development · Wavedash playtests')", 5000, 'playtest report');
  await page.evalJS("(()=>{const e=document.querySelector('#player-kpis-days');e.value='1';e.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await page.waitFor("!!document.querySelector('.player-kpis-card') && document.querySelector('.player-kpis-status').textContent.includes('Development')", 5000, 'one-day report');
  await page.evalJS("document.querySelector('#player-kpis-build').value='release-42';[...document.querySelectorAll('.player-kpis-filters button')].find(e=>e.textContent==='Refresh').click()");
  await page.waitFor("document.querySelector('.player-kpis-status').textContent.includes('build release-42')", 5000, 'build filter');
  if (!requests.some(r => r.traffic === 'playtest' && r.days === '1' && r.build === 'release-42')) throw new Error('Filter values did not reach the report');

  // A slow earlier response must not replace a newer environment selection.
  delayedLive = true;
  await page.evalJS("(()=>{const e=document.querySelector('#player-kpis-traffic');e.value='live';e.dispatchEvent(new Event('change',{bubbles:true}));e.value='all';e.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await page.waitFor("document.querySelector('.player-kpis-status').textContent.includes('Development · all traffic')", 5000, 'development report');
  await sleep(650);
  if (!await page.evalJS("document.querySelector('.player-kpis-status').textContent.includes('Development · all traffic')")) throw new Error('An old report overwrote a newer selection');
  delayedLive = false;

  failure = true;
  await page.evalJS("[...document.querySelectorAll('.player-kpis-filters button')].find(e=>e.textContent==='Refresh').click()");
  await page.waitFor("document.querySelector('.player-kpis-error')?.textContent.includes('Fixture report unavailable')", 5000, 'report failure');
  failure = false;
  await page.evalJS("[...document.querySelectorAll('.player-kpis-filters button')].find(e=>e.textContent==='Refresh').click()");
  await page.waitFor("!!document.querySelector('.player-kpis-card')", 5000, 'report retry');
  await page.evalJS("document.querySelector('#player-kpis-build').value='a'.repeat(100);[...document.querySelectorAll('.player-kpis-filters button')].find(e=>e.textContent==='Refresh').click()");
  await page.waitFor("document.querySelector('.player-kpis-status').textContent.includes('build '+ 'a'.repeat(100))", 5000, 'long build label');
  for (const [width, height] of [[390, 844], [320, 640], [800, 360]]) {
    await page.S('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const bounds = await page.evalJS("(()=>{const e=document.querySelector('.player-kpis-dialog'),r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}})()");
    if (bounds.left < 0 || bounds.top < 0 || bounds.right > width || bounds.bottom > height || bounds.scrollWidth > bounds.clientWidth) throw new Error(`KPI dialog does not fit ${width}x${height}: ${JSON.stringify(bounds)}`);
  }
  await page.S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await page.S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await page.waitFor("document.querySelector('.player-kpis-overlay').hidden", 5000, 'Escape closes KPIs');

  await page.S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await page.S('Page.navigate', { url: `${origin}/?scene=gym&capture=1` });
  await openDebug(page);
  if (!await page.evalJS("[...document.querySelectorAll('#dbg button')].some(e=>e.textContent==='Toggle bounds')")) throw new Error('Scene debug actions were replaced');
  console.log('Player KPI debug passed: environment, window and build filters, medians, events, stale responses, failure/retry, responsive layouts, Escape and scene actions.');
} finally {
  if (cdp) await cdp.close(); if (chrome) await chrome.close(); vite.kill('SIGTERM');
}
