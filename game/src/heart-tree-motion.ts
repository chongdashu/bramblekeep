/** Hit flash strength at the moment of a hit, and how long it fades. The renderer mixes the lit colour
 * toward an overbright white (2.2), so even 0.2 blows the bark out to a white silhouette. */
export const HIT_FLASH_PEAK=.07;
export const HIT_FLASH_SECONDS=.12;

/** Presentation clocks for the rooted guardian. Combat remains simulation-owned. */
export class HeartTreeMotion {
 private health=6;
 private hurtAt=-Infinity;
 private defeatedAt: number|undefined;
 sample(health:number,time:number,cleared:boolean) {
  if(health>this.health){this.defeatedAt=undefined;this.hurtAt=-Infinity;}
  else if(this.defeatedAt!==undefined && !cleared)this.defeatedAt=undefined;
  if(health<this.health)this.hurtAt=time;
  if(cleared && this.defeatedAt===undefined)this.defeatedAt=time;
  this.health=health;
  const hitAge=Math.max(0,time-this.hurtAt);
  const recoil=hitAge<.4?Math.sin(Math.PI*hitAge/.4):0;
  const defeat=this.defeatedAt===undefined?0:Math.min(1,Math.max(0,(time-this.defeatedAt)/1.6));
  const fall=1-(1-defeat)*(1-defeat);
  // A short, light pop. The guardian is hit several times a second, and a long full flash
  // left it a solid white silhouette for most of the fight.
  const flash=hitAge<HIT_FLASH_SECONDS?HIT_FLASH_PEAK*(1-hitAge/HIT_FLASH_SECONDS):0;
  return {pitch:-.2*recoil-.9*fall,roll:.035*Math.sin(time*1.5)*(1-fall),arm:.18*Math.sin(time*1.8)*(1-fall),flash,fall};
 }
}
