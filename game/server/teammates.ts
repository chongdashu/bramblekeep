import { canStand } from '../src/scenes/environment-map';
import { LEVERS } from '../src/gate-mechanism';
import type { World } from './world';
import type { FighterClass } from '../src/castle-combat';
import { CAMP_SPAWNS } from './spawn';

const PREFIX='ai-teammate:';
export const isTeammate=(id:string)=>id.startsWith(PREFIX);
export const DEFAULT_TEAM_SIZE=10;
export const BOT_DEFEAT_LIMIT=2;
const names=['Pip','moss','Bramble','clover_7','Hazel','bram','fern_wisp','Rowan','tansy','Juniper','willow','thistle_8','ASH','poppy','WREN','basil','oakheart','Sage','maple','ivy_rose','nettle','Holly','birch','lark_3'];
export function teammateName(id:string):string {
 const index=Number(id.slice(PREFIX.length));return names[Number.isSafeInteger(index)&&index>=0?index%names.length:0];
}
const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
type Point={x:number;z:number};
const gridCache=new Map<string,boolean>();
const edgeCache=new Map<string,boolean>();
function gridStand(x:number,z:number,open:boolean):boolean {
 const key=`${open?1:0}:${x},${z}`;let result=gridCache.get(key);
 if(result===undefined){result=canStand(x,z,open);gridCache.set(key,result);}return result;
}
function gridEdge(a:Point,b:Point,open:boolean):boolean {
 const forward=`${a.x},${a.z}`,back=`${b.x},${b.z}`,key=`${open?1:0}:${forward<back?forward+'|'+back:back+'|'+forward}`;
 let result=edgeCache.get(key);if(result===undefined){result=clearSegment(a,b,open);edgeCache.set(key,result);}return result;
}

/** Test the whole segment: a walkable grid endpoint can still be behind a thin obstacle. */
function clearSegment(a:Point,b:Point,open:boolean):boolean {
 const steps=Math.max(1,Math.ceil(distance(a,b)/.15));
 for(let i=1;i<=steps;i++){const t=i/steps;if(!canStand(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,open))return false;}
 return true;
}

/** Build a route on the collision map, keeping the full route until it needs replanning. */
function findPath(start:Point,goal:Point,open:boolean):Point[] {
 const key=(p:Point)=>`${p.x},${p.z}`;
 const candidates=(p:Point):Point[]=>{
  const result:Point[]=[];const x=Math.round(p.x),z=Math.round(p.z);
  for(let dx=-4;dx<=4;dx++)for(let dz=-4;dz<=4;dz++){const point={x:x+dx,z:z+dz};if(gridStand(point.x,point.z,open))result.push(point);}
  return result.sort((a,b)=>distance(a,p)-distance(b,p));
 };
 const s=candidates(start).find(p=>clearSegment(start,p,open));
 const g=candidates(goal)[0];
 if(!s||!g)return [];
 type Node=Point & {cost:number;score:number};
 const queue:Node[]=[];
 const push=(node:Node)=>{queue.push(node);let i=queue.length-1;while(i>0){const parent=Math.floor((i-1)/2);if(queue[parent].score<=node.score)break;queue[i]=queue[parent];i=parent;}queue[i]=node;};
 const pop=()=>{const first=queue[0],last=queue.pop()!;if(queue.length){let i=0;while(true){let child=i*2+1;if(child>=queue.length)break;if(child+1<queue.length&&queue[child+1].score<queue[child].score)child++;if(queue[child].score>=last.score)break;queue[i]=queue[child];i=child;}queue[i]=last;}return first;};
 const sk=key(s),gk=key(g);push({...s,cost:0,score:distance(s,g)});
 const costs=new Map([[sk,0]]),parent=new Map<string,string>();let visited=0;
 while(queue.length&&visited++<5000){
  const p=pop(),pk=key(p);
  if(p.cost>(costs.get(pk)??Infinity))continue;
  if(pk===gk){
   const result:Point[]=[];let k=pk;
   while(k!==sk){const [x,z]=k.split(',').map(Number);result.push({x,z});k=parent.get(k)!;}
   result.push(s);result.reverse();
   if(canStand(goal.x,goal.z,open)&&clearSegment(g,goal,open))result.push(goal);
   return result;
  }
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const n={x:p.x+dx,z:p.z+dz};if(!gridStand(n.x,n.z,open)||!gridStand(p.x+dx,p.z,open)||!gridStand(p.x,p.z+dz,open)||!gridEdge(p,n,open))continue;
   const nk=key(n),cost=p.cost+Math.hypot(dx,dz);if(cost>=(costs.get(nk)??Infinity))continue;
   costs.set(nk,cost);parent.set(nk,pk);push({...n,cost,score:cost+distance(n,g)});
  }
 }
 return [];
}

