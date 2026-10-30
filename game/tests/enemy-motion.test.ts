import { describe,it,expect } from 'vitest';
import { enemyAttackPose, EnemyDeaths, ENEMY_DEATH_DURATION, enemyReaction } from '../src/enemy-motion';
describe('enemy attack poses',()=>{
 it('raises both arms during the warning and strike and returns to idle',()=>{
  expect(enemyAttackPose(0,0)).toBeUndefined();
  const windup=enemyAttackPose(.1,0)!, strike=enemyAttackPose(0,.225)!;
  expect(Math.abs(windup.L_Upperarm[2])).toBeGreaterThan(.1);
  expect(strike.L_Upperarm[2]).toBeLessThan(0);
  expect(strike.R_Upperarm[2]).toBeGreaterThan(0);
 });
});

describe('enemy defeat presentation',()=>{
 it('shows a fall and grounded hold after defeat, then clears for respawn',()=>{
  const deaths=new EnemyDeaths();deaths.update('0',true,.016);deaths.update('0',false,.016);
  expect(deaths.age('0')).toBe(0);
  deaths.update('0',false,.55);const fallen=enemyReaction(0,deaths.age('0'));
  expect(fallen.pitch).toBeLessThan(-1.3);expect(fallen.back).toBeGreaterThan(.3);expect(fallen.sink).toBe(0);
  deaths.update('0',false,.8);expect(enemyReaction(0,deaths.age('0')).sink).toBeGreaterThan(0);
  deaths.update('0',false,ENEMY_DEATH_DURATION);expect(deaths.age('0')).toBeUndefined();
  deaths.update('0',true,.016);expect(deaths.age('0')).toBeUndefined();
  deaths.update('0',false,.016);expect(deaths.age('0')).toBe(0);
 });
 it('does not replay old deaths on joining and recoils on a nonfatal hit',()=>{
  const deaths=new EnemyDeaths();deaths.update('0',false,.016);expect(deaths.age('0')).toBeUndefined();
  expect(enemyReaction(.11,undefined).back).toBeGreaterThan(0);expect(enemyReaction(0,undefined).back).toBe(0);
 });
});
