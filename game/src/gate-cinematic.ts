import type { GameRuntime } from '@engine/runtime';
import { PARTICLE } from '@engine/fx';
import { MESH, hex } from '@engine/gpu/meshes';
import './gate-cinematic.css';

const FALL_TIME = 1.2;
const NOTICE_TIME = 4;
/** A gate event played in the world; it never owns the camera or input. */
export class GateCinematic {
 private remaining=0;
 private elapsed=FALL_TIME;
 private impactPlayed=false;
 private panel:HTMLElement|null=null;
 constructor(){
  if(typeof document==='undefined')return;
  const panel=document.createElement('aside');panel.className='gate-cinematic';panel.hidden=true;
  panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
  panel.innerHTML='<div class="gate-cinematic-title">THE GATE IS DOWN!</div><div class="gate-cinematic-subtitle">Press on to the Bramble Boss</div>';
  document.body.append(panel);this.panel=panel;
 }
 start(rt:GameRuntime){
  this.remaining=NOTICE_TIME;this.elapsed=0;this.impactPlayed=false;
  if(this.panel)this.panel.hidden=false;
  rt.camera.addTrauma(.12);
  this.burst(rt,12,1.8);
 }
 private burst(rt:GameRuntime,count:number,height:number){
  const r=rt.particles.random;
  for(let i=0;i<count;i++)rt.particles.spawn({kind:PARTICLE.chip,x:(r()-.5)*2.5,y:.15+r()*height,z:-16.1+r()*.7,vx:(r()-.5)*4,vy:1+r()*3,vz:1+r()*3,size:.10+r()*.16,life:.7+r()*.7,color:[.54,.43,.29],gravity:4,spin:3});
 }
 skip(){this.remaining=0;this.elapsed=FALL_TIME;if(this.panel)this.panel.hidden=true;}
 step(dt:number,rt:GameRuntime){
  if(this.remaining<=0)return false;
  this.elapsed+=Math.max(0,dt);this.remaining=Math.max(0,this.remaining-dt);
  const impact=!this.impactPlayed&&this.elapsed>=FALL_TIME;
  if(impact){this.impactPlayed=true;rt.camera.addTrauma(.25);this.burst(rt,26,.65);rt.particles.spawn({kind:PARTICLE.ring,x:0,y:.1,z:-14.6,size:3.8,life:.7,color:[.85,.72,.46],glow:.08});}
  if(!this.remaining&&this.panel)this.panel.hidden=true;
  return impact;
 }
 /** Draw the fallen door during and after the event, even for late joiners. */
 draw(rt:GameRuntime){
  const t=Math.max(0,Math.min(1,this.elapsed/FALL_TIME));
  const angle=(t*t*(3-2*t))*Math.PI*.49;
  const b=rt.batches,wood=hex(0x705039),woodAlt=hex(0x8b6443),iron=hex(0x334342),brass=hex(0xc7a45d);
  // Two broad leaves hinge at the threshold and crash outward onto the path.
  for(const side of [-1,1]){
   const x=side*.61;
   for(let plank=0;plank<4;plank++){
    const px=x+(plank-1.5)*.29,y=.12+1.5*Math.cos(angle),z=-16.15+1.5*Math.sin(angle);
    b[MESH.box].push(px,y,z,0,angle,0,.28,3,.18,plank%2?wood:woodAlt,.8);
   }
   for(const h of [.55,1.55,2.55]){
    const y=.12+h*Math.cos(angle),z=-16.15+h*Math.sin(angle);
    b[MESH.box].push(x,y,z+.10*Math.cos(angle),0,angle,0,1.14,.12,.12,iron,.65);
    for(const dx of [-.39,.39])b[MESH.sphere].push(x+dx,y,z+.18*Math.cos(angle),0,0,0,.09,.09,.09,brass,.5);
   }
  }
 }
 get active(){return this.remaining>0;}
 get progress(){return Math.min(1,this.elapsed/FALL_TIME);}
}
