import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  events: defineTable({
    id: v.string(), sessionId: v.string(), event: v.string(), timestamp: v.number(), receivedAt: v.number(),
    build: v.string(), channel: v.string(), traffic: v.string(), source: v.string(),
    elapsedMs: v.optional(v.number()), activeMs: v.optional(v.number()), playerId: v.optional(v.string()),
    props: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean()))),
  }).index('by_event_id', ['id']).index('by_received', ['receivedAt']),
  rateBuckets: defineTable({ key: v.string(), count: v.number(), expiresAt: v.number() })
    .index('by_key', ['key']).index('by_expiry', ['expiresAt']),
});
