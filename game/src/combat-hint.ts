/** Player-facing guidance uses the same distance and target rules as the greybox simulation. */
export interface CombatHintState {
  x: number; z: number; enemies: Array<{ x: number; z: number; alive: boolean }>;
  gateOpen: boolean; cleared: boolean; range: number; touch: boolean;
}
export function combatHint(s: CombatHintState): { text: string; target: number | null; inRange: boolean } {
  if (s.cleared) return { text: s.touch ? "Core cleared! Pause → Restart to play again" : "Core cleared! Press R to play again", target: null, inRange: false };
  const enemies = s.enemies.map((e, index) => ({ ...e, index, distance: Math.hypot(e.x - s.x, e.z - s.z) })).filter(e => e.alive).sort((a, b) => a.distance - b.distance);
  const action = s.touch ? "hold Attack" : "hold Space or left-click";
  if (enemies.length) {
    const inRange = enemies[0].distance <= s.range;
    return { text: inRange ? `In range: ${action}` : `Move close to a minion, then ${action}`, target: enemies[0].index, inRange };
  }
  if (s.gateOpen) {
    const inRange = s.z >= 5.5 && Math.hypot(s.x, s.z - 8.5) <= s.range;
    return { text: inRange ? `At the core: ${action}` : "Go through the open gate to the gold core", target: null, inRange };
  }
  return { text: "Clear the minions to open the gate", target: null, inRange: false };
}
