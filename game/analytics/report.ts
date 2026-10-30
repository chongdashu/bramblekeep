import type { AnalyticsEvent, Traffic } from './contract';

export type StoredEvent = AnalyticsEvent & { receivedAt: number; source: string };
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Report sessions once, keep raw attempt counts separate, and classify traffic from the server when available. */
export function summarize(events: StoredEvent[], traffic: Traffic | 'all', build?: string) {
  const joined = (e: StoredEvent) => e.event === 'world_join' || e.event === 'world_tracking_resumed';
  const groups = new Map<string, StoredEvent[]>();
  for (const event of events) groups.set(event.sessionId, [...(groups.get(event.sessionId) ?? []), event]);
  const selected = [...groups.values()].filter(group => {
    const authoritative = group.find(e => e.source === 'server' && joined(e));
    const classification = authoritative?.traffic ?? group.find(e => e.source === 'client' && e.traffic !== 'unknown')?.traffic ?? 'unknown';
    return (traffic === 'all' || traffic === classification) && (!build || group.some(e => e.build === build));
  });
  const count = (name: string) => selected.filter(group => group.some(e => e.event === name)).length;
  const attempts = (name: string) => selected.reduce((sum, group) => sum + group.filter(e => e.event === name).length, 0);
  const breakdown = (name: string, property: string) => {
    const result: Record<string, number> = {};
    for (const group of selected) {
      const values = new Set(group.filter(e => e.event === name).map(e => e.props?.[property]).filter((value): value is string => typeof value === 'string'));
      for (const value of values) result[value] = (result[value] ?? 0) + 1;
    }
    return result;
  };
  const played = selected.filter(group => group.some(joined));
  const gateEligible = played.filter(group => { const join = group.find(joined); return join?.props?.gateOpen === false && join.props.cleared === false; });
  const clearEligible = played.filter(group => group.find(joined)?.props?.cleared === false);
  const players = new Set(played.flatMap(group => group.filter(e => joined(e) && e.playerId).map(e => e.playerId!)));
  const active = played.map(group => Math.max(0, ...group.map(e => e.activeMs ?? 0)));
  const completed = selected.map(group => {
    let end: StoredEvent | null = null;
    for (const e of [...group].filter(e => e.source === 'client').sort((a, b) => (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0) || a.timestamp - b.timestamp)) {
      if (e.event === 'session_end') end = e;
      else if (e.event === 'session_resume') end = null;
    }
    return end;
  }).filter((end): end is StoredEvent => end !== null);
  const durations = completed.map(end => end.elapsedMs ?? 0);
  const exitScreens: Record<string, number> = {};
  for (const end of completed) { const screen = end.props?.screen; if (typeof screen === 'string') exitScreens[screen] = (exitScreens[screen] ?? 0) + 1; }
  const heroes: Record<string, number> = { Knight: 0, Scout: 0, Spellcaster: 0 };
  for (const group of played) { const hero = group.find(joined)?.props?.hero; if (typeof hero === 'string' && hero in heroes) heroes[hero]++; }
  return {
    traffic, build: build ?? 'all', sessions: selected.length, pageLoads: count('page_load'),
    titleShown: count('title_shown'), menuShown: count('menu_shown'), playClicked: count('play_clicked'),
    heroSelected: count('hero_selected'), playedSessions: played.length, uniquePlayers: players.size,
    firstMove: count('first_move'), firstAttack: count('first_attack'), enemyDefeated: count('enemy_defeated'),
    gateBreached: count('gate_breached'), castleCleared: count('castle_cleared'), playerDefeated: count('player_defeated'),
    joinedWithGateOpen: played.filter(group => group.find(joined)?.props?.gateOpen === true).length,
    joinedAfterClear: played.filter(group => group.find(joined)?.props?.cleared === true).length,
    gateEligibleSessions: gateEligible.length, gateBreachedEligibleSessions: gateEligible.filter(group => group.some(e => e.event === 'gate_breached')).length,
    clearEligibleSessions: clearEligible.length, castleClearedEligibleSessions: clearEligible.filter(group => group.some(e => e.event === 'castle_cleared')).length,
    joinFailures: count('join_failed'), loadFailures: count('load_error'), unexpectedErrors: count('runtime_error'), connectionLost: count('connection_lost'), connectionRestored: count('connection_restored'),
    joinFailureReasons: breakdown('join_failed', 'reason'), loadFailureReasons: breakdown('load_error', 'reason'),
    graphicsBackends: breakdown('graphics_ready', 'backend'), graphicsFallbackStages: breakdown('graphics_ready', 'fallbackStage'),
    features: { worldStatus: count('world_status_opened'), settings: count('settings_opened'), pause: count('pause_opened'), scores: count('scores_opened'), achievementsOpened: count('achievements_opened'), chatOpened: count('chat_opened'), chatSent: count('chat_sent'), profileOpened: count('profile_opened'), profileEditAttempted: count('profile_edit_attempted') },
    joinAttempts: attempts('hero_selected'), enemyDefeats: attempts('enemy_defeated'), subsequentRounds: attempts('round_started'), heroes,
    completedSessions: completed.length, incompleteSessions: selected.length - completed.length,
    medianCompletedSessionMs: median(durations), medianObservedActivePlayMs: median(active), exitScreens,
  };
}
