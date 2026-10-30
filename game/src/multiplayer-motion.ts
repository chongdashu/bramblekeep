import { MAP, moveOnMap } from './scenes/environment-map';
import { movementFactor } from './movement';

export type MotionInput={x:number;z:number;sprint:boolean};
export type Point={x:number;z:number};
export function quantize(value:number,step:number):number{return Math.round(value/step)*step;}
export function smoothAngle(current:number,target:number,factor:number):number {const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));return current+delta*factor;}
/** Interpolate network poses without drawing a slow crawl across a teleport. */
export function smoothPosition(current:Point,target:Point,dt:number,speed=14):Point {
 const distance=Math.hypot(target.x-current.x,target.z-current.z),factor=distance>2?1:1-Math.exp(-speed*Math.max(0,dt));
 return {x:current.x+(target.x-current.x)*factor,z:current.z+(target.z-current.z)*factor};
}
export function predictStep(point:Point,input:MotionInput,dt:number,gateOpen:boolean):Point {
 const speed=MAP.speed*movementFactor(input.sprint),[x,z]=moveOnMap(point.x,point.z,input.x*speed*dt,input.z*speed*dt,gateOpen);return {x,z};
}
/** Locally replay only the input time the authoritative server has not applied. */
export class LocalPrediction {
 private pending:{seq:number;dt:number;input:MotionInput}[]=[];
 private point:Point|null=null;
 reset(point:Point){this.point={...point};this.pending=[];}
 advance(seq:number,input:MotionInput,dt:number,gateOpen:boolean):Point {
  if(!this.point)this.reset({x:MAP.camp[0],z:MAP.camp[1]});
  dt=Math.max(0,Math.min(dt,.1));this.point=predictStep(this.point!,input,dt,gateOpen);
  const last=this.pending.at(-1);if(last?.seq===seq&&last.input.x===input.x&&last.input.z===input.z&&last.input.sprint===input.sprint)last.dt+=dt;else this.pending.push({seq,input:{...input},dt});
  // A disconnected or stalled server cannot grow this queue without bound.
  if(this.pending.length>100)this.pending.splice(0,this.pending.length-100);
  return {...this.point};
 }
 reconcile(server:Point,ack:number,gateOpen:boolean):Point {
  this.pending=this.pending.filter(p=>p.seq>ack);
  let point={...server};for(const p of this.pending){let remaining=Math.min(p.dt,.25);while(remaining>0){const dt=Math.min(remaining,.05);point=predictStep(point,p.input,dt,gateOpen);remaining-=dt;}}
  this.point=point;return {...point};
 }
}
