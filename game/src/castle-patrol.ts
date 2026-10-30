import { PatrolMotion } from './patrol-motion';
import { Guardian, guardianVulnerable, GUARDIAN_REVEAL_HEALTH, GUARDIAN_STRIKE_DAMAGE } from './guardian';
import { PLAYER_RESPAWN_DELAY } from './player-death';
import { enemyType } from './enemy-types';
import { PATROL_HOMES, reinforcementSpawn, availableReinforcement, availableCourtyardReinforcement } from './castle-spawns';
export { PATROL_HOMES } from './castle-spawns';
import { ENEMY_DEATH_DURATION } from './enemy-motion';
import { AttackWindow, attackVolume, type FighterClass } from './castle-combat';
import type { Impact, Target } from './castle-projectiles';
import { GateMechanism, LEVERS } from './gate-mechanism';
export type PatrolEnemy = { x:number; z:number; homeX:number; homeZ:number; phase:number; gait:number; alive:boolean; deathRemaining:number; engaged:boolean; attackCooldown:number; windup:number; type:number; hp:number; maxHp:number; hitFlash:number; attackCue:number; attackSeq:number; moving:boolean; yaw:number };
export const INITIAL_PATROLS=8;
export const PATROL_LIMIT=10;
export const COURTYARD_LIMIT=6;
/** Count connected human players, not automatic companions, when sizing pressure. */
export function enemyPopulation(humans:number){const n=Math.max(0,Math.floor(humans));return {patrol:Math.min(PATROL_LIMIT,INITIAL_PATROLS+Math.floor(Math.max(0,n-1)/2)),courtyard:Math.min(COURTYARD_LIMIT,4+(n>=4?2:0))};}
export const ENEMY_MODEL_LIMIT=PATROL_LIMIT+COURTYARD_LIMIT;
export const COURTYARD_RESPAWN_SECONDS=3;
export const RESPAWN_SECONDS=9;
export const BREACH_DEFEATS=5;
// The heart tree takes 6 hits before its guardian wakes (GUARDIAN_REVEAL_HEALTH); the guardian itself has the rest.
export const CORE_X=0, CORE_Z=-26, CORE_MAX_HP=30;
// The side patrols guard the two flank routes after the river. Shared with the server.
const homes=PATROL_HOMES;
export class CastlePatrol {
  readonly gate=new GateMechanism();
  readonly guardian=new Guardian();
  private patrolMotion=new PatrolMotion();
  private spawnSerial=0;
  private courtyardSerial=0;
  private courtyardClock=0;
  enemies:PatrolEnemy[]=[];health=6;respawnRemaining=0;invulnerability=0;spawnClock=0;defeats=0;time=0;coreHealth=CORE_MAX_HP;cleared=false;
  constructor(){this.reset();}
  get gateOpen(){return this.gate.open;}
  get alive(){return this.enemies.filter(e=>e.alive).length;}
  reset(){this.guardian.reset();this.spawnSerial=0;this.courtyardSerial=0;this.courtyardClock=0;this.gate.reset();this.enemies=[];this.health=6;this.respawnRemaining=0;this.invulnerability=0;this.spawnClock=0;this.defeats=0;this.time=0;this.coreHealth=CORE_MAX_HP;this.cleared=false;for(let i=0;i<INITIAL_PATROLS;i++)this.spawn(i);}
  private spawn(i:number,fromCastle=false,interior?:ReturnType<typeof reinforcementSpawn>){const point=interior??(fromCastle?reinforcementSpawn(i,this.gateOpen,this.spawnSerial):{x:homes[i][0],z:homes[i][1],homeX:homes[i][0],homeZ:homes[i][1]});const type=i%4,maxHp=[2,3,2,4][type],attackSeq=this.enemies[i]?.attackSeq??0;this.enemies[i]={...point,phase:i*1.3,gait:0,alive:true,deathRemaining:0,engaged:false,attackCooldown:0,windup:0,type,hp:maxHp,maxHp,hitFlash:0,attackCue:0,attackSeq,moving:false,yaw:fromCastle&&this.gateOpen?0:Math.PI};}
  targets():Target[] {
    const targets=this.enemies.flatMap((e,i)=>e.alive?[{id:`enemy-${i}`,x:e.x,z:e.z,radius:enemyType(e.type).radius}]:[]);
    if(!this.cleared){targets.push(...LEVERS.map(l=>({...l})));targets.push({id:'core',x:this.guardian.x,z:this.guardian.z,radius:.8});}
    return targets;
  }
  private damage(id:string):boolean {
    if(id.startsWith('lever-')){const i=LEVERS.findIndex(l=>l.id===id);if(i<0 || this.cleared)return false;if(this.gate.hit(i))this.invulnerability=Math.max(this.invulnerability,2.5);return true;}
    if(id==='core') { if(this.cleared || !guardianVulnerable(this.guardian.phase,this.guardian.windup))return false;this.coreHealth--;if(this.coreHealth===GUARDIAN_REVEAL_HEALTH && this.guardian.phase===0)this.guardian.step(0,this.coreHealth,[],this.gateOpen,false);if(this.coreHealth<=0)this.cleared=true;return true; }
    const index=Number(id.slice(6)),e=this.enemies[index];if(!e?.alive)return false;
    e.hp--;e.hitFlash=.22;e.engaged=true;if(e.hp<=0){e.alive=false;e.deathRemaining=ENEMY_DEATH_DURATION+.25;this.defeats++;}return true;
  }
  hit(window:AttackWindow,x:number,z:number,yaw:number,kind:FighterClass):{ hits:number; coreHit:boolean; breached:boolean; cleared:boolean } {
    const volume=attackVolume(x,z,yaw,kind);let hits=0,coreHit=false;const wasOpen=this.gateOpen;
    if(kind==='Knight') for(const t of this.targets()) if(window.take(t.id,volume,t.x,t.z,t.radius) && this.damage(t.id)){if(t.id==='core')coreHit=true;else hits++;}
    return {hits,coreHit,breached:!wasOpen && this.gateOpen,cleared:coreHit && this.cleared};
  }
  impact(impact:Impact):{ hits:number; coreHit:boolean; breached:boolean; cleared:boolean } {
    const wasOpen=this.gateOpen;let hits=0,coreHit=false;
    const targets=impact.blocked ? [] : impact.projectile.kind==='arrow' ? this.targets().filter(t=>t.id===impact.target) : this.targets().filter(t=>Math.hypot(t.x-impact.x,t.z-impact.z)<=1.65+t.radius);
    for(const t of targets)if(this.damage(t.id)){if(t.id==='core')coreHit=true;else hits++;}
    return {hits,coreHit,breached:!wasOpen && this.gateOpen,cleared:coreHit && this.cleared};
  }
  step(dt:number,px:number,pz:number):boolean {
    dt=Math.max(0,Math.min(dt,.1));this.time+=dt;this.invulnerability=Math.max(0,this.invulnerability-dt);
    if(!this.cleared){this.spawnClock+=dt;this.gate.step(dt);}
    if(this.spawnClock>=RESPAWN_SECONDS){const i=homes.findIndex((_,index)=>index<enemyPopulation(1).patrol && (!this.enemies[index] || (!this.enemies[index].alive && this.enemies[index].deathRemaining<=0)));if(i>=0){const source=availableReinforcement(i,this.gateOpen,this.spawnSerial,[{x:px,z:pz}],this.enemies.filter(e=>e?.alive));if(source){this.spawnClock=0;this.spawnSerial=source.serial;this.spawn(i,true);this.spawnSerial++;}}}
    if(!this.cleared && (this.gateOpen || pz < -20.2)){
      this.courtyardClock=Math.max(0,this.courtyardClock-dt);
      const slot=Array.from({length:enemyPopulation(1).courtyard},(_,j)=>PATROL_LIMIT+j).find(i=>!this.enemies[i] || (!this.enemies[i].alive && this.enemies[i].deathRemaining<=0));
      if(slot!==undefined && this.courtyardClock===0){
        const source=availableCourtyardReinforcement(this.courtyardSerial,[{x:px,z:pz}],this.enemies.filter(e=>e?.alive));
        if(source){while(this.enemies.length<PATROL_LIMIT)this.enemies.push({...this.enemies[0],alive:false,hp:0,deathRemaining:0});this.spawn(slot,true,source.point);this.courtyardSerial=source.serial+1;this.courtyardClock=COURTYARD_RESPAWN_SECONDS;}
      }
    }
    let respawn=false;
    if(this.respawnRemaining>0){this.respawnRemaining=Math.max(0,this.respawnRemaining-dt);if(this.respawnRemaining===0){this.health=6;this.invulnerability=2;respawn=true;}}
    const guardianHits=this.guardian.step(dt,this.coreHealth,this.health>0?[{id:'player',x:px,z:pz}]:[],this.gateOpen,this.cleared);
    if(guardianHits.includes('player') && this.invulnerability===0){this.health=Math.max(0,this.health-GUARDIAN_STRIKE_DAMAGE);this.invulnerability=.8;if(this.health<=0)this.respawnRemaining=PLAYER_RESPAWN_DELAY;}
    for(const e of this.enemies){
      if(!e.alive){e.deathRemaining=Math.max(0,e.deathRemaining-dt);continue;}
      e.attackCooldown=Math.max(0,e.attackCooldown-dt);e.hitFlash=Math.max(0,e.hitFlash-dt);e.attackCue=Math.max(0,e.attackCue-dt);
      const distance=this.health>0?Math.hypot(px-e.x,pz-e.z):Infinity;
      if(e.windup>0){
        e.windup=Math.max(0,e.windup-dt);e.moving=false;this.patrolMotion.face(e,px,pz,dt);
        if(e.windup===0){
          e.attackCue=.45;e.attackSeq++;e.attackCooldown=1.25+e.type*.25;
          if(!this.cleared && distance<1.2 && this.invulnerability===0){
            this.health--;this.invulnerability=.8;
            if(this.health<=0){this.health=0;this.respawnRemaining=PLAYER_RESPAWN_DELAY;}
          }
        }
        continue;
      }
      if(distance<3.3)e.engaged=true;
      if(e.engaged && Math.hypot(px-e.homeX,pz-e.homeZ)>8)e.engaged=false;
      this.patrolMotion.step(e,dt,this.gateOpen,e.engaged?{x:px,z:pz}:null);
      if(!this.cleared && e.engaged && distance<1.05 && e.attackCooldown===0){e.windup=.5;e.moving=false;}

    }
    return respawn;
  }
}
