import {describe,it,expect} from 'vitest';
import { World } from '../server/world';
import { GATE_MIN_OPEN, LEVER_REPAIR_DELAY } from '../src/gate-mechanism';
const tick=(w:World,seconds:number,attackIds:string[]=[])=>{for(let i=0;i<seconds*20;i++){for(const id of attackIds)w.setInput(id,{x:0,z:0,sprint:false,attack:true});w.step(.05);}};
function twoHeroes(){const w=new World();for(const e of w.enemies)e.alive=false;const a=w.join('a','Knight'),b=w.join('b','Knight');Object.assign(a,{x:-9,z:-13.3,yaw:Math.PI});Object.assign(b,{x:9,z:-13.3,yaw:Math.PI});return {w,a,b};}
describe('shared gate levers',()=>{
 it('requires attacks on both levers from either player, not enemy kills',()=>{const {w,a,b}=twoHeroes();w.defeats=50;expect(w.gateOpen).toBe(false);tick(w,3.5,['a']);expect(w.gate.health[0]).toBe(0);expect(w.gateOpen).toBe(false);tick(w,3.5,['b']);expect(w.gateOpen).toBe(true);expect(w.gate.remaining).toBeGreaterThan(0);expect(a.invulnerability).toBeGreaterThan(0);expect(b.invulnerability).toBeGreaterThan(0);});
 it('repairs and reseals when abandoned, but coordinated attacks maintain it',()=>{const {w}=twoHeroes();tick(w,3.5,['a','b']);expect(w.gateOpen).toBe(true);tick(w,GATE_MIN_OPEN+1,['a','b']);expect(w.gateOpen).toBe(true);expect(w.gate.remaining).toBe(0);tick(w,LEVER_REPAIR_DELAY+2);expect(w.gateOpen).toBe(false);});
});
