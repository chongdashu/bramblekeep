import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('bridge lantern asset', () => {
  it('exports warm emissive panes on both lanterns', () => {
    const glb=readFileSync(new URL('../public/assets/environment-lab/world-props.glb',import.meta.url));
    const n=glb.readUInt32LE(12),doc=JSON.parse(glb.subarray(20,20+n).toString('utf8'));
    const gold=doc.materials.find((m:{name:string})=>m.name==='Lantern gold');
    expect(gold.emissiveFactor[0]).toBeGreaterThan(.8);
    expect(gold.extensions.KHR_materials_emissive_strength.emissiveStrength).toBeGreaterThan(1);
    const node=doc.nodes.find((n:{name:string})=>n.name==='world-props-lantern-gold');
    const positions=doc.accessors[doc.meshes[node.mesh].primitives[0].attributes.POSITION];
    expect(positions.count).toBeGreaterThanOrEqual(8*24);
    expect(positions.min[0]).toBeLessThan(-2);
    expect(positions.max[0]).toBeGreaterThan(2);
  });
});
