import type { FighterClass } from './castle-combat';

/** Local player's identity and authoritative health, shown during multiplayer. */
export class HeroStatus {
 private root:HTMLElement;
 private portrait:HTMLImageElement;
 private name:HTMLElement;
 private role:HTMLElement;
 private fill:HTMLElement;
 private value:HTMLElement;
 private signature='';
 constructor(){
  const root=document.createElement('section');root.className='hero-status';root.hidden=true;root.setAttribute('aria-label','Your hero');
  root.innerHTML='<div class="hero-status-portrait"><img alt=""></div><div class="hero-status-info"><div class="hero-status-name"></div><div class="hero-status-class"></div><div class="hero-status-health"><span aria-hidden="true">♥</span><div class="hero-status-track"><div class="hero-status-fill"></div></div><strong></strong></div></div>';
  document.body.append(root);this.root=root;this.portrait=root.querySelector('img')!;this.name=root.querySelector('.hero-status-name')!;this.role=root.querySelector('.hero-status-class')!;this.fill=root.querySelector('.hero-status-fill')!;this.value=root.querySelector('.hero-status-health strong')!;
 }
 hide(){this.root.hidden=true;this.signature='';}
 update(name:string,classId:FighterClass,health:number){
  const current=Math.max(0,Math.min(6,health)),signature=`${name}|${classId}|${current}`;this.root.hidden=false;if(signature===this.signature)return;this.signature=signature;
  this.name.textContent=name;this.role.textContent=classId;this.value.textContent=`${current}/6`;this.fill.style.width=`${current/6*100}%`;this.root.setAttribute('aria-label',`${name}, ${classId}, health ${current} of 6`);
  this.portrait.src=new URL(`assets/ui/hero-${classId.toLowerCase()}.webp`,document.baseURI).href;
 }
}
