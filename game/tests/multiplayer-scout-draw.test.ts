import {describe,it,expect} from 'vitest';
import {World} from '../server/world';
import {SCOUT_MAX_RANGE,SCOUT_MIN_RANGE} from '../src/scout-draw';
const input=(w:World,id:string,attack:boolean)=>w.setInput(id,{x:0,z:0,sprint:false,attack});
describe('authoritative scout draw',()=>{
 it('holds without shooting and releases one long-range arrow',()=>{
  const w=new World(),p=w.join('scout','Scout');for(const e of w.enemies)e.alive=false;
  p.x=0;p.z=0;p.yaw=Math.PI;
  for(let i=0;i<26;i++){input(w,p.id,true);w.step(.05);}expect(p.scoutDraw.progress).toBe(1);expect(p.attackSeq).toBe(0);expect(w.projectiles).toHaveLength(0);
  input(w,p.id,false);w.step(.05);expect(p.attackSeq).toBe(1);expect(p.shotRange).toBe(SCOUT_MAX_RANGE);
  for(let i=0;i<4;i++){input(w,p.id,false);w.step(.05);}expect(w.projectiles[0]?.shot.range).toBe(SCOUT_MAX_RANGE);
 });
 it('releases a quick short shot and cancels on disconnect',()=>{
  const w=new World(),p=w.join('scout','Scout');input(w,p.id,true);w.step(.05);input(w,p.id,false);w.step(.05);expect(p.shotRange).toBeGreaterThanOrEqual(SCOUT_MIN_RANGE);expect(p.shotRange).toBeLessThan(SCOUT_MAX_RANGE);expect(p.attackSeq).toBe(1);
  p.swing.age=2;input(w,p.id,true);w.step(.05);expect(p.scoutDraw.active).toBe(true);p.connected=false;w.step(.05);expect(p.scoutDraw.active).toBe(false);expect(p.attackSeq).toBe(1);
 });
});
