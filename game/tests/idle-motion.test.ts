import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { Animator } from '@engine/gltf/animator';
import { parseGlb } from '@engine/gltf/glb';
import { mat4 } from '@engine/math';
import { IdleVariations, characterIdlePose, heroIdleLayers } from '../src/idle-motion';

describe('idle variety',()=>{
 it('staggers gestures independently and restarts their timing after a respawn',()=>{
  const idle=new IdleVariations(),first=[-1,-1,-1,-1];
  for(let tick=0;tick<100;tick++)for(let i=0;i<4;i++){const p=idle.update(String(i),.05,true);if(p.amount>0&&first[i]<0)first[i]=tick;}
  expect(first.every(t=>t>=0)).toBe(true);expect(new Set(first).size).toBeGreaterThan(2);
  idle.remove('0');expect(idle.sample('0').amount).toBe(0);idle.update('0',.05,true);expect(idle.sample('0').amount).toBe(0);
 });
 it('cancels a gesture when movement or combat starts and waits before retrying',()=>{
  const idle=new IdleVariations();let active=false;
  for(let i=0;i<100;i++)if(idle.update('actor',.05,true).amount>.2){active=true;break;}
  expect(active).toBe(true);expect(idle.update('actor',.05,false).amount).toBe(0);
  for(let i=0;i<20;i++)expect(idle.update('actor',.05,true).amount).toBe(0);
 });
 for(const [kind,name] of ['hero-knight-grip','hero-spellcaster-grip','hero-scout-grip'].entries())it(`${name} keeps its feet planted during its gesture`,async()=>{
  const bytes=readFileSync(new URL(`../public/assets/characters/${name}.glb`,import.meta.url));
  const doc=await parseGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),name,{textures:false});const actor=new Animator(doc,0,"Spine01"),root=mat4.identity();
  const feet=()=>['L_Foot','R_Foot'].map(n=>Array.from(actor.nodeWorld(n)!.slice(12,15)));
  actor.update([{clip:'idle',time:0}],root);const cramped=feet();
  actor.update(heroIdleLayers(),root);const before=feet();
  expect(Math.abs(before[0][0]-before[1][0])).toBeGreaterThan(Math.abs(cramped[0][0]-cramped[1][0])*2);
  actor.update(heroIdleLayers(),root,characterIdlePose(kind,1,0));const after=feet();
  expect(after).toEqual(before);
 });
 it('gives different characters different gestures without moving leg bones',()=>{
  const poses=[0,1,2].map(i=>characterIdlePose(i,1,0));expect(new Set(poses.map(p=>JSON.stringify(p))).size).toBe(3);
  for(let kind=0;kind<4;kind++)expect(Object.keys(characterIdlePose(kind,1,0,true)!)).not.toContain('L_Leg');
 });
});
