export const PLAYER_RESPAWN_DELAY=3;
/** A presentation-only collapse; the simulation owns the remaining time. */
export function deathTilt(remaining:number){
 if(remaining<=0)return 0;
 const t=Math.min(1,Math.max(0,(PLAYER_RESPAWN_DELAY-remaining)/.55));
 return -1.35*(1-(1-t)*(1-t));
}
export class DeathNotice {
 private panel:HTMLElement|null=null;
 constructor(){if(typeof document==='undefined')return;this.panel=document.createElement('div');this.panel.className='player-death-notice';this.panel.hidden=true;this.panel.setAttribute('role','status');document.body.append(this.panel);}
 update(remaining:number){if(!this.panel)return;this.panel.hidden=remaining<=0;if(remaining>0)this.panel.textContent=`Fallen · back at camp in ${Math.ceil(remaining)}`;}
 clear(){if(this.panel)this.panel.hidden=true;}
}
