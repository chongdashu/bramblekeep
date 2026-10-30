import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canStand, moveOnMap, riverEdge } from '../src/scenes/environment-map';
import { overlookHeight } from '../src/scenes/overlook';
import routes from '../src/scenes/assault-routes.json';
import { CastlePatrol, PATROL_HOMES } from '../src/castle-patrol';
import { World } from '../server/world';

describe('camp to castle routes', () => {
  it('connects both flanks from camp to the gate through visible crossings', () => {
    for (const side of [-1, 1]) {
      let [x,z]: [number,number] = [0,22];
      for (const [px,pz] of routes.flank) {
        const targetX=px*side;
        [x,z]=moveOnMap(x,z,targetX-x,pz-z);
        expect(x, `flank ${side} at ${targetX},${pz}`).toBeCloseTo(targetX,1);
        expect(z, `flank ${side} at ${targetX},${pz}`).toBeCloseTo(pz,1);
      }
      const cx=side*7.2, [lo,hi]=riverEdge(cx);
      expect(canStand(cx,(lo+hi)/2)).toBe(true);
      expect(canStand(cx+1.6,(lo+hi)/2)).toBe(false);
    }
  });
  it('places a patrol on each flank in solo and shared worlds', () => {
    const solo=new CastlePatrol(), shared=new World();
    expect(PATROL_HOMES.slice(2,4)).toEqual([[-6.5,-4],[6.5,-4]]);
    for (const i of [2,3]) {
      expect([solo.enemies[i].x,solo.enemies[i].z]).toEqual(PATROL_HOMES[i]);
      expect([shared.enemies[i].x,shared.enemies[i].z]).toEqual(PATROL_HOMES[i]);
      expect(canStand(...PATROL_HOMES[i])).toBe(true);
    }
  });
  it('exports textured trail edges and both bridge decks', () => {
    const glb=readFileSync(new URL('../public/assets/environment-lab/assault-routes.glb', import.meta.url));
    const n=glb.readUInt32LE(12), doc=JSON.parse(glb.subarray(20,20+n).toString('utf8'));
    const road=doc.materials.find((m:{name:string}) => m.name==='Path earth');
    expect(road.alphaMode).toBe('BLEND');
    expect(road.pbrMetallicRoughness.baseColorTexture).toBeDefined();
    const deck=doc.nodes.find((node:{name:string}) => node.name.startsWith('assault-Flank-bridge-oak'));
    const positions=doc.accessors[doc.meshes[deck.mesh].primitives[0].attributes.POSITION];
    expect(positions.min[0]+deck.translation[0]).toBeLessThan(-8);
    expect(positions.max[0]+deck.translation[0]).toBeGreaterThan(8);
  });
  it('removes the isolated lookout and its invisible ledges and colliders', () => {
    expect(overlookHeight(9,-10)).toBe(0);
    expect(canStand(9,-10)).toBe(true);
    expect(moveOnMap(6,-10,6,0)[0]).toBeCloseTo(12);
  });
});
