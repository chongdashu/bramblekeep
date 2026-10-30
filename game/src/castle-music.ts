import { MAP } from './scenes/environment-map';

/** Distance from the authored camp center in world metres. */
export function campDistance(x: number, z: number): number {
  return Math.hypot(x - MAP.camp[0], z - MAP.camp[1]);
}

export interface CastleMusicState {
  cleared: boolean;
  gateOpen: boolean;
  danger: boolean;
  coreHealth: number;
  coreMaxHealth: number;
  nearCore: boolean;
  campDistance: number;
  /** Shared worlds can advance to a new round without reloading the page. */
  round?: number;
}

/** Translate observed combat into score sections; no music choice owns game state. */
export class CastleMusic {
  private combatHold = 0;
  private coreHold = 0;
  private previousCore: number | null = null;
  private round: number | undefined;
  private atCamp = false;

  reset() { this.combatHold = 0; this.coreHold = 0; this.previousCore = null; this.round = undefined; this.atCamp = false; }

  update(dt: number, state: CastleMusicState): string {
    if (state.round !== undefined && this.round !== undefined && state.round !== this.round) this.reset();
    this.round = state.round;
    // The gap between entering and leaving avoids rapid switches at the edge.
    if (Number.isFinite(state.campDistance)) this.atCamp = state.campDistance < (this.atCamp ? 8 : 6);
    const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const validCore = Number.isFinite(state.coreHealth) && Number.isFinite(state.coreMaxHealth) && state.coreMaxHealth > 0;
    if (validCore) {
      if (this.previousCore !== null && state.coreHealth < this.previousCore && !state.cleared) this.coreHold = 6;
      else if (this.previousCore !== null && state.coreHealth > this.previousCore) this.coreHold = 0;
      this.previousCore = state.coreHealth;
    }
    if (state.cleared) { this.combatHold = 0; this.coreHold = 0; return 'castleVictory'; }
    if (state.danger) this.combatHold = 4;
    else this.combatHold = Math.max(0, this.combatHold - elapsed);
    const coreUnderAttack = this.coreHold > 0;
    if (coreUnderAttack) this.coreHold = Math.max(0, this.coreHold - elapsed);
    const inAssault = state.gateOpen || state.nearCore || coreUnderAttack;
    if (inAssault && validCore && state.coreHealth > 0 && state.coreHealth / state.coreMaxHealth <= 1 / 3) return 'castleCritical';
    if (coreUnderAttack) return 'castleCore';
    if (state.gateOpen || state.nearCore) return 'castleClimax';
    if (this.combatHold > 0) return 'castleCombat';
    return this.atCamp ? 'castleCamp' : 'castleAction';
  }
}
