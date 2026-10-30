import './player-death.css';
import { Client, type Room } from '@colyseus/sdk';
import type { GameRuntime } from '@engine/runtime';
import type { InputSnapshot } from '@engine/input';
import type { Phase } from '@engine/game';
import { loadGlb, type GltfDoc } from '@engine/gltf/glb';
import { Animator, type Layer } from '@engine/gltf/animator';
import { ModelRenderer, type GpuModel } from '@engine/gpu/model';
import { MESH, hex } from '@engine/gpu/meshes';
import { mat4 } from '@engine/math';
import { EnvironmentScene } from './scenes/environment';
import { terrainHeight } from './scenes/terrain';
import { overlookHeight } from './scenes/overlook';
import { CastleState } from './multiplayer-schema';
import { CORE_MAX_HP, ENEMY_MODEL_LIMIT } from './castle-patrol';
import { Weapons, attackPose } from './weapons';
import { loopLayers } from './loop-layers';
import { IdleVariations, heroIdleLayers } from './idle-motion';
import { enemyAttackPose, EnemyDeaths, enemyReaction } from './enemy-motion';
import { enemyType } from './enemy-types';
import { installSceneLinks } from './scene-menu';
import { installMobilePreview } from './mobile-preview';
import { installWorldStatus } from './menu-world-status';
import { CastleMusic, campDistance } from './castle-music';
import { CombatAudioEvents } from './combat-audio-events';
import { scoutAimGuide } from './scout-arrows';
import { scoutRange, SCOUT_MIN_RANGE } from './scout-draw';
import { PROJECTILE_RELEASE } from './castle-combat';
import { CASTLE_PROTOCOL } from './multiplayer-protocol';
import { drawGateLevers } from './gate-view';
import { LeverReactions, emitLeverImpact } from './lever-effects';
import { playerDamageFeedback } from './player-damage-feedback';
import { clearLeverHud } from './lever-hud';
import { LEVERS } from './gate-mechanism';
import { GateCinematic } from './gate-cinematic';
import { VictoryFinale } from './victory-finale';
import { CasterSpells } from './caster-spells';
import { emitHealing } from './healing-effects';
import { GuardianHud } from './guardian-hud';
import { HeartTree } from './heart-tree';
import { EnemyEmergence } from './enemy-emergence';
import { spawnCue } from './spawn-cue';
import { DeathNotice, deathTilt } from './player-death';
import { LocalPrediction, smoothPosition, smoothAngle } from './multiplayer-motion';
import { ConnectionMonitor, connectionText, type ConnectionView } from './connection-status';
import { worldHour, nightAmount, clockLabel } from './world-clock';
import { SocialUI } from './social-ui';
import { VictoryUI } from './victory-ui';
import { HeroStatus } from './hero-status';
import { Nameplates } from './nameplates';
import { NearbyChat, isNearbyHero } from './nearby-chat';
import { wavedashDisplayName } from './wavedash-name';
import { AchievementsUI } from './achievements-ui';
import { AchievementSync } from './achievement-sync';
import { ENEMY_NAMES, type PlayerProgress } from './achievements';
import { platform } from '@engine/platform';
import { analytics } from './analytics';
import type { FighterClass } from './castle-combat';

