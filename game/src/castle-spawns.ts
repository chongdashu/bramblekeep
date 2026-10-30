import courtyard from './scenes/courtyard-layout.json';
export const PATROL_HOMES:readonly (readonly [number,number])[]=[[-2,-10],[2,-12],[-6.5,-4],[6.5,-4],[0,-3],[0,-13],[-8,-9],[8,-9],[-4,-7],[4,-7]];
/** The trees are solid scenery; enemies emerge just in front of their hollow trunks. */
export const BAD_TREE_NESTS=[{x:-10,z:-5},{x:10,z:-5}] as const;
export const WALL_EXITS=[{x:-8.1,z:-16.2},{x:8.1,z:-16.2}] as const;

/** Rotate through castle exits and external nests independently of enemy slot.
 * After a breach, the courtyard barracks join the rotation. */
export function reinforcementSpawn(index:number,gateOpen:boolean,serial=index) {
  const turn=((serial% (gateOpen?6:4))+(gateOpen?6:4))%(gateOpen?6:4);
  if(gateOpen && turn<2){
    const barracks=courtyard.barracks[turn];
    return {x:barracks.x,z:courtyard.spawnZ,homeX:barracks.x,homeZ:courtyard.patrolZ};
  }
  const outsideTurn=turn-(gateOpen?2:0);
  const [homeX,homeZ]=PATROL_HOMES[index % PATROL_HOMES.length];
  if(outsideTurn<2){const exit=WALL_EXITS[outsideTurn];return {...exit,homeX,homeZ};}
  const tree=BAD_TREE_NESTS[outsideTurn-2];return {x:tree.x,z:tree.z+1.15,homeX:tree.x,homeZ:tree.z+2.8};
}

/** Prefer the next source, but never let one occupied exit suppress all spawns. */
export function availableReinforcement(index:number,gateOpen:boolean,serial:number,players:readonly {x:number;z:number}[],enemies:readonly {x:number;z:number}[] = []) {
  const count=gateOpen?6:4;
  for(let offset=0;offset<count;offset++){
    const turn=serial+offset,point=reinforcementSpawn(index,gateOpen,turn);
    if(players.every(p=>Math.hypot(p.x-point.x,p.z-point.z)>=3) && enemies.every(e=>Math.hypot(e.x-point.x,e.z-point.z)>=1.5))return {serial:turn,point};
  }
  return null;
}

/** Dedicated interior barracks sources, independent of exterior reinforcement slots. */
export function availableCourtyardReinforcement(serial:number,players:readonly {x:number;z:number}[],enemies:readonly {x:number;z:number}[] = []) {
 for(let offset=0;offset<courtyard.barracks.length;offset++){
  const turn=serial+offset,barracks=courtyard.barracks[turn%courtyard.barracks.length];
  const point={x:barracks.x,z:courtyard.spawnZ,homeX:barracks.x,homeZ:courtyard.patrolZ};
  if(players.every(p=>Math.hypot(p.x-point.x,p.z-point.z)>=3) && enemies.every(e=>Math.hypot(e.x-point.x,e.z-point.z)>=1.5))return {serial:turn,point};
 }
 return null;
}
