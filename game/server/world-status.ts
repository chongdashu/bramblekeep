import { matchMaker } from '@colyseus/core';
import type { CastleRoom } from './room';
import { CASTLE_PROTOCOL } from '../src/multiplayer-protocol';
import { isTeammate } from './teammates';

/** Read-only view of the single local world; never reserves a room seat. */
export async function worldStatus() {
  const rooms = await matchMaker.query({ name: 'castle' });
  const room = rooms.length ? matchMaker.getLocalRoomById(rooms[0].roomId) as CastleRoom | undefined : undefined;
  if (!room?.state) return null;
  const state = room.state;
  const players = [...state.scores.entries()].filter(([,player]) => player.connected).map(([id,player]) => ({ name: player.name, classId: player.classId, isBot: isTeammate(id) }));
  return {
    protocol: CASTLE_PROTOCOL,
    players,
    teammateTarget: room.teammateTarget,
    gate: state.cleared ? 'cleared' : state.gateOpen ? 'open' : 'locked',
    night: state.night,
    enemies: [...state.enemies.values()].filter(enemy => enemy.alive).length,
    round: state.round,
    guardian: {
      x: state.guardianX, z: state.guardianZ, phase: state.guardianPhase,
      emerge: state.guardianEmerge, health: state.coreHealth,
      cleared: state.cleared, victoryRemaining: state.victoryRemaining,
    },
  };
}
