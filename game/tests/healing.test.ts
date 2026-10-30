import {describe,expect,it} from 'vitest';
import {World} from '../server/world';
import {HEAL_COOLDOWN,HEAL_RADIUS} from '../src/healing';

const input=(w:World,id:string,heal:boolean,attack=true)=>w.setInput(id,{x:0,z:0,sprint:false,attack,heal});
const run=(w:World,id:string,heal:boolean,seconds:number,attack=true)=>{for(let i=0;i<Math.ceil(seconds/.05);i++){input(w,id,heal,attack);w.step(.05);}};
describe('spellcaster healing',()=>{
 it('heals nearby living allies and self, never enemies, distant, dead or disconnected players',()=>{
  const w=new World(),caster=w.join('caster','Spellcaster'),ally=w.join('ally','Knight'),far=w.join('far','Scout'),dead=w.join('dead','Knight'),gone=w.join('gone','Scout');
  w.enemies.forEach(e=>e.alive=false);Object.assign(caster,{x:0,z:22,health:4});Object.assign(ally,{x:1,z:22,health:5});Object.assign(far,{x:HEAL_RADIUS+1,z:22,health:3});Object.assign(dead,{x:1,z:22,health:0,respawnRemaining:2});Object.assign(gone,{x:1,z:22,health:2,connected:false});
  run(w,caster.id,true,.3);
  expect(caster.health).toBe(5);expect(ally.health).toBe(6);expect(far.health).toBe(3);expect(dead.health).toBe(0);expect(gone.health).toBe(2);expect(caster.healSeq).toBe(1);expect(caster.healCooldown).toBeGreaterThan(HEAL_COOLDOWN-.2);expect(w.projectiles).toHaveLength(0);
  run(w,caster.id,true,2);expect(caster.health).toBe(5);expect(caster.healSeq).toBe(1);
  run(w,caster.id,true,HEAL_COOLDOWN);expect(caster.health).toBe(6);expect(caster.healSeq).toBe(2);
 });
 it('locks the chosen spell when casting begins and can attack during heal cooldown',()=>{
  const w=new World(),p=w.join('caster','Spellcaster');w.enemies.forEach(e=>e.alive=false);p.health=4;
  run(w,p.id,true,.05);run(w,p.id,false,.2);expect(p.health).toBe(5);expect(p.healSeq).toBe(1);
  run(w,p.id,false,1);expect(p.attackSeq).toBeGreaterThan(1);expect(p.healSeq).toBe(1);expect(w.projectiles.some(v=>v.shot.kind==='orb')).toBe(true);
 });
 it('cannot request healing as another class or through a closed gate',()=>{
  const w=new World(),knight=w.join('knight','Knight'),caster=w.join('caster','Spellcaster'),other=w.join('other','Scout');w.enemies.forEach(e=>e.alive=false);
  Object.assign(knight,{x:0,z:22,health:3});run(w,knight.id,true,.3);expect(knight.health).toBe(3);expect(knight.healSeq).toBe(0);
  Object.assign(caster,{x:0,z:-15.4,health:4});Object.assign(other,{x:0,z:-17.5,health:3});run(w,caster.id,true,.3);expect(caster.health).toBe(5);expect(other.health).toBe(3);
 });
});
