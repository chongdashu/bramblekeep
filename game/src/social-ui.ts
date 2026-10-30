import type { CastleState } from './multiplayer-schema';
import { clockLabel } from './world-clock';
import { CORE_MAX_HP } from './castle-patrol';
import { analytics } from './analytics';
const icons:Record<string,string>={join:'✦',leave:'↗',gate:'⚑',kill:'⚔',victory:'★'};
/** Small permanent chat, recent event feed and a hold-to-view round scoreboard. */
export class SocialUI {
 private root:HTMLElement;private feed:HTMLElement;private lines:HTMLElement;private input:HTMLInputElement;private board:HTMLElement;private scoreButton:HTMLButtonElement;private visible=false;private joined=false;private signature='';private boardSignature='';
 private leaderboard:{name:string;wins:number;classId:string}[]|null=null;
 private leaderboardUnavailable=false;
 constructor(private readonly send:(message:string)=>void,private readonly clearInput:()=>void,private readonly openAchievements:(opener:HTMLElement)=>void,private readonly refreshLeaderboard:()=>void){
  const root=document.createElement('div');root.className='social-ui';root.hidden=true;
  root.innerHTML=`<div class="chat-scrim" aria-hidden="true"></div><aside class="activity-feed" aria-label="World activity"></aside><section class="chat-panel" aria-label="Global chat"><div class="chat-heading"><b>Global chat</b><span><button type="button" class="awards-button">Awards</button><button type="button" class="scores-button" aria-label="Show battle wins">Wins · Tab</button></span></div><div class="chat-lines" aria-live="polite"></div><input class="chat-input" aria-label="Global chat message" maxlength="240" placeholder="Enter to chat" autocomplete="off"></section><section class="scoreboard" aria-label="Battle wins leaderboard" hidden></section>`;
  document.body.append(root);this.root=root;this.feed=root.querySelector('.activity-feed')!;this.lines=root.querySelector('.chat-lines')!;this.input=root.querySelector('.chat-input')!;this.board=root.querySelector('.scoreboard')!;this.scoreButton=root.querySelector('.scores-button')!;
  this.scoreButton.addEventListener('click',()=>{this.board.hidden=!this.board.hidden;if(!this.board.hidden){this.refreshLeaderboard();analytics.track('scores_opened');}});
  root.querySelector<HTMLButtonElement>('.awards-button')!.addEventListener('click',event=>{this.clearInput();this.openAchievements(event.currentTarget as HTMLElement);analytics.track('achievements_opened');});
  this.input.addEventListener('focus',()=>{this.clearInput();this.lines.scrollTop=this.lines.scrollHeight;});
  document.addEventListener('keydown',event=>{
   if(!this.visible||!this.joined||event.repeat)return;
   const active=document.activeElement;
   if(event.key==='Enter'){
    if(active instanceof HTMLElement&&active!==this.input&&active.matches('input,textarea,select,button,a,[contenteditable=true]')&&!active.closest('[hidden]'))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(active===this.input){const text=this.input.value.trim();if(text)this.send(text);this.input.value='';this.input.blur();}
    else{this.clearInput();this.input.focus();}
   }else if(event.key==='Escape'&&active===this.input){event.preventDefault();event.stopImmediatePropagation();this.input.blur();this.clearInput();}
   else if(event.key==='Tab'&&active!==this.input){event.preventDefault();event.stopImmediatePropagation();const wasHidden=this.board.hidden;this.board.hidden=false;this.refreshLeaderboard();if(wasHidden)analytics.track('scores_opened');}
  },true);
  document.addEventListener('keyup',event=>{if(this.visible&&event.key==='Tab'&&document.activeElement!==this.input){event.preventDefault();event.stopImmediatePropagation();this.board.hidden=true;}},true);
  window.addEventListener('blur',()=>{this.board.hidden=true;});
 }
 get typing(){return document.activeElement===this.input;}
 setLeaderboard(entries:{name:string;wins:number;classId:string}[]|null){this.leaderboard=entries;this.leaderboardUnavailable=entries===null;this.boardSignature='';}
 show(on:boolean){this.visible=on;this.root.hidden=!on;if(!on){this.board.hidden=true;this.input.blur();}}
 setJoined(joined:boolean){this.joined=joined;this.input.disabled=!joined;if(!joined){this.input.blur();this.board.hidden=true;}}
 update(state:CastleState){
  const events=[...state.activity.entries()].map(([id,e])=>({id:Number(id),kind:e.kind,name:e.name,text:e.text,sentAt:e.sentAt})).sort((a,b)=>a.id-b.id);
  const signature=JSON.stringify(events);if(signature!==this.signature){this.signature=signature;
   this.feed.replaceChildren(...events.filter(e=>e.kind!=='chat').slice(-4).map(e=>{const line=document.createElement('div');const icon=document.createElement('span');icon.className='activity-icon';icon.textContent=icons[e.kind]??'•';const text=document.createElement('span');text.textContent=`${e.name} ${e.text}`;line.append(icon,text);return line;}));
   this.lines.replaceChildren(...events.filter(e=>e.kind==='chat').slice(-20).map(e=>{const line=document.createElement('div'),name=document.createElement('b');if(e.sentAt>0){const time=document.createElement('time');const date=new Date(e.sentAt);time.dateTime=date.toISOString();time.className='chat-time';time.textContent=new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(date);line.append(time);}name.textContent=`${e.name}: `;line.append(name,document.createTextNode(e.text));return line;}));this.lines.scrollTop=this.lines.scrollHeight;
  }
  const scores=[...state.scores.entries()].map(([id,row])=>({name:row.name,classId:row.classId,kills:row.kills,connected:row.connected,bot:id.startsWith('ai-teammate:')})).sort((a,b)=>b.kills-a.kills||a.name.localeCompare(b.name));
  const boardSignature=JSON.stringify([state.round,state.defeats,state.coreHealth,clockLabel(state.worldSeconds),scores,this.leaderboard]);if(boardSignature!==this.boardSignature){this.boardSignature=boardSignature;
   this.board.innerHTML='<div class="scoreboard-banner"><span class="scoreboard-eyebrow">✦ &nbsp; HEROES OF BRAMBLEKEEP &nbsp; ✦</span><h2>Battle wins</h2><div class="scoreboard-round"></div></div><div class="scoreboard-summary"><span class="scoreboard-defeats"></span><span class="scoreboard-core"></span></div><div class="scoreboard-list-heading"><span>This battle</span><span>Defeats</span></div><div class="scoreboard-party-list"></div><div class="scoreboard-list-heading scoreboard-wins-heading"><span>Battle wins</span><span>Wins</span></div><div class="scoreboard-list"></div>';
   this.board.querySelector('.scoreboard-round')!.textContent=`ROUND ${state.round}  ·  ${clockLabel(state.worldSeconds)}`;
   this.board.querySelector('.scoreboard-defeats')!.textContent=`⚔ ${state.defeats} defeated`;
   this.board.querySelector('.scoreboard-core')!.textContent=`Bramble Boss ${state.coreHealth}/${CORE_MAX_HP}`;
   const list=this.board.querySelector('.scoreboard-list')!;
   if(!this.leaderboard)list.textContent=this.leaderboardUnavailable?'Battle wins are unavailable.':'Loading battle wins…';
   else if(!this.leaderboard.length)list.textContent='No castle victories yet.';
   else for(const [index,score] of this.leaderboard.entries()){const row=document.createElement('div');row.className='score-row';const rank=document.createElement('span');rank.className='score-rank';rank.textContent=String(index+1);const portrait=document.createElement('img');portrait.className='score-portrait';portrait.alt='';const kind=['Knight','Scout','Spellcaster'].includes(score.classId)?score.classId.toLowerCase():'knight';portrait.src=new URL(`assets/ui/hero-${kind}.webp`,document.baseURI).href;const identity=document.createElement('span');identity.className='score-identity';const name=document.createElement('b');name.textContent=score.name;identity.append(name);const points=document.createElement('strong');points.className='score-points';points.textContent=String(score.wins);row.append(rank,portrait,identity,points);list.append(row);}
   const party=this.board.querySelector('.scoreboard-party-list')!;
   if(!scores.length)party.textContent='No heroes in this battle.';
   for(const [index,score] of scores.entries()){const row=document.createElement('div');row.className='party-score-row';const rank=document.createElement('span');rank.className='score-rank';rank.textContent=String(index+1);const identity=document.createElement('span');identity.className='score-identity';const name=document.createElement('b');name.textContent=score.name;const role=document.createElement('small');role.textContent=`${score.classId}${score.bot?' · AI':''}${score.connected?'':' · away'}`;identity.append(name,role);const points=document.createElement('strong');points.className='score-points';points.textContent=String(score.kills);row.append(rank,identity,points);party.append(row);}
  }
 }
}
