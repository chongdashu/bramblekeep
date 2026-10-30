/** Presentation-only movement from the doorway or hollow onto the walkable spawn point. */
export class EnemyEmergence {
 private states=new Map<string,{alive:boolean;age:number}>();
 clear(){this.states.clear();}
 update(id:string,alive:boolean,dt:number){
  const s=this.states.get(id);
  if(!s){const emerged=alive && Number(id)>=5;this.states.set(id,{alive,age:emerged?0:1});return emerged;}
  const emerged=alive&&!s.alive;
  if(emerged)s.age=0;
  else if(alive)s.age=Math.min(1,s.age+Math.max(0,dt)/.65);
  s.alive=alive;
  return emerged;
 }
 offset(id:string){const s=this.states.get(id);if(!s?.alive)return 0;const t=s.age*s.age*(3-2*s.age);return -.8*(1-t);}
}
