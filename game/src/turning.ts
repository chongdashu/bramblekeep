/** Smooth a visual facing toward the shortest arc without changing gameplay input. */
export function turnToward(current: number, target: number, dt: number, response = 36): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-response * Math.max(0, dt)));
}
