/** Shared movement tuning for the local prototype and its test scenes. */
export const WALK_FACTOR = 0.4;
export const WALK_STRIDE = 1.8;
export const RUN_STRIDE = 3.6;
export function movementFactor(sprinting: boolean): number { return sprinting ? 1 : WALK_FACTOR; }
export function runBlend(speed: number, runSpeed: number): number {
  const start = Math.max(0.01, runSpeed * 0.64), end = Math.max(start + 0.01, runSpeed * 0.9);
  const t = Math.max(0, Math.min(1, (speed-start)/(end-start)));
  return t*t*(3-2*t);
}
