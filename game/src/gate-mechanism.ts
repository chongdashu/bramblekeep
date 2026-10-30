/** Shared mechanics for two repairable gate mechanisms, in world metres/seconds. */
export const LEVER_MAX_HEALTH=4;
export const LEVER_REPAIR_DELAY=14;
export const LEVER_REPAIR_RATE=.2;
export const GATE_MIN_OPEN=20;
export const LEVERS=[{id:'lever-left',x:-9,z:-14.3,radius:.65},{id:'lever-right',x:9,z:-14.3,radius:.65}] as const;
export class GateMechanism {
 health=[LEVER_MAX_HEALTH,LEVER_MAX_HEALTH];
 hitCount=[0,0];
 delay=[0,0];
 open=false;
 remaining=0;
 reset(){this.health=[LEVER_MAX_HEALTH,LEVER_MAX_HEALTH];this.hitCount=[0,0];this.delay=[0,0];this.open=false;this.remaining=0;}
 hit(index:number):boolean {
  if(index<0 || index>1)return false;
  this.hitCount[index]++;
  this.health[index]=Math.max(0,this.health[index]-1);this.delay[index]=LEVER_REPAIR_DELAY;
  if(!this.open && this.health.every(h=>h<=0)){this.open=true;this.remaining=GATE_MIN_OPEN;return true;}
  return false;
 }
 step(dt:number){
  dt=Math.max(0,Math.min(dt,.1));
  for(let i=0;i<2;i++){
   const waiting=Math.min(dt,this.delay[i]);this.delay[i]=Math.max(0,this.delay[i]-dt);
   this.health[i]=Math.min(LEVER_MAX_HEALTH,this.health[i]+(dt-waiting)*LEVER_REPAIR_RATE);
  }
  if(this.open){this.remaining=Math.max(0,this.remaining-dt);if(this.remaining===0 && this.health.some(h=>h>0))this.open=false;}
 }
 get damaged(){return this.open || this.health.some(h=>h<LEVER_MAX_HEALTH);}
}
