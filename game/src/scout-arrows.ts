import { canStand } from './scenes/environment-map';
import { assistedTarget, type Impact, type Target } from './castle-projectiles';

export interface StuckArrow { x:number; z:number; y:number; yaw:number; age:number; target:string|null; offsetX:number; offsetZ:number }
export const STUCK_ARROW_SECONDS=4;
export const STUCK_ARROW_LIMIT=12;
/** Short-lived visual arrows; target offsets follow a moving live enemy. */
export class StuckArrows {
  arrows:StuckArrow[]=[];
  add(impact:Impact,targets:Target[]) {
    if(impact.projectile.kind!=='arrow')return;
    const t=targets.find(t=>t.id===impact.target);
    this.arrows.push({x:impact.x,z:impact.z,y:(impact.target || impact.blocked) ? .9 : .12,yaw:Math.atan2(impact.projectile.dx,impact.projectile.dz),age:0,target:t?.id??null,offsetX:t?impact.x-t.x:0,offsetZ:t?impact.z-t.z:0});
    if(this.arrows.length>STUCK_ARROW_LIMIT)this.arrows.shift();
  }
  step(dt:number,targets:Target[]) {
    for(const a of this.arrows){a.age+=Math.max(0,dt);const t=targets.find(t=>t.id===a.target);if(t){a.x=t.x+a.offsetX;a.z=t.z+a.offsetZ;}else a.target=null;}
    this.arrows=this.arrows.filter(a=>a.age<STUCK_ARROW_SECONDS);
  }
  clear(){this.arrows=[];}
}
/** Small world-space markers show the same direction and target choice as an arrow. */
export function scoutAimGuide(x:number,z:number,yaw:number,targets:Target[],gateOpen:boolean,maxRange=9) {
  const chosen=assistedTarget(x,z,yaw,targets,gateOpen,maxRange);let dx=Math.sin(yaw),dz=Math.cos(yaw),distance=maxRange;
  if(chosen){distance=Math.hypot(chosen.x-x,chosen.z-z);dx=(chosen.x-x)/distance;dz=(chosen.z-z)/distance;}
  let clear=true;const points:{x:number;z:number}[]=[];
  const end=Math.min(chosen?Math.max(0,distance-chosen.radius):distance,maxRange);
  for(let d=.2;d<end;d+=.2)if(!canStand(x+dx*d,z+dz*d,gateOpen)){clear=false;break;}
  for(let d=1;d<end;d+=1.75){const px=x+dx*d,pz=z+dz*d;if(!canStand(px,pz,gateOpen))break;points.push({x:px,z:pz});}
  return {points,target:clear?chosen:undefined};
}
