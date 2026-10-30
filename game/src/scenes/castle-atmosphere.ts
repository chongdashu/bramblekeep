/** Lightweight, animated details on the environment lab's outer castle. */
import { MESH, hex, type InstanceBatch } from "@engine/gpu/meshes";
import { drawFlame } from "./fire";

export function flagWave(time: number, wind: number, segment: number, phase = 0): number {
  return wind * 0.28 * (segment / 6) * Math.sin(time * 2.4 - segment * 0.65 + phase);
}

export function drawCastleAtmosphere(b: InstanceBatch[], time: number, wind: number, night: number) {
  const pole = hex(0x6c5740), cloth = hex(0x306cb6), gold = hex(0xe5ba57);
  const brazier = hex(0x544436), core = hex(0xffd052);
  for (const [index, side] of [-1, 1].entries()) {
    const x = side * 11, z = -18, top = 9.45;
    b[MESH.cylinder].push(x,top,z,0,0,0,0.09,1.9,0.09,pole,0.4,0,0,0);
    // Narrow connected strips form one flexible flag, fixed at its pole.
    for (let j=0; j<6; j++) {
      const a = flagWave(time,wind,j,index), c = flagWave(time,wind,j+1,index);
      b[MESH.box].push(x+(j+0.5)*0.25,top+1.48,z+(a+c)*0.5,
        -Math.atan2(c-a,0.25),0,0,0.26,0.55,0.045,j === 5 ? gold : cloth,0.35,0,0,0);
    }
    // Two wall-top braziers give the warm light a visible source.
    for (const bx of [side*9.2]) {
      b[MESH.cylinder].push(bx,4.38,-16.9,0,0,0,0.52,0.18,0.52,brazier,0.3,0,0,0);
      drawFlame(b,bx,4.54,-16.9,0.48,time,bx);
    }
    // The outer wall's narrow windows glow more strongly after dusk.
    for (const offset of [-1.3,1.3]) {
      const flicker = 0.9 + 0.1*Math.sin(time*5+offset+side);
      b[MESH.box].push(side*8.1+offset,2.65,-16.79,0,0,0,0.21,0.72,0.06,core,0.3,0,0,0,night*1.4*flicker);
    }
  }
}
