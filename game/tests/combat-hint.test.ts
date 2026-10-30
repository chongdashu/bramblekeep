import { describe, expect, it } from "vitest";
import { combatHint, type CombatHintState } from "../src/combat-hint";

const base: CombatHintState = { x: 0, z: 0, enemies: [{ x: 3, z: 0, alive: true }], gateOpen: false, cleared: false, range: 2, touch: false };
describe("combat guidance", () => {
  it("names the actual desktop input and tells the player to get closer", () => {
    const hint = combatHint(base);
    expect(hint.text).toContain("Move close"); expect(hint.text).toContain("Space or left-click"); expect(hint.inRange).toBe(false);
  });
  it("shows the touch action and highlights a reachable target", () => {
    const hint = combatHint({ ...base, x: 1.1, touch: true });
    expect(hint.text).toContain("hold Attack"); expect(hint.inRange).toBe(true); expect(hint.target).toBe(0);
  });
  it("points to the core after minions are gone and explains restart after success", () => {
    expect(combatHint({ ...base, enemies: [], gateOpen: true }).text).toContain("open gate");
    expect(combatHint({ ...base, enemies: [], gateOpen: true, z: 8.5, touch: true }).text).toContain("hold Attack");
    expect(combatHint({ ...base, cleared: true, touch: true }).text).toContain("Restart");
  });
});
