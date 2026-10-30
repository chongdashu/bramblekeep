// Exercise the game-owned Vite release configuration without touching a deployment.
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'bramblekeep-analytics-config-'));
try {
  mkdirSync(join(dir, 'analytics')); copyFileSync('game/vite.mjs', join(dir, 'vite.mjs'));
  const config = join(dir, 'analytics', 'release.json');
  const valid = { web: { site: 'https://test.convex.site' }, wavedash: { productionSite: 'https://live.convex.site', sites: { 'https://playtest.example.com': 'https://test.convex.site', 'https://live.example.com': 'https://live.convex.site' }, playtestGameCloudId: 'playtest123', liveGameCloudId: 'live123' } };
  writeFileSync(config, JSON.stringify(valid));
  const { default: plugins } = await import(pathToFileURL(join(dir, 'vite.mjs')).href);
  const plugin = plugins().find(p => p.name === 'bramblekeep-analytics-config');
  const release = (target, server = '') => ({ define: { 'import.meta.env.VITE_RELEASE': JSON.stringify(target), 'import.meta.env.VITE_COLYSEUS_URL': JSON.stringify(server) } });
  const wavedash = plugin.config(release('wavedash', 'https://playtest.example.com')).define;
  assert.equal(JSON.parse(wavedash['import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_SITE']), 'https://test.convex.site');
  assert.equal(JSON.parse(wavedash['import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_LIVE_SITE']), '');
  const live = plugin.config(release('wavedash', 'https://live.example.com')).define;
  assert.equal(JSON.parse(live['import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_SITE']), 'https://test.convex.site');
  assert.equal(JSON.parse(live['import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_LIVE_SITE']), 'https://live.convex.site');
  const other = plugin.config(release('wavedash', 'https://other.example.com')).define;
  assert.equal(JSON.parse(other['import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_SITE']), 'https://test.convex.site');
  assert.equal(JSON.parse(other['import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_LIVE_SITE']), '');
  assert.equal(JSON.parse(wavedash['import.meta.env.VITE_BRAMBLEKEEP_WAVEDASH_PLAYTEST_GCID']), 'playtest123');
  assert.equal(JSON.parse(live['import.meta.env.VITE_BRAMBLEKEEP_WAVEDASH_LIVE_GCID']), 'live123');
  assert.equal(JSON.parse(plugin.config(release('web')).define['import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_SITE']), 'https://test.convex.site');
  assert.equal(JSON.parse(plugin.config(release('web')).define['import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_LIVE_SITE']), '');
  assert.equal(plugin.config(release('crazygames')), undefined);
  writeFileSync(config, JSON.stringify({ wavedash: { sites: { 'https://playtest.example.com': 'https://example.convex.site.evil.test' } } }));
  assert.throws(() => plugin.config(release('wavedash')), /dedicated HTTPS Convex/);
  writeFileSync(config, JSON.stringify({ ...valid, web: { site: valid.wavedash.productionSite } }));
  assert.throws(() => plugin.config(release('wavedash')), /must be separate/);
  writeFileSync(config, JSON.stringify({ ...valid, wavedash: { ...valid.wavedash, liveGameCloudId: 'playtest123' } }));
  assert.throws(() => plugin.config(release('wavedash')), /must differ/);
  console.log('Analytics release configuration passed');
} finally { rmSync(dir, { recursive: true, force: true }); }
