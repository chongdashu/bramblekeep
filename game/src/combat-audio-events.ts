import { LEVERS } from './gate-mechanism';
import { CORE_X, CORE_Z } from './castle-patrol';

export type CombatAudioCue = 'enemyAttack' | 'hit' | 'leverHit' | 'leverDown' | 'heartHit' | 'gateClose';
export interface CombatAudioSnapshot {
  round: number;
  gateOpen: boolean;
  cleared: boolean;
  coreHealth: number;
  corePosition?: {x:number;z:number};
  guardianAttack?: number;
  leverHealth: readonly number[];
  leverHits: readonly number[];
  enemies: readonly { id: string; x: number; z: number; hp: number; attackSeq: number }[];
}
export type CombatAudioEvent = { cue: CombatAudioCue; x: number; z: number };

/** Convert authoritative changes into one-shot sounds, without replaying a join/reset snapshot. */
export class CombatAudioEvents {
  private previous: CombatAudioSnapshot | null = null;
  reset() { this.previous = null; }
  update(current: CombatAudioSnapshot, audible = true): CombatAudioEvent[] {
    const before = this.previous;
    // Colyseus schema objects mutate in place; store values rather than references.
    this.previous = { ...current, leverHealth:[...current.leverHealth], leverHits:[...current.leverHits], enemies:current.enemies.map(e=>({...e})) };
    if (!before || before.round !== current.round || !audible) return [];
    const events: CombatAudioEvent[] = [];
    const oldEnemies = new Map(before.enemies.map(e=>[e.id,e]));
    for (const enemy of current.enemies) {
      const old = oldEnemies.get(enemy.id);
      if (!old) continue;
      if (enemy.attackSeq > old.attackSeq) events.push({cue:'enemyAttack',x:enemy.x,z:enemy.z});
      if (enemy.hp < old.hp) events.push({cue:'hit',x:enemy.x,z:enemy.z});
    }
    for (let i=0;i<LEVERS.length;i++) {
      if (current.leverHits[i] <= before.leverHits[i]) continue;
      const {x,z}=LEVERS[i]; events.push({cue:'leverHit',x,z});
      if (before.leverHealth[i] > 0 && current.leverHealth[i] <= 0) events.push({cue:'leverDown',x,z});
    }
    if ((current.guardianAttack??0)>0 && (before.guardianAttack??0)<=0 && current.corePosition) events.push({cue:'enemyAttack',...current.corePosition});
    if (current.coreHealth < before.coreHealth && !current.cleared) events.push({cue:'heartHit',x:current.corePosition?.x??CORE_X,z:current.corePosition?.z??CORE_Z});
    if (before.gateOpen && !current.gateOpen && !current.cleared) events.push({cue:'gateClose',x:0,z:-16});
    return events;
  }
}
