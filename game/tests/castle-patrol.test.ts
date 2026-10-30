import { describe,expect,it } from 'vitest';
import { CastlePatrol,PATROL_LIMIT,INITIAL_PATROLS,RESPAWN_SECONDS,CORE_X,CORE_Z,CORE_MAX_HP } from '../src/castle-patrol';
import { GUARDIAN_REVEAL_HEALTH } from '../src/guardian';
import { AttackWindow,attackVolume } from '../src/castle-combat';
import { moveOnMap } from '../src/scenes/environment-map';
import { reinforcementSpawn } from '../src/castle-spawns';
const run=(p:CastlePatrol,seconds:number,x:number,z:number)=>{for(let i=0;i<seconds*10;i++)p.step(.1,x,z);};
function swingAt(p:CastlePatrol,x:number,z:number){const w=new AttackWindow();w.start();w.advance(.2);return p.hit(w,x,z,Math.PI,'Knight');}
describe('castle assault',()=>{
 it('patrols quietly, then pursues and damages nearby players',()=>{const p=new CastlePatrol(),e=p.enemies[0],start=[e.x,e.z];run(p,2,0,22);expect([e.x,e.z]).not.toEqual(start);expect(e.engaged).toBe(false);expect(p.health).toBe(6);run(p,1,e.x,e.z+2);expect(e.engaged).toBe(true);run(p,3,e.x,e.z);expect(p.health).toBeLessThan(6);});
 it('telegraphs attacks and allows the player to step out of reach',()=>{const p=new CastlePatrol(),e=p.enemies[0];p.enemies.slice(1).forEach(other=>other.alive=false);const x=e.x,z=e.z;p.step(.1,x,z+.8);expect(e.windup).toBeGreaterThan(0);expect(p.health).toBe(6);run(p,.6,x,z+3);expect(p.health).toBe(6);expect(e.attackCue).toBeGreaterThan(0);expect(e.attackCooldown).toBeGreaterThan(0);});
 it('applies damage during the active window once per enemy per swing',()=>{const p=new CastlePatrol(),e=p.enemies[0],w=new AttackWindow();w.start();const x=e.x,z=e.z+1;expect(p.hit(w,x,z,Math.PI,'Knight').hits).toBe(0);w.advance(.2);expect(p.hit(w,x,z,Math.PI,'Knight').hits).toBe(1);expect(e.hp).toBe(e.maxHp-1);expect(p.hit(w,x,z,Math.PI,'Knight').hits).toBe(0);expect(e.alive).toBe(true);swingAt(p,x,z);expect(e.alive).toBe(false);});
 it('keeps a defeated enemy untargetable until its fall has finished before respawning',()=>{
  const p=new CastlePatrol(),e=p.enemies[0];p.enemies.push({...p.enemies[4]});
  swingAt(p,e.x,e.z+1);swingAt(p,e.x,e.z+1);expect(e.alive).toBe(false);
  expect(p.targets().some(t=>t.id==='enemy-0')).toBe(false);
  p.spawnClock=RESPAWN_SECONDS;run(p,1,0,22);expect(p.enemies[0]).toBe(e);
  run(p,1.2,0,22);expect(p.enemies[0]).not.toBe(e);expect(p.enemies[0].alive).toBe(true);
 });
 it('detects targets entering the volume after the swing began',()=>{const p=new CastlePatrol(),e=p.enemies[0],w=new AttackWindow();w.start();w.advance(.16);expect(p.hit(w,e.x,e.z+5,Math.PI,'Knight').hits).toBe(0);w.advance(.05);expect(p.hit(w,e.x,e.z+1,Math.PI,'Knight').hits).toBe(1);w.advance(.2);expect(w.active).toBe(false);expect(attackVolume(0,0,Math.PI,'Knight').z).toBeLessThan(0);});
 it('breaches only when both levers are damaged and allows exit after repair',()=>{const p=new CastlePatrol();swingAt(p,0,-15);expect(p.coreHealth).toBe(CORE_MAX_HP);expect(moveOnMap(0,-15,0,-7)[1]).toBeGreaterThan(-20);p.defeats=99;expect(p.gateOpen).toBe(false);for(let i=0;i<4;i++){swingAt(p,-9,-13.3);swingAt(p,9,-13.3);}expect(p.gateOpen).toBe(true);expect(p.invulnerability).toBeGreaterThan(2);expect(moveOnMap(0,-15,0,-7,true)[1]).toBeLessThan(-21);for(let i=0;i<CORE_MAX_HP-GUARDIAN_REVEAL_HEALTH;i++)swingAt(p,CORE_X,CORE_Z+1);run(p,2,0,22);for(let i=0;i<GUARDIAN_REVEAL_HEALTH;i++)swingAt(p,CORE_X,CORE_Z+1);expect(p.cleared).toBe(true);p.reset();expect(p.gateOpen).toBe(false);expect(p.coreHealth).toBe(CORE_MAX_HP);expect(moveOnMap(0,-22,0,7)[1]).toBeGreaterThan(-16);});
 it('replenishes at the gate without exceeding the limit or spawning on the player',()=>{const p=new CastlePatrol();run(p,30,0,22);expect(p.alive).toBe(INITIAL_PATROLS);const e=p.enemies[0];e.alive=false;p.spawnClock=0;run(p,RESPAWN_SECONDS+1,0,22);expect(p.alive).toBe(INITIAL_PATROLS);expect(p.enemies[0].z).toBeLessThan(-13);p.enemies[0].alive=false;p.spawnClock=0;const spawn=reinforcementSpawn(0,false,2);run(p,RESPAWN_SECONDS+1,spawn.x,spawn.z);expect(p.enemies[0].alive).toBe(true);expect(Math.hypot(p.enemies[0].x-spawn.x,p.enemies[0].z-spawn.z)).toBeGreaterThan(3);});
});
