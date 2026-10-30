import { describe, expect, it } from 'vitest';
import { LeverReactions, emitLeverImpact } from '../src/lever-effects';
import { LEVERS } from '../src/gate-mechanism';
import type { GameRuntime } from '@engine/runtime';

describe('lever hit reactions', () => {
  it('emits a bounded burst at the struck mechanism', () => {
    const particles: Array<{x:number; z:number; life:number}> = [];
    const rt = { particles: { random: () => .5, spawn: (p: {x:number; z:number; life:number}) => particles.push(p) } } as unknown as GameRuntime;
    emitLeverImpact(rt, 1);
    expect(particles).toHaveLength(17);
    expect(particles.every(p => p.x === LEVERS[1].x && (Math.abs(p.z - (LEVERS[1].z + .49)) < .001 || p.z === LEVERS[1].z) && p.life < .8)).toBe(true);
    emitLeverImpact(rt, 5);
    expect(particles).toHaveLength(17);
  });
  it('reacts once per new authoritative hit, including hits on a disabled lever', () => {
    const fx = new LeverReactions();
    expect(fx.step([5, 2], .016, 1)).toEqual([]); // late join is a baseline, not a replay
    expect(fx.step([6, 2], .016, 1)).toEqual([0]);
    expect(fx.flash(0)).toBe(1);
    expect(fx.step([6, 2], .05, 1)).toEqual([]);
    expect(Math.abs(fx.angle(0))).toBeGreaterThan(.1);
    expect(fx.step([7, 2], .016, 1)).toEqual([0]);
    expect(fx.step([7, 3], .016, 1)).toEqual([1]);
    expect(fx.step([0, 0], .016, 2)).toEqual([]); // new round does not replay old hits
    expect(fx.step([1, 0], .016, 2)).toEqual([0]);
    for (let i=0; i<10; i++) fx.step([1,0], .1, 2);
    expect(fx.angle(0)).toBe(0);
  });
});
