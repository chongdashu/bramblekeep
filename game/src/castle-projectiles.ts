import { canStand } from './scenes/environment-map';
export type ProjectileKind='arrow'|'orb';
export type Target={ id:string; x:number; z:number; radius:number };
export type Projectile={kind:ProjectileKind;x:number;z:number;dx:number;dz:number;distance:number;target:string|null;height?:number;range?:number};
export type Impact={projectile:Projectile;x:number;z:number;target:string|null;blocked:boolean};

/** Aim only within the forward cone; the arrow may make a gentle correction in flight. */
export function assistedTarget(x:number,z:number,yaw:number,targets:Target[],gateOpen=false,maxRange=9):Target|undefined {
 const fx=Math.sin(yaw),fz=Math.cos(yaw);
 return targets.map(t=>{const dx=t.x-x,dz=t.z-z,d=Math.hypot(dx,dz);return {t,d,dot:d>0?(dx*fx+dz*fz)/d:1};})
  .filter(v=>v.d<=maxRange && v.dot>=.5 && clearAim(x,z,v.t,gateOpen)).sort((a,b)=>a.d-b.d)[0]?.t;
}
function clearAim(x:number,z:number,t:Target,gateOpen:boolean):boolean {
 const dx=t.x-x,dz=t.z-z,d=Math.hypot(dx,dz);const n=Math.ceil(Math.max(0,d-t.radius)/.2);
 for(let i=1;i<n;i++){const f=i/n;if(!canStand(x+dx*f,z+dz*f,gateOpen))return false;}return true;
}
export function makeProjectile(kind:ProjectileKind,x:number,z:number,yaw:number,targets:Target[],gateOpen=false,maxRange=10):Projectile {
 const target=kind==='arrow'?assistedTarget(x,z,yaw,targets,gateOpen,maxRange):undefined;
 let dx=Math.sin(yaw),dz=Math.cos(yaw);
 if(target){const d=Math.hypot(target.x-x,target.z-z)||1;dx=(target.x-x)/d;dz=(target.z-z)/d;}
 return {kind,x:x+dx*.35,z:z+dz*.35,dx,dz,distance:0,target:target?.id??null,range:kind==='arrow'?maxRange:undefined};
}
/** Sweep in short steps so fast arrows cannot tunnel through hurtboxes or walls. */
export function advanceProjectiles(shots:Projectile[],dt:number,targets:Target[],gateOpen:boolean):Impact[] {
 const hits:Impact[]=[];
 for(let i=shots.length-1;i>=0;i--){const p=shots[i],target=targets.find(t=>t.id===p.target);
  if(p.kind==='arrow' && target){const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d>.01){const weight=Math.min(1,dt*2);p.dx=p.dx*(1-weight)+dx/d*weight;p.dz=p.dz*(1-weight)+dz/d*weight;const len=Math.hypot(p.dx,p.dz)||1;p.dx/=len;p.dz/=len;}}
  const speed=p.kind==='arrow'?16:7,range=p.kind==='arrow'?(p.range??10):6.5,travel=Math.min(speed*Math.max(0,Math.min(dt,.1)),range-p.distance),n=Math.max(1,Math.ceil(travel/.12));
  let impact:Impact|undefined;
  for(let j=0;j<n;j++){p.x+=p.dx*travel/n;p.z+=p.dz*travel/n;p.distance+=travel/n;
   if(!canStand(p.x,p.z,gateOpen)){impact={projectile:p,x:p.x,z:p.z,target:null,blocked:true};break;}
   const t=targets.find(t=>Math.hypot(t.x-p.x,t.z-p.z)<=t.radius+(p.kind==='arrow'?.12:.35));
   if(t){impact={projectile:p,x:p.x,z:p.z,target:t.id,blocked:false};break;}
  }
  if(!impact && p.distance>=range-.0001)impact={projectile:p,x:p.x,z:p.z,target:null,blocked:false};
  if(impact){hits.push(impact);shots.splice(i,1);}
 }
 return hits;
}
