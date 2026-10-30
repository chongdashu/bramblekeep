import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { terrainHeight } from '../src/scenes/terrain';

describe('rolling meadow', () => {
  it('keeps the road, bridge, and fixed props level while adding walkable rises', () => {
    for (const [x,z] of [[0,22],[0,8],[0,-18],[-7,22],[3.5,20],[9,1]]) expect(terrainHeight(x,z)).toBe(0);
    expect(terrainHeight(-16,3)).toBeGreaterThan(.5);
    expect(terrainHeight(17,-27)).toBeGreaterThan(.5);
    for (let x=-22; x<=22; x++) for (let z=-45; z<=26; z++) {
      const h=terrainHeight(x,z);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      expect(Math.abs(h-terrainHeight(x+.1,z))).toBeLessThan(.06);
      expect(Math.abs(h-terrainHeight(x,z+.1))).toBeLessThan(.06);
    }
  });
  it('exports the same height field and the textured ground material', () => {
    const glb=readFileSync(new URL('../public/assets/environment-lab/rolling-meadow.glb',import.meta.url));
    const jsonLength=glb.readUInt32LE(12), doc=JSON.parse(glb.subarray(20,20+jsonLength).toString('utf8'));
    const binStart=20+jsonLength+8;
    const primitive=doc.meshes[doc.nodes.find((n:{name:string})=>n.name==='Rolling meadow').mesh].primitives[0];
    const accessor=doc.accessors[primitive.attributes.POSITION], view=doc.bufferViews[accessor.bufferView];
    expect(accessor.max[1]).toBeGreaterThan(.5);
    const material=doc.materials[primitive.material];
    expect(material.name).toBe('River landscape');
    expect(material.extras.vgd_kind).toBe('bump');
    expect(material.pbrMetallicRoughness.baseColorTexture).toBeDefined();
    const offset=binStart+(view.byteOffset??0)+(accessor.byteOffset??0), stride=view.byteStride??12;
    for (let i=0;i<accessor.count;i+=53) {
      const at=offset+i*stride, x=glb.readFloatLE(at), y=glb.readFloatLE(at+4), z=glb.readFloatLE(at+8);
      expect(y).toBeCloseTo(terrainHeight(x,z),4);
    }
  });
});
