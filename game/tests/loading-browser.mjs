// The title stays usable while online-only artwork loads, including a failed
// first request and an immediate retry from the hero picker.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const endpoint = (process.env.VITE_COLYSEUS_URL ?? 'https://world.up.railway.app').replace(/\/$/, '');
const port = await new Promise((resolve, reject) => {
  const probe = createServer(); probe.on('error', reject);
  probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(() => resolve(value)); });
});
const server = spawn(process.execPath, ['scripts/serve-release.mjs', 'wavedash', '--port', String(port), '--isolated'], { stdio: ['ignore', 'pipe', 'pipe'] });
let output = '', chrome, cdp;
server.stdout.on('data', value => { output += value; }); server.stderr.on('data', value => { output += value; });
try {
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/__misses`)).ok) break; } catch {}
    if (server.exitCode !== null || i === 149) throw new Error(`release server failed: ${output}`);
    await sleep(100);
  }
  chrome = await launchChrome(); cdp = await connect(chrome.wsUrl);
  const [target] = await cdp.pages(), page = await cdp.attach(target.targetId);
  let held = '', blockedOnce = false; const remote = [], errors = [];
  page.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description ?? event.exceptionDetails.text));
  await page.S('Page.enable'); await page.S('Runtime.enable');
  await page.S('Page.addScriptToEvaluateOnNewDocument', { source: `window.__wd={ready:0};window.Wavedash={init:()=>{window.__wd.ready++;return true},updateLoadProgressZeroToOne:()=>{},getUserJwt:async()=>({success:true,data:'test-token'}),getUsername:()=>'Test'};` });
  await page.S('Fetch.enable', { patterns: [{ urlPattern: '*assets/enemies/stump-animated.glb*' }, { urlPattern: `${endpoint}/*` }, { urlPattern: 'https://*.convex.site/*' }] });
  page.on('Fetch.requestPaused', event => {
    const url = event.request.url;
    if (url.includes('/assets/enemies/stump-animated.glb') && !blockedOnce) { blockedOnce = true; held = event.requestId; return; }
    if (url.startsWith(`${endpoint}/`) || new URL(url).hostname.endsWith('.convex.site')) {
      remote.push(url);
      void page.S('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 503, responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: `http://127.0.0.1:${port}` }, { name: 'Content-Type', value: 'application/json' }], body: btoa('{}') }).catch(() => {});
    } else void page.S('Fetch.continueRequest', { requestId: event.requestId }).catch(() => {});
  });
  await page.S('Page.navigate', { url: `http://127.0.0.1:${port}/builds/bramblekeep/` });
  await page.waitFor("window.__wd?.ready===1 && !!document.querySelector('#press-start') && !document.querySelector('#press-start').hidden", 60000, 'title before online artwork');
  for (let i = 0; i < 150 && !held; i++) await sleep(100);
  if (!held) throw new Error('online artwork did not start in the background');
  await page.evalJS("document.querySelector('#press-start').click()");
  await page.waitFor("document.body.dataset.phase==='menu'", 15000, 'menu during artwork loading');
  await page.evalJS("document.querySelector('#menu [data-act=play]').click()");
  await page.waitFor("!!document.querySelector('.multiplayer-join:not([hidden])')", 15000, 'hero picker during artwork loading');
  await page.evalJS("document.querySelector('[data-class=Knight]').click()");
  await page.waitFor("document.querySelector('.multiplayer-message').textContent.includes('Preparing the castle')", 10000, 'early join waits for artwork');
  if (remote.some(url => url.endsWith('/health'))) throw new Error('join reached the server before its artwork was ready');
  await page.S('Fetch.fulfillRequest', { requestId: held, responseCode: 503, body: btoa('unavailable') });
  await page.waitFor("document.querySelector('.multiplayer-message').textContent.includes('castle artwork could not load') && !document.querySelector('[data-class=Knight]').disabled", 15000, 'artwork failure can be retried');
  await page.evalJS("document.querySelector('[data-class=Knight]').click()");
  for (let i = 0; i < 450 && !remote.some(url => url.endsWith('/health')); i++) await sleep(100);
  if (!remote.some(url => url === `${endpoint}/health`)) throw new Error('retry did not finish loading and contact the server');
  await page.waitFor("document.querySelector('.multiplayer-message').textContent.includes('Could not reach the castle server')", 15000, 'server failure after retry');
  const misses = await (await fetch(`http://127.0.0.1:${port}/__misses`)).json();
  if (misses.length || errors.length) throw new Error(`asset misses or runtime exceptions: ${JSON.stringify({ misses, errors })}`);
  console.log('Loading browser passed: title and menu before online artwork; early join waits; failed artwork can be retried.');
} finally {
  if (cdp) await cdp.close(); if (chrome) await chrome.close(); server.kill('SIGTERM');
}
