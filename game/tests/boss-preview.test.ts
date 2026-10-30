import { describe,expect,it } from 'vitest';
import { BossPreview } from '../src/boss-preview';
import { GUARDIAN_REVEAL_HEALTH } from '../src/guardian';
import { CORE_MAX_HP } from '../src/castle-patrol';

const run=(preview:BossPreview,seconds:number)=>{for(let i=0;i<seconds*20;i++)preview.step(.05);};
describe('boss preview',()=>{
 it('replays emergence and keeps rooted state still',()=>{
  const p=new BossPreview();run(p,2);expect(p.guardian.phase).toBe(0);
  p.select('emerging');run(p,.5);expect(p.guardian.emerge).toBeGreaterThan(0);expect(p.guardian.phase).toBe(1);
  run(p,1.5);expect(p.guardian.phase).toBe(2);p.select('emerging');expect(p.guardian.emerge).toBe(0);
 });
 it('previews walking and repeated attacks without moving the encounter',()=>{
  const p=new BossPreview();p.select('walking');run(p,.5);expect(p.guardian.moving).toBe(true);expect(p.guardian.gait).toBeGreaterThan(0);expect(p.guardian.z).toBe(-26);
  p.select('attacking');run(p,.2);expect(p.guardian.windup).toBeGreaterThan(0);run(p,1.0);expect(p.guardian.attackCue).toBeGreaterThan(0);
 });
 it('exposes hurt and defeat and resets when changing states',()=>{
  const p=new BossPreview();p.select('hit');run(p,.6);expect(p.health).toBe(GUARDIAN_REVEAL_HEALTH-1);run(p,1);expect(p.health).toBe(GUARDIAN_REVEAL_HEALTH);
  p.select('defeated');expect(p.cleared).toBe(true);expect(p.health).toBe(0);p.select('rooted');expect(p.cleared).toBe(false);expect(p.health).toBe(CORE_MAX_HP);
 });
});
