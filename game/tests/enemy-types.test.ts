import { describe, expect, it } from 'vitest';
import { ENEMY_TYPES } from '../src/enemy-types';
import { CastlePatrol } from '../src/castle-patrol';
import { World } from '../server/world';

describe('enemy size profiles',()=>{
 it('gives each enemy a visibly separated height and a ground-level target',()=>{
  const [bloom,bramble,mushroom,stump]=ENEMY_TYPES;
  expect(mushroom.height*mushroom.scale).toBeGreaterThan(bloom.height*bloom.scale*1.1);
  expect(bramble.height*bramble.scale).toBeGreaterThan(mushroom.height*mushroom.scale*1.2);
  expect(stump.height*stump.scale).toBeGreaterThan(bramble.height*bramble.scale*1.15);
  expect(stump.radius).toBeGreaterThan(bramble.radius);
 });
 it('uses matching target radii for solo and multiplayer',()=>{
  const solo=new CastlePatrol(),shared=new World();
  for(let i=0;i<4;i++){
   const id=`enemy-${i}`,radius=ENEMY_TYPES[i].radius;
   expect(solo.targets().find(t=>t.id===id)?.radius).toBe(radius);
   expect(shared.targets().find(t=>t.id===id)?.radius).toBe(radius);
  }
 });
});
