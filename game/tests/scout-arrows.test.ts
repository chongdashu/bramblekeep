import {describe,it,expect} from 'vitest';
import {StuckArrows,STUCK_ARROW_LIMIT,STUCK_ARROW_SECONDS,scoutAimGuide} from '../src/scout-arrows';
import {makeProjectile,assistedTarget} from '../src/castle-projectiles';
const target={id:'enemy-0',x:0,z:-4,radius:.48};
describe('scout arrow feedback',()=>{
 it('holds arrows on moving targets, freezes them after defeat, and expires them',()=>{
  const stuck=new StuckArrows(),arrow=makeProjectile('arrow',0,0,Math.PI,[target]);
  stuck.add({projectile:arrow,x:0,z:-3.6,target:target.id,blocked:false},[target]);
  stuck.step(1,[{...target,x:1,z:-5}]);expect(stuck.arrows[0].x).toBe(1);expect(stuck.arrows[0].z).toBeCloseTo(-4.6);
  stuck.step(1,[]);expect(stuck.arrows[0].target).toBeNull();expect(stuck.arrows[0].x).toBe(1);
  stuck.step(STUCK_ARROW_SECONDS,[]);expect(stuck.arrows).toHaveLength(0);
 });
 it('limits persistent arrows and places misses on the ground',()=>{
  const stuck=new StuckArrows(),arrow=makeProjectile('arrow',0,0,Math.PI,[]);
  for(let i=0;i<STUCK_ARROW_LIMIT+2;i++)stuck.add({projectile:arrow,x:i,z:-4,target:null,blocked:false},[]);
  expect(stuck.arrows).toHaveLength(STUCK_ARROW_LIMIT);expect(stuck.arrows[0].x).toBe(2);expect(stuck.arrows[0].y).toBe(.12);stuck.clear();expect(stuck.arrows).toHaveLength(0);
 });
 it('shows a forward snap marker without selecting enemies behind a closed wall',()=>{
  const front=scoutAimGuide(0,0,Math.PI,[target],false);expect(front.target?.id).toBe(target.id);expect(front.points.length).toBeGreaterThan(0);
  const behind={id:'behind',x:0,z:-22,radius:.48};expect(assistedTarget(0,-14,Math.PI,[behind],false)).toBeUndefined();expect(scoutAimGuide(0,-14,Math.PI,[behind],false).target).toBeUndefined();
  expect(assistedTarget(0,-14,Math.PI,[behind],true)?.id).toBe('behind');
 });
});
