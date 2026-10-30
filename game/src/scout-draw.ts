/** Scout draw controls range only; damage remains the same at every draw. */
export const SCOUT_MIN_RANGE=6;
export const SCOUT_MAX_RANGE=16;
export const SCOUT_FULL_DRAW=1.2;
export function scoutRange(progress:number){return SCOUT_MIN_RANGE+(SCOUT_MAX_RANGE-SCOUT_MIN_RANGE)*Math.max(0,Math.min(1,progress));}
export class ScoutDraw {
 active=false;
 elapsed=0;
 get progress(){return Math.min(1,this.elapsed/SCOUT_FULL_DRAW);}
 get range(){return scoutRange(this.progress);}
 /** Returns the release range exactly once, or null while drawing/idle. */
 step(held:boolean,dt:number,canStart:boolean):number|null {
  if(held){if(!this.active && canStart){this.active=true;this.elapsed=0;}if(this.active)this.elapsed=Math.min(SCOUT_FULL_DRAW,this.elapsed+Math.max(0,Math.min(.1,dt)));return null;}
  if(this.active){const range=this.range;this.cancel();return range;}return null;
 }
 cancel(){this.active=false;this.elapsed=0;}
}
