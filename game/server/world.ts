import { HEAL_COOLDOWN, healNearby } from '../src/healing';
import { Guardian, guardianVulnerable, GUARDIAN_REVEAL_HEALTH, GUARDIAN_STRIKE_DAMAGE, GUARDIAN_KNOCKBACK } from '../src/guardian';
import { enemyType } from '../src/enemy-types';
import { moveOnMap, MAP } from '../src/scenes/environment-map';
import { AttackWindow, attackVolume, PROJECTILE_RELEASE, type FighterClass } from '../src/castle-combat';
import { makeProjectile, advanceProjectiles, assistedTarget, type Projectile, type Target } from '../src/castle-projectiles';
import { ENEMY_DEATH_DURATION } from '../src/enemy-motion';
import { CORE_MAX_HP, RESPAWN_SECONDS, PATROL_LIMIT, INITIAL_PATROLS, enemyPopulation, COURTYARD_RESPAWN_SECONDS, PATROL_HOMES, type PatrolEnemy } from '../src/castle-patrol';
import { movementFactor } from '../src/movement';
import { ScoutDraw, SCOUT_MIN_RANGE } from '../src/scout-draw';
import type { Checkpoint } from './storage';
import { PatrolMotion } from '../src/patrol-motion';
import { reinforcementSpawn, availableReinforcement, availableCourtyardReinforcement } from '../src/castle-spawns';
import { GateMechanism, LEVERS } from '../src/gate-mechanism';
import { CAMP_SPAWNS, reserveSpawn, respawnPosition } from './spawn';
import { PLAYER_RESPAWN_DELAY } from '../src/player-death';
import { BOT_DEFEAT_LIMIT, isTeammate } from './teammates';

