import type {GameRuntime} from '@engine/runtime';
import {PARTICLE} from '@engine/fx';
import {HEAL_RADIUS} from './healing';
export function emitHealing(rt:GameRuntime,x:number,z:number){
 rt.particles.spawn({kind:PARTICLE.ring,x,y:.15,z,size:HEAL_RADIUS,life:.7,color:[.42,1,.68],glow:.25});
 for(let i=0;i<12;i++){const a=rt.particles.random()*Math.PI*2,r=rt.particles.random()*HEAL_RADIUS*.7;rt.particles.spawn({kind:PARTICLE.star,x:x+Math.sin(a)*r,y:.3+rt.particles.random(),z:z+Math.cos(a)*r,vx:0,vy:1+rt.particles.random(),vz:0,size:.12,life:.8,color:[.5,1,.7],glow:.3});}
}
