import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('stump enemy export',()=>{
 it('keeps its outstretched arms across the facing axis and retains its clips',()=>{
  const bytes=readFileSync(new URL('../public/assets/enemies/stump-animated.glb',import.meta.url));
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  const bounds=gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
  const width=bounds.max[0]-bounds.min[0],depth=bounds.max[2]-bounds.min[2];
  // This asymmetric character previously exported sideways, with its arms along Z.
  expect(width).toBeGreaterThan(depth*1.4);
  expect(bounds.min[1]).toBeCloseTo(0);
  expect(gltf.animations.map((a:{name:string})=>a.name)).toEqual(expect.arrayContaining(['idle','walk','attack']));
 });
});
