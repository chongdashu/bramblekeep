import { describe, expect, it, vi } from 'vitest';
import { CombatAudioEvents, type CombatAudioSnapshot } from '../src/combat-audio-events';
import { GateMechanism, LEVERS } from '../src/gate-mechanism';
import { CastlePatrol } from '../src/castle-patrol';
import { GateCinematic } from '../src/gate-cinematic';
import type { GameRuntime } from '@engine/runtime';
import { World } from '../server/world';

const snapshot = (): CombatAudioSnapshot => ({round:1,gateOpen:false,cleared:false,coreHealth:6,leverHealth:[4,4],leverHits:[0,0],enemies:[{id:'0',x:1,z:2,hp:2,attackSeq:0}]});

describe('combat audio events',()=>{
  it('emits one cue for an enemy strike, damage, and lever hits including at zero health',()=>{
    const events=new CombatAudioEvents(),s=snapshot();
    expect(events.update(s)).toEqual([]);
    s.enemies[0].attackSeq++;s.enemies[0].hp--;s.leverHits[0]++;s.leverHealth[0]=0;
    expect(events.update(s)).toEqual([
      {cue:'enemyAttack',x:1,z:2},{cue:'hit',x:1,z:2},
      {cue:'leverHit',x:LEVERS[0].x,z:LEVERS[0].z},{cue:'leverDown',x:LEVERS[0].x,z:LEVERS[0].z},
    ]);
    expect(events.update(s)).toEqual([]);
    s.leverHits[0]++;
    expect(events.update(s)).toEqual([{cue:'leverHit',x:LEVERS[0].x,z:LEVERS[0].z}]);
    s.leverHealth[0]=.2;expect(events.update(s)).toEqual([]); // repair is not a hit
  });
  it('handles heart damage and gate closure without replaying joins, pause changes, or new rounds',()=>{
    const events=new CombatAudioEvents(),s=snapshot();s.gateOpen=true;s.leverHits[0]=6;s.coreHealth=3;
    expect(events.update(s)).toEqual([]);
    s.coreHealth=2;expect(events.update(s)).toEqual([{cue:'heartHit',x:0,z:-26}]);
    s.gateOpen=false;expect(events.update(s)).toEqual([{cue:'gateClose',x:0,z:-16}]);
    s.enemies[0].attackSeq++;expect(events.update(s,false)).toEqual([]);
    expect(events.update(s)).toEqual([]);
    s.round++;s.coreHealth=6;s.leverHits=[0,0];s.enemies[0].attackSeq=0;
    expect(events.update(s)).toEqual([]);
    events.reset();s.coreHealth=1;expect(events.update(s)).toEqual([]);
  });
  it('counts repeated authoritative lever strikes at zero and enemy attack releases',()=>{
    const gate=new GateMechanism();for(let i=0;i<6;i++)gate.hit(0);
    expect(gate.health[0]).toBe(0);expect(gate.hitCount[0]).toBe(6);
    gate.reset();expect(gate.hitCount).toEqual([0,0]);
    const patrol=new CastlePatrol(),e=patrol.enemies[0];patrol.enemies.slice(1).forEach(other=>other.alive=false);
    e.windup=.05;patrol.step(.1,e.x,e.z);expect(e.attackSeq).toBe(1);
  });
  it('reports the gate landing exactly once at the animated impact',()=>{
    const rt={camera:{addTrauma:vi.fn()},particles:{random:()=>.5,spawn:vi.fn()}} as unknown as GameRuntime;
    const gate=new GateCinematic();gate.start(rt);
    expect(gate.step(.6,rt)).toBe(false);
    expect(gate.step(.6,rt)).toBe(true);
    expect(gate.step(.1,rt)).toBe(false);
  });
  it('observes real shared-world attacks, including repeat hits while a lever is held down',()=>{
    const world=new World(),tracker=new CombatAudioEvents();
    const player=world.join('tester','Knight');
    Object.assign(player,{x:LEVERS[0].x,z:LEVERS[0].z+1,yaw:Math.PI});
    for(const enemy of world.enemies)enemy.alive=false;
    const state=():CombatAudioSnapshot=>({round:world.round,gateOpen:world.gateOpen,cleared:world.cleared,coreHealth:world.coreHealth,leverHealth:world.gate.health,leverHits:world.gate.hitCount,enemies:world.enemies.map((e,i)=>({id:String(i),x:e.x,z:e.z,hp:e.hp,attackSeq:e.attackSeq}))});
    tracker.update(state());
    let hits=0,disabled=0;
    for(let i=0;i<100;i++){
      world.setInput('tester',{x:0,z:0,sprint:false,attack:true});world.step(.05);
      for(const event of tracker.update(state())){if(event.cue==='leverHit')hits++;if(event.cue==='leverDown')disabled++;}
    }
    expect(world.gate.health[0]).toBe(0);expect(hits).toBeGreaterThan(4);expect(disabled).toBe(1);
    const enemy=world.enemies[0];enemy.alive=true;enemy.windup=.05;
    world.step(.05);expect(tracker.update(state()).some(event=>event.cue==='enemyAttack')).toBe(true);
  });
});
