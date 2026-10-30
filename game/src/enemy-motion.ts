/** Anticipation and follow-through applied to the rig's arms and torso. */
type Quat = [number,number,number,number];
const zRotation=(angle:number):Quat=>[0,0,Math.sin(angle/2),Math.cos(angle/2)];
const xRotation=(angle:number):Quat=>[Math.sin(angle/2),0,0,Math.cos(angle/2)];
export function enemyAttackPose(windup:number,attackCue:number):Record<string,Quat>|undefined {
  if(windup<=0 && attackCue<=0)return undefined;
  const power=windup>0 ? .25+.55*(1-windup/.5) : Math.sin(Math.PI*(1-attackCue/.45));
  return {L_Upperarm:zRotation(-1.0*power),R_Upperarm:zRotation(1.0*power),L_Forearm:xRotation(-.6*power),R_Forearm:xRotation(-.6*power),Spine02:xRotation(-.22*power)};
}


/** Presentation only: defeated enemies stop being targets immediately but finish falling. */
export const ENEMY_DEATH_DURATION = 1.65;
export class EnemyDeaths {
  private states = new Map<string, { alive: boolean; age: number }>();
  clear(){ this.states.clear(); }
  update(id:string, alive:boolean, dt:number){
    const state=this.states.get(id);
    if(!state){this.states.set(id,{alive,age:ENEMY_DEATH_DURATION});return;}
    if(alive){state.alive=true;state.age=ENEMY_DEATH_DURATION;return;}
    if(state.alive){state.alive=false;state.age=0;}
    else state.age=Math.min(ENEMY_DEATH_DURATION,state.age+Math.max(0,dt));
  }
  age(id:string){const state=this.states.get(id);return state && !state.alive && state.age<ENEMY_DEATH_DURATION ? state.age : undefined;}
}

/** Local-space recoil and fall, with a short grounded hold before sinking away. */
export function enemyReaction(hitFlash:number, deathAge:number|undefined){
  if(deathAge!==undefined){
    const t=Math.min(1,Math.max(0,deathAge)/.55), fall=1-(1-t)*(1-t);
    const sink=Math.max(0,Math.min(1,(deathAge-1.25)/.4));
    return { pitch:-1.42*fall, back:.34*fall, sink, pose:{
      L_Upperarm:zRotation(-.85*fall),R_Upperarm:zRotation(.85*fall),
      L_Forearm:xRotation(-.45*fall),R_Forearm:xRotation(-.45*fall),
    }};
  }
  const hit=Math.sin(Math.PI*Math.max(0,Math.min(1,hitFlash/.22)));
  return {pitch:-.24*hit,back:.16*hit,sink:0,pose:undefined};
}
