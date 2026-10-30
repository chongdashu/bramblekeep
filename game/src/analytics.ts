import { platform, storageKey } from '@engine/platform';
import type { AnalyticsEvent, Channel, ClientEvent, EventProps, Traffic } from '../analytics/contract';

const PREF = storageKey('analytics-optout');
const LEGACY_PREF = 'bramblekeep.analytics.optout';
const MAX_QUEUE = 100;
function eventId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
}
const validSite = (value: unknown, test: boolean): string | null => {
  try {
    const url = new URL(String(value));
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    if (url.protocol === 'https:' && url.hostname.endsWith('.convex.site')) return url.origin;
    if (test && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) return url.origin;
  } catch { /* absent or malformed */ }
  return null;
};
function classification(token: string | null): Traffic {
  try {
    if (!token) return 'unknown';
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const playtest = import.meta.env.VITE_BRAMBLEKEEP_WAVEDASH_PLAYTEST_GCID;
    const live = import.meta.env.VITE_BRAMBLEKEEP_WAVEDASH_LIVE_GCID;
    return payload.gcid && playtest && payload.gcid === playtest ? 'playtest' : payload.gcid && live && payload.gcid === live ? 'live' : 'unknown';
  } catch { return 'unknown'; }
}
function optedOut(): boolean {
  try { return platform.storage?.getItem(PREF) === '1' || localStorage.getItem(PREF) === '1' || localStorage.getItem(LEGACY_PREF) === '1'; } catch { return false; }
}
function saveChoice(off: boolean) {
  try { platform.storage?.setItem(PREF, off ? '1' : '0'); localStorage.setItem(PREF, off ? '1' : '0'); localStorage.removeItem(LEGACY_PREF); } catch { /* storage can be unavailable */ }
}

