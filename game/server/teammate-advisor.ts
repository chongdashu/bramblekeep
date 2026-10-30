import { isTeammate } from './teammates';
import type { World } from './world';
import { LEVERS } from '../src/gate-mechanism';

/** Optional, observational experiment: Jev never controls the live simulation. */
export class TeammateAdvisor {
 private next=0;
 private pending=false;
 constructor(private readonly key:string,private readonly send:typeof fetch=fetch){}
 step(world:World){
  const humans=[...world.players.values()].filter(p=>!isTeammate(p.id)&&p.connected);
  const bots=[...world.players.values()].filter(p=>isTeammate(p.id));
  if(!this.key||!humans.length||!bots.length||this.pending||world.time<this.next||world.cleared)return;
  this.next=world.time+30;this.pending=true;const started=Date.now();
  const state={round:world.round,observedAtSeconds:Math.floor(world.time),humans:humans.map(p=>({x:Math.round(p.x),z:Math.round(p.z),health:p.health})),teammates:bots.map(p=>({x:Math.round(p.x),z:Math.round(p.z),health:p.health})),enemies:world.enemies.filter(e=>e.alive).map(e=>({x:Math.round(e.x),z:Math.round(e.z),health:e.hp})),gateOpen:world.gateOpen,leverHealth:world.gate.health,coreHealth:world.coreHealth};
  const baseline=world.enemies.some(e=>e.alive&&humans.some(p=>Math.hypot(e.x-p.x,e.z-p.z)<7))?'assist':world.gateOpen&&humans.some(p=>p.z< -20)?'objective':!world.gateOpen&&LEVERS_NEAR(humans)?'objective':'follow';
  void this.send('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{'Authorization':`Bearer ${this.key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(3000),body:JSON.stringify({model:'jev-latest',state,questions:{strategy:{type:'choice',instructions:'Choose how helpful AI teammates should support human players now. Humans lead; do not independently rush objectives. Select unknown when the evidence is insufficient.',criteria:{assist:'Help humans fight nearby enemies.',objective:'Help with an objective when a human is already nearby.',follow:'Stay close and follow the humans.',unknown:'There is not enough evidence to choose.'}}}})})
   .then(async response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);const result=await response.json() as {model?:unknown;answers?:{strategy?:{choice?:unknown;confidence?:unknown}};usage?:unknown};const answer=result.answers?.strategy;if(!['assist','objective','follow','unknown'].includes(String(answer?.choice)))throw new Error('invalid response');console.info('[teammate-advisor]',JSON.stringify({questionVersion:1,state,baseline,choice:answer?.choice,confidence:answer?.confidence,model:result.model,usage:result.usage,latencyMs:Date.now()-started}));})
   .catch(error=>console.warn('[teammate-advisor] unavailable:',error instanceof Error?error.message:'request failed'))
   .finally(()=>{this.pending=false;});
 }
}
function LEVERS_NEAR(humans:{x:number;z:number}[]){return humans.some(p=>LEVERS.some(l=>Math.hypot(p.x-l.x,p.z-l.z)<8));}
