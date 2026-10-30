import type { Layer } from "@engine/gltf/animator";

/** Per-actor idle scheduling. No gameplay state or animation playback owns this clock. */
type Quat=[number,number,number,number];
type IdleState={rng:number;wait:number;age:number;variant:number};
const hash=(text:string)=>{let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const q=(axis:'x'|'y'|'z',a:number):Quat=>{const s=Math.sin(a/2);return [axis==='x'?s:0,axis==='y'?s:0,axis==='z'?s:0,Math.cos(a/2)];};
export class IdleVariations {
 private states=new Map<string,IdleState>();
 private generation=0;
 clear(){this.states.clear();this.generation=0;}
 remove(id:string){this.states.delete(id);}
 private random(s:IdleState){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
 update(id:string,dt:number,eligible:boolean){
  let s=this.states.get(id);
  if(!s){s={rng:hash(`${id}:${this.generation++}`),wait:0,age:-1,variant:0};s.wait=.8+this.random(s)*3.5;this.states.set(id,s);}
  if(!eligible){if(s.age>=0)s.wait=4+this.random(s)*6;s.age=-1;return {amount:0,variant:s.variant};}
  dt=Math.max(0,Math.min(.1,dt));
  if(s.age<0){s.wait-=dt;if(s.wait<=0){s.age=0;s.variant=Math.floor(this.random(s)*2);}}
  else {s.age+=dt;if(s.age>=1.8){s.age=-1;s.wait=4+this.random(s)*6;}}
  return this.sample(id);
 }
 sample(id:string){const s=this.states.get(id);return {amount:!s||s.age<0?0:Math.sin(Math.PI*Math.min(1,s.age/1.8)),variant:s?.variant??0};}
 pose(id:string,kind:number,enemy=false){const {amount,variant}=this.sample(id);return characterIdlePose(kind,amount,variant,enemy);}
}
/** Distinct small gestures, using upper-body bones only; feet retain the first idle pose. */
export function characterIdlePose(kind:number,amount:number,variant:number,enemy=false):Record<string,Quat>|undefined {
 if(amount<=0)return undefined;
 const direction=variant===0?1:-1;
 if(enemy){
  if(kind===3)return {L_Upperarm:q('x',.3*amount*direction),R_Upperarm:q('x',-.22*amount*direction)};
  if(kind===0)return {Head:q('z',.19*amount*direction),L_Upperarm:q('x',.18*amount)};
  if(kind===1)return {Spine02:q('y',.19*amount*direction),R_Upperarm:q('x',.28*amount)};
  return {Head:q('x',.17*amount),L_Upperarm:q('x',-.22*amount*direction),R_Upperarm:q('x',.22*amount*direction)};
 }
 if(kind===0)return {Head:q('y',.24*amount*direction),Spine02:q('y',.10*amount*direction)};
 if(kind===1)return {Head:q('z',.10*amount*direction),L_Upperarm:q('x',.26*amount*direction),L_Forearm:q('x',.18*amount)};
 return {Head:q('y',.32*amount*direction),Spine02:q('y',.13*amount*direction),R_Upperarm:q('x',.15*amount)};
}

/** A wider planted stance from the same idle clip; upper-body pose stays at its calibrated frame. */
export function heroIdleLayers():Layer[] {
 return [{clip:'idle',time:0},{clip:'idle',time:13.5,mask:'lower'}];
}
