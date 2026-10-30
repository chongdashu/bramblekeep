import { guardianVulnerable } from './guardian';
import './guardian-hud.css';
/** Encounter hint shown only to players who can see the courtyard fight. */
export class GuardianHud {
 private root:HTMLElement|null=null;
 constructor(){if(typeof document==='undefined')return;this.root=document.createElement('div');this.root.className='guardian-hud';this.root.hidden=true;this.root.setAttribute('role','status');document.body.append(this.root);}
 update(visible:boolean,phase:number,windup:number,health:number){
  if(!this.root)return;
  this.root.hidden=!visible;
  if(!visible)return;
  const text=phase===0?'Strike the Bramble Boss':phase===1?'The Bramble Boss awakens!':!guardianVulnerable(phase,windup)?'Dodge the slam!':health>0?'Bramble Boss exposed — attack!':'';
  if(this.root.textContent!==text)this.root.textContent=text;
  this.root.dataset.guarded=String(phase===1||windup>0);
 }
 hide(){if(this.root)this.root.hidden=true;}
}
