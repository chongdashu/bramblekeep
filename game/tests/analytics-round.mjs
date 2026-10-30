// A real multiplayer round on isolated ports, with a disposable local ingest endpoint.
import { createServer } from 'node:http';
import { createServer as createSocketServer } from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const events = [], key = randomBytes(32).toString('hex');
const receiver = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  if (req.method !== 'POST' || !['/events/client', '/events/server'].includes(req.url)) { res.writeHead(404).end(); return; }
  if (req.url === '/events/server' && req.headers.authorization !== `Bearer ${key}`) { res.writeHead(401).end(); return; }
  const chunks = []; req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => { try { for (const event of JSON.parse(Buffer.concat(chunks).toString('utf8'))) events.push({ ...event, source: req.url }); res.writeHead(204).end(); } catch { res.writeHead(400).end(); } });
});
await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${receiver.address().port}`;
async function freePort() {
  const socket = createSocketServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve)); return port;
}
const worldPort = await freePort(), frontPort = await freePort();
const child = spawn(process.execPath, ['--import', 'tsx', 'game/tests/multiplayer-victory-browser.mjs'], {
  env: { ...process.env, TEST_WORLD_PORT: String(worldPort), TEST_FRONT_PORT: String(frontPort),
    VITE_BRAMBLEKEEP_ANALYTICS_SITE: origin, VITE_BRAMBLEKEEP_ANALYTICS_TEST: '1',
    BRAMBLEKEEP_ANALYTICS_SITE: origin, BRAMBLEKEEP_ANALYTICS_ALLOW_LOCAL: '1', BRAMBLEKEEP_ANALYTICS_TRAFFIC: 'test', BRAMBLEKEEP_INGEST_KEY: key },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
try {
  const exit = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Round walkthrough timed out')); }, 180_000);
    child.once('error', reject); child.once('exit', code => { clearTimeout(timeout); resolve(code); });
  });
  if (exit !== 0) throw new Error(`Round walkthrough exited ${exit}`);
  const page = events.find(e => e.source === '/events/client' && e.event === 'page_load');
  const joined = events.find(e => e.source === '/events/server' && e.event === 'world_join');
  if (!page || !joined || page.sessionId !== joined.sessionId || joined.traffic !== 'test') throw new Error(`Browser and authoritative server did not agree on the test session: ${events.map(e => e.event).join(', ')}`);
  for (const name of ['gate_breached', 'castle_cleared', 'round_started']) {
    if (!events.some(e => e.sessionId === page.sessionId && e.source === '/events/server' && e.event === name)) throw new Error(`Missing server-confirmed ${name}: ${events.map(e => e.event).join(', ')}`);
  }
  if (events.some(e => JSON.stringify(e).includes('guestSecret') || JSON.stringify(e).includes('displayName'))) throw new Error('Private identity leaked into analytics');
  console.log('Analytics round passed:', JSON.stringify({ events: events.map(e => e.event), traffic: joined.traffic, correlated: true }));
} finally {
  if (child.exitCode === null) child.kill('SIGTERM');
  await new Promise(resolve => receiver.close(resolve));
}
