import { describe,it,expect } from 'vitest';
import { World,VICTORY_SECONDS,type Result } from '../server/world';
import { CORE_MAX_HP,BREACH_DEFEATS } from '../src/castle-patrol';
import { canStand } from '../src/scenes/environment-map';
import { CAMP_SPAWNS } from '../server/spawn';

describe('shared castle world',()=>{
 it('spawns all four patrol types with distinct movement and health profiles',()=>{
  const w=new World();expect(w.enemies.map(e=>e.type)).toEqual([0,1,2,3,0,1,2,3]);
  expect(w.enemies.map(e=>e.maxHp)).toEqual([2,3,2,4,2,3,2,4]);
 });
 it('patrols without players and ignores invalid movement',()=>{
  const w=new World(), original=w.enemies[0].x;
  for(let i=0;i<50;i++)w.step(.05);
  expect(w.enemies[0].x).not.toBe(original);
  const p=w.join('one','Knight');w.setInput('one',{x:NaN,z:1,sprint:false,attack:false});w.step(.05);expect(p.x).toBe(0);expect(p.z).toBe(22);
 });
 it('lets bots help only when a living player is nearby and reserves half the boss for players',()=>{
  const w=new World(),bot=w.join('ai-teammate:0','Knight'),hero=w.join('hero','Knight');
  w.enemies.forEach(e=>e.alive=false);Object.assign(w.guardian,{phase:2,emerge:1,cooldown:100});
  Object.assign(bot,{x:0,z:CORE_Z+1.05,yaw:Math.PI,invulnerability:100});
  const swing=()=>{for(let i=0;i<20;i++){w.setInput(bot.id,{x:0,z:0,sprint:false,attack:true});w.step(.05);}};
  swing();expect(w.coreHealth).toBe(CORE_MAX_HP);
  hero.x=0;hero.z=CORE_Z+4;hero.invulnerability=100;
  swing();expect(w.coreHealth).toBeLessThan(CORE_MAX_HP);
  w.coreHealth=CORE_MAX_HP/2+1;swing();expect(w.coreHealth).toBe(CORE_MAX_HP/2);
  swing();expect(w.coreHealth).toBe(CORE_MAX_HP/2);
  hero.x=0;hero.z=CORE_Z+1.05;hero.yaw=Math.PI;
  for(let i=0;i<20;i++){w.setInput(hero.id,{x:0,z:0,sprint:false,attack:true});w.step(.05);}
  expect(w.coreHealth).toBeLessThan(CORE_MAX_HP/2);
 });
 it('tracks separate contributions and restores an abandoned encounter',()=>{
  const records:Result[]=[];const w=new World(r=>records.push(r));
  const a=w.join('a','Knight');w.join('b','Scout');a.kills=2;w.defeats=BREACH_DEFEATS;for(let i=0;i<4;i++){w.gate.hit(0);w.gate.hit(1);}w.coreHealth=2;
  w.leave('a');expect(w.gateOpen).toBe(true);expect(records[0]).toMatchObject({id:'a',kills:2,won:false});
  w.leave('b');expect(w.gateOpen).toBe(true);expect(w.coreHealth).toBe(2);for(let i=0;i<440;i++)w.step(.05);expect(w.gateOpen).toBe(false);
 });
 it('records one victory per player and resets the world after the celebration',()=>{
  const records:Result[]=[];const w=new World(r=>records.push(r));const a=w.join('a','Knight'),b=w.join('b','Knight');a.kills=2;b.kills=3;
  w.defeats=BREACH_DEFEATS;for(let i=0;i<4;i++){w.gate.hit(0);w.gate.hit(1);}w.coreHealth=1;w.guardian.phase=2;w.guardian.emerge=1;w.guardian.cooldown=2;a.x=0;a.z=CORE_Z+1.05;a.yaw=Math.PI;w.setInput('a',{x:0,z:0,sprint:false,attack:true});
  for(let i=0;i<8;i++)w.step(.05);
  expect(w.cleared).toBe(true);expect(records).toHaveLength(2);expect(records).toEqual(expect.arrayContaining([expect.objectContaining({id:'a',kills:2,won:true}),expect.objectContaining({id:'b',kills:3,won:true})]));
  expect(w.victoryTimer).toBeGreaterThan(14);for(let i=0;i<Math.ceil((VICTORY_SECONDS+1)/.05);i++)w.step(.05);
  expect(w.round).toBe(2);expect(w.night).toBe(true);expect(w.gateOpen).toBe(false);expect(w.coreHealth).toBe(CORE_MAX_HP);expect(a.kills).toBe(0);expect(records).toHaveLength(2);
 });
 it('restores idle patrol state and abandons an interrupted battle on server restart',()=>{
  const world=new World();for(let i=0;i<20;i++)world.step(.05);const saved=world.snapshot();const resumed=new World();resumed.restore(saved);
  expect(resumed.enemies[0].x).toBe(saved.enemies[0].x);expect(resumed.round).toBe(saved.round);expect(resumed.time).toBe(saved.time);
  world.defeats=BREACH_DEFEATS;world.coreHealth=2;const interrupted=world.snapshot(),fresh=new World();fresh.restore(interrupted);
  expect(fresh.gateOpen).toBe(false);expect(fresh.coreHealth).toBe(CORE_MAX_HP);expect(fresh.round).toBe(interrupted.round+1);
 });
 it('assigns all 24 players distinct, walkable camp spawns and reuses a vacated slot',()=>{
  const world=new World();expect(CAMP_SPAWNS.length).toBeGreaterThanOrEqual(24);
  const players=Array.from({length:24},(_,i)=>world.join(`p${i}`,'Knight'));
  for(const [i,p] of players.entries()){
   expect(canStand(p.x,p.z)).toBe(true);
   for(const other of players.slice(i+1))expect(Math.hypot(p.x-other.x,p.z-other.z)).toBeGreaterThanOrEqual(1.05);
  }
  const vacated=players[7].spawnSlot;world.leave(players[7].id);const replacement=world.join('replacement','Scout');
  expect(replacement.spawnSlot).toBe(vacated);
  expect(players.filter(p=>p!==players[7]).every(p=>Math.hypot(p.x-replacement.x,p.z-replacement.z)>=1.05)).toBe(true);
 });
 it('uses a clear alternative when a player respawns at an occupied reserved point',()=>{
  const world=new World(),hero=world.join('hero','Knight'),other=world.join('other','Scout'),enemy=world.enemies[0];
  const reserved=CAMP_SPAWNS[hero.spawnSlot];other.x=reserved.x;other.z=reserved.z;
  hero.x=enemy.x;hero.z=enemy.z+.5;hero.health=1;hero.invulnerability=0;enemy.windup=.05;
  world.step(.05);
  expect(hero.health).toBe(0);expect(hero.respawnRemaining).toBeGreaterThan(2.9);
  for(let i=0;i<61;i++)world.step(.05);
  expect(hero.health).toBe(6);expect(canStand(hero.x,hero.z)).toBe(true);expect(Math.hypot(hero.x-other.x,hero.z-other.z)).toBeGreaterThanOrEqual(1.05);
 });
 it('keeps every player separated when a new world starts',()=>{
  const world=new World(),players=Array.from({length:24},(_,i)=>world.join(`p${i}`,'Knight'));
  for(const p of players){p.x=0;p.z=-26;}
  world.victoryTimer=.01;world.step(.05);
  for(const [i,p] of players.entries()){
   expect(canStand(p.x,p.z)).toBe(true);
   for(const other of players.slice(i+1))expect(Math.hypot(p.x-other.x,p.z-other.z)).toBeGreaterThanOrEqual(1.05);
  }
 });


 for(const classId of ['Scout','Spellcaster'] as const)it(`${classId} can damage and defeat an enemy with server-owned projectiles`,()=>{
  const world=new World(),player=world.join('ranged',classId),enemy=world.enemies[0];
  for(const e of world.enemies)e.alive=false;
  Object.assign(enemy,{alive:true,x:0,z:0,homeX:0,homeZ:0,hp:2,maxHp:2});
  player.x=0;player.z=3;player.yaw=Math.PI;
  for(let i=0;i<140&&enemy.alive;i++){world.setInput(player.id,{x:0,z:0,sprint:false,attack:classId==='Scout'?i%32<12:true});world.step(.05);}
  expect(enemy.alive).toBe(false);expect(player.kills).toBe(1);expect(world.defeats).toBe(1);
 });

 it('does not respawn an enemy during its death presentation',()=>{
  const world=new World(),player=world.join('hero','Knight'),enemy=world.enemies[0];
  world.enemies.push({...world.enemies[4]});Object.assign(enemy,{x:0,z:0,homeX:0,homeZ:0,hp:1});
  player.x=0;player.z=1;player.yaw=Math.PI;world.setInput(player.id,{x:0,z:0,sprint:false,attack:true});
  for(let i=0;i<10&&enemy.alive;i++)world.step(.05);
  expect(enemy.alive).toBe(false);expect(world.targets().some(t=>t.id==='enemy-0')).toBe(false);
  player.x=0;player.z=22;world.spawnClock=12;
  for(let i=0;i<20;i++)world.step(.05);expect(world.enemies[0]).toBe(enemy);
  for(let i=0;i<25;i++)world.step(.05);expect(world.enemies[0]).not.toBe(enemy);
 });

 it('acknowledges the latest valid input and rejects stale sequence numbers',()=>{
  const world=new World(),player=world.join('one','Knight');
  world.setInput('one',{seq:4,x:0,z:-1,sprint:false,attack:false});
  world.setInput('one',{seq:3,x:0,z:1,sprint:false,attack:false});
  world.step(.05);expect(player.lastSeq).toBe(4);expect(player.z).toBeLessThan(22);
 });

});
const CORE_Z=-26;
