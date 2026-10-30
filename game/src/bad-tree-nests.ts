import type { GameRuntime } from '@engine/runtime';
import { MESH, hex } from '@engine/gpu/meshes';
import { BAD_TREE_NESTS } from './castle-spawns';
/** Hollow, overgrown tree stumps mark the external reinforcement entrances. */
export function drawBadTreeNests(rt:GameRuntime,time:number){
 const b=rt.batches,wood=hex(0x514333),bark=hex(0x76543a),leaf=hex(0x597846),hollow=hex(0x222a25),eyes=hex(0xf7b65c);
 for(const [i,n] of BAD_TREE_NESTS.entries()){
  b[MESH.cylinder].push(n.x,0,n.z,0,0,0,1.46,1.7,1.46,wood,.88);
  for(const side of [-1,1]){
   b[MESH.box].push(n.x+side*.5,.28,n.z+.35,side*.4,0,side*.55,.29,1.2,.36,bark,.8);
   b[MESH.cone].push(n.x+side*.51,1.5,n.z,0,0,side*.28,.68,.85,.68,wood,.85);
   b[MESH.sphere].push(n.x+side*.58,2.12,n.z,0,0,0,.95,.62,.9,leaf,.9);
   b[MESH.sphere].push(n.x+side*.24,1.39,n.z+.71,0,0,0,.15,.12,.12,eyes,.45,0,1,1,.25+.08*Math.sin(time*2+i));
  }
  b[MESH.sphere].push(n.x,2.24,n.z,0,0,0,1.0,.68,.9,leaf,.9);
  b[MESH.box].push(n.x,.55,n.z+.72,0,0,0,.77,.88,.06,hollow,.9);
  b[MESH.box].push(n.x,1.04,n.z+.76,0,0,0,.95,.15,.12,bark,.85);
  b[MESH.sphere].push(n.x,.60,n.z+.77,0,0,0,.17,.17,.08,hex(0xb975ce),.4,0,1,1,.25);
 }
}
