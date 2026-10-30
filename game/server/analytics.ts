import { createHmac, randomUUID } from 'node:crypto';
import { parseEvent, type AnalyticsEvent, type Channel, type EventProps, type ServerEvent, type Traffic } from '../analytics/contract';

export type TrackingContext = { sessionId: string; build: string; channel: Channel; playerId: string };
type Environment = Record<string, string | undefined>;

/** Best-effort sink: gameplay never waits for Convex, and neither credentials nor identity leave in logs. */
export class ServerAnalytics {
  private endpoint: string | null = null;
  private key = '';
  private traffic: Traffic = 'unknown';
  private queue: AnalyticsEvent[] = [];
  private sending = false;
  private firstAttempt = false;
  private lastWrite: 'disabled' | 'pending' | 'ok' | 'failed' = 'disabled';
  constructor(env: Environment = process.env, private readonly send: typeof fetch = fetch) {
    try {
      const url = new URL(env.BRAMBLEKEEP_ANALYTICS_SITE ?? '');
      const cloud = url.protocol === 'https:' && url.hostname.endsWith('.convex.site');
      const local = env.NODE_ENV !== 'production' && env.BRAMBLEKEEP_ANALYTICS_ALLOW_LOCAL === '1' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
      if ((!cloud && !local) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return;
      if (!env.BRAMBLEKEEP_INGEST_KEY || env.BRAMBLEKEEP_INGEST_KEY.length < 32) return;
      if (env.BRAMBLEKEEP_ANALYTICS_TRAFFIC !== 'live' && env.BRAMBLEKEEP_ANALYTICS_TRAFFIC !== 'playtest' && env.BRAMBLEKEEP_ANALYTICS_TRAFFIC !== 'test') return;
      this.endpoint = url.origin; this.key = env.BRAMBLEKEEP_INGEST_KEY; this.traffic = env.BRAMBLEKEEP_ANALYTICS_TRAFFIC;
      this.lastWrite = 'pending';
      const timer = setInterval(() => void this.flush(), 5000); timer.unref();
      console.info(`[analytics] server sink enabled (${this.traffic})`);
    } catch { /* no explicit game-owned target: stay disabled */ }
  }
  status() { return { configured: !!this.endpoint, lastWrite: this.lastWrite }; }
  context(input: unknown, identityId: string): TrackingContext | null {
    if (!this.endpoint || !input || typeof input !== 'object') return null;
    const r = input as Record<string, unknown>;
    if (Object.keys(r).some(key => !['sessionId', 'build', 'channel'].includes(key))) return null;
    if (this.traffic === 'live' && r.channel !== 'wavedash') return null;
    const playerId = createHmac('sha256', this.key).update(`bramblekeep-player:${identityId}`).digest('hex');
    const candidate = { id: randomUUID(), sessionId: r.sessionId, event: 'world_join', timestamp: Date.now(), build: r.build, channel: r.channel, traffic: this.traffic, playerId };
    return parseEvent(candidate, 'server', Date.now()) ? { sessionId: r.sessionId as string, build: r.build as string, channel: r.channel as Channel, playerId } : null;
  }
  emit(context: TrackingContext | null | undefined, event: ServerEvent, props?: EventProps) {
    if (!this.endpoint || !context) return;
    const value: AnalyticsEvent = { id: randomUUID(), ...context, event, timestamp: Date.now(), traffic: this.traffic, ...(props ? { props } : {}) };
    if (!parseEvent(value, 'server', Date.now())) return;
    this.queue.push(value); if (this.queue.length > 500) this.queue.shift();
    if (!this.firstAttempt || this.queue.length >= 20) void this.flush();
  }
  discard(sessionId: string) { this.queue = this.queue.filter(event => event.sessionId !== sessionId); }
  async flush() {
    if (!this.endpoint || this.sending || !this.queue.length) return;
    this.sending = true;
    if (!this.firstAttempt) { this.firstAttempt = true; console.info('[analytics] first server write attempted'); }
    const batch = this.queue.slice(0, 20);
    let ok = false;
    try {
      const response = await this.send(`${this.endpoint}/events/server`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` }, body: JSON.stringify(batch), signal: AbortSignal.timeout(5000) });
      if (response.ok) { const ids = new Set(batch.map(e => e.id)); this.queue = this.queue.filter(e => !ids.has(e.id)); ok = true; this.lastWrite = 'ok'; }
      else this.lastWrite = 'failed';
    } catch { this.lastWrite = 'failed'; }
    finally { this.sending = false; }
    if (ok && this.queue.length >= 20) void this.flush();
  }
}
export const analyticsSink = new ServerAnalytics();
