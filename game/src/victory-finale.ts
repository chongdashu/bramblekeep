import type { GameRuntime } from '@engine/runtime';
import type { Shot } from '@engine/camera';
import { PARTICLE } from '@engine/fx';
import { motion } from '@engine/ui/tween';
import './victory-finale.css';

const DURATION=4.2;
/** Client-only celebration. It never controls the authoritative round clock. */
export class VictoryFinale {
 private elapsed=0;
 private running=false;
 private stage=0;
 private x=0;private z=0;
 private camera:GameRuntime['camera']|null=null;
 private oldShot:Shot|null=null;
 private oldBlend=0;
 private shot:Shot|null=null;
 private panel:HTMLElement|null=null;
 constructor(){
  if(typeof document==='undefined')return;
  const panel=document.createElement('aside');panel.className='victory-finale';panel.hidden=true;
  panel.innerHTML='<div class="victory-finale-title">The Bramble Boss falls</div><div class="victory-finale-subtitle">Bramblekeep is free</div><button type="button">Skip · Enter</button>';
  panel.querySelector('button')!.addEventListener('click',()=>this.skip());
  document.addEventListener('keydown',e=>{if(this.running&&e.key==='Enter'){e.preventDefault();e.stopPropagation();this.skip();}});
  document.body.append(panel);this.panel=panel;
 }
 start(rt:GameRuntime,x:number,z:number){
  this.skip();this.x=x;this.z=z;
  if(motion.reduced)return;
  this.running=true;this.elapsed=0;this.stage=0;this.camera=rt.camera;
  this.oldShot=rt.camera.shot;this.oldBlend=rt.camera.shotBlend;
  this.shot={target:[x,1.45,z],pitch:.52,yaw:Math.PI,distance:rt.canvas.clientWidth<rt.canvas.clientHeight?10:8};
  // Cut directly inside the courtyard: blending from camp flies through the gatehouse.
  rt.camera.shot=this.shot;rt.camera.shotBlend=1;
  if(this.panel)this.panel.hidden=false;
  rt.camera.addTrauma(.18);this.burst(rt,14,[1,.69,.25],.65);
 }
 private burst(rt:GameRuntime,count:number,color:[number,number,number],height:number){
  const r=rt.particles.random;
  for(let i=0;i<count;i++){
   const a=r()*Math.PI*2,speed=.6+r()*2.2;
   rt.particles.spawn({kind:i%3===0?PARTICLE.star:PARTICLE.glow,x:this.x+(r()-.5)*1.2,y:.7+r()*height,z:this.z+(r()-.5)*1.2,vx:Math.sin(a)*speed,vy:1+r()*2.3,vz:Math.cos(a)*speed,size:.12+r()*.18,life:1+r()*.9,color,glow:.55,gravity:.55,drag:.4,spin:2});
  }
 }
 step(dt:number,rt:GameRuntime){
  if(!this.running)return;
  this.elapsed+=Math.max(0,dt);
  if(this.stage===0&&this.elapsed>=.7){this.stage=1;rt.camera.addTrauma(.16);rt.particles.spawn({kind:PARTICLE.ring,x:this.x,y:.15,z:this.z,size:4.2,life:1,color:[1,.74,.35],glow:.3});this.burst(rt,18,[.97,.73,.31],1.8);}
  if(this.stage===1&&this.elapsed>=1.5){this.stage=2;this.burst(rt,12,[.62,.87,.42],2.4);}
  if(this.elapsed>=DURATION){this.skip();return;}
  if(this.shot){this.shot.yaw=Math.PI+.12*Math.min(1,this.elapsed/DURATION);rt.camera.shot=this.shot;rt.camera.shotBlend=1;}
 }
 skip(){
  this.running=false;if(this.panel)this.panel.hidden=true;
  if(this.camera&&this.camera.shot===this.shot){this.camera.shot=this.oldShot;this.camera.shotBlend=this.oldBlend;}
  this.camera=null;this.shot=null;
 }
 get active(){return this.running;}
}
