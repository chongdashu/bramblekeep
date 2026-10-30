import { describe,it,expect } from 'vitest';
import { AttackWindow, ATTACK_COOLDOWN } from '../src/castle-combat';
import { makeProjectile,advanceProjectiles,assistedTarget,type Target } from '../src/castle-projectiles';
import { CastlePatrol } from '../src/castle-patrol';
const targets:Target[]=[{id:'front',x:2,z:-6,radius:.48},{id:'behind',x:0,z:2,radius:.48}];
describe('ranged combat',()=>{
 it('enforces recovery per class',()=>{for(const kind of ['Knight','Scout','Spellcaster'] as const){const w=new AttackWindow();w.start(kind);w.advance(ATTACK_COOLDOWN[kind]-.01);expect(w.ready).toBe(false);w.advance(.02);expect(w.ready).toBe(true);}});
 it('assists arrows only toward nearby targets in the forward cone',()=>{expect(assistedTarget(0,0,Math.PI,targets)?.id).toBe('front');expect(assistedTarget(0,0,Math.PI,[targets[1]])).toBeUndefined();const arrow=makeProjectile('arrow',0,0,Math.PI,targets);expect(arrow.target).toBe('front');expect(arrow.dx).toBeGreaterThan(0);});
 it('sweeps fast arrows into one target and stops at the closed keep',()=>{const t=[{id:'one',x:0,z:-4,radius:.4}];const shots=[makeProjectile('arrow',0,0,Math.PI,t)];let hits=advanceProjectiles(shots,.1,t,false);expect(hits).toHaveLength(0);hits=advanceProjectiles(shots,.1,t,false);expect(hits[0].target).toBe('one');expect(shots).toHaveLength(0);const walls=[makeProjectile('arrow',0,-14,Math.PI,[])];const wall=advanceProjectiles(walls,.1,[],false);expect(wall[0].blocked).toBe(true);});
 it('makes orbs splash nearby enemies while arrows hit only one',()=>{const p=new CastlePatrol();p.enemies.slice(2).forEach(e=>e.alive=false);p.enemies[0].x=0;p.enemies[0].z=-4;p.enemies[1].x=1;p.enemies[1].z=-4;const orb=makeProjectile('orb',0,-3,Math.PI,[]);const result=p.impact({projectile:orb,x:0,z:-4,target:'enemy-0',blocked:false});expect(result.hits).toBe(2);expect(p.enemies[0].hp).toBe(1);expect(p.enemies[1].hp).toBe(2);const arrow=makeProjectile('arrow',0,-3,Math.PI,[]);expect(p.impact({projectile:arrow,x:0,z:-4,target:'enemy-0',blocked:false}).hits).toBe(1);expect(p.enemies[1].hp).toBe(2);});
 it('never deals blast damage through a blocked wall',()=>{const p=new CastlePatrol();p.enemies.slice(2).forEach(e=>e.alive=false);p.enemies[0].x=0;p.enemies[0].z=-4;const orb=makeProjectile('orb',0,-3,Math.PI,[]);expect(p.impact({projectile:orb,x:0,z:-4,target:null,blocked:true}).hits).toBe(0);});
});
