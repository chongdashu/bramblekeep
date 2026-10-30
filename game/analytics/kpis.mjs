// Print the private KPI report for a recent window, using the game's own deployment configuration.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { configuredDeployment } from './deployments.mjs';

const [traffic = 'playtest', requestedDays = '7', build] = process.argv.slice(2);
if (traffic === '--help' || traffic === '-h') {
  console.log('Usage: node game/analytics/kpis.mjs [playtest|live|test|unknown|all] [days] [build-label]');
  process.exit(0);
}
const days = Number(requestedDays);
if (!['playtest', 'live', 'test', 'unknown', 'all'].includes(traffic) || !Number.isInteger(days) || days < 1 || days > 30 || (build && !/^[a-zA-Z0-9_.-]{1,100}$/.test(build))) {
  throw new Error('Choose a traffic class, 1–30 days, and an optional build label.');
}
const config = JSON.parse(readFileSync(new URL('./release.json', import.meta.url), 'utf8'));
const expected = traffic === 'live' ? 'production' : 'development';
const deployment = process.env.BRAMBLEKEEP_CONVEX_DEPLOYMENT || configuredDeployment(config, traffic);
if (!deployment || !/^[a-zA-Z0-9_:/.-]{1,150}$/.test(deployment)) throw new Error(`No dedicated ${expected} Convex deployment is configured.`);
const until = Date.now(), args = { since: until - days * 86_400_000, until, traffic, ...(build ? { build } : {}) };
const run = spawnSync('npx', ['--no-install', 'convex', 'run', '--deployment', deployment, 'analytics:report', JSON.stringify(args)], {
  cwd: fileURLToPath(new URL('.', import.meta.url)), stdio: 'inherit',
});
if (run.error) throw run.error;
process.exit(run.status ?? 1);
