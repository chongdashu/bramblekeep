import { Room, type Client } from '@colyseus/core';
import { CastleState, PlayerState, EnemyState, ProjectileState, ScoreState, ActivityState } from '../src/multiplayer-schema';
import { quantize } from '../src/multiplayer-motion';
import { nightAmount, worldHour } from '../src/world-clock';
import { WorldStorage } from './storage';
import { World } from './world';
import { identify, type Identity } from './identity';
import { profiles } from './profiles';
import { Social, type Score } from './social';
import { freezeVictoryRoster } from './victory-roster';
import type { FighterClass } from '../src/castle-combat';
import { isTeammate, teammateName, TeammateDirector } from './teammates';
import { TeammateChat } from './teammate-chat';
import { TeammateAdvisor } from './teammate-advisor';
import { analyticsSink, type TrackingContext } from './analytics';
import { ProgressStore } from './progress';

export const storage=new WorldStorage(process.env.CASTLE_DATA_DIR ?? 'out/multiplayer');
export const progress=new ProgressStore(process.env.CASTLE_DATA_DIR ?? 'out/multiplayer');
export class CastleRoom extends Room<{state:CastleState}> {
 private social=new Social();
 private sessions=new Map<string,Identity>();
 private tracking=new Map<string,{context:TrackingContext;moved:boolean;attacked:boolean;attackSeq:number;health:number;round:number}>();
 private chatTimes=new Map<string,number>();
 private victoryRoster:Score[]=[];
 private world=new World(result=>{const identity=this.sessions.get(result.id);storage.record({...result,id:identity?.id??result.id});},(kind,id,enemyType)=>{
  const identity=this.sessions.get(id);
  if(identity){try{if(kind==='kill'&&enemyType!==undefined)progress.defeat(identity.id,enemyType);if(kind==='victory')progress.finish(identity.id);}catch(error){console.error('[castle] could not save player progress',error);}}
  if(kind==='kill')analyticsSink.emit(this.tracking.get(id)?.context,'enemy_defeated',{round:this.world.round});
  if(kind==='gate'||kind==='victory')for(const [session,track] of this.tracking){if(!this.world.players.get(session)?.connected)continue;if(kind==='gate')analyticsSink.emit(track.context,'gate_breached',{round:this.world.round});else analyticsSink.emit(track.context,'castle_cleared',{round:this.world.round});}
  if(identity||isTeammate(id))this.social.add(kind,identity?.name??teammateName(id),kind==='gate'?'unlocked the gate':kind==='victory'?'cleared the castle':'defeated an enemy');if(kind==='victory'){for(const [session,player] of this.world.players){const row=this.social.roster.get(this.sessions.get(session)?.id??'');if(row)row.kills=player.kills;}this.victoryRoster=freezeVictoryRoster(this.social.roster.values(),this.world.players.values());}if(kind==='victory')for(const row of this.social.roster.values())if(!row.connected)storage.record({round:this.world.round,id:row.id,classId:row.classId as FighterClass,kills:row.kills,won:true,finishedAt:new Date().toISOString()});
 });
 private teammates=new TeammateDirector(this.world);
 get teammateTarget(){return this.teammates.partySize;}
 private teammateChat=new TeammateChat(this.world,(name,text,actorId)=>this.social.add('chat',name,text,actorId));
 private teammateAdvisor=new TeammateAdvisor(process.env.CASTLE_JEV_SHADOW==='1' ? process.env.TYPESAFE_API_KEY??'' : '');
 private checkpointClock=0;
 private tick=0;
 private lastMessage=new Map<string,number>();
 private snapshot(){const snapshot=this.world.snapshot();snapshot.activeSessions=snapshot.activeSessions?.map(p=>({...p,id:this.sessions.get(p.id)?.id??p.id}));return {...snapshot,social:this.social.snapshot()};}
 onCreate(){
  const saved=storage.load();if(saved)this.world.restore(saved);this.social.restore(saved?.social,this.world.round);
  this.autoDispose=false;this.maxClients=24;this.setState(new CastleState());this.setPatchRate(50);
  this.onMessage('input',(client,payload)=>{const now=Date.now(),last=this.lastMessage.get(client.sessionId)??0;if(now-last<25)return;this.lastMessage.set(client.sessionId,now);const player=this.world.players.get(client.sessionId),previous=player?.inputSeq;this.world.setInput(client.sessionId,payload);const track=this.tracking.get(client.sessionId);if(player&&track&&!track.moved&&player.inputSeq!==previous&&Math.hypot(player.input.x,player.input.z)>.05){track.moved=true;analyticsSink.emit(track.context,'first_move',{round:this.world.round});}});
  this.onMessage('debug_add_player',client=>{if(process.env.CASTLE_DEV_DEBUG!=='1'||!this.sessions.has(client.sessionId))return;this.teammates.addDebugPlayer();this.sync();});
  this.onMessage('analytics_opt_out',client=>{const track=this.tracking.get(client.sessionId);if(track)analyticsSink.discard(track.context.sessionId);this.tracking.delete(client.sessionId);});
  this.onMessage('analytics_opt_in',(client,payload)=>{if(this.tracking.has(client.sessionId))return;const identity=this.sessions.get(client.sessionId),player=this.world.players.get(client.sessionId);if(!identity||!player)return;const context=analyticsSink.context(payload,identity.id);if(!context)return;this.tracking.set(client.sessionId,{context,moved:false,attacked:false,attackSeq:player.attackSeq,health:player.health,round:this.world.round});analyticsSink.emit(context,'world_tracking_resumed',{hero:player.classId,round:this.world.round,gateOpen:this.world.gateOpen,cleared:this.world.cleared,players:this.humanPlayers()});});
  this.onMessage('chat',(client,payload)=>{const identity=this.sessions.get(client.sessionId);if(!identity||typeof payload!=='string')return;const text=payload.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,240),now=Date.now();if(!text||now-(this.chatTimes.get(identity.id)??0)<1000)return;this.chatTimes.set(identity.id,now);this.social.add('chat',identity.name,text,client.sessionId);analyticsSink.emit(this.tracking.get(client.sessionId)?.context,'chat_sent');void storage.saveAsync(this.snapshot()).catch(error=>console.error('[castle] checkpoint failed',error));this.sync();});
  this.setSimulationInterval(ms=>{this.teammates.step();this.teammateChat.step();this.teammateAdvisor.step(this.world);this.world.step(ms/1000);this.tick++;if(this.social.round!==this.world.round){this.social.reset(this.world.round);this.victoryRoster=[];}this.checkpointClock+=ms;if(this.checkpointClock>=2000){this.checkpointClock=0;void storage.saveAsync(this.snapshot()).catch(error=>console.error('[castle] checkpoint failed',error));}this.sync();},50);this.sync();
 }
 async onAuth(_client:Client,options:{guestSecret?:unknown;wavedashToken?:unknown;displayName?:unknown}){const identity=await identify(options??{});identity.name=profiles.get(identity);return identity;}
 onJoin(client:Client,options:{classId?:string;analytics?:unknown},auth:Identity){const identity=auth??client.auth as Identity;for(const [session,previous] of this.sessions){if(previous.id===identity.id&&session!==client.sessionId){const old=this.clients.find(c=>c.sessionId===session);this.disconnectPlayer({sessionId:session} as Client);old?.leave(4000);}}const classId=(['Knight','Scout','Spellcaster'].includes(options?.classId ?? '')?options.classId:'Knight') as FighterClass;this.sessions.set(client.sessionId,identity);const row=this.social.join(identity,classId);const player=this.world.join(client.sessionId,classId);player.kills=row.kills;const context=analyticsSink.context(options?.analytics,identity.id);if(context){this.tracking.set(client.sessionId,{context,moved:false,attacked:false,attackSeq:player.attackSeq,health:player.health,round:this.world.round});analyticsSink.emit(context,'world_join',{hero:classId,round:this.world.round,gateOpen:this.world.gateOpen,cleared:this.world.cleared,players:this.humanPlayers()});}this.sync();}
 async onDrop(client:Client){const p=this.world.players.get(client.sessionId),identity=this.sessions.get(client.sessionId);analyticsSink.emit(this.tracking.get(client.sessionId)?.context,'connection_lost');if(p)p.connected=false;if(identity)this.social.leave(identity.id,true);this.sync();try{await this.allowReconnection(client,20);}catch{this.disconnectPlayer(client);await storage.saveAsync(this.snapshot());}this.sync();}
 onReconnect(client:Client){if(!this.sessions.has(client.sessionId)){client.leave(4000);return;}const p=this.world.players.get(client.sessionId),identity=this.sessions.get(client.sessionId);analyticsSink.emit(this.tracking.get(client.sessionId)?.context,'connection_restored');if(p)p.connected=true;if(identity)this.social.reconnect(identity.id);this.sync();}
 async onLeave(client:Client){this.disconnectPlayer(client);await storage.saveAsync(this.snapshot());this.sync();}
 async onDispose(){await storage.saveAsync(this.snapshot());}
 private humanPlayers(){return [...this.world.players.values()].filter(player=>player.connected&&!isTeammate(player.id)).length;}
 private disconnectPlayer(client:Client){const identity=this.sessions.get(client.sessionId),player=this.world.players.get(client.sessionId);analyticsSink.emit(this.tracking.get(client.sessionId)?.context,'world_leave');this.tracking.delete(client.sessionId);if(identity){const row=this.social.roster.get(identity.id);if(row&&player)row.kills=player.kills;this.social.leave(identity.id);}this.world.leave(client.sessionId);this.sessions.delete(client.sessionId);this.lastMessage.delete(client.sessionId);}
 private sync(){const s=this.state,w=this.world;Object.assign(s,{tick:this.tick,worldSeconds:Math.floor(w.time),round:w.round,defeats:w.defeats,leverLeft:w.gate.health[0],leverRight:w.gate.health[1],leverLeftHits:w.gate.hitCount[0],leverRightHits:w.gate.hitCount[1],gateRemaining:w.gate.remaining,coreHealth:w.coreHealth,guardianX:quantize(w.guardian.x,.025),guardianZ:quantize(w.guardian.z,.025),guardianYaw:quantize(w.guardian.yaw,.01),guardianPhase:w.guardian.phase,guardianEmerge:w.guardian.emerge,guardianWindup:w.guardian.windup,guardianAttack:w.guardian.attackCue,guardianGait:w.guardian.gait,guardianMoving:w.guardian.moving,gateOpen:w.gateOpen,cleared:w.cleared,victoryRemaining:Math.max(0,Math.ceil(w.victoryTimer)),night:nightAmount(worldHour(w.time))>.5});
  for(const [id,p] of w.players){const track=this.tracking.get(id);if(track){if(!track.attacked&&p.attackSeq>track.attackSeq){track.attacked=true;analyticsSink.emit(track.context,'first_attack',{round:w.round});}if(p.health<=0&&track.health>0)analyticsSink.emit(track.context,'player_defeated',{round:w.round});if(w.round!==track.round)analyticsSink.emit(track.context,'round_started',{round:w.round});track.attackSeq=p.attackSeq;track.health=p.health;track.round=w.round;}let e=s.players.get(id);if(!e){e=new PlayerState();s.players.set(id,e);}Object.assign(e,{name:this.sessions.get(id)?.name??(isTeammate(id)?teammateName(id):''),x:quantize(p.x,.025),z:quantize(p.z,.025),yaw:quantize(p.yaw,.01),health:p.health,respawnRemaining:p.respawnRemaining,kills:p.kills,wonRound:p.wonRound,classId:p.classId,connected:p.connected,drawProgress:p.scoutDraw.active?p.scoutDraw.progress:-1,attackSeq:p.attackSeq,healCooldown:quantize(p.healCooldown,.05),healSeq:p.healSeq,lastSeq:p.lastSeq});const identity=this.sessions.get(id),row=identity&&this.social.roster.get(identity.id);if(row)row.kills=p.kills;}
  for(const id of s.players.keys())if(!w.players.has(id))s.players.delete(id);
  for(const [id,row] of this.social.roster){let item=s.scores.get(id);if(!item){item=new ScoreState();s.scores.set(id,item);}Object.assign(item,{name:row.name,classId:row.classId,kills:row.kills,connected:row.connected});}for(const id of s.scores.keys())if(!this.social.roster.has(id)&&!(isTeammate(id)&&w.players.has(id)))s.scores.delete(id);
  for(const [id,p] of w.players)if(isTeammate(id)){let item=s.scores.get(id);if(!item){item=new ScoreState();s.scores.set(id,item);}Object.assign(item,{name:teammateName(id),classId:p.classId,kills:p.kills,connected:true});}
  const winners=new Set<string>();for(const row of this.victoryRoster){winners.add(row.id);let item=s.victoryScores.get(row.id);if(!item){item=new ScoreState();s.victoryScores.set(row.id,item);}Object.assign(item,{name:row.name,classId:row.classId,kills:row.kills,connected:row.connected});}for(const id of s.victoryScores.keys())if(!winners.has(id))s.victoryScores.delete(id);
  const events=new Set<string>();for(const event of this.social.activity){const key=String(event.id);events.add(key);let item=s.activity.get(key);if(!item){item=new ActivityState();s.activity.set(key,item);}Object.assign(item,{actorId:event.actorId??'',kind:event.kind,name:event.name,text:event.text,sentAt:event.sentAt});}for(const id of s.activity.keys())if(!events.has(id))s.activity.delete(id);
  w.enemies.forEach((e,i)=>{let target=s.enemies.get(String(i));if(!target){target=new EnemyState();s.enemies.set(String(i),target);}Object.assign(target,{x:quantize(e.x,.05),z:quantize(e.z,.05),yaw:quantize(e.yaw,.01),hp:e.hp,maxHp:e.maxHp,alive:e.alive,type:e.type,moving:e.moving,hitFlash:quantize(e.hitFlash,.05),attackCue:quantize(e.attackCue,.05),attackSeq:e.attackSeq,windup:quantize(e.windup,.05),gait:quantize(e.gait,.02)});});
  const ids=new Set<string>();for(const {id,shot} of w.projectiles){const key=String(id);ids.add(key);let item=s.projectiles.get(key);if(!item){item=new ProjectileState();s.projectiles.set(key,item);}Object.assign(item,{x:quantize(shot.x,.025),z:quantize(shot.z,.025),dx:quantize(shot.dx,.01),dz:quantize(shot.dz,.01),kind:shot.kind});}for(const key of s.projectiles.keys())if(!ids.has(key))s.projectiles.delete(key);
 }
}
