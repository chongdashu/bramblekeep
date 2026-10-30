import { moveOnMap } from './scenes/environment-map';

/** The heart wakes after six hits; a guarded windup creates a clear counterattack window. */
export const GUARDIAN_REVEAL_HEALTH=24;
export const GUARDIAN_EMERGE_SECONDS=1.6;
export const GUARDIAN_WINDUP_SECONDS=1.05;
export const GUARDIAN_RECOVERY_SECONDS=2.4;
export const GUARDIAN_STRIKE_LENGTH=2.7;
export const GUARDIAN_STRIKE_HALF_WIDTH=1.5;
export const GUARDIAN_STRIKE_DAMAGE=2;
export const GUARDIAN_KNOCKBACK=2.4;
// Keep the fight visible from the gate and away from the side spawn doorways.
export const GUARDIAN_BOUNDS={minX:-5,maxX:5,minZ:-31,maxZ:-23} as const;
export type GuardianTarget={id:string;x:number;z:number};
export function guardianVulnerable(phase:number,windup:number){return phase!==1 && windup<=0;}
/** One authoritative encounter state, shared by solo and server simulations. */
export class Guardian {
 x=0;z=-26;yaw=0;phase=0;emerge=0;windup=0;attackCue=0;cooldown=0;moving=false;gait=0;
 reset(){Object.assign(this,{x:0,z:-26,yaw:0,phase:0,emerge:0,windup:0,attackCue:0,cooldown:0,moving:false,gait:0});}
 step(dt:number,health:number,targets:GuardianTarget[],gateOpen:boolean,cleared:boolean):string[] {
  dt=Math.max(0,Math.min(.1,dt));this.moving=false;
  if(cleared || health<=0)return [];
  // Recover an older live encounter whose boss escaped before this boundary existed.
  if(this.x<GUARDIAN_BOUNDS.minX || this.x>GUARDIAN_BOUNDS.maxX || this.z<GUARDIAN_BOUNDS.minZ || this.z>GUARDIAN_BOUNDS.maxZ){this.x=0;this.z=-26;this.windup=0;this.moving=false;}
  if(this.phase===0){if(health>GUARDIAN_REVEAL_HEALTH)return [];this.phase=1;this.emerge=0;}
  if(this.phase===1){this.emerge=Math.min(1,this.emerge+dt/GUARDIAN_EMERGE_SECONDS);if(this.emerge>=1)this.phase=2;return [];}
  this.cooldown=Math.max(0,this.cooldown-dt);this.attackCue=Math.max(0,this.attackCue-dt);
  // Once committed, the strike holds its direction even if the target leaves or disconnects.
  if(this.windup>0){
   this.windup=Math.max(0,this.windup-dt);
   if(this.windup===0){
    this.attackCue=.5;this.cooldown=GUARDIAN_RECOVERY_SECONDS;
    const fx=Math.sin(this.yaw),fz=Math.cos(this.yaw);
    return targets.filter(t=>{const dx=t.x-this.x,dz=t.z-this.z,forward=dx*fx+dz*fz,side=dx*fz-dz*fx;return forward>=0&&forward<=GUARDIAN_STRIKE_LENGTH&&Math.abs(side)<=GUARDIAN_STRIKE_HALF_WIDTH;}).map(t=>t.id);
   }
   return [];
  }
  const target=targets.filter(t=>t.x>=GUARDIAN_BOUNDS.minX-3 && t.x<=GUARDIAN_BOUNDS.maxX+3 && t.z>=GUARDIAN_BOUNDS.minZ-3 && t.z<=GUARDIAN_BOUNDS.maxZ+3 && Math.hypot(t.x-this.x,t.z-this.z)<12).sort((a,b)=>Math.hypot(a.x-this.x,a.z-this.z)-Math.hypot(b.x-this.x,b.z-this.z))[0];
  if(!target){
   // Don't leave the guardian stranded at the edge after players or bots depart.
   const dx=-this.x,dz=-26-this.z,dist=Math.hypot(dx,dz);
   if(dist>.08){
    this.yaw=Math.atan2(dx,dz);
    const step=Math.min(dist,dt*1.1),[x,z]=moveOnMap(this.x,this.z,dx/dist*step,dz/dist*step,gateOpen);
    const d=Math.hypot(x-this.x,z-this.z);this.x=x;this.z=z;this.moving=d>.001;this.gait=(this.gait+d/2.2)%1;
   }
   return [];
  }
  const dx=target.x-this.x,dz=target.z-this.z,dist=Math.hypot(dx,dz);
  if(dist>.05){const desired=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(desired-this.yaw),Math.cos(desired-this.yaw));this.yaw+=Math.max(-2*dt,Math.min(2*dt,delta));}
  if(dist<1.65 && this.cooldown===0){this.yaw=Math.atan2(dx,dz);this.windup=GUARDIAN_WINDUP_SECONDS;return [];}
  if(dist>1.45){const [nx,nz]=moveOnMap(this.x,this.z,Math.sin(this.yaw)*dt*1.1,Math.cos(this.yaw)*dt*1.1,gateOpen);const x=Math.max(GUARDIAN_BOUNDS.minX,Math.min(GUARDIAN_BOUNDS.maxX,nx)),z=Math.max(GUARDIAN_BOUNDS.minZ,Math.min(GUARDIAN_BOUNDS.maxZ,nz));const d=Math.hypot(x-this.x,z-this.z);this.x=x;this.z=z;this.moving=d>.001;this.gait=(this.gait+d/2.2)%1;}
  return [];
 }
}
