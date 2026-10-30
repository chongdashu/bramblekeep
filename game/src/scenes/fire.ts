/** Small, irregular flames shared by the campfire, torches and braziers. */
import { MESH, hex, type InstanceBatch } from '@engine/gpu/meshes';

const outer=hex(0xf26b20), inner=hex(0xffbb3b), tip=hex(0xff8c24);

export function flameShape(time: number, phase: number) {
  return {
    height: 0.88 + .14*Math.sin(time*6.3+phase) + .09*Math.sin(time*11.7+phase*1.7),
    lean: .12*Math.sin(time*3.8+phase) + .07*Math.sin(time*7.1+phase*2),
  };
}

export function drawFlame(b: InstanceBatch[], x: number, y: number, z: number, size: number, time: number, phase: number) {
  const a=flameShape(time,phase), c=flameShape(time+0.24,phase+1.8);
  b[MESH.cone].push(x,y,z,0,0,a.lean,size*.42,size*.78*a.height,size*.42,outer,.25,0,0,0,1.05);
  b[MESH.cone].push(x+size*.11,y+size*.02,z+size*.03,0,0,c.lean,size*.22,size*.55*c.height,size*.22,inner,.25,0,0,0,1.5);
  b[MESH.cone].push(x-size*.11,y+size*.1,z-size*.04,0,0,-c.lean,size*.17,size*.50*c.height,size*.17,tip,.25,0,0,0,.9);
}
