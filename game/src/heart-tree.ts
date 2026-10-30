import type { GameRuntime } from '@engine/runtime';
import type { GltfDoc } from '@engine/gltf/glb';
import { Animator } from '@engine/gltf/animator';
import { ModelRenderer, type GpuModel } from '@engine/gpu/model';
import { MESH, hex } from '@engine/gpu/meshes';
import { mat4 } from '@engine/math';
import { CORE_X, CORE_Z, CORE_MAX_HP } from './castle-patrol';
import { HeartTreeMotion } from './heart-tree-motion';
import { loopLayers } from './loop-layers';
import { GUARDIAN_STRIKE_HALF_WIDTH, GUARDIAN_STRIKE_LENGTH, GUARDIAN_WINDUP_SECONDS, guardianVulnerable, type Guardian } from './guardian';

/** Rooted evil tree character. The existing core target owns health and hits. */
export class HeartTree {
 private model:GpuModel;
 private animator:Animator;
 private root=mat4.identity();
 private motion=new HeartTreeMotion();
 constructor(private renderer:ModelRenderer,doc:GltfDoc){
  if(!doc.skins.length || !doc.clips.some(c=>c.name==='idle'))throw new Error('Heart tree needs the stump rig and idle clip');
  this.model=renderer.upload(doc);this.animator=new Animator(doc);
 }
 resetMotion(){this.motion=new HeartTreeMotion();}
 draw(rt:GameRuntime,health:number,time:number,cleared:boolean,guardian?:Pick<Guardian,'x'|'z'|'yaw'|'phase'|'emerge'|'windup'|'attackCue'|'moving'|'gait'>){
  const p=this.motion.sample(health,time,cleared),scale=2.6;
  const x=guardian?.x??CORE_X,z=guardian?.z??CORE_Z,yaw=guardian?.yaw??0,phase=guardian?.phase??0,emerge=guardian?.emerge??0;
  const attack=guardian?.attackCue?Math.sin(Math.PI*(1-guardian.attackCue/.5)):0;
  const windup=guardian?.windup?1-guardian.windup/GUARDIAN_WINDUP_SECONDS:0;
  const pitch=p.pitch+attack*.24-windup*.12;
  mat4.compose(this.root,0,x,-.38*(1-emerge),z,yaw,pitch,p.roll,scale,scale,scale);
  const xRotation=(angle:number):[number,number,number,number]=>[Math.sin(angle/2),0,0,Math.cos(angle/2)];
  const layers=[{clip:'idle',time}];
  if(guardian?.moving)layers.push(...loopLayers('walk',guardian.gait,this.animator.clipDuration('walk'),1));
  this.animator.update(layers,this.root,{
   L_Upperarm:xRotation(p.arm+.28*p.fall+attack*.5),R_Upperarm:xRotation(-p.arm+.28*p.fall+attack*.5),
  });
  this.renderer.prepareSkinned(this.model,this.animator,{flash:p.flash});
  const b=rt.batches,eye=hex(0xffb33c),brow=hex(0x382b24);
  // Uneven roots, stones and low foliage sell the dormant tree as part of the courtyard.
  const wood=hex(0x514333),stone=hex(0x6e7465),leaf=hex(0x4e7543);
  for(const [dx,dz,angle] of [[-1.12,.35,-.7],[.9,-.45,.6],[-.45,-1.05,-1.2]])
   b[MESH.box].push(CORE_X+dx,.12,CORE_Z+dz,angle,0,.12,.28,.24,1.2,wood,.9);
  for(const [dx,dz,size] of [[-1.65,-.5,.48],[1.5,.9,.36],[.35,-1.65,.3]])
   b[MESH.sphere].push(CORE_X+dx,.15,CORE_Z+dz,0,0,0,size,.27,size*.8,stone,.9);
  for(const [dx,dz] of [[-1.35,1.1],[1.65,-.65]])b[MESH.sphere].push(CORE_X+dx,.24,CORE_Z+dz,0,0,0,.6,.48,.55,leaf,.9);
  // The face is concealed until the tree begins to awaken.
  if(phase>0)for(const side of [-1,1]){
   const at=mat4.transformPoint(this.root,[side*.14,.97,.245]);
   b[MESH.sphere].push(at[0],at[1],at[2],yaw,pitch,p.roll,.24,.15,.10,eye,.45,0,1,1,.45);
   const above=mat4.transformPoint(this.root,[side*.14,1.025,.22]);
   b[MESH.box].push(above[0],above[1],above[2],yaw,pitch,p.roll+side*.28,.35,.09,.12,brow,.9);
  }
  if(phase>0){const mouth=mat4.transformPoint(this.root,[0,.70,.31]);
  b[MESH.box].push(mouth[0],mouth[1],mouth[2],yaw,pitch,p.roll,.58,.09,.1,brow,.9);}
  // This temporary ground tell matches the authoritative rectangular strike.
  if(!cleared && guardian && guardian.windup>0){
   const fx=Math.sin(yaw),fz=Math.cos(yaw),sx=Math.cos(yaw),sz=-Math.sin(yaw);
   const length=GUARDIAN_STRIKE_LENGTH,width=GUARDIAN_STRIKE_HALF_WIDTH*2;
   const cx=x+fx*length/2,cz=z+fz*length/2,color=hex(0xef8b3e);
   b[MESH.box].push(cx,.055,cz,yaw,0,0,width,.035,length,color,.65,0,1,1,.15);
   for(const side of [-1,1])b[MESH.box].push(cx+sx*side*width/2,.075,cz+sz*side*width/2,yaw,0,0,.10,.04,length,hex(0xffe8a0),.5,0,1,1,.3);
   b[MESH.box].push(x+fx*length,.075,z+fz*length,yaw,0,0,width,.04,.10,hex(0xffe8a0),.5,0,1,1,.3);
  }
  if(!cleared && guardian && guardian.attackCue>0){
   const age=1-guardian.attackCue/.5,fx=Math.sin(yaw),fz=Math.cos(yaw),size=1+age*2.8;
   b[MESH.cylinder].push(x+fx*1.2,.07,z+fz*1.2,0,0,0,size,.05,size,hex(0xffc15d),.5,0,1,1,.35*(1-age));
  }
  if(!cleared && health<CORE_MAX_HP){
   const y=3.9;b[MESH.box].push(x,y,z,0,0,0,1.35,.13,.12,hex(0x354b42),.8);
   if(health>0)b[MESH.box].push(x-(1-health/CORE_MAX_HP)*.64,y+.01,z+.02,0,0,0,1.28*health/CORE_MAX_HP,.09,.14,guardian && !guardianVulnerable(phase,guardian.windup)?hex(0x78b8e5):eye,.5,0,1,1,.14);
  }
 }
}
