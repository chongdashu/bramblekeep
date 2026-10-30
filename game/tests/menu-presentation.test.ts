import { describe, expect, it } from 'vitest';
import { EnvironmentScene } from '../src/scenes/environment';

describe('environment menu camera', () => {
  it('pans smoothly around the world independently of the gameplay start shot', () => {
    const scene = new EnvironmentScene();
    const first = scene.menuShot();
    expect(scene.menuShot(10).yaw).not.toEqual(first.yaw);
    expect(Math.abs(scene.menuShot(10.01).yaw - scene.menuShot(10).yaw)).toBeLessThan(0.001);
    expect(first.target[2]).toBeLessThan(0);
    expect(first.pitch).toBeLessThan(0.5);
    expect(first).not.toEqual(scene.heroShot());
  });
});
