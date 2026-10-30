import { describe,expect,it } from 'vitest';
import { BAD_TREE_NESTS, reinforcementSpawn, availableReinforcement } from '../src/castle-spawns';
import { LEVERS } from '../src/gate-mechanism';
import { canStand,moveOnMap } from '../src/scenes/environment-map';
import { CastlePatrol } from '../src/castle-patrol';
import { World } from '../server/world';

describe('reinforcement sources',()=>{
 it('separates reachable levers on opposite sides of the gate',()=>{
  expect(LEVERS[0].x).toBeLessThanOrEqual(-9);expect(LEVERS[1].x).toBeGreaterThanOrEqual(9);
  for(const lever of LEVERS)expect(canStand(lever.x,lever.z+1)).toBe(true);
 });
 it('keeps tree hollows and castle interiors inaccessible while exits are clear',()=>{
  for(const t of BAD_TREE_NESTS){expect(canStand(t.x,t.z)).toBe(false);expect(canStand(t.x,t.z+1.15)).toBe(true);}
  for(const open of [false,true])for(let i=0;i<(open?6:4);i++){
   const p=reinforcementSpawn(0,open,i);expect(canStand(p.x,p.z,open)).toBe(true);expect(moveOnMap(p.x,p.z,0,1,open)[1]).toBeCloseTo(p.z+1);
  }
 });
 it('skips occupied exits and waits only when every source is occupied',()=>{
  const sources=Array.from({length:4},(_,i)=>reinforcementSpawn(0,false,i));
  expect(availableReinforcement(0,false,0,[sources[0]])?.serial).toBe(1);
  expect(availableReinforcement(0,false,0,sources)).toBeNull();
 });
 it('rotates sources across respawns for both solo and shared simulations',()=>{
  for(const sim of [new CastlePatrol(),new World()]){
   const positions=[];
   for(let i=0;i<4;i++){
    sim.enemies[0].alive=false;sim.enemies[0].deathRemaining=0;sim.spawnClock=12;
    if(sim instanceof CastlePatrol)sim.step(.01,0,22);else sim.step(.01);
    positions.push([sim.enemies[0].x,sim.enemies[0].z]);
   }
   for(const [i,[x,z]] of positions.entries()){const p=reinforcementSpawn(0,false,i);expect(x).toBeCloseTo(p.x,1);expect(z).toBeCloseTo(p.z,1);}
  }
 });
});
