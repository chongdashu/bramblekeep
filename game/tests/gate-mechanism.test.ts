import {describe,it,expect} from 'vitest';
import {GateMechanism,LEVER_MAX_HEALTH,LEVER_REPAIR_DELAY,GATE_MIN_OPEN} from '../src/gate-mechanism';
const run=(g:GateMechanism,seconds:number)=>{for(let i=0;i<seconds*10;i++)g.step(.1)};
describe('repairable gate mechanisms',()=>{
 it('requires both mechanisms to be critical, rather than enemy defeats',()=>{const g=new GateMechanism();for(let i=0;i<LEVER_MAX_HEALTH;i++)g.hit(0);expect(g.open).toBe(false);for(let i=0;i<LEVER_MAX_HEALTH;i++)g.hit(1);expect(g.open).toBe(true);expect(g.remaining).toBe(GATE_MIN_OPEN);});
 it('repairs damaged mechanisms after the grace period',()=>{const g=new GateMechanism();g.hit(0);run(g,LEVER_REPAIR_DELAY-1);expect(g.health[0]).toBe(3);run(g,2);expect(g.health[0]).toBeGreaterThan(3);});
 it('closes after the minimum window unless both repairs are suppressed',()=>{const g=new GateMechanism();for(let i=0;i<4;i++){g.hit(0);g.hit(1)}run(g,GATE_MIN_OPEN+1);expect(g.open).toBe(false);g.reset();for(let i=0;i<4;i++){g.hit(0);g.hit(1)}for(let i=0;i<26;i++){if(i%5===0){g.hit(0);g.hit(1)}run(g,1)}expect(g.open).toBe(true);expect(g.remaining).toBe(0);run(g,LEVER_REPAIR_DELAY+1);expect(g.open).toBe(false);});
 it('reset restores both mechanisms and closes the gate',()=>{const g=new GateMechanism();g.hit(0);g.reset();expect(g.health).toEqual([4,4]);expect(g.open).toBe(false);});
});
