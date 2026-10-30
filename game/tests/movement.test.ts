import { describe, expect, it } from 'vitest';
import { movementFactor, runBlend, RUN_STRIDE, WALK_STRIDE } from '../src/movement';

describe('walk and run tuning', () => {
  it('walks by default and runs only when held', () => {
    expect(movementFactor(false)).toBeLessThan(movementFactor(true));
    expect(movementFactor(true)).toBe(1);
    expect(runBlend(6*movementFactor(false),6)).toBe(0);
    expect(runBlend(6,6)).toBe(1);
  });
  it('advances the run cycle more slowly per metre than before', () => {
    expect(RUN_STRIDE).toBeGreaterThan(2.2);
    expect(RUN_STRIDE).toBeGreaterThan(WALK_STRIDE);
  });
});
