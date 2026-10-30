import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import camp from '../src/scenes/camp-layout.json';
import routes from '../src/scenes/assault-routes.json';
import { canStand, moveOnMap } from '../src/scenes/environment-map';
import { CAMP_SPAWNS } from '../server/spawn';

describe('friendly camp',()=>{
 it('keeps the camp props solid and at least 24 player starts clear',()=>{
  expect(camp.tents).toHaveLength(3);
  for (const t of camp.tents) expect(canStand(t.x,t.z)).toBe(false);
  for (const p of camp.solids) expect(canStand(p.x,p.z)).toBe(false);
  for (const [x,z] of camp.lights) expect(canStand(x,z)).toBe(false);
  expect(CAMP_SPAWNS.length).toBeGreaterThanOrEqual(24);
  for (const p of CAMP_SPAWNS) expect(canStand(p.x,p.z)).toBe(true);
 });
 it('leaves room to move beside the fire toward the river',()=>{
  const side=moveOnMap(0,22,5,0);
  expect(side[0]).toBeCloseTo(5);
  const river=moveOnMap(...side,0,-12);
  expect(river[1]).toBeGreaterThan(9.3);
  expect(river[1]).toBeLessThan(10.5);
 });
 it('keeps each branch connected from camp to the crossing',()=>{
  for (const side of [-1,1]) {
   let [x,z]=[0,22];
   for (const [px,pz] of routes.flank.slice(0,4)) {
    [x,z]=moveOnMap(x,z,side*px-x,pz-z);
    expect(x).toBeCloseTo(side*px,1);expect(z).toBeCloseTo(pz,1);
   }
  }
 });
 it('ships recognizable tent, lantern and camp furniture materials',()=>{
  const glb=readFileSync(new URL('../public/assets/environment-lab/camp-kit.glb',import.meta.url));
  const n=glb.readUInt32LE(12),doc=JSON.parse(glb.subarray(20,20+n).toString('utf8'));
  expect(doc.materials.map((m:{name:string})=>m.name)).toEqual(expect.arrayContaining(['Camp warm canvas','Camp blue canvas','Camp oak','Camp lantern glow']));
  expect(doc.materials.find((m:{name:string})=>m.name==='Camp lantern glow').emissiveFactor[0]).toBeGreaterThan(.8);
  expect(doc.materials.find((m:{name:string})=>m.name==='Camp warm canvas').pbrMetallicRoughness.baseColorTexture).toBeDefined();
 });
});
