import type { Score } from './social';
import type { Player } from './world';
import { isTeammate, teammateName } from './teammates';

/** Freeze human contributions and live AI teammates together for the completed round. */
export function freezeVictoryRoster(humans: Iterable<Score>, players: Iterable<Player>): Score[] {
  const roster = Array.from(humans, row => ({ ...row }));
  for (const player of players) if (isTeammate(player.id)) roster.push({
    id:player.id, name:teammateName(player.id), classId:player.classId, kills:player.kills, connected:player.connected,
  });
  return roster;
}