export type Intent = {x:number; z:number; sprint:boolean; attack:boolean; heal?:boolean};
export type Player = {id:string; classId:FighterClass; spawnSlot:number; x:number; z:number; yaw:number; health:number; kills:number; wonRound:number; connected:boolean; input:Intent; inputSeq:number; lastSeq:number; lastInput:number; swing:AttackWindow; scoutDraw:ScoutDraw; shotRange:number; attackSeq:number; healCooldown:number; healSeq:number; castHealing:boolean; invulnerability:number; respawnRemaining:number};
export type Result = {round:number; id:string; classId:FighterClass; kills:number; won:boolean; finishedAt:string};
export const VICTORY_SECONDS=15;
const homes=PATROL_HOMES;
const idle:Intent={x:0,z:0,sprint:false,attack:false};
/** Server-only shared simulation. Positions, damage, score and round transitions are authoritative. */
export class World {
 players=new Map<string,Player>(); enemies:PatrolEnemy[]=[]; projectiles: {id:number; owner:string; shot:Projectile}[]=[];
 private nextProjectileId=0;
 private patrolMotion=new PatrolMotion();
 private spawnSerial=0;
 private courtyardSerial=0;
 private courtyardClock=0;
 readonly gate=new GateMechanism();
 readonly guardian=new Guardian();
 defeats=0; botDefeats=0; coreHealth=CORE_MAX_HP; round=1; night=false; time=0; spawnClock=0; victoryTimer=0;
 constructor(private readonly record:(result:Result)=>void=()=>{},private readonly event:(kind:'gate'|'kill'|'victory',playerId:string,enemyType?:number)=>void=()=>{}) {this.resetEnemies();}
 snapshot():Checkpoint {return {version:1,round:this.round,night:this.night,time:this.time,enemies:this.enemies.map(e=>({...e})),activeSessions:[...this.players.values()].filter(p=>!isTeammate(p.id)).map(p=>({id:p.id,classId:p.classId,kills:p.kills})),activeBattle:this.gate.damaged||this.defeats>0||this.coreHealth<CORE_MAX_HP||this.cleared||this.enemies.some(e=>e.hp<e.maxHp)};}
 restore(checkpoint:Checkpoint){this.round=checkpoint.round;this.night=checkpoint.night;this.time=checkpoint.time;
  for(const p of checkpoint.activeSessions??[])if(typeof p.id==='string'&&['Knight','Scout','Spellcaster'].includes(p.classId)&&Number.isSafeInteger(p.kills)&&p.kills>=0)this.record({round:this.round,id:p.id,classId:p.classId,kills:p.kills,won:false,finishedAt:new Date().toISOString()});
  // A process restart disconnects everyone; abandon an interrupted battle safely.
  if(checkpoint.activeBattle){this.round++;this.night=!this.night;this.resetEnemies();}
  else if((checkpoint.enemies.length===5 || checkpoint.enemies.length===INITIAL_PATROLS) && checkpoint.enemies.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.z)&&Number.isFinite(e.homeX)&&Number.isFinite(e.homeZ)))this.enemies=checkpoint.enemies.map((e,i)=>({...e,type:i%4,maxHp:[2,3,2,4][i%4],hp:[2,3,2,4][i%4],gait:Number.isFinite(e.gait)?e.gait:0,deathRemaining:0,engaged:false,windup:0,attackCue:0,attackSeq:0}));
 }
 get gateOpen(){return this.gate.open;}
 get cleared(){return this.victoryTimer>0;}
 private spawn(i:number, fromCastle=false,interior?:ReturnType<typeof reinforcementSpawn>){const point=interior??(fromCastle?reinforcementSpawn(i,this.gateOpen,this.spawnSerial):{x:homes[i][0],z:homes[i][1],homeX:homes[i][0],homeZ:homes[i][1]});const type=i%4,maxHp=[2,3,2,4][type],attackSeq=this.enemies[i]?.attackSeq??0;this.enemies[i]={...point,phase:i*1.3,gait:0,alive:true,deathRemaining:0,engaged:false,attackCooldown:0,windup:0,type,hp:maxHp,maxHp,hitFlash:0,attackCue:0,attackSeq,moving:false,yaw:fromCastle&&this.gateOpen?0:Math.PI};}
 private resetEnemies(){this.enemies=[];for(let i=0;i<INITIAL_PATROLS;i++)this.spawn(i);}
 join(id:string,classId:FighterClass){const spawnSlot=reserveSpawn([...this.players.values()]);const point=CAMP_SPAWNS[spawnSlot];const p:Player={id,classId,spawnSlot,x:point.x,z:point.z,yaw:Math.PI,health:6,kills:0,wonRound:0,connected:true,input:{...idle},inputSeq:-1,lastSeq:-1,lastInput:this.time,swing:new AttackWindow(),scoutDraw:new ScoutDraw(),shotRange:SCOUT_MIN_RANGE,attackSeq:0,healCooldown:0,healSeq:0,castHealing:false,invulnerability:0,respawnRemaining:0};this.players.set(id,p);return p;}
 private respawnPlayer(player:Player){player.scoutDraw.cancel();const others=[...this.players.values()].filter(p=>p!==player);const point=respawnPosition(player.spawnSlot,others);player.x=point.x;player.z=point.z;}
 private tickRespawn(p:Player,dt:number){if(p.respawnRemaining<=0)return;p.respawnRemaining=Math.max(0,p.respawnRemaining-dt);p.input={...idle};if(p.respawnRemaining===0){p.health=6;this.respawnPlayer(p);p.invulnerability=2;}}

 leave(id:string){const p=this.players.get(id);if(p){if(!this.cleared&&!isTeammate(id))this.record({round:this.round,id:p.id,classId:p.classId,kills:p.kills,won:false,finishedAt:new Date().toISOString()});this.players.delete(id);}}
 setInput(id:string,value:unknown){const p=this.players.get(id);if(!p||!value||typeof value!=='object')return;const v=value as Partial<Intent> & {seq?:unknown};if(typeof v.x!=='number'||!Number.isFinite(v.x)||typeof v.z!=='number'||!Number.isFinite(v.z)||typeof v.attack!=='boolean'||typeof v.sprint!=='boolean')return;if(v.seq!==undefined && (typeof v.seq!=='number'||!Number.isSafeInteger(v.seq)||v.seq<0||v.seq<=p.inputSeq))return;if(typeof v.seq==='number')p.inputSeq=v.seq;const length=Math.max(1,Math.hypot(v.x,v.z));p.input={x:v.x/length,z:v.z/length,sprint:v.sprint,attack:v.attack,heal:p.classId==='Spellcaster' && v.heal===true};p.lastInput=this.time;}
 targets():Target[]{const a=this.enemies.flatMap((e,i)=>e.alive?[{id:`enemy-${i}`,x:e.x,z:e.z,radius:enemyType(e.type).radius}]:[]);if(!this.cleared){a.push(...LEVERS.map(l=>({...l})));a.push({id:'core',x:this.guardian.x,z:this.guardian.z,radius:.8});}return a;}
 private damage(id:string,p:Player){if(id.startsWith('lever-')){const i=LEVERS.findIndex(l=>l.id===id);if(i>=0&&!this.cleared && this.gate.hit(i)){this.event('gate',p.id);for(const player of this.players.values())player.invulnerability=Math.max(player.invulnerability,2.5);}return;}if(id==='core'){const humanNearby=[...this.players.values()].some(hero=>!isTeammate(hero.id)&&hero.connected&&hero.respawnRemaining<=0&&Math.hypot(hero.x-this.guardian.x,hero.z-this.guardian.z)<9);if(this.cleared || !guardianVulnerable(this.guardian.phase,this.guardian.windup) || (isTeammate(p.id)&&(!humanNearby||this.coreHealth<=CORE_MAX_HP/2)))return;this.coreHealth--;if(this.coreHealth===GUARDIAN_REVEAL_HEALTH && this.guardian.phase===0)this.guardian.step(0,this.coreHealth,[],this.gateOpen,false);if(this.coreHealth<=0){this.event('victory',p.id);this.win();}return;}const e=this.enemies[Number(id.slice(6))];if(!e?.alive)return;if(isTeammate(p.id)&&this.botDefeats>=BOT_DEFEAT_LIMIT&&e.hp<=1)return;e.hp--;e.hitFlash=.22;e.engaged=true;if(e.hp<=0){e.alive=false;e.deathRemaining=ENEMY_DEATH_DURATION+.25;this.defeats++;if(isTeammate(p.id))this.botDefeats++;p.kills++;this.event('kill',p.id,e.type);}}
 private win(){this.victoryTimer=VICTORY_SECONDS;for(const p of this.players.values()){p.wonRound=this.round;if(!isTeammate(p.id))this.record({round:this.round,id:p.id,classId:p.classId,kills:p.kills,won:true,finishedAt:new Date().toISOString()});}}
 private resetRound(){this.guardian.reset();this.spawnSerial=0;this.courtyardSerial=0;this.courtyardClock=0;this.gate.reset();this.round++;this.defeats=0;this.botDefeats=0;this.coreHealth=CORE_MAX_HP;this.victoryTimer=0;this.spawnClock=0;this.night=!this.night;this.projectiles=[];this.resetEnemies();for(const p of this.players.values()){const point=CAMP_SPAWNS[p.spawnSlot];p.x=point.x;p.z=point.z;p.health=6;p.kills=0;p.swing=new AttackWindow();p.scoutDraw.cancel();p.shotRange=SCOUT_MIN_RANGE;p.healCooldown=0;p.castHealing=false;p.input={...idle};p.invulnerability=2;p.respawnRemaining=0;}}
 step(dt:number){dt=Math.max(0,Math.min(.1,dt));this.time+=dt;for(const p of this.players.values())this.tickRespawn(p,dt);if(this.cleared){this.victoryTimer-=dt;if(this.victoryTimer<=0)this.resetRound();return;}
  const humans=[...this.players.values()].filter(p=>p.connected&&!isTeammate(p.id)).length,population=enemyPopulation(humans);
  this.gate.step(dt);this.spawnClock+=dt;if(this.spawnClock>=RESPAWN_SECONDS){const i=homes.findIndex((_,index)=>index<population.patrol && (!this.enemies[index] || (!this.enemies[index].alive && this.enemies[index].deathRemaining<=0)));if(i>=0){const source=availableReinforcement(i,this.gateOpen,this.spawnSerial,[...this.players.values()].filter(p=>p.connected&&p.respawnRemaining<=0),this.enemies.filter(e=>e?.alive));if(source){this.spawnClock=0;this.spawnSerial=source.serial;this.spawn(i,true);this.spawnSerial++;}}}
  if(this.gateOpen || [...this.players.values()].some(p=>p.connected && p.respawnRemaining<=0 && p.z < -20.2)){
   this.courtyardClock=Math.max(0,this.courtyardClock-dt);
   const slot=Array.from({length:population.courtyard},(_,j)=>PATROL_LIMIT+j).find(i=>!this.enemies[i] || (!this.enemies[i].alive && this.enemies[i].deathRemaining<=0));
   if(slot!==undefined && this.courtyardClock===0){
    const source=availableCourtyardReinforcement(this.courtyardSerial,[...this.players.values()].filter(p=>p.connected&&p.respawnRemaining<=0),this.enemies.filter(e=>e?.alive));
    if(source){while(this.enemies.length<PATROL_LIMIT)this.enemies.push({...this.enemies[0],alive:false,hp:0,deathRemaining:0});this.spawn(slot,true,source.point);this.courtyardSerial=source.serial+1;this.courtyardClock=COURTYARD_RESPAWN_SECONDS;}
   }
  }
  for(const p of this.players.values()){
   p.lastSeq=p.inputSeq;
   if(p.respawnRemaining>0)continue;
   p.invulnerability=Math.max(0,p.invulnerability-dt);p.healCooldown=Math.max(0,p.healCooldown-dt);const stale=!p.connected||this.time-p.lastInput>.5;if(stale){p.input={...idle};p.scoutDraw.cancel();}const {x,z,sprint,attack}=p.input;
   if(Math.hypot(x,z)>.05){
    const speed=dt*MAP.speed*movementFactor(sprint);
    const candidates=isTeammate(p.id)?[[x,z],[(x-z)*.707,(x+z)*.707],[(x+z)*.707,(z-x)*.707]]:[[x,z]];
    for(const [dx,dz] of candidates){const [nx,nz]=moveOnMap(p.x,p.z,dx*speed,dz*speed,this.gateOpen);
     if(isTeammate(p.id)&&[...this.players.values()].some(other=>other!==p&&other.connected&&other.respawnRemaining<=0&&Math.hypot(nx-other.x,nz-other.z)<.9&&Math.hypot(nx-other.x,nz-other.z)<Math.hypot(p.x-other.x,p.z-other.z)-.001))continue;
     if(isTeammate(p.id)&&Math.hypot(nx-p.x,nz-p.z)>.001){const desired=Math.atan2(nx-p.x,nz-p.z),delta=Math.atan2(Math.sin(desired-p.yaw),Math.cos(desired-p.yaw));p.yaw+=delta*(1-Math.exp(-9*dt));}
     p.x=nx;p.z=nz;break;
    }
    if(!isTeammate(p.id))p.yaw=Math.atan2(x,z);
   }
   const release=p.classId==='Scout'&&!stale?p.scoutDraw.step(attack,dt,p.swing.ready):null;
   const healing=p.classId==='Spellcaster' && p.input.heal===true;
   const start=p.classId==='Scout'?release!==null:attack&&p.swing.ready&&(!healing || p.healCooldown<=0);
   if(start){
    if(release!==null)p.shotRange=release;
    p.castHealing=healing;
    const targets=this.targets();
    const target=isTeammate(p.id)?targets.filter(t=>Math.hypot(t.x-p.x,t.z-p.z)<=(p.classId==='Knight'?2.1:5.5)).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]:p.classId==='Knight'?targets.filter(t=>Math.hypot(t.x-p.x,t.z-p.z)<=2.1).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]:p.classId==='Scout'?assistedTarget(p.x,p.z,p.yaw,targets,this.gateOpen,p.shotRange):undefined;
    if(target)p.yaw=Math.atan2(target.x-p.x,target.z-p.z);
    p.swing.start(p.classId);p.attackSeq++;
   }p.swing.advance(dt);
   if(p.classId==='Knight'){const v=attackVolume(p.x,p.z,p.yaw,p.classId);for(const t of this.targets())if(p.swing.take(t.id,v,t.x,t.z,t.radius))this.damage(t.id,p);}
   else if(!p.swing.released&&p.swing.age>=PROJECTILE_RELEASE&&p.swing.age<1){p.swing.released=true;if(p.classId==='Spellcaster'&&p.castHealing){healNearby(p,this.players.values(),this.gateOpen);p.healCooldown=HEAL_COOLDOWN;p.healSeq++;}else this.projectiles.push({id:++this.nextProjectileId,owner:p.id,shot:makeProjectile(p.classId==='Scout'?'arrow':'orb',p.x,p.z,p.yaw,this.targets(),this.gateOpen,p.shotRange)});}
  }
  for(const item of this.projectiles){const shots=[item.shot];for(const impact of advanceProjectiles(shots,dt,this.targets(),this.gateOpen)){const owner=this.players.get(item.owner);if(owner&&!impact.blocked){const hit=impact.projectile.kind==='arrow'?this.targets().filter(t=>t.id===impact.target):this.targets().filter(t=>Math.hypot(t.x-impact.x,t.z-impact.z)<=1.65+t.radius);for(const t of hit)this.damage(t.id,owner);}item.shot.distance=Infinity;}}
  this.projectiles=this.projectiles.filter(p=>Number.isFinite(p.shot.distance));
  const guardianHits=this.guardian.step(dt,this.coreHealth,[...this.players.values()].filter(p=>p.connected&&p.respawnRemaining<=0).map(p=>({id:p.id,x:p.x,z:p.z})),this.gateOpen,this.cleared);
  for(const id of guardianHits){const victim=this.players.get(id);if(victim&&!victim.invulnerability){victim.health=Math.max(0,victim.health-GUARDIAN_STRIKE_DAMAGE);const dx=victim.x-this.guardian.x,dz=victim.z-this.guardian.z,d=Math.hypot(dx,dz);const fx=d>.01?dx/d:Math.sin(this.guardian.yaw),fz=d>.01?dz/d:Math.cos(this.guardian.yaw);[victim.x,victim.z]=moveOnMap(victim.x,victim.z,fx*GUARDIAN_KNOCKBACK,fz*GUARDIAN_KNOCKBACK,this.gateOpen);victim.invulnerability=.8;if(victim.health<=0){victim.respawnRemaining=PLAYER_RESPAWN_DELAY;victim.input={...idle};victim.scoutDraw.cancel();victim.swing=new AttackWindow();}}}
  for(const e of this.enemies){
   if(!e.alive){e.deathRemaining=Math.max(0,e.deathRemaining-dt);continue;}
   e.attackCooldown=Math.max(0,e.attackCooldown-dt);e.hitFlash=Math.max(0,e.hitFlash-dt);e.attackCue=Math.max(0,e.attackCue-dt);
   const player=[...this.players.values()].filter(p=>p.connected&&p.respawnRemaining<=0&&Math.hypot(p.x-e.homeX,p.z-e.homeZ)<8).sort((a,b)=>Math.hypot(a.x-e.x,a.z-e.z)-Math.hypot(b.x-e.x,b.z-e.z))[0];
   const distance=player?Math.hypot(player.x-e.x,player.z-e.z):Infinity;
   if(e.windup>0){
    e.windup=Math.max(0,e.windup-dt);e.moving=false;if(player)this.patrolMotion.face(e,player.x,player.z,dt);
    if(e.windup===0){e.attackCue=.45;e.attackSeq++;e.attackCooldown=1.25+e.type*.25;
     if(player&&distance<1.2&&!player.invulnerability){player.health--;player.invulnerability=.8;
      if(player.health<=0){player.health=0;player.respawnRemaining=PLAYER_RESPAWN_DELAY;player.input={...idle};player.scoutDraw.cancel();player.swing=new AttackWindow();}
     }
    }
    continue;
   }
   if(distance<3.3)e.engaged=true;
   if(!player)e.engaged=false;
   const engaged=!!player&&e.engaged;
   this.patrolMotion.step(e,dt,this.gateOpen,engaged&&player?{x:player.x,z:player.z}:null);
   if(engaged&&player&&distance<1.05&&!e.attackCooldown){e.windup=.5;e.moving=false;}

  }
 }
}
