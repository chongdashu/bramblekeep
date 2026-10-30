import './caster-spells.css';
export type SpellMode='attack'|'heal';
/** Two explicit, thumb-sized spell choices; the normal action casts the selected spell. */
export class CasterSpells {
 private root:HTMLElement|null=null;private mode:SpellMode='attack';private active=false;
 constructor(){
  if(typeof document==='undefined')return;
  const root=document.createElement('div');root.className='caster-spells';root.hidden=true;root.setAttribute('role','group');root.setAttribute('aria-label','Choose spell');
  root.innerHTML='<button type="button" data-spell="attack" aria-label="Attack spell, key 1"><span aria-hidden="true">✦</span> Attack <small>1</small></button><button type="button" data-spell="heal" aria-label="Healing spell, key 2"><span aria-hidden="true">✚</span> Heal <small>2</small><em></em></button><div class="caster-spells-hint">Select a spell · use Attack to cast</div>';
  root.addEventListener('pointerdown',e=>e.stopPropagation());
  root.addEventListener('click',e=>{const button=(e.target as Element).closest<HTMLButtonElement>('button[data-spell]');if(button)this.select(button.dataset.spell as SpellMode);});
  document.addEventListener('keydown',e=>{if(!this.active||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target instanceof HTMLElement&&(e.target.matches('input,textarea,select')||e.target.isContentEditable))return;if(e.code==='Digit1'||e.code==='Digit2'){e.preventDefault();this.select(e.code==='Digit1'?'attack':'heal');}});
  document.body.append(root);this.root=root;this.select('attack');
 }
 select(mode:SpellMode){this.mode=mode;this.root?.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.spell===mode)));}
 get selected(){return this.mode;}
 update(visible:boolean,cooldown:number){this.active=visible;if(!this.root)return;this.root.hidden=!visible;const remaining=Math.max(0,cooldown),el=this.root.querySelector('em')!;el.textContent=remaining>0?`${Math.ceil(remaining)}s`:'';const button=document.querySelector<HTMLButtonElement>('.touch-btn[data-action="attack"]');if(button){button.dataset.cast=visible&&this.mode==='heal'?'heal':'attack';button.setAttribute('aria-label',visible&&this.mode==='heal'?'Cast heal':'Attack');const span=button.querySelector('span');if(span)span.textContent=visible&&this.mode==='heal'?'Heal':'Attack';}}
 hide(){this.update(false,0);}
}
