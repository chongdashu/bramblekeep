import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CastlePatrol } from '../src/castle-patrol';
import { reinforcementSpawn } from '../src/castle-spawns';
import { World } from '../server/world';
import { canStand, moveOnMap } from '../src/scenes/environment-map';
import courtyard from '../src/scenes/courtyard-layout.json';
import { showEnvironmentKitNode } from '../src/scenes/environment-kit-nodes';

function breach(gate: {hit(index:number):boolean}) { for(let n=0;n<4;n++){gate.hit(0);gate.hit(1);} }
describe('castle courtyard',()=>{
 it('keeps each barracks doorway and the central core arena reachable',()=>{
  for(const [i,b] of courtyard.barracks.entries()){
   const p=reinforcementSpawn(i,true);
   expect(canStand(p.x,p.z,true)).toBe(true);
   expect(canStand(b.x,(b.front+b.back)/2,true)).toBe(false);
   expect(moveOnMap(p.x,p.z,0,3,true)[1]).toBeCloseTo(p.z+3);
   expect(moveOnMap(0,-26,p.x,-2.5,true)[0]).toBeCloseTo(p.x);
  }
  expect(canStand(0,-26,true)).toBe(true);
  expect(canStand(0,-34,true)).toBe(true); // removed rear castle leaves no phantom blocker
 });
 it('spawns reinforcements at the barracks after breach in both simulations and lets them emerge',()=>{
  const solo=new CastlePatrol(),world=new World();breach(solo.gate);breach(world.gate);
  for(const simulation of [solo,world]){
   simulation.enemies[0].alive=false;simulation.enemies[0].deathRemaining=0;simulation.spawnClock=12;
   if(simulation instanceof CastlePatrol)simulation.step(.05,0,-22);else simulation.step(.05);
   const e=simulation.enemies[0],p=reinforcementSpawn(0,true);
   expect(e.alive).toBe(true);expect(e.x).toBeCloseTo(p.x);expect(e.z).toBeCloseTo(p.z,1);
   for(let i=0;i<160;i++)if(simulation instanceof CastlePatrol)simulation.step(.05,0,-22);else simulation.step(.05);
   expect(e.z).toBeGreaterThan(p.z+0.5);
  }
 });
 it('keeps rear planters solid while preserving the arena and portal approaches',()=>{
  for(const p of courtyard.planters){
   expect(canStand(p.x,p.z,true)).toBe(false);
   expect(canStand(p.x,p.z+p.halfDepth+.5,true)).toBe(true);
  }
  expect(moveOnMap(0,-22,0,-12,true)[1]).toBeCloseTo(-34);
 });
 it('musters at clear exterior wall doors when the gate is closed',()=>{
  for (const i of [0,1]) {
   const p=reinforcementSpawn(i,false);
   expect(p).toMatchObject({x:i===0?-8.1:8.1,z:-16.2});
   expect(canStand(p.x,p.z,false)).toBe(true);
   expect(moveOnMap(p.x,p.z,0,2,false)[1]).toBeCloseTo(p.z+2);
  }
 });
 it('excludes the legacy hill that intersected the keep',()=>{
  expect(showEnvironmentKitNode('environment_distant_hills')).toBe(false);
  expect(showEnvironmentKitNode('environment_meadow_light')).toBe(true);
 });
 it('exports a tall emissive crystal core',()=>{
  const glb=readFileSync(new URL('../public/assets/environment-lab/castle-core.glb',import.meta.url));
  const n=glb.readUInt32LE(12),doc=JSON.parse(glb.subarray(20,20+n).toString('utf8'));
  const m=doc.materials.find((m:{name:string})=>m.name==='Core amber crystal');
  expect(m.emissiveFactor.some((x:number)=>x>0)).toBe(true);
  const node=doc.nodes.find((n:{name:string})=>n.name==='Castle core crystal');
  expect(node).toBeDefined();
  const positions=doc.meshes[node.mesh].primitives.map((p:{attributes:{POSITION:number}})=>doc.accessors[p.attributes.POSITION]);
  expect(Math.max(...positions.map((p:{max:number[]})=>p.max[1]))-Math.min(...positions.map((p:{min:number[]})=>p.min[1]))).toBeGreaterThan(1.8);
 });
 it('exports the courtyard asset with both barracks and stone paving',()=>{
  const glb=readFileSync(new URL('../public/assets/environment-lab/castle-courtyard.glb',import.meta.url));
  const n=glb.readUInt32LE(12),doc=JSON.parse(glb.subarray(20,20+n).toString('utf8'));
  expect(doc.materials.map((m:{name:string})=>m.name)).toEqual(expect.arrayContaining(['Courtyard paving','Barracks entry','Barracks blue roof','Spawn portal glow','Courtyard aged gold','Heraldic midnight blue','Garden ivy']));
  expect(doc.materials.find((m:{name:string})=>m.name==='Spawn portal glow').emissiveFactor.some((x:number)=>x>0)).toBe(true);
  expect(doc.materials.find((m:{name:string})=>m.name==='Worn paving stones').pbrMetallicRoughness.baseColorTexture).toBeDefined();
  expect(doc.meshes.length).toBeGreaterThan(3);
 });
});
