import { enemyType } from './enemy-types';
import { canStand, moveOnMap } from './scenes/environment-map';
import type { PatrolEnemy } from './castle-patrol';

type PatrolState={side:1|-1;wait:number;stuck:number;wasEngaged:boolean;targetX:number;targetZ:number;hasTarget:boolean};
const TURN_RATE=2.8;
/** Each enemy keeps a destination long enough to walk there, then rests before pacing back. */
export class PatrolMotion {
 private states=new WeakMap<PatrolEnemy,PatrolState>();
 private state(e:PatrolEnemy):PatrolState {
  let state=this.states.get(e);
  if(!state){state={side:1,wait:.25+(e.phase%1)*.5,stuck:0,wasEngaged:false,targetX:e.homeX,targetZ:e.homeZ,hasTarget:false};this.states.set(e,state);}
  return state;
 }
 face(e:PatrolEnemy,x:number,z:number,dt:number){
  const dx=x-e.x,dz=z-e.z;if(Math.hypot(dx,dz)<.08)return;
  const target=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(target-e.yaw),Math.cos(target-e.yaw));
  e.yaw+=Math.max(-TURN_RATE*dt,Math.min(TURN_RATE*dt,delta));
 }
 private destination(e:PatrolEnemy,state:PatrolState,gateOpen:boolean){
  // Pick a stable waypoint; try a few orientations when props or the river block it.
  for(let i=0;i<8;i++){
   const angle=e.phase*.72+.4+i*Math.PI/4,span=1.15+(e.type%2)*.3;
   const x=e.homeX+Math.sin(angle)*span*state.side,z=e.homeZ+Math.cos(angle)*span*state.side;
   if(canStand(x,z,gateOpen)){state.targetX=x;state.targetZ=z;state.hasTarget=true;return;}
  }
  state.targetX=e.homeX;state.targetZ=e.homeZ;state.hasTarget=true;
 }
 step(e:PatrolEnemy,dt:number,gateOpen:boolean,target:{x:number;z:number}|null){
  const state=this.state(e),engaged=target!==null;e.moving=false;
  if(engaged){state.wasEngaged=true;state.hasTarget=false;state.wait=0;}
  else if(state.wasEngaged){state.wasEngaged=false;state.wait=.8;state.stuck=0;state.hasTarget=false;}
  if(!engaged && state.wait>0){state.wait=Math.max(0,state.wait-dt);return;}
  if(!engaged && !state.hasTarget)this.destination(e,state,gateOpen);
  const tx=target?.x??state.targetX,tz=target?.z??state.targetZ,dx=tx-e.x,dz=tz-e.z,distance=Math.hypot(dx,dz);
  if(distance<(engaged?.9:.16)){
   if(!engaged){state.side=state.side===1?-1:1;state.hasTarget=false;state.wait=1.2+(e.phase%1)*1.3;state.stuck=0;}
   return;
  }
  this.face(e,tx,tz,dt);
  const desired=Math.atan2(dx,dz),angle=Math.abs(Math.atan2(Math.sin(desired-e.yaw),Math.cos(desired-e.yaw)));
  // Turn before advancing so the animation never slides sideways through an about-face.
  if(angle>1.05)return;
  const speed=[1.2,1.0,1.45,.85][e.type]??1,travel=Math.min(distance,dt*(engaged?speed:speed*.46));
  const [nx,nz]=moveOnMap(e.x,e.z,Math.sin(e.yaw)*travel,Math.cos(e.yaw)*travel,gateOpen);
  const moved=Math.hypot(nx-e.x,nz-e.z);e.moving=moved>.0001;e.gait=(e.gait+moved/(.85*enemyType(e.type).scale))%1;e.x=nx;e.z=nz;
  if(!engaged){state.stuck=e.moving?0:state.stuck+dt;if(state.stuck>.8){state.side=state.side===1?-1:1;state.hasTarget=false;state.wait=1;state.stuck=0;}}
 }
}
