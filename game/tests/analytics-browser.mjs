// Boot, play, pause and opt out against a disposable local sink and world.
import { createServer } from 'node:http';
import { createServer as createSocketServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';

const events = [], clientContentTypes = new Set(), key = randomBytes(32).toString('hex'), data = mkdtempSync(join(tmpdir(), 'analytics-world-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const receiver = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  if (req.method !== 'POST' || !['/events/client', '/events/server'].includes(req.url)) { res.writeHead(404).end(); return; }
  if (req.url === '/events/client') clientContentTypes.add(req.headers['content-type']);
  if (req.url === '/events/server' && req.headers.authorization !== `Bearer ${key}`) { res.writeHead(401).end(); return; }
  const chunks = []; req.on('data', chunk => chunks.push(chunk)); req.on('end', () => { try { for (const e of JSON.parse(Buffer.concat(chunks).toString('utf8'))) events.push({ ...e, source: req.url, destination: 'dev' }); res.writeHead(204).end(); } catch { res.writeHead(400).end(); } });
});
await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${receiver.address().port}`;
const productionReceiver = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST' || req.url !== '/events/client') { res.writeHead(404).end(); return; }
  const chunks = []; req.on('data', chunk => chunks.push(chunk)); req.on('end', () => { try { for (const e of JSON.parse(Buffer.concat(chunks).toString('utf8'))) events.push({ ...e, source: req.url, destination: 'production' }); res.writeHead(204).end(); } catch { res.writeHead(400).end(); } });
});
await new Promise(resolve => productionReceiver.listen(0, '127.0.0.1', resolve));
const productionOrigin = `http://127.0.0.1:${productionReceiver.address().port}`;
async function freePort() { const socket = createSocketServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve)); const port = socket.address().port; await new Promise(resolve => socket.close(resolve)); return port; }
const worldPort = await freePort(), frontPort = await freePort();
const env = { ...process.env, VITE_BRAMBLEKEEP_ANALYTICS_SITE: origin, VITE_BRAMBLEKEEP_ANALYTICS_LIVE_SITE: productionOrigin, VITE_BRAMBLEKEEP_ANALYTICS_TEST: '1', VITE_BRAMBLEKEEP_WAVEDASH_PLAYTEST_GCID: 'playtest123', VITE_BRAMBLEKEEP_WAVEDASH_LIVE_GCID: 'live123', BRAMBLEKEEP_ANALYTICS_SITE: origin, BRAMBLEKEEP_ANALYTICS_ALLOW_LOCAL: '1', BRAMBLEKEEP_ANALYTICS_TRAFFIC: 'test', BRAMBLEKEEP_INGEST_KEY: key };
const world = spawn(process.execPath, ['--import', 'tsx', 'game/server/index.ts'], { env: { ...env, PORT: String(worldPort), CASTLE_DATA_DIR: data }, stdio: ['ignore', 'pipe', 'pipe'] });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(frontPort), '--strictPort'], { env: { ...env, VITE_COLYSEUS_URL: `http://127.0.0.1:${worldPort}` }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; for (const process of [world, vite]) { process.stdout.on('data', chunk => { log += chunk; }); process.stderr.on('data', chunk => { log += chunk; }); }
let chrome, cdp;
async function ready(url) { for (let i = 0; i < 150; i++) { try { if ((await fetch(url)).ok) return; } catch {} await sleep(100); } throw new Error(`Server did not start: ${log}`); }
async function waitForEvent(predicate, label) { for (let i = 0; i < 150; i++) { const value = events.find(predicate); if (value) return value; await sleep(100); } throw new Error(`Missing ${label}: ${events.map(e => e.event).join(', ')}`); }
async function click(page, selector) {
  const point = await page.evalJS(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e?.getBoundingClientRect();return r?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()`);
  if (!point) throw new Error(`Missing ${selector}`);
  await page.S('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.S('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function press(page, key, code, virtualCode, duration = 50) {
  await page.S('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualCode }); await sleep(duration);
  await page.S('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualCode });
}
try {
  await Promise.all([ready(`http://127.0.0.1:${worldPort}/health`), ready(`http://127.0.0.1:${frontPort}/`)]);
  chrome = await launchChrome(); cdp = await connect(chrome.wsUrl);
  const [target] = await cdp.pages(), page = await cdp.attach(target.targetId);
  await page.S('Runtime.enable'); await page.S('Page.enable'); await page.S('Emulation.setFocusEmulationEnabled', { enabled: true }); await page.S('Page.bringToFront');
  await page.S('Page.navigate', { url: `http://127.0.0.1:${frontPort}/` });
  await page.waitFor("!document.querySelector('#press-start').hidden", 30000, 'title');
  await click(page, '#press-start'); await page.waitFor("document.body.dataset.phase==='menu'", 5000, 'menu');
  await click(page, '[data-act="play"]'); await page.waitFor("!!document.querySelector('.multiplayer-join:not([hidden])')", 10000, 'hero selection');
  await click(page, '[data-class="Knight"]'); await page.waitFor('window.__game.multiplayer().joined', 10000, 'join');
  const joined = await waitForEvent(e => e.source === '/events/server' && e.event === 'world_join', 'world join');
  if (joined.props?.players !== 1) throw new Error('AI teammates were counted as human players');
  await click(page, '.awards-button'); await page.waitFor("!document.querySelector('.achievements-overlay').hidden", 5000, 'achievements'); await click(page, '.achievements-close');
  await click(page, '.scores-button'); await page.waitFor("!document.querySelector('.scoreboard').hidden", 5000, 'battle wins'); await click(page, '.scores-button');
  await press(page, 'w', 'KeyW', 87, 900); await press(page, ' ', 'Space', 32, 500);
  await press(page, 'Escape', 'Escape', 27); await page.waitFor("document.body.dataset.phase==='paused'", 5000, 'pause'); await sleep(1200);
  await click(page, '#pause-resume'); await page.waitFor("document.body.dataset.phase==='playing'", 5000, 'resume');
  await sleep(300); await page.S('Page.navigate', { url: 'about:blank' });
  const end = await waitForEvent(e => e.sessionId === joined.sessionId && e.event === 'session_end', 'session end');
  if (end.props?.screen !== 'playing') throw new Error(`Incorrect exit screen: ${JSON.stringify(end.props)}`);
  await waitForEvent(e => e.sessionId === joined.sessionId && e.event === 'first_move', 'accepted movement');
  await waitForEvent(e => e.sessionId === joined.sessionId && e.event === 'first_attack', 'accepted attack');
  const browserEvents = events.filter(e => e.sessionId === joined.sessionId).map(e => e.event);
  for (const name of ['page_load', 'title_shown', 'graphics_ready', 'menu_shown', 'play_clicked', 'hero_selected', 'achievements_opened', 'scores_opened']) if (!browserEvents.includes(name)) throw new Error(`Missing ${name}: ${browserEvents.join(', ')}`);
  if (end.activeMs < 500 || end.elapsedMs - end.activeMs < 1000) throw new Error(`Active time did not exclude loading or pause: ${JSON.stringify(end)}`);

  // The choice persists across page loads and stops new client events.
  await page.S('Page.navigate', { url: `http://127.0.0.1:${frontPort}/` });
  await page.waitFor("!document.querySelector('#press-start').hidden", 30000, 'second title'); await click(page, '#press-start');
  await page.waitFor("document.body.dataset.phase==='menu'", 5000, 'second menu'); await click(page, '[data-act="settings"]');
  await page.waitFor("!document.querySelector('#settings-pop').hidden", 5000, 'settings'); await click(page, '#bramblekeep-analytics-toggle');
  if (await page.evalJS("localStorage.getItem('bramblekeep:analytics-optout:v1')") !== '1') throw new Error('Opt-out was not persisted');
  await sleep(500); const before = events.filter(e => e.source === '/events/client' && e.event === 'page_load').length;
  await page.S('Page.navigate', { url: `http://127.0.0.1:${frontPort}/` }); await page.waitFor("!document.querySelector('#press-start').hidden", 30000, 'opted-out title'); await sleep(1000);
  if (events.filter(e => e.source === '/events/client' && e.event === 'page_load').length !== before) throw new Error('Opted-out page emitted analytics');
  await page.evalJS("localStorage.removeItem('castle-guest-secret-v1')");
  await click(page, '#press-start'); await page.waitFor("document.body.dataset.phase==='menu'", 5000, 'opted-out menu'); await click(page, '[data-act="play"]');
  await page.waitFor("!!document.querySelector('.multiplayer-join:not([hidden])')", 10000, 'opted-out hero selection');
  const joinsBefore = events.filter(e => e.event === 'world_join').length;
  await click(page, '[data-class="Scout"]'); await page.waitFor('window.__game.multiplayer().joined', 10000, 'opted-out join'); await sleep(500);
  if (events.filter(e => e.event === 'world_join').length !== joinsBefore) throw new Error('Opted-out join emitted server analytics');
  await press(page, 'Escape', 'Escape', 27); await page.waitFor("document.body.dataset.phase==='paused'", 5000, 'second pause');
  await click(page, '#pause-settings'); await page.waitFor("!document.querySelector('#settings-pop').hidden", 5000, 'second settings'); await click(page, '#bramblekeep-analytics-toggle');
  const resumed = await waitForEvent(e => e.event === 'world_tracking_resumed', 'tracking resumed in the world');
  await page.S('Page.navigate', { url: 'about:blank' });
  await waitForEvent(e => e.sessionId === resumed.sessionId && e.event === 'session_resume', 'resumed client session');
  if (events.some(e => e.sessionId === resumed.sessionId && e.event === 'page_load')) throw new Error('Opting in fabricated a page load');

  // A fresh browser context with both graphics backends unavailable reports a stable boot code.
  const { browserContextId } = await cdp.send('Target.createBrowserContext');
  const created = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId }); const failure = await cdp.attach(created.targetId);
  await failure.S('Runtime.enable'); await failure.S('Page.enable');
  await failure.S('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2'||kind==='webgpu'?null:original.call(this,kind,...args)}})()` });
  await failure.S('Page.navigate', { url: `http://127.0.0.1:${frontPort}/?renderer=webgl2` });
  await failure.waitFor("!document.querySelector('#fatal').hidden", 30000, 'graphics failure');
  await waitForEvent(e => e.event === 'load_error' && e.props?.reason === 'graphics', 'graphics boot failure');

  const fallbackContext = await cdp.send('Target.createBrowserContext');
  const fallbackTarget = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId: fallbackContext.browserContextId });
  const fallback = await cdp.attach(fallbackTarget.targetId); await fallback.S('Runtime.enable'); await fallback.S('Page.enable');
  await fallback.S('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true})" });
  await fallback.S('Page.navigate', { url: `http://127.0.0.1:${frontPort}/` });
  await fallback.waitFor("!document.querySelector('#press-start').hidden", 30000, 'graphics fallback title');
  await fallback.S('Page.navigate', { url: 'about:blank' });
  await waitForEvent(e => e.event === 'graphics_ready' && e.props?.backend === 'webgl2' && e.props?.fallbackStage === 'api-unavailable', 'graphics fallback stage');
  if (!clientContentTypes.has('text/plain')) throw new Error('Browser analytics require a preflight-free content type');

  // The host can reveal its playtest identity only after init; classify even without a join.
  const wavedashContext = await cdp.send('Target.createBrowserContext');
  const wavedashTarget = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId: wavedashContext.browserContextId });
  const wavedash = await cdp.attach(wavedashTarget.targetId); await wavedash.S('Runtime.enable'); await wavedash.S('Page.enable');
  const token = `header.${Buffer.from(JSON.stringify({ gcid: 'playtest123' })).toString('base64url')}.signature`;
  await wavedash.S('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{let ready=false;window.Wavedash={init:()=>{ready=true;return true},updateLoadProgressZeroToOne:()=>{},getUserJwt:async()=>ready?{success:true,data:${JSON.stringify(token)}}:{success:false}}})()` });
  await wavedash.S('Page.navigate', { url: `http://127.0.0.1:${frontPort}/?platform=wavedash` });
  await wavedash.waitFor("!document.querySelector('#press-start').hidden", 30000, 'Wavedash title');
  const tagged = await waitForEvent(e => e.event === 'traffic_classified' && e.channel === 'wavedash' && e.traffic === 'playtest', 'late Wavedash classification');
  if (events.filter(e => e.sessionId === tagged.sessionId).some(e => JSON.stringify(e).includes('playtest123') || JSON.stringify(e).includes(token))) throw new Error('Wavedash identity leaked into analytics');
  if (events.filter(e => e.sessionId === tagged.sessionId).some(e => e.destination !== 'dev')) throw new Error('Playtest events reached production');

  // The exact same build routes a confirmed live identity, including boot,
  // exclusively to its production sink.
  const liveContext = await cdp.send('Target.createBrowserContext');
  const liveTarget = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId: liveContext.browserContextId });
  const live = await cdp.attach(liveTarget.targetId); await live.S('Runtime.enable'); await live.S('Page.enable');
  const liveToken = `header.${Buffer.from(JSON.stringify({ gcid: 'live123' })).toString('base64url')}.signature`;
  await live.S('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{let ready=false;window.Wavedash={init:()=>{ready=true;return true},updateLoadProgressZeroToOne:()=>{},getUserJwt:async()=>ready?{success:true,data:${JSON.stringify(liveToken)}}:{success:false}}})()` });
  await live.S('Page.navigate', { url: `http://127.0.0.1:${frontPort}/?platform=wavedash` });
  await live.waitFor("!document.querySelector('#press-start').hidden", 30000, 'live Wavedash title');
  const livePage = await waitForEvent(e => e.event === 'page_load' && e.channel === 'wavedash' && e.traffic === 'live', 'live boot');
  await live.S('Page.navigate', { url: 'about:blank' });
  await waitForEvent(e => e.sessionId === livePage.sessionId && e.event === 'session_end', 'live session end');
  if (events.filter(e => e.sessionId === livePage.sessionId).some(e => e.destination !== 'production' || JSON.stringify(e).includes(liveToken))) throw new Error('Live session was split across sinks or exposed its identity');

  // If identity arrives too late, the whole session stays in development.
  const lateContext = await cdp.send('Target.createBrowserContext');
  const lateTarget = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId: lateContext.browserContextId });
  const late = await cdp.attach(lateTarget.targetId); await late.S('Runtime.enable'); await late.S('Page.enable');
  await late.S('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{let ready=false;const start=Date.now();window.Wavedash={init:()=>{ready=true;return true},updateLoadProgressZeroToOne:()=>{},getUserJwt:async()=>ready&&Date.now()-start>12000?{success:true,data:${JSON.stringify(liveToken)}}:{success:false}}})()` });
  await late.S('Page.navigate', { url: `http://127.0.0.1:${frontPort}/?platform=wavedash` });
  await late.waitFor("!document.querySelector('#press-start').hidden", 30000, 'unclassified Wavedash title');
  const unknown = await waitForEvent(e => e.event === 'page_load' && e.channel === 'wavedash' && e.traffic === 'unknown' && e.destination === 'dev', 'unclassified fallback');
  await sleep(2500); await late.S('Page.navigate', { url: 'about:blank' });
  await waitForEvent(e => e.sessionId === unknown.sessionId && e.event === 'session_end', 'unclassified session end');
  if (events.filter(e => e.sessionId === unknown.sessionId).some(e => e.destination !== 'dev' || e.traffic !== 'unknown')) throw new Error('Late identity moved a session between environments');
  console.log('Analytics browser passed:', JSON.stringify({ browserEvents, elapsedMs: end.elapsedMs, activeMs: end.activeMs, optOut: true, graphicsFailure: true, fallback: true, environmentRouting: true }));
} finally {
  if (cdp) await cdp.close(); if (chrome) await chrome.close(); vite.kill('SIGTERM'); world.kill('SIGTERM');
  await Promise.all([new Promise(resolve => { if (world.exitCode !== null) resolve(); else { world.once('exit', resolve); setTimeout(resolve, 2000); } }), new Promise(resolve => receiver.close(resolve)), new Promise(resolve => productionReceiver.close(resolve))]);
  rmSync(data, { recursive: true, force: true });
}
