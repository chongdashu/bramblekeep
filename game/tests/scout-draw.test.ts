import {describe,it,expect} from 'vitest';
import {ScoutDraw,scoutRange,SCOUT_MIN_RANGE,SCOUT_MAX_RANGE,SCOUT_FULL_DRAW} from '../src/scout-draw';
import {assistedTarget,makeProjectile,advanceProjectiles} from '../src/castle-projectiles';

describe('scout bow draw',()=>{
 it('charges smoothly, fires once on release and is bounded',()=>{
  const d=new ScoutDraw();expect(d.range).toBe(SCOUT_MIN_RANGE);
  for(let i=0;i<6;i++)expect(d.step(true,.1,true)).toBeNull();expect(d.progress).toBeCloseTo(.5);expect(d.range).toBeCloseTo((SCOUT_MIN_RANGE+SCOUT_MAX_RANGE)/2);
  for(let i=0;i<20;i++)expect(d.step(true,.1,true)).toBeNull();expect(d.progress).toBe(1);expect(d.step(false,.1,true)).toBe(SCOUT_MAX_RANGE);expect(d.step(false,.1,true)).toBeNull();expect(d.active).toBe(false);
 });
 it('does not begin during recovery and can cancel without firing',()=>{const d=new ScoutDraw();d.step(true,.1,false);expect(d.active).toBe(false);d.step(true,.1,true);d.cancel();expect(d.step(false,.1,true)).toBeNull();expect(scoutRange(-1)).toBe(SCOUT_MIN_RANGE);expect(scoutRange(2)).toBe(SCOUT_MAX_RANGE);});
 it('only acquires and reaches a distant target after charging',()=>{
  const far={id:'far',x:0,z:-12,radius:.48};expect(assistedTarget(0,0,Math.PI,[far],false,SCOUT_MIN_RANGE)).toBeUndefined();expect(assistedTarget(0,0,Math.PI,[far],false,SCOUT_MAX_RANGE)?.id).toBe('far');
  const shots=[makeProjectile('arrow',0,0,Math.PI,[far],false,SCOUT_MAX_RANGE)];let hit;for(let i=0;i<12&&!hit;i++)hit=advanceProjectiles(shots,.1,[far],false)[0];expect(hit?.target).toBe('far');
 });
});
