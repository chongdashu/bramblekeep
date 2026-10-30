import { describe,expect,it } from 'vitest';
import { Guardian, GUARDIAN_BOUNDS, GUARDIAN_EMERGE_SECONDS, GUARDIAN_WINDUP_SECONDS, GUARDIAN_REVEAL_HEALTH as REVEAL } from '../src/guardian';
import { CastlePatrol, CORE_MAX_HP } from '../src/castle-patrol';
import { World } from '../server/world';
import { AttackWindow } from '../src/castle-combat';

const tick=(g:Guardian,seconds:number,health:number,x=0,z=-24.8)=>{let hits:string[]=[];for(let i=0;i<Math.ceil(seconds/.05);i++)hits.push(...g.step(.05,health,[{id:'hero',x,z}],true,false));return hits;};
describe('castle guardian encounter',()=>{
 it('stays rooted until half health, emerges before chasing and telegraphs its attack',()=>{
  const g=new Guardian();expect(tick(g,3,REVEAL+1)).toEqual([]);expect(g.phase).toBe(0);expect(g.z).toBe(-26);
  tick(g,GUARDIAN_EMERGE_SECONDS/2,REVEAL);expect(g.phase).toBe(1);expect(g.emerge).toBeGreaterThan(0);expect(g.z).toBe(-26);
  tick(g,1,REVEAL);expect(g.phase).toBe(2);
  expect(tick(g,2,REVEAL)).toContain('hero');expect(g.attackCue).toBeGreaterThanOrEqual(0);
  g.reset();expect(g.phase).toBe(0);expect(g.z).toBe(-26);
 });
 it('chases only reachable players and stops attacking after defeat',()=>{
  const g=new Guardian();tick(g,2,REVEAL,0,-22);const start=g.z;tick(g,2,REVEAL,0,-22);expect(g.z).toBeGreaterThan(start);
  expect(g.step(.05,0,[{id:'hero',x:g.x,z:g.z}],true,true)).toEqual([]);
 });
 it('uses its moving location as the combat target in solo and multiplayer',()=>{
  const solo=new CastlePatrol(),world=new World();
  for(const sim of [solo,world]){sim.guardian.x=1.2;sim.guardian.z=-24;const core=sim.targets().find(t=>t.id==='core');expect(core).toMatchObject({x:1.2,z:-24});}
 });
 it('reveals from actual core hits and remains attackable while moving',()=>{
  const solo=new CastlePatrol();solo.enemies.forEach(e=>e.alive=false);
  const swing=()=>{const w=new AttackWindow();w.start();w.advance(.2);return solo.hit(w,solo.guardian.x,solo.guardian.z+1,Math.PI,'Knight');};
  for(let i=0;i<CORE_MAX_HP-REVEAL;i++)expect(swing().coreHit).toBe(true);
  expect(solo.coreHealth).toBe(REVEAL);expect(solo.guardian.phase).toBe(1);
  for(let i=0;i<75;i++)solo.step(.05,0,-22);
  expect(solo.guardian.phase).toBe(2);expect(solo.guardian.z).toBeGreaterThan(-26);
  expect(swing().coreHit).toBe(true);expect(solo.coreHealth).toBe(REVEAL-1);
  solo.reset();expect(solo.guardian.phase).toBe(0);expect(solo.guardian.z).toBe(-26);
 });
 it('damages players only after awakening in both simulations',()=>{
  const solo=new CastlePatrol();solo.enemies.forEach(e=>e.alive=false);solo.coreHealth=REVEAL;
  const w=new World(),p=w.join('hero','Knight');w.enemies.forEach(e=>e.alive=false);w.coreHealth=REVEAL;p.x=0;p.z=-24.8;
  for(let i=0;i<90;i++){solo.step(.05,0,-24.8);w.step(.05);}
  expect(solo.health).toBeLessThan(6);expect(p.health).toBeLessThan(6);
 });
 it('slams multiple players for two health and knocks them away without crossing walls',()=>{
  const w=new World();w.enemies.forEach(e=>e.alive=false);
  const a=w.join('a','Knight'),b=w.join('b','Scout');
  Object.assign(a,{x:0,z:-24.8,invulnerability:0});Object.assign(b,{x:.7,z:-24.8,invulnerability:0});
  w.coreHealth=REVEAL;Object.assign(w.guardian,{phase:2,emerge:1,yaw:0,windup:.05});
  w.step(.05);
  expect(a.health).toBe(4);expect(b.health).toBe(4);
  expect(a.z).toBeGreaterThan(-24.8);expect(Math.hypot(b.x,b.z+26)).toBeGreaterThan(2);
 });
 it('commits its direction, lets players dodge, and hits every hero in the shown strike',()=>{
  const g=new Guardian();g.phase=2;g.emerge=1;
  const initial=[{id:'a',x:0,z:-24.8},{id:'b',x:.6,z:-24.7}];
  g.step(.05,REVEAL,initial,true,false);expect(g.windup).toBe(GUARDIAN_WINDUP_SECONDS);const yaw=g.yaw;
  let hits:string[]=[];
  const moved=[{id:'a',x:2,z:-24.8},{id:'b',x:.6,z:-24.7},{id:'c',x:-.6,z:-24.7}];
  for(let i=0;i<21;i++){hits.push(...g.step(.05,REVEAL,moved,true,false));expect(g.yaw).toBe(yaw);}
  expect(hits.sort()).toEqual(['b','c']);expect(g.cooldown).toBeGreaterThan(1);
 });
 it('protects the awakening and windup but takes damage during recovery in solo and server',()=>{
  const solo=new CastlePatrol(),world=new World();solo.enemies.forEach(e=>e.alive=false);world.enemies.forEach(e=>e.alive=false);
  const player=world.join('hero','Knight');player.x=0;player.z=-24.8;player.yaw=Math.PI;
  const swing=()=>{const w=new AttackWindow();w.start();w.advance(.2);return solo.hit(w,0,-24.8,Math.PI,'Knight');};
  const attackWorld=()=>{player.swing=new AttackWindow();world.setInput('hero',{x:0,z:0,sprint:false,attack:true});for(let i=0;i<8;i++)world.step(.05);world.setInput('hero',{x:0,z:0,sprint:false,attack:false});};
  for(const phase of [1,2]){
   solo.coreHealth=world.coreHealth=REVEAL;solo.guardian.phase=world.guardian.phase=phase;
   solo.guardian.windup=world.guardian.windup=phase===2?GUARDIAN_WINDUP_SECONDS:0;
   expect(swing().coreHit).toBe(false);attackWorld();expect(world.coreHealth).toBe(REVEAL);
  }
  solo.guardian.windup=0;world.guardian.windup=0;world.guardian.cooldown=2;
  expect(swing().coreHit).toBe(true);attackWorld();expect(world.coreHealth).toBe(REVEAL-1);
 });

 it('stays in the courtyard when a target retreats through the open gate',()=>{
  const g=new Guardian();g.phase=2;g.emerge=1;
  for(let i=0;i<200;i++)g.step(.05,REVEAL,[{id:'hero',x:0,z:-21.5}],true,false);
  expect(g.z).toBeGreaterThan(-26);
  for(let i=0;i<300;i++)g.step(.05,REVEAL,[{id:'hero',x:0,z:-18}],true,false);
  for(let i=0;i<300;i++)g.step(.05,REVEAL,[{id:'hero',x:0,z:-12}],true,false);
  expect(g.z).toBeLessThanOrEqual(GUARDIAN_BOUNDS.maxZ);expect(g.z).toBeGreaterThanOrEqual(GUARDIAN_BOUNDS.minZ);
 });
 it('recovers an escaped live guardian without resetting the fight or health',()=>{
  for(const sim of [new CastlePatrol(),new World()]){
   sim.coreHealth=9;Object.assign(sim.guardian,{x:0,z:-13,phase:2,emerge:1,windup:.5});
   if(sim instanceof CastlePatrol)sim.step(.05,0,22);else sim.step(.05);
   expect(sim.coreHealth).toBe(9);expect(sim.guardian.phase).toBe(2);expect(sim.guardian.emerge).toBe(1);
   expect(sim.guardian.x).toBe(0);expect(sim.guardian.z).toBe(-26);expect(sim.guardian.windup).toBe(0);
   expect(sim.targets().find(t=>t.id==='core')).toMatchObject({x:0,z:-26});
  }
 });

 it('keeps the boss away from spawn doors and returns it to the central roots',()=>{
  const g=new Guardian();g.phase=2;g.emerge=1;
  for(let i=0;i<500;i++)g.step(.05,REVEAL,[{id:'hero',x:-6,z:-26}],true,false);
  expect(g.x).toBeGreaterThanOrEqual(GUARDIAN_BOUNDS.minX);
  expect(g.x).toBeLessThan(-3);
  for(let i=0;i<200;i++)g.step(.05,REVEAL,[],true,false);
  expect(Math.hypot(g.x,g.z+26)).toBeLessThan(.1);
  expect(g.phase).toBe(2);
 });

 it('recovers a guardian stranded beside an enemy spawn doorway',()=>{
  const g=new Guardian();Object.assign(g,{x:-9,z:-27,phase:2,emerge:1,windup:.5});
  g.step(.05,9,[],true,false);
  expect(g).toMatchObject({x:0,z:-26,phase:2,emerge:1,windup:0});
 });

});
