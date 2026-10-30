import { describe, expect, it } from 'vitest';
import layout from '../src/scenes/castle-outskirts.json';
import { canStand, moveOnMap } from '../src/scenes/environment-map';

describe('castle outskirts', () => {
  it('backs the visible barricades and supply piles with invisible collision', () => {
    for (const fence of [...layout.sideFences, ...layout.rearFences]) expect(canStand(fence.x, fence.z)).toBe(false);
    for (const group of layout.supplyGroups) {
      expect(canStand(group.x, group.z)).toBe(false);
      expect(canStand(group.x + group.side*.75, group.z + .7)).toBe(false);
    }
    for (const [x,z] of layout.lights) expect(canStand(x,z)).toBe(false);
    expect(moveOnMap(19,-30,4,0)[0]).toBeLessThan(20.7);
    expect(moveOnMap(0,-42,0,-3)[1]).toBeGreaterThan(-44);
  });
  it('leaves a connected service route down both sides and behind the castle', () => {
    const step=.25, key=(x:number,z:number)=>`${x},${z}`;
    const start:[number,number]=[68,-80], queue:[number,number][]=[start], seen=new Set([key(...start)]);
    for (let i=0;i<queue.length;i++) {
      const [x,z]=queue[i];
      for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=x+dx,nz=z+dz,k=key(nx,nz);
        if (nx < -88 || nx > 88 || nz < -180 || nz > -68 || seen.has(k) || !canStand(nx*step,nz*step)) continue;
        seen.add(k); queue.push([nx,nz]);
      }
    }
    expect(seen.has(key(0,-170)), 'rear passage is reachable').toBe(true);
    expect(seen.has(key(-68,-80)), 'opposite side is reachable').toBe(true);
    expect(canStand(0,-25,true), 'courtyard remains clear').toBe(true);
  });
});
