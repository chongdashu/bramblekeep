import {describe,it,expect} from 'vitest';
import {CastlePatrol} from '../src/castle-patrol';
import {PLAYER_RESPAWN_DELAY,deathTilt} from '../src/player-death';
describe('solo death and respawn',()=>{
 it('waits before restoring health while the world continues',()=>{
  const p=new CastlePatrol(),e=p.enemies[0];p.enemies.slice(1).forEach(e=>e.alive=false);p.health=1;p.invulnerability=0;e.attackCooldown=0;e.engaged=true;Object.assign(e,{windup:.05});p.step(.05,e.x,e.z+.5);
  expect(p.health).toBe(0);expect(p.respawnRemaining).toBe(PLAYER_RESPAWN_DELAY);let respawn=false;
  for(let i=0;i<61;i++)respawn=p.step(.05,e.x,e.z+.5)||respawn;
  expect(respawn).toBe(true);expect(p.health).toBe(6);expect(p.time).toBeGreaterThan(3);
 });
 it('falls over progressively and returns upright',()=>{expect(deathTilt(0)).toBe(0);expect(deathTilt(2.4)).toBeLessThan(-1.3);});
});
