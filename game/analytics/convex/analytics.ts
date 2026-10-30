import { anyApi, internalMutationGeneric, internalQueryGeneric } from 'convex/server';
import { v } from 'convex/values';
import { summarize } from '../report';
import type { StoredEvent } from '../report';

const eventValidator = v.object({
  id: v.string(), sessionId: v.string(), event: v.string(), timestamp: v.number(), build: v.string(), channel: v.string(), traffic: v.string(),
  elapsedMs: v.optional(v.number()), activeMs: v.optional(v.number()), playerId: v.optional(v.string()),
  props: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean()))),
});

export const ingest = internalMutationGeneric({
  args: { events: v.array(eventValidator), source: v.union(v.literal('client'), v.literal('server')) },
  handler: async (ctx, { events, source }) => {
    const now = Date.now(), minute = Math.floor(now / 60_000);
    const buckets = new Map<string, number>([[`global:${minute}`, events.length]]);
    for (const event of events) buckets.set(`${event.sessionId}:${minute}`, (buckets.get(`${event.sessionId}:${minute}`) ?? 0) + 1);
    for (const [key, count] of buckets) {
      const existing = await ctx.db.query('rateBuckets').withIndex('by_key', q => q.eq('key', key)).unique();
      if ((existing?.count ?? 0) + count > (key.startsWith('global:') ? 10_000 : 120)) throw new Error('analytics rate limit');
      if (existing) await ctx.db.patch(existing._id, { count: existing.count + count });
      else await ctx.db.insert('rateBuckets', { key, count, expiresAt: now + 3_600_000 });
    }
    let inserted = 0;
    for (const event of events) {
      if (await ctx.db.query('events').withIndex('by_event_id', q => q.eq('id', event.id)).first()) continue;
      await ctx.db.insert('events', { ...event, source, receivedAt: now }); inserted++;
    }
    return inserted;
  },
});

/** Private: invoke from the authenticated Convex CLI or dashboard, not from the game. */
export const report = internalQueryGeneric({
  args: { since: v.number(), until: v.number(), traffic: v.union(v.literal('live'), v.literal('playtest'), v.literal('test'), v.literal('unknown'), v.literal('all')), build: v.optional(v.string()) },
  handler: async (ctx, { since, until, traffic, build }) => {
    if (!Number.isSafeInteger(since) || !Number.isSafeInteger(until) || since >= until || until - since > 31 * 86_400_000) throw new Error('Choose a reporting window of at most 31 days');
    const events = await ctx.db.query('events').withIndex('by_received', q => q.gte('receivedAt', since).lt('receivedAt', until)).take(10_001);
    const truncated = events.length > 10_000;
    return { since, until, truncated, ...summarize(events.slice(0, 10_000) as StoredEvent[], traffic, build) };
  },
});

/** Retain raw events for 30 days, and clean up old rate buckets in bounded batches. */
export const prune = internalMutationGeneric({
  args: {}, handler: async ctx => {
    const now = Date.now();
    const events = await ctx.db.query('events').withIndex('by_received', q => q.lt('receivedAt', now - 30 * 86_400_000)).take(500);
    const buckets = await ctx.db.query('rateBuckets').withIndex('by_expiry', q => q.lt('expiresAt', now)).take(500);
    for (const row of [...events, ...buckets]) await ctx.db.delete(row._id);
    if (events.length === 500 || buckets.length === 500) await ctx.scheduler.runAfter(0, anyApi.analytics.prune, {});
    return { events: events.length, buckets: buckets.length };
  },
});
