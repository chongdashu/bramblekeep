import { Guardian, GUARDIAN_REVEAL_HEALTH } from './guardian';
import { CORE_MAX_HP } from './castle-patrol';

export type BossPreviewMode='rooted'|'emerging'|'walking'|'attacking'|'hit'|'defeated';
/** A local, non-combat preview of the same guardian pose inputs used in play. */
export class BossPreview {
 mode:BossPreviewMode='rooted';
 readonly guardian=new Guardian();
 age=0;
 select(mode:BossPreviewMode){
  this.mode=mode;this.age=0;this.guardian.reset();
  if(mode==='emerging'){this.guardian.phase=1;}
  else if(mode!=='rooted'){this.guardian.phase=2;this.guardian.emerge=1;}
 }
 step(dt:number){
  dt=Math.max(0,Math.min(.1,dt));this.age+=dt;
  if(this.mode==='emerging')this.guardian.step(dt,GUARDIAN_REVEAL_HEALTH,[],true,false);
  else if(this.mode==='walking'){this.guardian.moving=true;this.guardian.gait=(this.guardian.gait+dt*.5)%1;}
  else if(this.mode==='attacking')this.guardian.step(dt,GUARDIAN_REVEAL_HEALTH,[{id:'preview',x:0,z:-24.6}],true,false);
 }
 get health(){return this.mode==='defeated'?0:this.mode==='rooted'?CORE_MAX_HP:this.mode==='hit'?(this.age%1.4<.5?GUARDIAN_REVEAL_HEALTH:GUARDIAN_REVEAL_HEALTH-1):GUARDIAN_REVEAL_HEALTH;}
 get cleared(){return this.mode==='defeated';}
}
