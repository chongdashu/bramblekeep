import type { GameRuntime } from '@engine/runtime';
import { MESH, hex } from '@engine/gpu/meshes';
import { LEVERS, LEVER_MAX_HEALTH } from './gate-mechanism';
import { updateLeverHud } from './lever-hud';

/** The two gate winches share the same locations and health as their hit volumes. */
export function drawGateLevers(rt: GameRuntime, health: readonly number[], time: number, player: { x: number; z: number; ground?: number }, cleared: boolean, cinematic: boolean, gateOpen = false, wobble: readonly number[] = [0, 0], flash: readonly number[] = [0, 0]) {
  updateLeverHud(rt, health, player, gateOpen, cleared, cinematic);
  const b = rt.batches;
  const stone = hex(0x79877e), stoneTop = hex(0xa9b6a0), iron = hex(0x344c4b);
  const wood = hex(0x72503b), woodLight = hex(0x9d714e), brass = hex(0xcda75e);
  const rope = hex(0xb7a277), blue = hex(0x65d2d6), alert = hex(0xf1a656);
  for (const [i, lever] of LEVERS.entries()) {
    const { x, z } = lever;
    const hp = Math.max(0, Math.min(1, health[i] / LEVER_MAX_HEALTH));
    const critical = hp < .025;
    // Layered stone footing and a timber frame keep the apparatus grounded.
    b[MESH.box].push(x, .11, z, 0, 0, 0, 1.38, .22, 1.24, stone, .85);
    b[MESH.box].push(x, .25, z, 0, 0, 0, 1.18, .12, 1.06, stoneTop, .85);
    for (const side of [-1, 1]) {
      b[MESH.box].push(x + side * .43, .64, z, 0, 0, 0, .16, .72, .76, wood, .8);
      b[MESH.box].push(x + side * .43, 1.02, z, 0, 0, 0, .20, .08, .80, brass, .55);
      b[MESH.box].push(x + side * .43, .37, z, 0, 0, 0, .20, .10, .80, iron, .65);
      for (const end of [-1, 1]) {
        b[MESH.sphere].push(x + side * .43, .53, z + end * .39, 0, 0, 0, .09, .09, .09, brass, .45);
      }
    }
    b[MESH.box].push(x, .42, z, 0, 0, 0, .73, .14, .62, woodLight, .8);
    // Horizontal winding drum, rope bands and a toothed wheel visible from the approach.
    b[MESH.cylinder].push(x, .71, z - .31, 0, Math.PI / 2, 0, .47, .62, .47, woodLight, .8);
    for (const offset of [-.16, 0, .16]) {
      b[MESH.cylinder].push(x, .71, z + offset - .018, 0, Math.PI / 2, 0, .50, .036, .50, rope, .8);
    }
    b[MESH.cylinder].push(x, .71, z + .33, 0, Math.PI / 2, 0, .66, .08, .66, iron, .65);
    b[MESH.cylinder].push(x, .71, z + .41, 0, Math.PI / 2, 0, .42, .025, .42, brass, .55);
    for (let tooth = 0; tooth < 8; tooth++) {
      const a = tooth * Math.PI / 4;
      b[MESH.box].push(x + Math.sin(a) * .34, .71 + Math.cos(a) * .34, z + .37, 0, 0, -a, .14, .16, .12, iron, .7);
    }
    b[MESH.sphere].push(x, .71, z + .46, 0, 0, 0, .13, .13, .13, wood, .65);
    // Lever pivots at the wheel; a bright enamel grip marks the part to strike.
    const angle = (critical ? .95 : -.36) + (wobble[i] ?? 0);
    const length = .92;
    const midX = x - Math.sin(angle) * length * .5;
    const midY = .71 + Math.cos(angle) * length * .5;
    b[MESH.box].push(midX, midY, z + .49, 0, 0, angle, .11, length, .11, brass, .55);
    const tipX = x - Math.sin(angle) * length, tipY = .71 + Math.cos(angle) * length;
    b[MESH.sphere].push(tipX, tipY, z + .49, 0, 0, 0, .30, .30, .30, (flash[i] ?? 0) > .1 ? hex(0xffe7a8) : critical ? alert : blue, .35, 0, 1, 1, critical ? .20 : .08 + (flash[i] ?? 0) * .5);
    b[MESH.sphere].push(tipX - .045, tipY + .05, z + .60, 0, 0, 0, .08, .08, .08, hex(0xe1f6df), .35);
    // Four discrete pips make repairs and damage legible at the game camera.
    b[MESH.box].push(x, 2.02, z, 0, 0, 0, 1.00, .15, .12, iron, .75);
    for (let pip = 0; pip < LEVER_MAX_HEALTH; pip++) {
      const remaining = Math.max(0, Math.min(1, hp * LEVER_MAX_HEALTH - pip));
      b[MESH.box].push(x - .36 + pip * .24, 2.03, z + .01, 0, 0, 0, .19, .11, .14, remaining > 0 ? (hp < .35 ? alert : blue) : stone, .65, 0, 1, 1, remaining * .12);
    }
    // The cable remains visible across the ground, tying each machine to the gate.
    const dx = -x, dz = -16.0 - z, len = Math.hypot(dx, dz);
    b[MESH.box].push(x + dx / 2, .12, z + dz / 2, Math.atan2(dx, dz), 0, 0, .09, .07, len, rope, .85);
    if (critical) b[MESH.sphere].push(tipX, tipY + .24 + Math.sin(time * 4 + i) * .04, z + .49, 0, 0, 0, .10, .10, .10, alert, .45, 0, 1, 1, .35);
  }
}
