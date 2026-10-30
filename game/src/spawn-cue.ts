import type { GameRuntime } from '@engine/runtime';
import { PARTICLE } from '@engine/fx';
/** Brief cue on an actual respawn, at its authoritative position. */
export function spawnCue(rt:GameRuntime,x:number,z:number){
 const r=rt.particles.random;
 rt.particles.spawn({kind:PARTICLE.ring,x,y:.08,z,size:1.1,life:.55,color:[.70,.46,.78],glow:.18});
 for(let i=0;i<6;i++)rt.particles.spawn({kind:PARTICLE.glow,x:x+(r()-.5)*.7,y:.15+r()*.45,z:z+(r()-.5)*.7,vx:(r()-.5)*.7,vy:.6+r(),vz:(r()-.5)*.7,size:.10+r()*.09,life:.5+r()*.4,color:[.75,.45,.85],glow:.5,gravity:0});
}
