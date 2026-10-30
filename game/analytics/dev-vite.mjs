import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { configuredDeployment } from './deployments.mjs';

const cli = fileURLToPath(new URL('../../node_modules/convex/bin/main.js', import.meta.url));
const cwd = fileURLToPath(new URL('.', import.meta.url));
const configPath = new URL('./release.json', import.meta.url);
const trafficClasses = new Set(['live', 'playtest', 'test', 'unknown', 'all']);

/** Browser requests to the private report are limited to the local developer. */
function localRequest(req) {
  const peer = req.socket.remoteAddress?.replace(/^::ffff:/, '');
  if (peer !== '127.0.0.1' && peer !== '::1') return false;
  const host = req.headers.host ?? '';
  if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host)) return false;
  const origin = req.headers.origin;
  const protocol = req.socket.encrypted ? 'https' : 'http';
  if (origin && origin !== `${protocol}://${host}`) return false;
  const fetchSite = req.headers['sec-fetch-site'];
  return (!fetchSite || fetchSite === 'same-origin') && req.headers['x-bramblekeep-dev'] === '1';
}

function queryReport({ deployment, args, signal }) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [cli, 'run', '--deployment', deployment, 'analytics:report', JSON.stringify(args)], {
      cwd, timeout: 20_000, maxBuffer: 256 * 1024, signal, windowsHide: true,
    }, (error, stdout) => {
      if (error) { reject(error); return; }
      try { resolve(JSON.parse(stdout)); } catch (parseError) { reject(parseError); }
    });
  });
}

/** Inject a report runner only for isolated local tests; never into the client bundle. */
export function devAnalyticsPlugin({ runReport = queryReport, loadConfig = () => JSON.parse(readFileSync(configPath, 'utf8')) } = {}) {
  return {
    name: 'bramblekeep-dev-player-kpis', apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/player-kpis', async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const respond = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
        if (!localRequest(req)) { respond(403, { error: 'Player KPIs are available only from the local developer preview.' }); return; }
        if (req.method !== 'GET') { respond(405, { error: 'Only GET is supported.' }); return; }
        let url;
        try { url = new URL(req.url ?? '/', 'http://localhost'); } catch { respond(400, { error: 'Invalid request.' }); return; }
        if (url.pathname !== '/report') { respond(404, { error: 'Not found.' }); return; }
        if ([...url.searchParams.keys()].some(key => !['traffic', 'days', 'build'].includes(key)) || ['traffic', 'days', 'build'].some(key => url.searchParams.getAll(key).length > 1)) {
          respond(400, { error: 'Invalid report parameters.' }); return;
        }
        const traffic = url.searchParams.get('traffic') ?? 'live';
        const daysText = url.searchParams.get('days') ?? '7';
        const days = Number(daysText), build = url.searchParams.get('build') ?? '';
        if (!trafficClasses.has(traffic) || !/^\d{1,2}$/.test(daysText) || !Number.isInteger(days) || days < 1 || days > 30 || (build && !/^[a-zA-Z0-9_.-]{1,100}$/.test(build))) {
          respond(400, { error: 'Choose a valid traffic class, 1–30 days, and an optional build label.' }); return;
        }
        let deployment;
        try { deployment = configuredDeployment(loadConfig(), traffic); } catch { /* reported below */ }
        if (!deployment) { respond(503, { error: 'The selected Convex deployment is not configured.' }); return; }
        const until = Date.now(), args = { since: until - days * 86_400_000, until, traffic, ...(build ? { build } : {}) };
        const abort = new AbortController();
        res.once('close', () => { if (!res.writableEnded) abort.abort(); });
        try {
          const report = await runReport({ deployment, args, signal: abort.signal });
          if (abort.signal.aborted) return;
          if (!report || typeof report !== 'object' || report.traffic !== traffic) throw new Error('Invalid report');
          respond(200, report);
        } catch {
          if (!abort.signal.aborted) respond(502, { error: 'Could not read the private Convex report. Check local Convex authentication and try again.' });
        }
      });
    },
  };
}
