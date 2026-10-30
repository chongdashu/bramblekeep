import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameRuntime } from '@engine/runtime';
import { motion } from '@engine/ui/tween';
import { playerDamageFeedback } from '../src/player-damage-feedback';

describe('player damage feedback', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('restarts the vignette and health flash on every hit', () => {
    const cancel = vi.fn(), animate = vi.fn();
    const element = { getAnimations: () => [{ cancel }], animate };
    vi.stubGlobal('document', { querySelector: () => element });
    const addTrauma = vi.fn();
    const rt = { camera: { addTrauma } } as unknown as GameRuntime;
    playerDamageFeedback(rt, false);
    playerDamageFeedback(rt, true);
    expect(cancel).toHaveBeenCalledTimes(4);
    expect(animate).toHaveBeenCalledTimes(4);
    if (!motion.reduced) expect(addTrauma.mock.calls.map(call => call[0])).toEqual([.54, .72]);
  });
});
