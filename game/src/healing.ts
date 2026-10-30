import { canStand } from './scenes/environment-map';

/** A spellcaster's close-range support pulse; distances are in world metres. */
export const HEAL_RADIUS=3.2;
export const HEAL_COOLDOWN=6;
export const HEAL_AMOUNT=1;
export const MAX_HEALTH=6;
export type HealingTarget={x:number;z:number;health:number;connected:boolean;respawnRemaining:number};
/** Heal living connected allies (including the caster), never revive or exceed max health. */
export function healNearby(caster:{x:number;z:number},targets:Iterable<HealingTarget>,gateOpen=false):number {
 let healed=0;
 for(const t of targets)if(t.connected && t.health>0 && t.respawnRemaining<=0 && t.health<MAX_HEALTH && Math.hypot(t.x-caster.x,t.z-caster.z)<=HEAL_RADIUS && clearHealingPath(caster,t,gateOpen)){t.health=Math.min(MAX_HEALTH,t.health+HEAL_AMOUNT);healed++;}
 return healed;
}

function clearHealingPath(a:{x:number;z:number},b:{x:number;z:number},gateOpen:boolean){
 const dx=b.x-a.x,dz=b.z-a.z,steps=Math.ceil(Math.hypot(dx,dz)/.2);
 for(let i=1;i<steps;i++)if(!canStand(a.x+dx*i/steps,a.z+dz*i/steps,gateOpen))return false;
 return true;
}
