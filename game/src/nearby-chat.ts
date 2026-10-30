import type { GameRuntime } from '@engine/runtime';
import type { CastleState } from './multiplayer-schema';

/** World units: labels and bubbles appear only for nearby heroes. */
export const NEARBY_HERO_RANGE=12;
export function isNearbyHero(x:number,z:number,otherX:number,otherZ:number):boolean {
 return Math.hypot(x-otherX,z-otherZ)<=NEARBY_HERO_RANGE;
}
const BUBBLE_MS=6000;
/** Chat history stays in the feed; only messages received in this connection get bubbles. */
export class NearbyChat {
 private root:HTMLElement;
 private bubbles=new Map<string,{text:string;until:number;node:HTMLElement}>();
 private lastEvent=-1;
 private rect:DOMRect|null=null;
 private seen=new Set<string>();
 constructor(private runtime:GameRuntime){this.root=document.createElement('div');this.root.className='speech-bubbles';this.root.setAttribute('aria-hidden','true');document.body.append(this.root);}
 observe(state:CastleState,now=performance.now()){
  const events=[...state.activity.entries()].map(([id,event])=>({id:Number(id),event})).filter(e=>Number.isSafeInteger(e.id)).sort((a,b)=>a.id-b.id);
  if(this.lastEvent<0){this.lastEvent=events.at(-1)?.id??0;return;}
  for(const {id,event} of events){if(id<=this.lastEvent)continue;this.lastEvent=id;if(event.kind!=='chat'||!event.actorId||!event.text)continue;
   let bubble=this.bubbles.get(event.actorId);if(!bubble){const node=document.createElement('div');node.className='speech-bubble';node.dataset.playerId=event.actorId;this.root.append(node);bubble={text:'',until:0,node};this.bubbles.set(event.actorId,bubble);}bubble.text=event.text;bubble.node.textContent=event.text;bubble.until=now+BUBBLE_MS;
  }
 }
 begin(){this.seen.clear();this.rect=this.runtime.canvas.getBoundingClientRect();}
 place(id:string,x:number,y:number,z:number,now=performance.now()){
  const bubble=this.bubbles.get(id),rect=this.rect;if(!bubble||!rect||now>=bubble.until)return;
  this.seen.add(id);const point=this.runtime.camera.project([x,y,z],rect.width,rect.height);
  bubble.node.hidden=!point||point[0]<0||point[0]>rect.width||point[1]<0||point[1]>rect.height;
  if(!bubble.node.hidden&&point){bubble.node.style.left=`${rect.left+point[0]}px`;bubble.node.style.top=`${rect.top+point[1]}px`;}
 }
 end(now=performance.now()){for(const [id,bubble] of this.bubbles){if(now>=bubble.until){bubble.node.remove();this.bubbles.delete(id);}else if(!this.seen.has(id))bubble.node.hidden=true;}}
 clear(){this.root.replaceChildren();this.bubbles.clear();this.lastEvent=-1;this.seen.clear();}
}
