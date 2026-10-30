/** Attack volumes are sampled throughout the active portion of each swing. */
export type FighterClass = 'Knight'|'Spellcaster'|'Scout';
export interface AttackVolume { x:number; z:number; radius:number }
export const ACTIVE_START = .14;
export const ACTIVE_END = .32;
/** Minimum time between attack starts, including recovery. */
export const ATTACK_COOLDOWN:Record<FighterClass,number>={ Knight:.72, Scout:.85, Spellcaster:1.0 };
export const PROJECTILE_RELEASE=.22;
export function attackVolume(x:number,z:number,yaw:number,kind:FighterClass): AttackVolume {
  const offset=kind==='Knight'?1.05:kind==='Spellcaster'?2.6:3.4;
  return {x:x+Math.sin(yaw)*offset,z:z+Math.cos(yaw)*offset,radius:kind==='Knight'?1.05:kind==='Spellcaster'?2.4:1.5};
}
export function overlaps(v:AttackVolume,x:number,z:number,radius:number):boolean {return Math.hypot(v.x-x,v.z-z)<=v.radius+radius;}
export class AttackWindow {
  age=Infinity;
  hit=new Set<string>();
  kind:FighterClass="Knight";
  released=false;
  start(kind:FighterClass="Knight") { this.age=0;this.kind=kind;this.released=false;this.hit.clear(); }
  advance(dt:number) { this.age+=dt; }
  get active() { return this.age>=ACTIVE_START && this.age<=ACTIVE_END; }
  get ready() { return this.age>=ATTACK_COOLDOWN[this.kind]; }
  take(id:string,v:AttackVolume,x:number,z:number,radius:number):boolean {
    if(!this.active || this.hit.has(id) || !overlaps(v,x,z,radius))return false;
    this.hit.add(id);return true;
  }
}
