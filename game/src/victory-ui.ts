import type { CastleState } from './multiplayer-schema';
import { VictoryShare } from './victory-share';

/** The result screen is derived exclusively from the server's frozen round result. */
export class VictoryUI {
 private root:HTMLElement;
 private signature='';
 private share=new VictoryShare();
 private frame:Promise<HTMLCanvasElement|null>|null=null;
 setFrame(frame:Promise<HTMLCanvasElement>){this.frame=frame.catch(()=>null);}
 constructor(){
  this.root=document.createElement('section');this.root.className='multiplayer-victory';this.root.hidden=true;
  this.root.setAttribute('aria-label','Castle victory results');document.body.append(this.root);
 }
 hide(){this.root.hidden=true;this.signature='';}
 update(state:CastleState,personalKills:number){
  if(!state.cleared){this.hide();return;}
  const scores=[...state.victoryScores.entries()].map(([id,s])=>({name:s.name,classId:s.classId,kills:s.kills,connected:s.connected,bot:id.startsWith('ai-teammate:')})).sort((a,b)=>b.kills-a.kills||a.name.localeCompare(b.name));
  const signature=JSON.stringify([state.round,state.defeats,personalKills,scores]);
  this.root.hidden=false;
  if(signature===this.signature){const countdown=this.root.querySelector<HTMLElement>('.victory-countdown strong');if(countdown)countdown.textContent=`${state.victoryRemaining}s`;return;}this.signature=signature;
  const card=document.createElement('div');card.className='victory-card';
  card.innerHTML='<div class="victory-art"><div class="victory-eyebrow">✦ &nbsp; A VICTORY FOR THE REALM &nbsp; ✦</div><h1>Castle cleared!</h1><p class="victory-subtitle">The Bramble Boss has fallen. Your party has won.</p></div><div class="victory-content"><div class="victory-stats"><div><strong class="victory-total"></strong><span>Enemies defeated</span></div><div><strong class="victory-personal"></strong><span>Your defeats</span></div><div><strong class="victory-heroes"></strong><span>Heroes</span></div></div><div class="victory-leaders"><h2>Top heroes</h2><div class="victory-list"></div></div><div class="victory-countdown"><span>Round resets in</span><strong></strong></div><button class="victory-share-button" type="button">Share victory</button></div>';

  card.querySelector('.victory-total')!.textContent=String(state.defeats);card.querySelector('.victory-personal')!.textContent=String(personalKills);card.querySelector('.victory-heroes')!.textContent=String(scores.length);card.querySelector('.victory-countdown strong')!.textContent=`${state.victoryRemaining}s`;
  const list=card.querySelector('.victory-list')!;
  scores.forEach((score,index)=>{const row=document.createElement('div');row.className='victory-row';const rank=document.createElement('span'),name=document.createElement('span'),kills=document.createElement('strong');rank.className='victory-rank';rank.textContent=String(index+1);name.className='victory-name';name.textContent=`${score.name} · ${score.classId}${score.bot?' · AI':''}${score.connected?'':' · away'}`;kills.textContent=String(score.kills);row.append(rank,name,kills);list.append(row);});
  const shareResult={round:state.round,defeats:state.defeats,scores:scores.map(score=>({...score}))};
  card.querySelector<HTMLButtonElement>('.victory-share-button')!.addEventListener('click',()=>{void this.share.open(this.frame,shareResult);});
  this.root.replaceChildren(card);
 }
}