/** Keeps a small party around the humans and assigns nearby threats and objectives. */
export class TeammateDirector {
 private paths=new Map<string,{until:number;goal:Point;points:Point[];open:boolean;checkAt:number;checkPos:Point}>();
 private steering=new Map<string,{x:number;z:number}>();
 private campWander=new Map<string,{target:Point;next:number;sequence:number}>();
 private lastStepTime:number|null=null;
 private manual=new Set<string>();
 constructor(private world:World,readonly partySize=DEFAULT_TEAM_SIZE){}
 private add():boolean {
  if(this.world.players.size>=24)return false;
  let i=0;while(this.world.players.has(PREFIX+i))i++;
  const classes:FighterClass[]=['Knight','Scout','Spellcaster'];
  const classId=classes.reduce((best,choice)=>[...this.world.players.values()].filter(p=>p.classId===choice).length<[...this.world.players.values()].filter(p=>p.classId===best).length?choice:best);
  this.world.join(PREFIX+i,classId);return true;
 }
 addDebugPlayer():boolean {
  if(![...this.world.players.values()].some(p=>!isTeammate(p.id)&&p.connected))return false;
  const before=new Set(this.world.players.keys());if(!this.add())return false;
  const id=[...this.world.players.keys()].find(key=>!before.has(key));if(id)this.manual.add(id);return true;
 }
 reconcile(){
  const humans=[...this.world.players.values()].filter(p=>!isTeammate(p.id));
  const bots=[...this.world.players.values()].filter(p=>isTeammate(p.id));
  // Disconnected humans retain their seats during the server's reconnect window.
  // Keep the world populated even when nobody is connected; reserved human
  // seats still count so reconnecting players retain their place.
  const wanted=Math.max(0,this.partySize-humans.length);
  for(const id of this.manual)if(!this.world.players.has(id))this.manual.delete(id);
  const extra=humans.some(p=>p.connected)?this.manual.size:0;
  const target=Math.min(Math.max(0,24-humans.length),wanted+extra);
  while(bots.length>target){const index=bots.findIndex(p=>!this.manual.has(p.id));const bot=bots.splice(index<0?bots.length-1:index,1)[0];this.world.leave(bot.id);this.paths.delete(bot.id);this.steering.delete(bot.id);this.campWander.delete(bot.id);this.manual.delete(bot.id);}
  while(bots.length<target){if(!this.add())break;bots.splice(0,bots.length,...[...this.world.players.values()].filter(p=>isTeammate(p.id)));}
 }
 step(){
  this.reconcile();const players=[...this.world.players.values()];
  const humans=players.filter(p=>!isTeammate(p.id)&&p.connected&&p.respawnRemaining<=0);
  const teammates=players.filter(p=>isTeammate(p.id));
  const elapsed=this.lastStepTime===null?.05:Math.max(0,Math.min(.1,this.world.time-this.lastStepTime));this.lastStepTime=this.world.time;
  // Stable slots keep a small assault group while the others support them.
  const assault=teammates.filter(bot=>Number(bot.id.slice(PREFIX.length))%3===0);
  // Spread path searches across ticks when a large party changes direction.
  let searches=0;
  for(const [index,bot] of teammates.entries()){
   const human=humans.slice().sort((a,b)=>distance(a,bot)-distance(b,bot))[0];
   if(bot.respawnRemaining>0||this.world.cleared){this.steering.delete(bot.id);this.campWander.delete(bot.id);this.world.setInput(bot.id,{x:0,z:0,sprint:false,attack:false});continue;}
   const attacking=assault.includes(bot)||!assault.some(p=>p.respawnRemaining<=0);
   const leader=assault.filter(p=>p!==bot&&p.respawnRemaining<=0).sort((a,b)=>distance(a,bot)-distance(b,bot))[0];
   const threats=this.world.enemies.filter(e=>e.alive&&(this.world.botDefeats<BOT_DEFEAT_LIMIT||e.hp>1)&&distance(e,bot)<5.5).sort((a,b)=>distance(a,bot)-distance(b,bot));
   // Give each companion its own position, instead of steering both to the same point.
   const side=index%2===0?-1:1;
   const angle=index*2.399963229728653;
   const offset=teammates.length<=2?{x:side*1.8,z:1.4}:{x:Math.sin(angle)*2.7,z:Math.cos(angle)*2.7};
   const ally=human&&distance(human,bot)<7?human:leader??human;
   let target:Point=ally?{x:ally.x+offset.x,z:ally.z+offset.z}:{x:bot.x,z:bot.z},attack=false,stop=.8;
   let objective:Point|undefined;
   if(threats.length)objective=threats[0];
   else if(attacking){
    if(this.world.gateOpen&&this.world.coreHealth>2)objective=this.world.guardian;
    else {const active=LEVERS.filter((_,i)=>this.world.gate.health[i]>0);const preferred=Number(bot.id.slice(PREFIX.length))%2;objective=active.find(l=>l.id===LEVERS[preferred].id)??active[0];}
   }
   if(objective){const ranged=bot.classId!=='Knight',range=ranged?5:2;attack=distance(bot,objective)<range;const radius=ranged?3.3:1.55;target=teammates.length<=2?{x:objective.x+side*(ranged?2.5:1.15),z:objective.z+(ranged?2.2:1.05)}:{x:objective.x+Math.sin(angle)*radius,z:objective.z+Math.cos(angle)*radius};stop=.35;}
   // When waiting near camp, walk between nearby clear points rather than
   // standing on the formation slot. Departing allies and combat take priority.
   const canWander=!objective&&bot.z>16&&(!ally||(ally.z>14&&distance(bot,ally)<4.5));
   let wander=this.campWander.get(bot.id);
   if(canWander&&(!!wander||distance(bot,target)<1.2)){
    if(!wander||this.world.time>=wander.next||distance(bot,wander.target)<.55){
     const choices=CAMP_SPAWNS.filter(point=>point.z>16&&distance(point,bot)>1.3&&distance(point,bot)<4&&(!ally||distance(point,ally)<5));
     if(choices.length){const sequence=(wander?.sequence??index)+1;wander={target:choices[sequence%choices.length],next:this.world.time+6,sequence};this.campWander.set(bot.id,wander);}
    }
    if(wander){target=wander.target;stop=.35;}
   }else if(wander){this.campWander.delete(bot.id);}
   const d=distance(bot,target);let x=0,z=0;
   if(d>stop){
    let path=this.paths.get(bot.id);
    const stuck=!!path&&this.world.time>=path.checkAt&&distance(bot,path.checkPos)<.35;
    const needsPath=!path||this.world.time>=path.until||distance(path.goal,target)>2||path.open!==this.world.gateOpen||stuck;
    if(needsPath&&searches<1){
     searches++;path={until:this.world.time+3,goal:{...target},points:findPath(bot,target,this.world.gateOpen),open:this.world.gateOpen,checkAt:this.world.time+1.5,checkPos:{x:bot.x,z:bot.z}};this.paths.set(bot.id,path);
    }else if(path&&!needsPath&&this.world.time>=path.checkAt){path.checkAt=this.world.time+1.5;path.checkPos={x:bot.x,z:bot.z};}
    if(path){while(path.points.length&&distance(bot,path.points[0])<.24)path.points.shift();
    // Skip intermediate points only when the actual route between them is walkable.
    while(path.points.length>1&&clearSegment(bot,path.points[1],this.world.gateOpen))path.points.shift();
    const waypoint=path.points[0];if(waypoint){const dx=waypoint.x-bot.x,dz=waypoint.z-bot.z,len=Math.hypot(dx,dz);if(len>.01){x=dx/len;z=dz/len;}}}
   }
   // Yield to nearby heroes, even while idle. A stable side breaks exact overlaps.
   for(const other of players){if(other===bot||!other.connected||other.respawnRemaining>0)continue;const dx=bot.x-other.x,dz=bot.z-other.z,space=Math.hypot(dx,dz);if(space>=1.3)continue;const strength=(1.3-space)/1.3*2.4;x+=(space>.01?dx/space:side)*strength;z+=(space>.01?dz/space:0)*strength;}
   const length=Math.hypot(x,z);if(length>1){x/=length;z/=length;}
   const previous=this.steering.get(bot.id)??{x:0,z:0},blend=1-Math.exp(-7*elapsed);
   x=previous.x+(x-previous.x)*blend;z=previous.z+(z-previous.z)*blend;
   if(Math.hypot(x,z)<.03){x=0;z=0;}this.steering.set(bot.id,{x,z});
   if(bot.classId==='Scout'&&attack)attack=bot.scoutDraw.elapsed<.6;
   this.world.setInput(bot.id,{x,z,sprint:d>8,attack});
  }
 }
}
