import {describe,it,expect} from 'vitest';
import {CastlePatrol, PATROL_LIMIT, INITIAL_PATROLS, COURTYARD_LIMIT, COURTYARD_RESPAWN_SECONDS, enemyPopulation} from '../src/castle-patrol';
import {World} from '../server/world';
import {availableCourtyardReinforcement} from '../src/castle-spawns';
const breach=(g:{hit:(i:number)=>unknown})=>{for(let i=0;i<4;i++){g.hit(0);g.hit(1);}};
describe('dedicated courtyard defenders',()=>{
 it('uses either clear barracks and waits if both entrances are occupied',()=>{
  const a=availableCourtyardReinforcement(0,[]),b=availableCourtyardReinforcement(0,[a!.point]);
  expect(a?.point.x).toBe(-8);expect(b?.point.x).toBe(8);
  expect(availableCourtyardReinforcement(0,[a!.point,b!.point])).toBeNull();
 });
 it('populates the boss area despite a full outside patrol, then replenishes without exceeding the cap',()=>{
  for(const sim of [new CastlePatrol(),new World()]){
   // The full small-party patrol remains in place after the breach.
   sim.spawnClock=12;if(sim instanceof CastlePatrol)sim.step(.05,0,22);else sim.step(.05);
   expect(sim.enemies.slice(0,PATROL_LIMIT).filter(e=>e.alive)).toHaveLength(INITIAL_PATROLS);
   breach(sim.gate);
   const tick=()=>sim instanceof CastlePatrol?sim.step(.05,0,-23):sim.step(.05);
   tick();expect(sim.enemies[PATROL_LIMIT]?.alive).toBe(true);expect(sim.enemies[PATROL_LIMIT].z).toBeLessThan(-25);
   for(let n=0;n<(COURTYARD_RESPAWN_SECONDS*3+1)*20;n++)tick();
   expect(sim.enemies.slice(PATROL_LIMIT).filter(e=>e.alive)).toHaveLength(enemyPopulation(1).courtyard);
   expect(new Set(sim.enemies.slice(PATROL_LIMIT).filter(e=>e.alive).map(e=>e.type))).toEqual(new Set([0,1,2,3]));
   expect(sim.enemies.filter(e=>e.alive).length).toBeLessThanOrEqual(PATROL_LIMIT+COURTYARD_LIMIT);
   const e=sim.enemies[PATROL_LIMIT];e.alive=false;e.deathRemaining=0;
   for(let n=0;n<(COURTYARD_RESPAWN_SECONDS*3+1)*20;n++)tick();
   expect(sim.enemies[PATROL_LIMIT].alive).toBe(true);
  }
 });
 it('continues defending a stranded player after the gate reseals and resets between rounds',()=>{
  const world=new World(),p=world.join('hero','Knight');p.x=0;p.z=-24;
  world.step(.05);expect(world.enemies[PATROL_LIMIT]?.alive).toBe(true);
  world.victoryTimer=.01;world.step(.05);
  expect(world.enemies).toHaveLength(INITIAL_PATROLS);expect(world.enemies.slice(PATROL_LIMIT).filter(e=>e.alive)).toHaveLength(0);
 });
 it('does not spawn courtyard defenders before the breach',()=>{
  const world=new World();for(let i=0;i<400;i++)world.step(.05);
  expect(world.enemies.slice(PATROL_LIMIT).filter(e=>e.alive)).toHaveLength(0);
 });
});
