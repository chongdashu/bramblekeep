import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HeartTreeMotion } from '../src/heart-tree-motion';

describe('evil tree guardian',()=>{
 it('animates, recoils when hit, falls when defeated, and resets for a new round',()=>{
  const motion=new HeartTreeMotion();
  const a=motion.sample(6,0,false), b=motion.sample(6,.6,false);
  expect(a.arm).not.toBe(b.arm);
  // A light, short pop, so rapid hits never leave the guardian a white silhouette.
  const hit=motion.sample(5,1,false).flash;
  expect(hit).toBeGreaterThan(0);expect(hit).toBeLessThanOrEqual(.1);
  expect(motion.sample(5,1.15,false).flash).toBe(0);
  expect(motion.sample(5,1.2,false).pitch).toBeLessThan(-.15);
  motion.sample(0,2,true);const fallen=motion.sample(0,3.7,true);
  expect(fallen.pitch).toBeLessThan(-.85);expect(fallen.fall).toBe(1);
  const reset=motion.sample(6,0,false);expect(reset.fall).toBe(0);expect(reset.flash).toBe(0);
 });
 it('does not ship circles or radial inlays around the guardian',()=>{
  const glb=readFileSync(new URL('../public/assets/environment-lab/castle-courtyard.glb',import.meta.url));
  const doc=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString('utf8'));
  const source=readFileSync(new URL('../art/environment-lab/courtyard/build.py',import.meta.url),'utf8');
  expect(source).not.toMatch(/Core (arena inlay|inlay wedge|inlay marker)/);
  const names=doc.nodes.map((n:{name?:string})=>n.name??'');
  expect(names.some((name:string)=>/^Core (arena inlay|inlay wedge|inlay marker)/.test(name))).toBe(false);
 });
});
