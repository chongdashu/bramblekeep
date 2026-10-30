import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { convexTest } from 'convex-test';
import { anyApi } from 'convex/server';
import schema from '../analytics/convex/schema';
import { CLIENT_EVENTS, SERVER_EVENTS, parseEvent, type AnalyticsEvent } from '../analytics/contract';
import { summarize, type StoredEvent } from '../analytics/report';
import { ServerAnalytics } from '../server/analytics';
import { isGameKey, storageKey } from '../../src/platform/storage-key';

const modules = { ...import.meta.glob('../analytics/convex/**/*.ts'), '../analytics/convex/_generated/server.js': async () => ({}) };
const session = randomUUID();
const make = (event: AnalyticsEvent['event'], extra: Partial<AnalyticsEvent> = {}): AnalyticsEvent => ({
  id: randomUUID(), sessionId: session, event, timestamp: Date.now(), build: 'bramblekeep-abc', channel: 'wavedash', traffic: 'unknown', ...extra,
});
const stored = (event: AnalyticsEvent, source = 'client'): StoredEvent => ({ ...event, source, receivedAt: Date.now() });

describe('analytics contract and reports', () => {
  it('uses a game storage key that Wavedash can mirror between build origins', () => {
    expect(storageKey('analytics-optout')).toBe('bramblekeep:analytics-optout:v1');
    expect(isGameKey(storageKey('analytics-optout'))).toBe(true);
  });
  it('keeps the finite event catalog aligned with the actual emitters', () => {
    const client = readFileSync('game/src/analytics.ts', 'utf8') + readFileSync('game/src/multiplayer-game.ts', 'utf8') + readFileSync('game/src/social-ui.ts', 'utf8');
    const server = readFileSync('game/server/room.ts', 'utf8');
    const clientCalls = [...client.matchAll(/(?:\.track)\(\s*'([^']+)'/g)].map(m => m[1]);
    const serverCalls = [...server.matchAll(/analyticsSink\.emit\([^,]+,\s*'([^']+)'/g)].map(m => m[1]);
    expect([...new Set(clientCalls)].sort()).toEqual([...CLIENT_EVENTS].sort());
    expect([...new Set(serverCalls)].sort()).toEqual([...SERVER_EVENTS].sort());
  });
  it('rejects untrusted fields, personal text, forged server events and excessive clocks', () => {
    const event = make('page_load');
    expect(parseEvent(event, 'client', Date.now())).toEqual(event);
    expect(parseEvent({ ...event, chat: 'private message' }, 'client', Date.now())).toBeNull();
    expect(parseEvent({ ...event, props: { reason: 'raw exception or URL' } }, 'client', Date.now())).toBeNull();
    expect(parseEvent({ ...event, playerId: 'a'.repeat(64) }, 'client', Date.now())).toBeNull();
    expect(parseEvent(make('castle_cleared'), 'client', Date.now())).toBeNull();
    expect(parseEvent({ ...event, activeMs: 86_400_001 }, 'client', Date.now())).toBeNull();
  });
  it('counts players and sessions separately, classifies from the server, and does not reopen ended sessions on late events', () => {
    const other = randomUUID(), third = randomUUID(), playerId = 'a'.repeat(64);
    const events = [
      stored(make('page_load', { elapsedMs: 0 })),
      stored(make('hero_selected', { props: { hero: 'Scout' }, elapsedMs: 2000 })),
      stored(make('settings_opened')), stored(make('settings_opened')), stored(make('achievements_opened')),
      stored(make('join_failed', { props: { reason: 'profile_unavailable' } })), stored(make('join_failed', { props: { reason: 'profile_unavailable' } })),
      stored(make('graphics_ready', { props: { backend: 'webgl2', fallback: true, fallbackStage: 'api-unavailable' } })),
      stored(make('world_join', { playerId, traffic: 'playtest', props: { hero: 'Scout', gateOpen: false, cleared: false } }), 'server'),
      stored(make('first_attack', { playerId, traffic: 'playtest' }), 'server'),
      stored(make('session_end', { elapsedMs: 10_000, activeMs: 6000, props: { screen: 'playing' } })),
      stored(make('session_checkpoint', { elapsedMs: 10_100, activeMs: 6000 })),
      stored(make('page_load', { sessionId: other, elapsedMs: 0 })),
      stored(make('world_join', { sessionId: other, playerId, traffic: 'playtest', props: { hero: 'Knight', gateOpen: true, cleared: false } }), 'server'),
      stored(make('session_checkpoint', { sessionId: other, elapsedMs: 9000, activeMs: 4000 })),
      stored(make('page_load', { sessionId: third, traffic: 'live' })),
    ];
    const report = summarize(events, 'playtest');
    expect(report).toMatchObject({ sessions: 2, pageLoads: 2, playedSessions: 2, uniquePlayers: 1, firstAttack: 1, gateBreached: 0, joinedWithGateOpen: 1, gateEligibleSessions: 1, clearEligibleSessions: 2, completedSessions: 1, incompleteSessions: 1, medianObservedActivePlayMs: 5000, medianCompletedSessionMs: 10_000, exitScreens: { playing: 1 }, heroes: { Knight: 1, Scout: 1, Spellcaster: 0 }, features: { settings: 1, achievementsOpened: 1 }, joinFailureReasons: { profile_unavailable: 1 }, graphicsBackends: { webgl2: 1 }, graphicsFallbackStages: { 'api-unavailable': 1 } });
    events.push(stored(make('session_resume', { elapsedMs: 11_000 })));
    expect(summarize(events, 'playtest').completedSessions).toBe(0);
    expect(summarize(events, 'live').pageLoads).toBe(1);
  });
  it('classifies an early unjoined Wavedash load after the SDK becomes ready, but trusts the server when it joins', () => {
    const events = [stored(make('page_load')), stored(make('traffic_classified', { traffic: 'playtest' }))];
    expect(summarize(events, 'playtest')).toMatchObject({ pageLoads: 1, playedSessions: 0 });
    events.push(stored(make('world_join', { traffic: 'live', playerId: 'a'.repeat(64) }), 'server'));
    expect(summarize(events, 'playtest').pageLoads).toBe(0);
    expect(summarize(events, 'live')).toMatchObject({ pageLoads: 1, playedSessions: 1 });
  });
});

describe('Convex ingest', () => {
  it('rejects non-live and non-Wavedash traffic on the production deployment', async () => {
    vi.stubEnv('BRAMBLEKEEP_ANALYTICS_ENV', 'production');
    vi.stubEnv('BRAMBLEKEEP_INGEST_KEY', 'k'.repeat(40));
    try {
      const t = convexTest(schema, modules);
      const post = (path: string, body: unknown, headers: Record<string, string> = {}) => t.fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
      for (const traffic of ['test', 'playtest', 'unknown'] as const) {
        expect((await post('/events/client', [make('page_load', { traffic })])).status).toBe(403);
      }
      expect((await post('/events/client', [make('page_load', { traffic: 'live', channel: 'web' })])).status).toBe(403);
      expect((await post('/events/client', [make('page_load', { traffic: 'live' })])).status).toBe(204);
      const auth = { authorization: `Bearer ${'k'.repeat(40)}` };
      expect((await post('/events/server', [make('world_join', { traffic: 'test' })], auth)).status).toBe(403);
      expect((await post('/events/server', [make('world_join', { traffic: 'live' })], auth)).status).toBe(204);
      expect(await t.run(ctx => ctx.db.query('events').collect())).toHaveLength(2);
    } finally { vi.unstubAllEnvs(); }
  });
  it('validates and deduplicates batches, requires the server key, and produces a private report', async () => {
    vi.stubEnv('BRAMBLEKEEP_INGEST_KEY', 'k'.repeat(40));
    try {
      const t = convexTest(schema, modules);
      const page = make('page_load', { elapsedMs: 0 });
      const post = (path: string, body: unknown, headers: Record<string, string> = {}) => t.fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
      expect((await post('/events/client', [page])).status).toBe(204);
      expect((await post('/events/client', [page])).status).toBe(204);
      expect((await post('/events/client', [{ ...page, props: { text: 'private chat' } }])).status).toBe(400);
      const join = make('world_join', { playerId: 'a'.repeat(64), traffic: 'playtest', props: { hero: 'Knight' } });
      expect((await post('/events/server', [join])).status).toBe(401);
      expect((await post('/events/server', [join], { authorization: `Bearer ${'k'.repeat(40)}` })).status).toBe(204);
      expect((await post('/events/client', [join])).status).toBe(400);
      const rows = await t.run(ctx => ctx.db.query('events').collect());
      expect(rows).toHaveLength(2);
      const report = await t.query(anyApi.analytics.report, { since: Date.now() - 60_000, until: Date.now() + 60_000, traffic: 'playtest' });
      expect(report).toMatchObject({ truncated: false, pageLoads: 1, playedSessions: 1, uniquePlayers: 1 });
      expect((await post('/events/client', 'x'.repeat(17_000))).status).toBe(413);
    } finally { vi.unstubAllEnvs(); }
  });
  it('bounds repeated writes and expires events and rate buckets after their retention windows', async () => {
    const t = convexTest(schema, modules);
    const post = (body: unknown) => t.fetch('/events/client', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    for (let batch = 0; batch < 6; batch++) expect((await post(Array.from({ length: 20 }, () => make('session_checkpoint')))).status).toBe(204);
    expect((await post([make('session_checkpoint')])).status).toBe(429);
    const now = Date.now(), old = make('page_load');
    await t.run(async ctx => {
      await ctx.db.insert('events', { ...old, source: 'client', receivedAt: now - 31 * 86_400_000 });
      await ctx.db.insert('rateBuckets', { key: 'expired', count: 1, expiresAt: now - 1 });
    });
    expect(await t.mutation(anyApi.analytics.prune, {})).toMatchObject({ events: 1, buckets: 1 });
    expect(await t.run(ctx => ctx.db.query('events').collect())).toHaveLength(120);
  });
});

describe('authoritative server sink', () => {
  it('stays inert without explicit game-owned configuration and pseudonymizes verified identities', async () => {
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    const disabled = new ServerAnalytics({ VITE_CONVEX_SITE_URL: 'https://other-game.convex.site' }, send);
    expect(disabled.context({ sessionId: session, build: 'dev', channel: 'web' }, 'verified-user')).toBeNull();
    expect(send).not.toHaveBeenCalled();
    const sink = new ServerAnalytics({ NODE_ENV: 'test', BRAMBLEKEEP_ANALYTICS_ALLOW_LOCAL: '1', BRAMBLEKEEP_ANALYTICS_SITE: 'http://127.0.0.1:5555', BRAMBLEKEEP_ANALYTICS_TRAFFIC: 'test', BRAMBLEKEEP_INGEST_KEY: 'k'.repeat(40) }, send);
    const context = sink.context({ sessionId: session, build: 'dev', channel: 'web' }, 'verified-user');
    expect(context?.playerId).toMatch(/^[a-f0-9]{64}$/);
    expect(context?.playerId).not.toContain('verified-user');
    expect(sink.context({ sessionId: 'bad', build: 'dev', channel: 'web' }, 'verified-user')).toBeNull();
    sink.emit(context, 'world_join', { hero: 'Knight', round: 1 });
    await vi.waitFor(() => expect(sink.status().lastWrite).toBe('ok'));
    const [url, options] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:5555/events/server');
    expect(String(options.body)).not.toContain('verified-user');
    expect(JSON.parse(String(options.body))[0]).toMatchObject({ event: 'world_join', playerId: context?.playerId, traffic: 'test' });
  });
  it('accepts live server measurement only from a Wavedash session', () => {
    const sink = new ServerAnalytics({ NODE_ENV: 'test', BRAMBLEKEEP_ANALYTICS_ALLOW_LOCAL: '1', BRAMBLEKEEP_ANALYTICS_SITE: 'http://127.0.0.1:5555', BRAMBLEKEEP_ANALYTICS_TRAFFIC: 'live', BRAMBLEKEEP_INGEST_KEY: 'k'.repeat(40) });
    expect(sink.context({ sessionId: session, build: 'live', channel: 'web' }, 'verified-user')).toBeNull();
    expect(sink.context({ sessionId: session, build: 'live', channel: 'wavedash' }, 'verified-user')).not.toBeNull();
  });
});
