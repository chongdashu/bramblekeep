import { canStand, MAP } from '../src/scenes/environment-map';

export type SpawnPoint={x:number;z:number};
type Occupant=SpawnPoint & {spawnSlot:number};
// A spaced grid around camp, filtered against the same collision map as movement.
export const CAMP_SPAWNS:readonly SpawnPoint[]=[0,1.4,2.8,-1.4,-2.8].flatMap(dz=>
 [0,-1.4,1.4,-2.8,2.8,-4.2,4.2].map(x=>({x,z:MAP.camp[1]+dz})).filter(p=>canStand(p.x,p.z)));
const CLEARANCE=1.05;
/** Reserve a distinct point for a new session, avoiding where other heroes actually stand. */
export function reserveSpawn(occupants:readonly Occupant[]):number {
 const reserved=new Set(occupants.map(p=>p.spawnSlot));
 const candidates=CAMP_SPAWNS.map((_,i)=>i).filter(i=>!reserved.has(i));
 return safestSpawn(candidates.length?candidates:CAMP_SPAWNS.map((_,i)=>i),occupants);
}
/** Prefer the hero's reserved point, unless another hero is standing too close to it. */
export function respawnPosition(slot:number,occupants:readonly SpawnPoint[]):SpawnPoint {
 const candidates=[slot,...CAMP_SPAWNS.map((_,i)=>i).filter(i=>i!==slot)].filter(i=>!!CAMP_SPAWNS[i]);
 return CAMP_SPAWNS[safestSpawn(candidates,occupants)];
}
function safestSpawn(candidates:readonly number[],occupants:readonly SpawnPoint[]):number {
 let best=candidates[0],bestDistance=-1;
 for(const i of candidates){const p=CAMP_SPAWNS[i];const distance=occupants.reduce((min,o)=>Math.min(min,Math.hypot(p.x-o.x,p.z-o.z)),Infinity);
  if(distance>=CLEARANCE)return i;
  if(distance>bestDistance){best=i;bestDistance=distance;}
 }
 return best;
}