const classes: FighterClass[]=['Knight','Spellcaster','Scout'];
type Remote = { model:GpuModel; animator:Animator; weapons:Weapons; kind:number; x:number; z:number; yaw:number; gait:number; attackAge:number; attackSeq:number };
type ProfileResponse = {id:string;name:string;progress?:PlayerProgress};
/** Presentation and input adapter: the Colyseus room owns gameplay state. */
export class MultiplayerGame extends EnvironmentScene {
 private runtime!:GameRuntime;
 private room:Room<any,CastleState>|null=null;
 private client!:Client;
 private endpoint="";
 private selecting!:HTMLElement;
 private message!:HTMLElement;
 private profileInput!:HTMLInputElement;
 private profileStatus!:HTMLElement;
 private guestSecret='';
 private profileId='';
 private savedName='';
 private profileLoading:Promise<void>|null=null;
 private profileSaving:Promise<void>=Promise.resolve();
 private profileCommitting=false;
 private profileToastTimer:ReturnType<typeof setTimeout>|undefined;
 private profileToast!:HTMLElement;
 private victory!:VictoryUI;
 private heroStatus!:HeroStatus;
 private nameplates!:Nameplates;
 private nearbyChat!:NearbyChat;
 private visual!:ModelRenderer;
 private worldAssets:Promise<void>|null=null;
 private worldAssetsReady=false;
 private docs:GltfDoc[]=[];
 private bases:GpuModel[]=[];
 private weaponBase!:Weapons;
 private remote=new Map<string,Remote>();
 private remotePool:Remote[][]=[[],[],[]];
 private enemyDeaths=new EnemyDeaths();
 private enemyIdles=new IdleVariations();
 private remoteIdles=new IdleVariations();
 private enemyEmergence=new EnemyEmergence();
 private guardianPose:{x:number;z:number;yaw:number;phase:number}|null=null;
 private enemyPose=new Map<string,{x:number;z:number;yaw:number;gait:number;moveWeight:number}>();
 private projectilePose=new Map<string,{x:number;z:number}>();
 private prediction=new LocalPrediction();
 private predictionReady=false;
 private inputSeq=0;
 private lastServerTick=-1;
 private lastRound=-1;
 private enemyModels:GpuModel[]=[];
 private enemyAnimators:Animator[]=[];
 private breached!:GpuModel;
 private arrow!:GpuModel;
 private arrowModels:GpuModel[]=[];
 private worldRoot=mat4.identity();
 private worldClock=0;
 private musicState=new CastleMusic();
 private combatAudio=new CombatAudioEvents();
 private cinematic=new GateCinematic();
 private finale=new VictoryFinale();
 private casterSpells=new CasterSpells();
 private healSeen=new Map<string,number>();
 private guardianHud=new GuardianHud();
 private leverReactions = new LeverReactions();
 private deathNotice=new DeathNotice();
 private heartTree!:HeartTree;
 private sendClock=0;
 private pendingAttack=false;
 private inputIntent:{x:number;z:number;sprint:boolean;attack:boolean;heal?:boolean}={x:0,z:0,sprint:false,attack:false};
 private attackSeq=-1;
 private lastHealth=6;
 private lastDefeats=0;
 private lastGate=false;
 private lastClear=false;
 private sharedCaptureRound=-1;
 private social!:SocialUI;
 private achievements!:AchievementsUI;
 private achievementSync=new AchievementSync(platform.stats,platform.boards);
 private progressClock=0;
 private progressKills=-1;
 private progressRefreshing=false;
 private leaderboardRefreshing=false;
 private socialTick=-1;
 private clockElement!:HTMLElement;
 private connectionElement!:HTMLElement;
 private connectionView:ConnectionView={phase:'selecting',ping:null,players:null};
 private connection=new ConnectionMonitor(view=>{this.connectionView=view;if(this.connectionElement){this.connectionElement.dataset.state=view.phase;this.connectionElement.textContent=connectionText(view);this.connectionElement.setAttribute('aria-label',connectionText(view));}});
 private joinAttempt=0;
 private joined=false;
 private hudOn=false;
 private debugServer=false;
 debugActions(){return [{group:'Multiplayer',label:'Add AI player',title:'Add a server-controlled teammate to the shared world',enabled:()=>this.joined&&this.debugServer&&(this.room?.state?.players.size??24)<24,run:()=>this.room?.send('debug_add_player')},...(import.meta.env.DEV?[{group:'Multiplayer',label:'Live world monitor',title:'View production and playtest world status',run:()=>{void import('./dev/world-monitor').then(({openWorldMonitor})=>openWorldMonitor());}}]:[])];}
 protected override musicTrack(){return 'castleCamp';}
 protected override audioPhase(phase:Phase):Phase{return phase==='playing'&&!this.joined?'menu':phase;}
 protected override initialPossessed(){return true;}
 protected override coreVisible(){return false;}
 protected override playerDeathRemaining(){return this.room?.state?.players.get(this.room.sessionId)?.respawnRemaining??0;}
 protected override showNockedArrow(age:number){return age<PROJECTILE_RELEASE;}
 protected override showCampCompanions(){return false;}
 protected override castleBreached(){return !!this.room?.state?.gateOpen || this.playablePose().z < -20.2;}
 async load(rt:GameRuntime,progress:(p:number,label?:string)=>void){
  this.runtime=rt;await super.load(rt,progress);rt.input.stickZone=()=>true;if(import.meta.env.DEV)installMobilePreview(rt);
  this.visual=new ModelRenderer(rt.renderer);
  document.body.classList.add('castle-play','multiplayer-play');installSceneLinks();
  const endpoint=import.meta.env.VITE_COLYSEUS_URL || `${location.protocol}//${location.hostname}:2567`;
  this.endpoint=endpoint;this.client=new Client(endpoint);installWorldStatus(endpoint);
  this.achievements=new AchievementsUI();
  this.createOverlay();
  this.social=new SocialUI(text=>this.room?.send('chat',text),()=>this.runtime.input.clear(),opener=>this.achievements.open(opener),()=>this.refreshLeaderboard());
  analytics.subscribe(enabled=>{if(enabled)this.room?.send('analytics_opt_in',analytics.joinContext());else this.room?.send('analytics_opt_out');});
  this.connectionElement=document.createElement('div');this.connectionElement.className='connection-status';this.connectionElement.setAttribute('role','status');this.connectionElement.setAttribute('aria-live','off');this.connectionElement.hidden=true;this.clockElement=document.createElement('div');this.clockElement.className='world-clock';this.clockElement.hidden=true;const cluster=document.createElement('div');cluster.className='connection-cluster';cluster.append(this.clockElement,this.connectionElement);document.querySelector('#hud')?.append(cluster);this.connection.setPhase('selecting');
  const pauseCard=document.querySelector<HTMLElement>('#pause-pop .pcard');if(pauseCard){const note=document.createElement('p');note.className='multiplayer-pause-note';note.textContent='The shared world continues while this menu is open.';pauseCard.insertBefore(note,pauseCard.querySelector('.row-buttons'));}

  Object.assign(rt.hooks,{leverEffects:()=>this.leverReactions.snapshot()});
  Object.assign(rt.hooks,{multiplayer:()=>({joined:this.joined,connection:this.connectionView,roomId:this.room?.roomId??null,sessionId:this.room?.sessionId??null,players:this.room?.state?.players.size??0,round:this.room?.state?.round??0,gateOpen:this.room?.state?.gateOpen??false,leverHealth:[this.room?.state?.leverLeft??4,this.room?.state?.leverRight??4],gateRemaining:this.room?.state?.gateRemaining??0,health:this.room?.state?.players.get(this.room.sessionId)?.health??6,respawnRemaining:this.playerDeathRemaining(),drawProgress:this.room?.state?.players.get(this.room.sessionId)?.drawProgress??-1,drawRange:scoutRange(Math.max(0,this.room?.state?.players.get(this.room.sessionId)?.drawProgress??0)),attackSeq:this.room?.state?.players.get(this.room.sessionId)?.attackSeq??0,cinematic:this.cinematic.active,victorySequence:this.finale.active,coreHealth:this.room?.state?.coreHealth??CORE_MAX_HP,guardian:this.room?.state?{x:this.room.state.guardianX,z:this.room.state.guardianZ,phase:this.room.state.guardianPhase,emerge:this.room.state.guardianEmerge}:null,cleared:this.room?.state?.cleared??false,night:this.room?.state?.night??false,enemyStates:this.room?.state ? [...this.room.state.enemies].map(([id,e])=>({id,x:e.x,z:e.z,renderX:this.enemyPose.get(id)?.x??e.x,renderZ:this.enemyPose.get(id)?.z??e.z,yaw:e.yaw,renderYaw:this.enemyPose.get(id)?.yaw??e.yaw,moving:e.moving})) : [],playerStates:this.room?.state ? [...this.room.state.players].map(([id,p])=>({id,connected:p.connected,classId:p.classId,x:p.x,z:p.z})) : [],remoteActors:[...this.remote].map(([id,a])=>({id,x:a.x,z:a.z,kind:classes[a.kind]}))})});
  progress(1,'Shared world ready');
 }
 private createOverlay(){
  const panel=document.createElement('section');panel.className='multiplayer-join';panel.hidden=true;
  panel.innerHTML=`<div class="multiplayer-card"><h1>Choose your hero</h1><p>Join the shared castle and fight together.</p><label class="player-name-label" for="player-name">Playing as <span class="player-name-edit"><input id="player-name" class="player-name-input" aria-label="Your player name" maxlength="24" autocomplete="off" placeholder="Loading name…" readonly disabled><span class="player-name-pencil" aria-hidden="true">✎</span><span class="player-name-toast" role="status" aria-live="polite" hidden>Name saved ✓</span></span></label><div class="player-name-status" role="status"></div><div class="multiplayer-classes"><button type="button" data-class="Knight"><b>Knight</b><span>Close-range sword</span></button><button type="button" data-class="Spellcaster"><b>Spellcaster</b><span>Magical orbs</span></button><button type="button" data-class="Scout"><b>Scout</b><span>Ranged arrows</span></button></div><p class="multiplayer-message" role="status" aria-live="polite">Select a class to join.</p><a class="multiplayer-back" href="./">Back to menu</a></div>`;
  panel.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-class]');if(button)void this.join(button.dataset.class as FighterClass);});
  document.body.append(panel);this.selecting=panel;this.message=panel.querySelector('.multiplayer-message')!;
  this.profileInput=panel.querySelector('.player-name-input')!;this.profileStatus=panel.querySelector('.player-name-status')!;this.profileToast=panel.querySelector('.player-name-toast')!;
  const editName=()=>{this.profileToast.hidden=true;clearTimeout(this.profileToastTimer);this.profileInput.readOnly=false;this.profileStatus.textContent='Press Enter to save your name.';};
  const back=panel.querySelector<HTMLAnchorElement>('.multiplayer-back')!;
  back.addEventListener('click',event=>{event.preventDefault();this.runtime.returnToMenu();});
  window.addEventListener('keydown',event=>{
   if(event.key!=='Escape'||panel.hidden||this.joined)return;
   if(document.activeElement===this.profileInput&&!this.profileInput.readOnly)return;
   event.preventDefault();event.stopImmediatePropagation();this.runtime.returnToMenu();
  },true);
  this.profileInput.addEventListener('focus',editName);this.profileInput.addEventListener('click',editName);
  this.profileInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();void this.commitProfileName(true);}else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.profileInput.value=this.savedName;this.profileInput.readOnly=true;this.profileInput.blur();this.profileStatus.textContent='Click your name to edit it.';}});
  this.profileInput.addEventListener('blur',()=>{if(!this.profileInput.readOnly&&!this.profileCommitting)void this.commitProfileName();});
  void this.loadProfile().catch(()=>{});
  this.victory=new VictoryUI();this.heroStatus=new HeroStatus();this.nameplates=new Nameplates(this.runtime);this.nearbyChat=new NearbyChat(this.runtime);
  // Reveal the existing title first, then prepare online-only art while the
  // player is reading it or the menu. A fast Play also starts this work.
  requestAnimationFrame(()=>{void this.prepareWorldAssets().catch(()=>{});});
 }
 private prepareWorldAssets():Promise<void>{
  if(this.worldAssets)return this.worldAssets;
  const loading=this.loadWorldAssets().then(()=>{this.worldAssetsReady=true;}).catch(error=>{this.worldAssets=null;throw error;});
  this.worldAssets=loading;return loading;
 }
 private async loadWorldAssets(){
  const files=['enemies/bloom-animated.glb','enemies/bramble-animated.glb','enemies/mushroom-animated.glb','enemies/stump-animated.glb','environment-lab/tripo-keep-breached.glb'];
  const docs=await Promise.all(files.map(p=>loadGlb(new URL(`assets/${p}`,document.baseURI).href)));
  this.docs=this.characterDocuments();this.bases=this.docs.map(d=>this.visual.upload(d));
  const enemyDocs=docs.slice(0,4),enemy=enemyDocs.map(d=>this.visual.upload(d));this.enemyModels=Array.from({length:ENEMY_MODEL_LIMIT},(_,i)=>i<4?enemy[i]:this.visual.instance(enemy[i%4]));this.enemyAnimators=Array.from({length:ENEMY_MODEL_LIMIT},(_,i)=>new Animator(enemyDocs[i%4]));
  this.heartTree=new HeartTree(this.visual,docs[3]);
  this.breached=this.visual.upload(docs[4]);this.visual.recolor(this.breached,new Map([['tripo_material_7b637080-eb7c-480b-a995-2928cb1e52c9',[.32,.32,.32]]]));
  const weapons=this.weaponDocuments();this.arrow=this.visual.upload(weapons[3]);this.arrowModels=Array.from({length:24},(_,i)=>i?this.visual.instance(this.arrow):this.arrow);
  this.weaponBase=new Weapons(this.visual);await this.weaponBase.load(weapons);
  this.runtime.renderer.sceneHooks.push(()=>this.visual.draw());
 }
 private async credentials():Promise<{guestSecret?:string;wavedashToken?:string;wavedashName?:string}>{
  if(platform.id==='wavedash'){const token=await platform.userToken?.();if(token)return {wavedashToken:token,wavedashName:await wavedashDisplayName()};}
  const preview=import.meta.env.DEV&&new URLSearchParams(location.search).has('mobilePreview');const key=preview?'castle-mobile-preview-secret':'castle-guest-secret-v1';let storage:Storage|null=null;let secret:string|undefined=this.guestSecret||undefined;try{storage=preview?sessionStorage:localStorage;secret=storage.getItem(key)??secret;}catch{}
  if(!secret||!/^[a-f0-9]{64}$/.test(secret)){secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');try{storage?.setItem(key,secret);}catch{}}
  this.guestSecret=secret;return {guestSecret:secret};
 }
 private async requestProfile(credentials:{guestSecret?:string;wavedashToken?:string;wavedashName?:string},operation:'get'|'set',name?:string):Promise<ProfileResponse>{
  const response=await fetch(new URL('player-profile',this.endpoint.replace(/\/$/,'')+'/'),{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({...credentials,operation,...(operation==='set'?{name,expectedId:this.profileId}:{})}),signal:AbortSignal.timeout(8000)});
  if(!response.ok){if(platform.id==='wavedash'&&!credentials.wavedashToken&&response.status===400)throw new Error('Wavedash identity is unavailable. Please try again.');throw new Error('Could not load or save your player name');}return await response.json() as ProfileResponse;
 }
 private acceptProgress(profile:ProfileResponse){
  const progress=profile.progress;
  if(!progress||!Array.isArray(progress.kills)||progress.kills.length!==ENEMY_NAMES.length||![...progress.kills,progress.battleWins,progress.bossFinishes].every(value=>Number.isSafeInteger(value)&&value>=0))return;
  this.achievements.update(progress);this.achievementSync.update(progress);
 }
 private refreshProgress(){
  if(this.progressRefreshing||!this.joined)return;this.progressRefreshing=true;
  void (async()=>{const profile=await this.requestProfile(await this.credentials(),'get');if(this.joined&&profile.id===this.profileId)this.acceptProgress(profile);})().catch(()=>{}).finally(()=>{this.progressRefreshing=false;});
 }
 private refreshLeaderboard(){
  if(this.leaderboardRefreshing)return;this.leaderboardRefreshing=true;
  void fetch(new URL('leaderboard',this.endpoint.replace(/\/$/,'')+'/'),{cache:'no-store',signal:AbortSignal.timeout(8000)}).then(async response=>{if(!response.ok)throw new Error('Leaderboard unavailable');const value=await response.json() as {entries?:unknown};if(!Array.isArray(value.entries))throw new Error('Invalid leaderboard');const entries=value.entries.filter((entry):entry is {name:string;wins:number;classId:string}=>!!entry&&typeof entry.name==='string'&&typeof entry.classId==='string'&&Number.isSafeInteger(entry.wins)&&entry.wins>=0);this.social.setLeaderboard(entries);}).catch(()=>this.social.setLeaderboard(null)).finally(()=>{this.leaderboardRefreshing=false;});
 }
 private loadProfile():Promise<void>{
  if(this.profileLoading)return this.profileLoading;
  this.profileLoading=(async()=>{try{const profile=await this.requestProfile(await this.credentials(),'get');this.profileId=profile.id;this.savedName=profile.name;this.acceptProgress(profile);this.profileInput.value=profile.name;this.profileInput.disabled=false;this.profileStatus.textContent='Click your name to edit it.';}catch(error){this.profileStatus.textContent='Could not load your name. Select a hero to retry.';throw error;}finally{this.profileLoading=null;}})();return this.profileLoading;
 }
 private commitProfileName(explicit=false):Promise<void>{
  if(this.profileCommitting)return this.profileSaving;
  this.profileCommitting=true;
  this.profileSaving=this.profileSaving.then(async()=>{try{await this.saveProfile(undefined,explicit);this.profileInput.readOnly=true;this.profileInput.blur();this.profileStatus.textContent='Click your name to edit it.';this.profileToast.hidden=false;clearTimeout(this.profileToastTimer);this.profileToastTimer=setTimeout(()=>{this.profileToast.hidden=true;},2600);}catch(error){this.profileStatus.textContent=error instanceof Error&&error.message==='Please enter a name.'?error.message:'Could not save your name. Try again.';}finally{this.profileCommitting=false;}});
  return this.profileSaving;
 }
 private async saveProfile(credentials?:{guestSecret?:string;wavedashToken?:string;wavedashName?:string},force=false){
  const name=this.profileInput.value.trim();if(!name){this.profileStatus.textContent='Please enter a name.';throw new Error('Please enter a name.');}
  if(name===this.savedName&&!force)return;
  const profile=await this.requestProfile(credentials??await this.credentials(),'set',name);this.savedName=profile.name;this.acceptProgress(profile);this.profileInput.value=profile.name;this.profileStatus.textContent='Name saved.';
 }
 private async join(kind:FighterClass){
  if(!classes.includes(kind)||this.joined||!this.hudOn)return;
  analytics.track('hero_selected',{hero:kind});
  const attempt=++this.joinAttempt;
  const buttons=this.selecting.querySelectorAll<HTMLButtonElement>('button');buttons.forEach(b=>b.disabled=true);this.message.textContent=this.worldAssetsReady?'Joining the castle…':'Preparing the castle…';this.connection.setPhase('connecting');
  try{
   try{await this.prepareWorldAssets();}catch{throw new Error('The castle artwork could not load. Check your connection and try again.');}
   if(attempt!==this.joinAttempt||!this.hudOn)return;
   this.message.textContent='Joining the castle…';
   const response=await fetch(new URL('health',this.endpoint.replace(/\/$/,'')+'/'),{signal:AbortSignal.timeout(5000)});
   if(!response.ok)throw new Error('Castle server unavailable');
   const health=await response.json() as {protocol?:string;devDebug?:boolean};this.debugServer=health.devDebug===true;
   if(health.protocol!==CASTLE_PROTOCOL)throw new Error('The castle server uses a different game version. Refresh the game and try again.');
   if(attempt!==this.joinAttempt||!this.hudOn)return;
   await this.profileSaving;if(!this.profileId)await this.loadProfile();
   const credentials=await this.credentials();const current=await this.requestProfile(credentials,'get');
   if(current.id!==this.profileId){this.achievements.reset();this.achievementSync=new AchievementSync(platform.stats,platform.boards);this.profileId=current.id;this.savedName=current.name;this.acceptProgress(current);this.profileInput.value=current.name;this.profileInput.disabled=false;throw new Error('Your player identity changed. Please review your name and try again.');}
   this.acceptProgress(current);
   if(current.name!==this.savedName&&this.profileInput.value.trim()===this.savedName){this.savedName=current.name;this.profileInput.value=current.name;}
   await this.saveProfile(credentials);
   if(attempt!==this.joinAttempt||!this.hudOn)return;
   const room=await this.client.join<CastleState>('castle',{classId:kind,...credentials,analytics:analytics.joinContext()},CastleState);if(attempt!==this.joinAttempt||!this.hudOn){void room.leave();return;}this.room=room;if(!analytics.enabled())room.send('analytics_opt_out');this.joined=true;analytics.setJoined(true);this.connection.start(room);this.social.setJoined(true);this.selectPlayableCharacter(classes.indexOf(kind));
   this.selecting.hidden=true;this.attackSeq=-1;this.lastClear=room.state.cleared;this.lastGate=room.state.gateOpen;this.lastDefeats=0;this.sendClock=0;this.predictionReady=false;this.lastServerTick=-1;this.lastRound=-1;this.guardianPose=null;this.enemyDeaths.clear();this.enemyIdles.clear();this.remoteIdles.clear();this.enemyEmergence.clear();this.musicState.reset();this.combatAudio.reset();
   room.onDrop(()=>{if(this.room!==room)return;analytics.setJoined(false);this.finale.skip();this.connection.setPhase('reconnecting');this.victory.hide();this.heroStatus.hide();this.clockElement.hidden=true;this.social.setJoined(false);this.joined=false;this.selecting.hidden=false;this.message.textContent='Connection lost. Reconnecting…';buttons.forEach(b=>b.disabled=true);});
   room.onReconnect(()=>{if(this.room!==room)return;this.connection.start(room);this.social.setJoined(true);this.joined=true;analytics.setJoined(true);this.selecting.hidden=true;this.sendClock=0;this.predictionReady=false;this.lastServerTick=-1;this.combatAudio.reset();this.lastGate=room.state.gateOpen;this.lastClear=room.state.cleared;});
   room.onLeave(()=>{if(this.room!==room)return;analytics.setJoined(false);this.finale.skip();this.connection.setPhase('disconnected');this.clockElement.hidden=true;this.social.setJoined(false);this.room=null;this.joined=false;this.victory.hide();this.heroStatus.hide();if(this.hudOn){this.selecting.hidden=false;this.message.textContent='Disconnected. Choose a hero to join again.';buttons.forEach(b=>b.disabled=false);}});
  }catch(error){if(attempt!==this.joinAttempt)return;const detail=error instanceof Error?error.message:'';const reason=detail.includes('castle artwork')?'other':detail.includes('different game version')?'version_mismatch':detail.includes('Wavedash identity')?'identity_unavailable':detail.includes('already in the world')?'already_joined':detail.includes('player identity changed')?'identity_changed':detail.includes('Please enter a name')?'profile_invalid':detail.includes('load or save your player name')?'profile_unavailable':'server_unavailable';analytics.track('join_failed',{reason});this.connection.setPhase('disconnected');console.warn('[multiplayer] join failed',error);this.message.textContent=error instanceof Error&&(error.message.includes('castle artwork')||error.message.includes('different game version')||error.message.includes('Wavedash identity')||error.message.includes('already in the world')||error.message.includes('player identity changed')||error.message.includes('Please enter a name'))?error.message:'Could not reach the castle server. Check the connection and try again.';buttons.forEach(b=>b.disabled=false);}
 }
 override input(snap:InputSnapshot,dt:number){
  if(this.social?.typing || this.achievements?.isOpen || !this.joined || this.room?.state?.cleared || this.runtime.phase!=='playing' || dt<=0){this.inputIntent={x:0,z:0,sprint:false,attack:false};return;}
  const {right,up}=this.runtime.camera.groundBasis();
  this.inputIntent={x:right[0]*snap.moveX-up[0]*snap.moveY,z:right[1]*snap.moveX-up[1]*snap.moveY,sprint:snap.held.has('sprint'),attack:snap.held.has('attack')||snap.pressed.has('attack'),heal:this.casterSpells.selected==='heal'};
  this.pendingAttack ||= this.inputIntent.attack;
 }
 override frame(dt:number,snap:InputSnapshot,phase:Phase):[number,number]{
  const state=this.room?.state;this.worldClock+=dt;
  if(this.joined&&this.room&&state){
   analytics.setResults(state.cleared);
   if(state.cleared&&!this.lastClear){this.progressClock=0;this.sound.cue('coreClear');if(phase==='playing')this.finale.start(this.runtime,state.guardianX,state.guardianZ);}this.lastClear=state.cleared;
   if(state.cleared && this.sharedCaptureRound!==state.round){this.sharedCaptureRound=state.round;this.victory.setFrame(this.runtime.captureFrame());}
   if(!state.cleared || phase!=='playing')this.finale.skip();
   if(this.socialTick!==state.tick){this.social.update(state);this.nearbyChat.observe(state);this.socialTick=state.tick;}const clock=clockLabel(state.worldSeconds);if(this.clockElement.dataset.clock!==clock){this.clockElement.dataset.clock=clock;const hour=worldHour(state.worldSeconds), period=hour<5?'Night':hour<8?'Dawn':hour<17?'Day':hour<20?'Dusk':'Night';this.clockElement.dataset.period=period.toLowerCase();this.clockElement.innerHTML=`<span class="clock-orb" aria-hidden="true"></span><span class="clock-copy"><span class="clock-period">${period}</span><span class="clock-time">${clock}</span></span>`;this.clockElement.setAttribute('aria-label',`World time ${clock}, ${period}`);}this.clockElement.hidden=false;
   this.connection.setPlayers(state.players.has(this.room.sessionId)?[...state.players.values()].filter(player=>player.connected).length:null);
   this.sendClock-=dt;if(this.sendClock<=0){this.sendClock=.05;this.inputSeq++;this.room.send('input',{...(phase==='playing'?{...this.inputIntent,attack:this.inputIntent.attack||this.pendingAttack}:{x:0,z:0,sprint:false,attack:false}),seq:this.inputSeq});this.pendingAttack=false;}
   const me=state.players.get(this.room.sessionId);
   this.casterSpells.update(phase==='playing'&&!state.cleared&&me?.classId==='Spellcaster'&&(me?.respawnRemaining??0)<=0,me?.healCooldown??0);
   for(const [id,p] of state.players){const seen=this.healSeen.get(id);if(seen!==undefined&&p.healSeq>seen)emitHealing(this.runtime,p.x,p.z);this.healSeen.set(id,p.healSeq);}
   for(const id of this.healSeen.keys())if(!state.players.has(id))this.healSeen.delete(id);
   if(me){if(me.kills!==this.progressKills){this.progressKills=me.kills;this.progressClock=0;}this.progressClock-=dt;if(this.progressClock<=0){this.progressClock=15;this.refreshProgress();}const old=this.playablePose(),distance=Math.hypot(me.x-old.x,me.z-old.z);
    const resetPosition=!this.predictionReady||state.round!==this.lastRound||distance>2;
    if(resetPosition){this.prediction.reset({x:me.x,z:me.z});this.predictionReady=true;this.lastRound=state.round;this.lastServerTick=state.tick;}
    else if(state.tick!==this.lastServerTick){this.prediction.reconcile({x:me.x,z:me.z},me.lastSeq,state.gateOpen);this.lastServerTick=state.tick;}
    const canMove=phase==='playing'&&!state.cleared&&me.respawnRemaining<=0;const intent=canMove?this.inputIntent:{x:0,z:0,sprint:false};const predicted=this.prediction.advance(this.inputSeq,intent,canMove?dt:0,state.gateOpen);
    const displayed=resetPosition?{x:me.x,z:me.z}:smoothPosition(old,predicted,dt,25);
    const moving=Math.hypot(intent.x,intent.z)>.05;const yaw=moving?Math.atan2(intent.x,intent.z):me.yaw;
    this.setAuthoritativePose(displayed.x,displayed.z,smoothAngle(old.yaw,yaw,1-Math.exp(-18*dt)),dt,this.inputIntent.sprint);
    if(this.attackSeq<0)this.attackSeq=me.attackSeq;else if(me.attackSeq!==this.attackSeq){this.attackSeq=me.attackSeq;this.animateAuthoritativeAttack();}
    if(me.classId==='Scout' && me.drawProgress>=0)this.holdScoutDrawPose();
    if(me.health<this.lastHealth){this.sound.cue('playerHurt');playerDamageFeedback(this.runtime, me.health <= 0);}if(me.health>this.lastHealth&&distance>2)this.sound.cue('respawn');this.lastHealth=me.health;this.deathNotice.update(me.respawnRemaining);
    if(this.finale.active)this.victory.hide();else this.victory.update(state,me.kills);
    this.heroStatus.update(state.scores.get(this.profileId)?.name??this.savedName,me.classId as FighterClass,me.health);
   }
   if (phase === "playing") for (const i of this.leverReactions.step([state.leverLeftHits,state.leverRightHits],dt,state.round)) emitLeverImpact(this.runtime,i,this.playablePose());
   const listener=this.playablePose();
   this.sound.combat(this.combatAudio.update({round:state.round,gateOpen:state.gateOpen,cleared:state.cleared,coreHealth:state.coreHealth,corePosition:{x:state.guardianX,z:state.guardianZ},guardianAttack:state.guardianAttack,leverHealth:[state.leverLeft,state.leverRight],leverHits:[state.leverLeftHits,state.leverRightHits],enemies:[...state.enemies].map(([id,e])=>({id,x:e.x,z:e.z,hp:e.hp,attackSeq:e.attackSeq}))},phase==='playing'),listener.x,listener.z);
   if(state.defeats>this.lastDefeats)this.sound.cue('enemyDefeat');this.lastDefeats=state.defeats;
   if(state.gateOpen&&!this.lastGate&&!state.cleared){this.cinematic.start(this.runtime);this.sound.cue('gateBreach');}this.lastGate=state.gateOpen;
   const pose=this.playablePose();const danger=[...state.enemies.values()].some(e=>e.alive&&Math.hypot(e.x-pose.x,e.z-pose.z)<5);
   this.guardianHud.update(phase==='playing'&&!state.cleared&&pose.z < -20.2&&Math.hypot(pose.x-state.guardianX,pose.z-state.guardianZ)<10,state.guardianPhase,state.guardianWindup,state.coreHealth);
   this.sound.setTrack(this.musicState.update(dt,{cleared:state.cleared,gateOpen:state.gateOpen,danger,coreHealth:state.coreHealth,coreMaxHealth:CORE_MAX_HP,nearCore:Math.hypot(pose.x-state.guardianX,pose.z-state.guardianZ)<4.5,campDistance:campDistance(pose.x,pose.z),round:state.round}));
   this.setWorldDaylight(nightAmount(worldHour(state.worldSeconds)),worldHour(state.worldSeconds));
   const status=document.querySelector<HTMLElement>('#gym-status');if(status)status.textContent=state.cleared?'Bramble Boss defeated!':state.gateOpen?`Bramble Boss ${state.coreHealth}/${CORE_MAX_HP} · ${state.gateRemaining>0?`gate ${Math.ceil(state.gateRemaining)}s`:'gate held'}`:'Break the gate';
   const hint=document.querySelector<HTMLElement>('#gym-objective');if(hint)hint.textContent=me?.classId==='Scout' && me.drawProgress>=0?`Drawing ${Math.round(me.drawProgress*100)}% · release to fire`:state.cleared?'Castle cleared!':state.gateOpen?'Attack the Bramble Boss · strike levers to delay repairs':`Strike both levers to zero before they repair · ${state.players.size} heroes`;
   this.updateRemote(state,dt);
   this.updateWorldMotion(state,dt);
  }
  if(!this.joined || !state){this.guardianHud.hide();this.casterSpells.hide();this.healSeen.clear();}
  const camera=super.frame(dt,snap,phase);this.finale.step(dt,this.runtime);if(this.cinematic.step(dt,this.runtime) && phase==='playing')this.sound.cue('gateImpact');return camera;
 }
 private updateRemote(state:CastleState,dt:number){
  for(const [id,p] of state.players){if(id===this.room?.sessionId||!p.connected)continue;const kind=Math.max(0,classes.indexOf(p.classId as FighterClass));let actor=this.remote.get(id);
   if(!actor){actor=this.remotePool[kind].pop();if(!actor){const animator=new Animator(this.docs[kind],0,'Spine01'),weapons=this.weaponBase.instance();weapons.calibrate(animator);actor={model:this.visual.instance(this.bases[kind]),animator,weapons,kind,x:p.x,z:p.z,yaw:p.yaw,gait:0,attackAge:Infinity,attackSeq:p.attackSeq};}Object.assign(actor,{x:p.x,z:p.z,yaw:p.yaw,gait:0,attackAge:Infinity,attackSeq:p.attackSeq});this.remote.set(id,actor);}
   const d=Math.hypot(p.x-actor.x,p.z-actor.z),f=d>2?1:1-Math.exp(-12*dt);actor.x+=(p.x-actor.x)*f;actor.z+=(p.z-actor.z)*f;actor.yaw=smoothAngle(actor.yaw,p.yaw,f);actor.gait+=Math.min(d,1)/1.8*f;actor.attackAge+=dt;if(p.attackSeq!==actor.attackSeq){actor.attackSeq=p.attackSeq;actor.attackAge=0;if(this.runtime.phase==='playing'){const listener=this.playablePose();this.sound.attackAt(kind,p.x,p.z,listener.x,listener.z);}}
   this.remoteIdles.update(id,dt,d<.025 && actor.attackAge>=.58 && p.respawnRemaining<=0 && p.drawProgress<0);
  }
  for(const [id,actor] of this.remote)if(!state.players.has(id)||!state.players.get(id)?.connected){this.remote.delete(id);this.remoteIdles.remove(id);this.remotePool[actor.kind].push(actor);}
 }
 private updateWorldMotion(state:CastleState,dt:number){
  const prior=this.guardianPose,authoritative={x:state.guardianX,z:state.guardianZ};
  if(!prior || (prior.phase>0&&state.guardianPhase===0) || Math.hypot(prior.x-authoritative.x,prior.z-authoritative.z)>2)this.guardianPose={...authoritative,yaw:state.guardianYaw,phase:state.guardianPhase};
  else {const next=smoothPosition(prior,authoritative,dt);prior.x=next.x;prior.z=next.z;prior.yaw=smoothAngle(prior.yaw,state.guardianYaw,1-Math.exp(-14*dt));prior.phase=state.guardianPhase;}
  for(const [id,e] of state.enemies){this.enemyDeaths.update(id,e.alive,dt);if(e.alive)this.enemyIdles.update(id,dt,!e.moving && e.windup<=0 && e.attackCue<=0 && e.hitFlash<=0);else this.enemyIdles.remove(id);if(this.enemyEmergence.update(id,e.alive,dt))spawnCue(this.runtime,e.x,e.z);if(!e.alive){this.enemyPose.delete(id);continue;}let pose=this.enemyPose.get(id);
   if(!pose){pose={x:e.x,z:e.z,yaw:e.yaw,gait:e.gait,moveWeight:e.moving?1:0};this.enemyPose.set(id,pose);continue;}
   const next=smoothPosition(pose,e,dt),travel=Math.hypot(next.x-pose.x,next.z-pose.z);pose.x=next.x;pose.z=next.z;pose.yaw=smoothAngle(pose.yaw,e.yaw,1-Math.exp(-14*dt));pose.moveWeight+=((e.moving?1:0)-pose.moveWeight)*(1-Math.exp(-7*dt));if(travel<2)pose.gait=(pose.gait+travel/(.85*enemyType(e.type).scale))%1;
  }
  for(const id of this.enemyPose.keys())if(!state.enemies.has(id))this.enemyPose.delete(id);
  for(const [id,shot] of state.projectiles){const old=this.projectilePose.get(id);this.projectilePose.set(id,old?smoothPosition(old,shot,dt,24):{x:shot.x,z:shot.z});}
  for(const id of this.projectilePose.keys())if(!state.projectiles.has(id))this.projectilePose.delete(id);
 }
 override draw(){
  super.draw();const state=this.room?.state;if(!state||!this.joined){this.nameplates.clear();this.nearbyChat.clear();clearLeverHud();this.leverReactions.reset();return;}const b=this.runtime.batches;
  { const pose=this.playablePose();drawGateLevers(this.runtime,[state.leverLeft,state.leverRight],this.worldClock,{...pose,ground:Math.max(terrainHeight(pose.x,pose.z),overlookHeight(pose.x,pose.z))},state.cleared,this.cinematic.active,state.gateOpen,[this.leverReactions.angle(0),this.leverReactions.angle(1)],[this.leverReactions.flash(0),this.leverReactions.flash(1)]); }
  if(state.gateOpen&&this.playablePose().z>-21){mat4.compose(this.worldRoot,0,0,0,-18,0,0,0,1.2,1.4,1);this.visual.prepareStatic(this.breached,{root:this.worldRoot});}
  if(state.gateOpen)this.cinematic.draw(this.runtime);
  if(state.gateOpen || this.playablePose().z < -20.2 || state.guardianPhase>0)this.heartTree.draw(this.runtime,state.coreHealth,this.worldClock,state.cleared,{x:this.guardianPose?.x??state.guardianX,z:this.guardianPose?.z??state.guardianZ,yaw:this.guardianPose?.yaw??state.guardianYaw,phase:state.guardianPhase,emerge:state.guardianEmerge,windup:state.guardianWindup,attackCue:state.guardianAttack,moving:state.guardianMoving,gait:state.guardianGait});
  for(const [key,e] of state.enemies){
   const model=this.enemyModels[Number(key)],deathAge=this.enemyDeaths.age(key);if(!model||(!e.alive&&deathAge===undefined))continue;
   const pose=this.enemyPose.get(key)??e,reaction=enemyReaction(e.alive?e.hitFlash:0,deathAge),profile=enemyType(e.type);
   const anticipation=e.windup>0?1-e.windup/.5:0,lunge=e.alive?(e.attackCue>0?Math.sin(Math.PI*(1-e.attackCue/.45))*.24:-anticipation*.13):0,offset=lunge-reaction.back*profile.scale;
   mat4.compose(this.worldRoot,0,pose.x+Math.sin(pose.yaw)*offset,terrainHeight(pose.x,pose.z)-reaction.sink*profile.scale,pose.z+Math.cos(pose.yaw)*offset+this.enemyEmergence.offset(key),pose.yaw,reaction.pitch,0,profile.scale,profile.scale,profile.scale);
   const animator=this.enemyAnimators[Number(key)],layers:Layer[]=[{clip:'idle',time:0}];
   const moveWeight=this.enemyPose.get(key)?.moveWeight??(e.moving?1:0);if(e.alive&&moveWeight>.001)layers.push(...loopLayers('walk',pose.gait,animator.clipDuration('walk'),moveWeight));
   animator.update(layers,this.worldRoot,reaction.pose ?? (e.alive?(enemyAttackPose(e.windup,e.attackCue) ?? this.enemyIdles.pose(key,e.type,true)):undefined));this.visual.prepareSkinned(model,animator,{flash:e.alive&&e.hitFlash>0?.65:0});this.runtime.blob(pose.x,pose.z,profile.radius,.35*(1-reaction.sink));
   if(!e.alive)continue;
   if(e.windup>0)b[MESH.cylinder].push(pose.x,.05,pose.z,0,0,0,1.8,.03,1.8,hex(0xe46f4f),.8);
   if(e.hp<e.maxHp){const barY=terrainHeight(pose.x,pose.z)+profile.height*profile.scale+.25;b[MESH.box].push(pose.x,barY,pose.z,0,0,0,1,.07,.08,hex(0x442b32),.8);b[MESH.box].push(pose.x-(1-e.hp/e.maxHp)*.5,barY+.02,pose.z,0,0,0,e.hp/e.maxHp,.08,.09,hex(0x8fe86d),.8);}
  }
  let arrow=0;for(const [id,p] of state.projectiles){const pose=this.projectilePose.get(id)??p;if(p.kind==='arrow'&&arrow<this.arrowModels.length){mat4.compose(this.worldRoot,0,pose.x,.9,pose.z,Math.atan2(p.dx,p.dz),0,0,1,1,1);this.visual.prepareStatic(this.arrowModels[arrow++],{root:this.worldRoot});}else if(p.kind==='orb')b[MESH.sphere].push(pose.x,1,pose.z,0,0,0,.28,.28,.28,hex(0xba86ff),.35,0,1,1,.65);}
  const me=state.players.get(this.room!.sessionId);
  if(me?.classId==='Scout'&&!state.cleared){const targets=[...state.enemies].flatMap(([id,e])=>e.alive?[{id:`enemy-${id}`,x:e.x,z:e.z,radius:enemyType(e.type).radius}]:[]);targets.push(...LEVERS.map(l=>({...l})));if(state.gateOpen||this.playablePose().z < -20.2)targets.push({id:'core',x:state.guardianX,z:state.guardianZ,radius:.8});const pose=this.playablePose(),guide=scoutAimGuide(pose.x,pose.z,pose.yaw,targets,state.gateOpen,me.drawProgress>=0?scoutRange(me.drawProgress):SCOUT_MIN_RANGE);for(const dot of guide.points)b[MESH.sphere].push(dot.x,.16,dot.z,0,0,0,.13,.13,.13,hex(0x54e5ef),.7,0,1,1,.1);if(guide.target){const {x,z}=guide.target,c=hex(0x54e5ef);for(const side of [-1,1]){b[MESH.box].push(x+side*.62,.12,z,0,0,0,.30,.05,.09,c,.6);b[MESH.box].push(x,.12,z+side*.62,0,0,0,.09,.05,.30,c,.6);}}}
  const observer=this.playablePose();this.nameplates.begin();this.nearbyChat.begin();if(this.hudOn&&!state.cleared)this.nearbyChat.place(this.room!.sessionId,observer.x,Math.max(terrainHeight(observer.x,observer.z),overlookHeight(observer.x,observer.z))+2.05,observer.z);for(const [id,actor] of this.remote){const p=state.players.get(id);if(!p)continue;const ground=Math.max(terrainHeight(actor.x,actor.z),overlookHeight(actor.x,actor.z));if(this.hudOn&&!state.cleared&&isNearbyHero(observer.x,observer.z,actor.x,actor.z)){this.nameplates.place(id,p.name,actor.x,ground+2.05,actor.z);this.nearbyChat.place(id,actor.x,ground+2.05,actor.z);}mat4.compose(this.worldRoot,0,actor.x,ground,actor.z,actor.yaw,deathTilt(p.respawnRemaining),0,1,1,1);const layers:Layer[]=heroIdleLayers();if(Math.hypot(p.x-actor.x,p.z-actor.z)>.01)layers.push(...loopLayers('walk',actor.gait,actor.animator.clipDuration('walk'),1));const age=actor.kind===2 && p.drawProgress>=0?.12:actor.attackAge;actor.animator.update(layers,this.worldRoot,attackPose(actor.kind,age) ?? this.remoteIdles.pose(id,actor.kind));this.visual.prepareSkinned(actor.model,actor.animator);actor.weapons.draw(actor.animator,actor.kind,age,actor.yaw);}this.nameplates.end();this.nearbyChat.end();
 }
 override showHud(on:boolean){if(!on){this.casterSpells.hide();this.healSeen.clear();this.guardianHud.hide();analytics.setJoined(false);this.finale.skip();this.deathNotice.clear();this.cinematic.skip();this.joinAttempt++;if(this.connectionElement)this.connection.setPhase('selecting');this.selecting?.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.disabled=false);if(this.message)this.message.textContent='Select a class to join.';}super.showHud(on);this.hudOn=on;this.social?.show(on);if(!on)this.social?.setJoined(false);if(this.connectionElement)this.connectionElement.hidden=!on;if(this.clockElement&&!on)this.clockElement.hidden=true;const h=document.querySelector<HTMLElement>('#hud');if(h)h.hidden=!on;const panel=document.querySelector<HTMLElement>('#environment-lab');if(panel)panel.hidden=true;const classButton=document.querySelector<HTMLElement>('#gym-class');if(classButton)classButton.hidden=true;const allies=document.querySelector<HTMLElement>('#gym-allies');if(allies)allies.hidden=true;if(this.selecting)this.selecting.hidden=!on||this.joined;if(this.victory&&!on)this.victory.hide();if(this.heroStatus&&!on)this.heroStatus.hide();if(this.nameplates&&!on)this.nameplates.clear();if(this.nearbyChat&&!on)this.nearbyChat.clear();if(!on&&this.room){const room=this.room;this.room=null;this.joined=false;this.connection.setPhase('selecting');void room.leave();}}
}
