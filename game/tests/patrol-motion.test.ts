import { describe, expect, it } from 'vitest';
import { World } from '../server/world';
import { CastlePatrol } from '../src/castle-patrol';

function angularDistance(a:number,b:number){return Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));}
describe('enemy patrol motion',()=>{
 it('alternates sustained walks and idle pauses without sudden turns',()=>{
  const world=new World(),enemies=world.enemies.slice(0,5),prior=enemies.map(e=>({yaw:e.yaw,moving:e.moving}));
  const transitions=Array(5).fill(0),moving=Array(5).fill(0),idle=Array(5).fill(0);let largestTurn=0;
  for(let i=0;i<600;i++){world.step(.05);enemies.forEach((e,j)=>{largestTurn=Math.max(largestTurn,angularDistance(e.yaw,prior[j].yaw));if(e.moving!==prior[j].moving)transitions[j]++;(e.moving?moving:idle)[j]++;prior[j]={yaw:e.yaw,moving:e.moving};});}
  expect(largestTurn).toBeLessThanOrEqual(.141);
  for(let i=0;i<5;i++){expect(moving[i]).toBeGreaterThan(60);expect(idle[i]).toBeGreaterThan(60);expect(transitions[i]).toBeLessThan(24);}
 });
 it('turns smoothly while tracking a nearby player in both game modes',()=>{
  const world=new World(),player=world.join('hero','Knight'),enemy=world.enemies[0];player.x=enemy.x;player.z=enemy.z+2;
  let yaw=enemy.yaw;for(let i=0;i<30;i++){player.x=enemy.x+Math.cos(i*.1)*2;player.z=enemy.z+Math.sin(i*.1)*2;world.step(.05);expect(angularDistance(enemy.yaw,yaw)).toBeLessThanOrEqual(.141);yaw=enemy.yaw;}
  const solo=new CastlePatrol(),opponent=solo.enemies[0];yaw=opponent.yaw;
  for(let i=0;i<30;i++){solo.step(.05,opponent.x+Math.cos(i*.1)*2,opponent.z+Math.sin(i*.1)*2);expect(angularDistance(opponent.yaw,yaw)).toBeLessThanOrEqual(.141);yaw=opponent.yaw;}
 });
});
