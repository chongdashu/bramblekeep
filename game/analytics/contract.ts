/** The only information accepted by Bramblekeep's analytics endpoint. */
export const CLIENT_EVENTS = [
  'page_load', 'title_shown', 'graphics_ready', 'load_error', 'runtime_error', 'traffic_classified', 'menu_shown',
  'play_clicked', 'hero_selected', 'join_failed', 'settings_opened', 'world_status_opened', 'pause_opened', 'scores_opened',
  'chat_opened', 'profile_opened', 'profile_edit_attempted', 'achievements_opened', 'session_checkpoint', 'session_end', 'session_resume',
] as const;
export const SERVER_EVENTS = [
  'world_join', 'world_tracking_resumed', 'world_leave', 'connection_lost', 'connection_restored',
  'first_move', 'first_attack', 'enemy_defeated', 'player_defeated',
  'gate_breached', 'castle_cleared', 'round_started', 'chat_sent',
] as const;
export type ClientEvent = typeof CLIENT_EVENTS[number];
export type ServerEvent = typeof SERVER_EVENTS[number];
export type Traffic = 'live' | 'playtest' | 'test' | 'unknown';
export type Channel = 'web' | 'wavedash';
export type EventProps = Record<string, string | number | boolean>;
export interface AnalyticsEvent {
  id: string;
  sessionId: string;
  event: ClientEvent | ServerEvent;
  timestamp: number;
  build: string;
  channel: Channel;
  traffic: Traffic;
  elapsedMs?: number;
  activeMs?: number;
  playerId?: string;
  props?: EventProps;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const propertyChecks: Record<string, (v: unknown) => boolean> = {
  hero: v => v === 'Knight' || v === 'Scout' || v === 'Spellcaster',
  reason: v => typeof v === 'string' && ['graphics', 'simulation', 'level', 'device_lost', 'unexpected', 'server_unavailable', 'version_mismatch', 'identity_unavailable', 'identity_changed', 'profile_invalid', 'profile_unavailable', 'already_joined', 'other'].includes(v),
  backend: v => v === 'webgpu' || v === 'webgl2' || v === 'unknown',
  fallback: v => typeof v === 'boolean',
  fallbackStage: v => typeof v === 'string' && ['api-unavailable', 'adapter', 'adapter-unavailable', 'adapter-timeout', 'device', 'device-timeout', 'initialization', 'initialization-timeout', 'other'].includes(v),
  screen: v => typeof v === 'string' && ['boot', 'title', 'menu', 'selecting', 'playing', 'paused', 'results'].includes(v),
  gateOpen: v => typeof v === 'boolean',
  cleared: v => typeof v === 'boolean',
  round: v => Number.isSafeInteger(v) && Number(v) > 0 && Number(v) < 1_000_000,
  players: v => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= 24,
};

/** Validate at the public boundary; reject extra fields rather than store arbitrary text. */
export function parseEvent(value: unknown, source: 'client' | 'server', now: number): AnalyticsEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  const keys = ['id', 'sessionId', 'event', 'timestamp', 'build', 'channel', 'traffic', 'elapsedMs', 'activeMs', 'playerId', 'props'];
  if (Object.keys(r).some(key => !keys.includes(key))) return null;
  if (typeof r.id !== 'string' || !uuid.test(r.id) || typeof r.sessionId !== 'string' || !uuid.test(r.sessionId)) return null;
  const allowed: readonly string[] = source === 'client' ? CLIENT_EVENTS : SERVER_EVENTS;
  if (typeof r.event !== 'string' || !allowed.includes(r.event)) return null;
  if (typeof r.timestamp !== 'number' || !Number.isSafeInteger(r.timestamp) || r.timestamp < now - 86_400_000 || r.timestamp > now + 300_000) return null;
  if (typeof r.build !== 'string' || !/^[a-zA-Z0-9_.-]{1,100}$/.test(r.build)) return null;
  if (r.channel !== 'web' && r.channel !== 'wavedash') return null;
  if (r.traffic !== 'live' && r.traffic !== 'playtest' && r.traffic !== 'test' && r.traffic !== 'unknown') return null;
  for (const key of ['elapsedMs', 'activeMs']) {
    const n = r[key];
    if (n !== undefined && (!Number.isSafeInteger(n) || Number(n) < 0 || Number(n) > 86_400_000)) return null;
  }
  if (r.playerId !== undefined && (source !== 'server' || typeof r.playerId !== 'string' || !/^[a-f0-9]{64}$/.test(r.playerId))) return null;
  if (r.props !== undefined) {
    if (!r.props || typeof r.props !== 'object' || Array.isArray(r.props)) return null;
    const props = r.props as Record<string, unknown>;
    if (Object.keys(props).length > 8 || Object.entries(props).some(([key, val]) => !propertyChecks[key]?.(val))) return null;
  }
  return r as unknown as AnalyticsEvent;
}
