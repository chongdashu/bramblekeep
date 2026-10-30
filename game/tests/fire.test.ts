import { describe, expect, it } from 'vitest';
import { flameShape } from '../src/scenes/fire';

describe('fire motion', () => {
  it('varies flames independently without growing or leaning excessively', () => {
    const a=flameShape(1,0), b=flameShape(1,2), c=flameShape(2,0);
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
    for (let t=0;t<20;t+=.1) for (const phase of [0,1.7,5]) {
      const {height,lean}=flameShape(t,phase);
      expect(height).toBeGreaterThan(.6);
      expect(height).toBeLessThan(1.2);
      expect(Math.abs(lean)).toBeLessThan(.2);
    }
  });
});
