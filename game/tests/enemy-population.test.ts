import {describe,expect,it} from 'vitest';
import {World} from '../server/world';
import {enemyPopulation,INITIAL_PATROLS,PATROL_LIMIT,COURTYARD_LIMIT} from '../src/castle-patrol';
import {PATROL_HOMES,availableReinforcement,availableCourtyardReinforcement} from '../src/castle-spawns';
import {canStand} from '../src/scenes/environment-map';
describe('enemy population',()=>{
 it('keeps the small-party patrol steady and adds a capped reserve for larger parties',()=>{
  expect(enemyPopulation(0)).toEqual({patrol:8,courtyard:4});expect(enemyPopulation(1)).toEqual({patrol:8,courtyard:4});expect(enemyPopulation(3)).toEqual({patrol:9,courtyard:4});expect(enemyPopulation(5)).toEqual({patrol:10,courtyard:6});expect(enemyPopulation(24)).toEqual({patrol:PATROL_LIMIT,courtyard:COURTYARD_LIMIT});
  const w=new World();expect(w.enemies.filter(e=>e.alive)).toHaveLength(INITIAL_PATROLS);
  for(let i=0;i<5;i++)w.join(`human-${i}`,'Knight');
  for(let i=0;i<800;i++)w.step(.05);
  expect(w.enemies.slice(0,PATROL_LIMIT).filter(e=>e.alive)).toHaveLength(PATROL_LIMIT);
  for(const [i,p] of w.players)if(i!=='human-0')p.connected=false;
  for(const e of w.enemies.slice(INITIAL_PATROLS,PATROL_LIMIT)){e.alive=false;e.deathRemaining=0;}
  w.join('ai-teammate:0','Knight');
  for(let i=0;i<600;i++)w.step(.05);
  expect(w.enemies.slice(0,PATROL_LIMIT).filter(e=>e.alive)).toHaveLength(INITIAL_PATROLS);
 });
 it('keeps homes walkable and avoids placing reinforcements on enemies as well as players',()=>{
  for(const point of PATROL_HOMES)expect(canStand(...point)).toBe(true);
  const first=availableReinforcement(0,false,0,[])!;const next=availableReinforcement(0,false,0,[],[first.point]);expect(next).not.toBeNull();expect(next!.point).not.toEqual(first.point);
  const a=availableCourtyardReinforcement(0,[])!,b=availableCourtyardReinforcement(0,[],[a.point])!;expect(b.point.x).not.toBe(a.point.x);expect(availableCourtyardReinforcement(0,[],[a.point,b.point])).toBeNull();
 });
});