/** Captures boot before renderer creation; no network is sent until platform storage is restored. */
class GameAnalytics {
  private site: string | null;
  private liveSite: string | null;
  private liveServer: boolean;
  private canCollect: boolean;
  private ready = false;
  private initializing = false;
  private consented = true;
  private session = eventId();
  private started = performance.now();
  private activeSince: number | null = null;
  private activeTotal = 0;
  private joined = false;
  private inResults = false;
  private ended = false;
  private queue: AnalyticsEvent[] = [];
  private inflight = false;
  private titleSeen = false;
  private fatalSeen = false;
  private unexpectedSeen = false;
  private lastPhase = 'boot';
  private traffic: Traffic = 'unknown';
  private channel: Channel = platform.id === 'wavedash' ? 'wavedash' : 'web';
  private build = String(import.meta.env.VITE_BUILD_ID || 'development').replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 100);
  private listeners = new Set<(enabled: boolean) => void>();

  constructor() {
    const test = import.meta.env.DEV && import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_TEST === '1';
    this.site = validSite(import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_SITE, test);
    this.liveSite = validSite(import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_LIVE_SITE, test);
    // An explicitly enabled local test may simulate production only with a
    // disposable local endpoint, never a real production Convex deployment.
    if (test && this.liveSite && !this.liveSite.startsWith('http://')) this.liveSite = null;
    this.liveServer = this.channel === 'wavedash' && !!import.meta.env.VITE_BRAMBLEKEEP_ANALYTICS_LIVE_SITE;
    if (typeof document === 'undefined') { this.canCollect = false; return; }
    const query = new URLSearchParams(location.search);
    this.canCollect = !!this.site && platform.ownAnalytics && (import.meta.env.PROD || test) && !query.has('capture') && (!query.has('autostart') || test) && (!navigator.webdriver || test);
    this.consented = !optedOut();
    if (!this.canCollect) return;
    this.track('page_load');
    const observer = new MutationObserver(() => this.observe());
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-phase'] });
    for (const element of [document.querySelector('#press-start'), document.querySelector('#fatal')]) {
      if (element) observer.observe(element, { attributes: true, attributeFilter: ['hidden'] });
    }
    const unexpected = () => { if (!this.unexpectedSeen) { this.unexpectedSeen = true; this.track('runtime_error', { reason: 'unexpected' }); void this.flush(); } };
    addEventListener('error', unexpected);
    addEventListener('unhandledrejection', unexpected);
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-act="play"]')) this.track('play_clicked');
      if (target?.closest('[data-act="settings"], #pause-settings')) this.track('settings_opened');
      if (target?.closest('.world-toggle')) queueMicrotask(() => { if (document.querySelector<HTMLElement>('.world-details')?.hidden === false) this.track('world_status_opened'); });
    }, true);
    document.addEventListener('focusin', event => { if (event.target instanceof Element && event.target.matches('.chat-input')) this.track('chat_opened'); if (event.target instanceof Element && event.target.matches('#player-name')) this.track('profile_opened'); });
    document.addEventListener('change', event => { if (event.target instanceof Element && event.target.matches('#player-name')) this.track('profile_edit_attempted'); });
    document.addEventListener('visibilitychange', () => { this.syncClock(); if (document.hidden) { this.track('session_checkpoint', { screen: this.screen() }); void this.flush(true); } });
    addEventListener('pagehide', () => {
      this.syncClock(); this.ended = true; this.track('session_end', { screen: this.screen() });
      if (this.initializing && !this.ready) this.finish('unknown', true);
      else void this.flush(true);
    });
    addEventListener('pageshow', event => { if (event.persisted && this.ended) { this.ended = false; this.track('session_resume'); this.syncClock(); } });
    setInterval(() => { if (this.ready && this.consented && !this.ended) { this.track('session_checkpoint', { screen: this.screen() }); void this.flush(); } }, 30_000);
  }
  /** Called after host storage restoration, before the engine creates a renderer. */
  platformReady() {
    if (!this.canCollect || this.ready || this.initializing) return;
    this.initializing = true;
    this.consented = !optedOut();
    if (!this.consented) this.queue = [];
    this.installChoice();
    if (this.channel === 'wavedash') {
      // The SDK's identity can arrive only after the host reveals the title.
      // Keep boot events together until classified; unknown sessions fail
      // closed to development rather than switching databases mid-session.
      const deadline = performance.now() + 10_000;
      const poll = async () => {
        if (this.ready) return;
        let traffic: Traffic = 'unknown';
        try {
          const token = await Promise.race([platform.userToken?.() ?? Promise.resolve(null), new Promise<null>(resolve => setTimeout(() => resolve(null), 500))]);
          traffic = classification(token);
        } catch { /* retry until the deadline */ }
        if (this.ready) return;
        if (traffic === 'live' && !this.liveSite) traffic = 'unknown';
        if (traffic !== 'unknown' || performance.now() >= deadline) this.finish(traffic);
        else setTimeout(poll, 200);
      };
      void poll();
    } else this.finish(import.meta.env.DEV ? 'test' : 'unknown');
  }
  private finish(traffic: Traffic, keepalive = false) {
    if (this.ready) return;
    this.traffic = traffic;
    if (traffic === 'live' && this.liveSite) this.site = this.liveSite;
    for (const event of this.queue) event.traffic = traffic;
    this.ready = true;
    this.syncClock();
    if (this.channel === 'wavedash' && traffic !== 'unknown') this.track('traffic_classified');
    for (const listener of this.listeners) listener(this.enabled());
    void this.flush(keepalive);
  }
  private installChoice() {
    const card = document.querySelector('#settings-pop .pcard');
    if (!card || document.querySelector('#bramblekeep-analytics-toggle')) return;
    const row = document.createElement('div'); row.className = 'set-row';
    const label = document.createElement('span'); label.textContent = 'Anonymous game analytics';
    const button = document.createElement('button'); button.id = 'bramblekeep-analytics-toggle'; button.className = 'toggle'; button.type = 'button';
    const paint = () => { button.textContent = this.consented ? 'On' : 'Off'; button.setAttribute('aria-label', `Anonymous game analytics ${this.consented ? 'on' : 'off'}`); button.setAttribute('aria-pressed', String(this.consented)); };
    button.addEventListener('click', () => {
      this.syncClock(); this.consented = !this.consented; saveChoice(!this.consented);
      if (!this.consented) { this.queue = []; this.activeSince = null; }
      else { this.session = eventId(); this.started = performance.now(); this.activeTotal = 0; this.ended = false; this.track('session_resume'); this.syncClock(); }
      for (const listener of this.listeners) listener(this.enabled());
      paint(); if (this.consented) void this.flush();
    });
    row.append(label, button); card.append(row); paint();
  }
  subscribe(listener: (enabled: boolean) => void) { this.listeners.add(listener); }
  enabled() { return this.canCollect && this.ready && this.consented; }
  joinContext() { return this.enabled() && (!this.liveServer || this.traffic === 'live') ? { sessionId: this.session, build: this.build, channel: this.channel } : undefined; }
  setJoined(joined: boolean) { this.syncClock(); this.joined = joined; this.syncClock(); }
  setResults(showing: boolean) { if (this.inResults !== showing) { this.syncClock(); this.inResults = showing; this.syncClock(); } }
  private syncClock() {
    const now = performance.now();
    if (this.activeSince !== null) { this.activeTotal += Math.max(0, now - this.activeSince); this.activeSince = null; }
    if (this.consented && this.joined && !this.inResults && !this.ended && !document.hidden && document.body.dataset.phase === 'playing') this.activeSince = now;
  }
  private screen(): string {
    const phase = document.body.dataset.phase;
    if (phase === 'paused') return 'paused';
    if (this.inResults) return 'results';
    const selection = document.querySelector<HTMLElement>('.multiplayer-join');
    if (selection && !selection.hidden) return 'selecting';
    if (phase === 'playing') return 'playing';
    if (phase === 'menu') return 'menu';
    if (this.titleSeen) return 'title';
    return 'boot';
  }
  private observe() {
    this.syncClock();
    const phase = document.body.dataset.phase ?? 'boot';
    if (phase === 'menu' && this.lastPhase !== 'menu') this.track('menu_shown');
    if (phase === 'paused' && this.lastPhase !== 'paused') this.track('pause_opened');
    this.lastPhase = phase;
    if (!this.titleSeen && !(document.querySelector<HTMLElement>('#press-start')?.hidden ?? true)) {
      this.titleSeen = true; this.track('title_shown');
      const info = (window as unknown as { __game?: { graphics?: () => { backend?: string; fallbackReason?: string | null } } }).__game?.graphics?.();
      const backend = info?.backend === 'webgpu' || info?.backend === 'webgl2' ? info.backend : 'unknown';
      const stages = ['api-unavailable', 'adapter', 'adapter-unavailable', 'adapter-timeout', 'device', 'device-timeout', 'initialization', 'initialization-timeout'];
      const fallbackStage = info?.fallbackReason ? (stages.includes(info.fallbackReason) ? info.fallbackReason : 'other') : undefined;
      this.track('graphics_ready', { backend, fallback: !!info?.fallbackReason, ...(fallbackStage ? { fallbackStage } : {}) });
    }
    const fatal = document.querySelector<HTMLElement>('#fatal');
    if (fatal && !fatal.hidden) {
      const title = fatal.querySelector('h2')?.textContent ?? '';
      const reason = title.includes('lost') ? 'device_lost' : title.includes('Graphics') ? 'graphics' : title.includes('Simulation') || title.includes('simulation') ? 'simulation' : title.includes('level') ? 'level' : 'unexpected';
      this.reportFatal(reason);
    }
  }
  private reportFatal(reason: string) { if (!this.fatalSeen) { this.fatalSeen = true; this.track('load_error', { reason }); void this.flush(true); } }
  track(event: ClientEvent, props?: EventProps) {
    if (!this.canCollect || !this.consented) return;
    this.syncClock();
    const elapsedMs = Math.min(86_400_000, Math.round(performance.now() - this.started));
    const activeMs = Math.min(86_400_000, Math.round(this.activeTotal));
    this.queue.push({ id: eventId(), sessionId: this.session, event, timestamp: Date.now(), build: this.build, channel: this.channel, traffic: this.traffic, elapsedMs, activeMs, ...(props ? { props } : {}) });
    if (this.queue.length > MAX_QUEUE) this.queue.shift();
    if (this.queue.length >= 20 || ['title_shown', 'menu_shown', 'hero_selected', 'join_failed', 'load_error'].includes(event)) void this.flush();
  }
  private async flush(keepalive = false) {
    if (!this.enabled() || !this.site || (this.inflight && !keepalive) || !this.queue.length) return;
    const ownsFlight = !this.inflight;
    if (ownsFlight) this.inflight = true;
    // The last batch includes the final checkpoint even after a long offline spell.
    const batch = keepalive ? this.queue.slice(-20) : this.queue.slice(0, 20);
    let sentSuccessfully = false;
    try {
      const response = await fetch(`${this.site}/events/client`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(batch), keepalive, credentials: 'omit' });
      if (response.ok && this.consented) { const sent = new Set(batch.map(e => e.id)); this.queue = this.queue.filter(e => !sent.has(e.id)); sentSuccessfully = true; }
    } catch { /* bounded queue retries at the next checkpoint */ }
    finally { if (ownsFlight) this.inflight = false; }
    if (sentSuccessfully && this.queue.length && this.enabled()) void this.flush();
  }
}

export const analytics = new GameAnalytics();
