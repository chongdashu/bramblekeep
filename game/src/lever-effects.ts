import type { GameRuntime } from '@engine/runtime';
import { PARTICLE } from '@engine/fx';
import { LEVERS } from './gate-mechanism';
import { motion } from '@engine/ui/tween';

/** Turn authoritative hit counters into short, presentation-only reactions. */
export class LeverReactions {
  private last: number[] | null = null;
  private round: number | null = null;
  private ages = [Infinity, Infinity];
  reset() { this.last = null; this.round = null; this.ages = [Infinity, Infinity]; }
  step(counts: readonly number[], dt: number, round = 0): number[] {
    const elapsed = Math.max(0, Math.min(dt, .1));
    this.ages = this.ages.map(age => age + elapsed);
    if (!this.last || this.round !== round) {
      this.last = [counts[0] ?? 0, counts[1] ?? 0]; this.round = round; this.ages = [Infinity, Infinity]; return [];
    }
    const hits: number[] = [];
    for (let i = 0; i < 2; i++) {
      const n = counts[i] ?? 0;
      if (n > this.last[i]) { this.ages[i] = 0; hits.push(i); }
      else if (n < this.last[i]) this.ages[i] = Infinity;
      this.last[i] = n;
    }
    return hits;
  }
  angle(index: number) {
    const age = this.ages[index] ?? Infinity;
    return motion.reduced || !Number.isFinite(age) || age > .6 ? 0 : .48 * Math.sin(age * 25) * Math.exp(-age * 7);
  }
  flash(index: number) { return Math.max(0, 1 - (this.ages[index] ?? Infinity) / .18); }
  snapshot() { return { ages: this.ages.map(age => Number.isFinite(age) ? age : -1), angles: [this.angle(0), this.angle(1)] }; }
}

/** A small bounded burst at the actual lever rather than at the attacker. */
export function emitLeverImpact(rt: GameRuntime, index: number, player?: { x: number; z: number }) {
  const lever = LEVERS[index]; if (!lever) return;
  const random = rt.particles.random;
  if (player && Math.hypot(player.x - lever.x, player.z - lever.z) < 8 && !motion.reduced) rt.camera.addTrauma(.38);
  rt.particles.spawn({ kind: PARTICLE.ring, x: lever.x, y: .2, z: lever.z, size: 1.25, life: .38, color: [1, .72, .28], glow: .35 });
  for (let i = 0; i < 16; i++) rt.particles.spawn({
    kind: PARTICLE.glow, x: lever.x + (random() - .5) * .25, y: 1.35 + random() * .25, z: lever.z + .49,
    vx: (random() - .5) * 4.2, vy: 1.2 + random() * 3, vz: (random() - .5) * 3,
    size: .13 + random() * .1, life: .4 + random() * .3, color: [1, .72 + random() * .2, .25], glow: .6, gravity: 2.5,
  });
}
