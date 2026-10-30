import {describe,it,expect} from 'vitest';
import {World} from '../server/world';
import {CastlePatrol} from '../src/castle-patrol';
import {PLAYER_RESPAWN_DELAY,deathTilt} from '../src/player-death';

describe('player death and respawn',()=>{
 it('keeps a dead player at the death location, ignores input and respawns after the server timer',()=>{
  const w=new World(),p=w.join('hero','Knight'),e=w.enemies[0];w.enemies.slice(1).forEach(e=>e.alive=false);
  p.x=e.x;p.z=e.z+.5;p.health=1;p.invulnerability=0;e.windup=.05;w.step(.05);
  const pos=[p.x,p.z],seq=p.attackSeq;expect(p.health).toBe(0);expect(p.respawnRemaining).toBe(PLAYER_RESPAWN_DELAY);
  for(let i=0;i<20;i++){w.setInput('hero',{x:1,z:0,sprint:true,attack:true});w.step(.05);}
  expect([p.x,p.z]).toEqual(pos);expect(p.attackSeq).toBe(seq);expect(p.health).toBe(0);expect(p.respawnRemaining).toBeGreaterThan(1.9);
  for(let i=0;i<41;i++)w.step(.05);expect(p.health).toBe(6);expect(p.respawnRemaining).toBe(0);expect(p.invulnerability).toBeGreaterThan(1.8);expect(Math.hypot(p.x-pos[0],p.z-pos[1])).toBeGreaterThan(5);
 });
 it('continues the respawn timer after the castle is cleared',()=>{
  const w=new World(),p=w.join('hero','Knight');p.health=0;p.respawnRemaining=PLAYER_RESPAWN_DELAY;w.victoryTimer=8;
  for(let i=0;i<61;i++)w.step(.05);
  expect(p.health).toBe(6);expect(p.respawnRemaining).toBe(0);expect(w.cleared).toBe(true);
 });
 it('keeps solo simulation running during the delay',()=>{
  const p=new CastlePatrol(),e=p.enemies[0];p.enemies.slice(1).forEach(e=>e.alive=false);p.health=1;p.invulnerability=0;e.windup=.05;p.step(.05,e.x,e.z+.5);
  expect(p.health).toBe(0);expect(p.respawnRemaining).toBe(PLAYER_RESPAWN_DELAY);
  let respawn=false;for(let i=0;i<61;i++)respawn=p.step(.05,e.x,e.z+.5)||respawn;
  expect(respawn).toBe(true);expect(p.health).toBe(6);expect(p.time).toBeGreaterThan(3);
 });
 it('collapses progressively and resets upright',()=>{expect(deathTilt(0)).toBe(0);expect(deathTilt(3)).toBeCloseTo(0);expect(deathTilt(2.4)).toBeLessThan(-1.3);});
});
