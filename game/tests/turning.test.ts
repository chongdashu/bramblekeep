import { describe, expect, it } from "vitest";
import { turnToward } from "../src/turning";

describe("visual direction changes", () => {
  it("turns sharply, toward the shortest arc, and holds while paused", () => {
    const start = Math.PI - 0.1, target = -Math.PI + 0.1;
    const next = turnToward(start, target, 1 / 60);
    expect(next).toBeGreaterThan(start);
    expect(next - start).toBeLessThan(0.2);
    expect(turnToward(start, target, 0)).toBe(start);
    let angle = 0;
    for (let i = 0; i < 6; i++) angle = turnToward(angle, Math.PI / 2, 1 / 60);
    expect(Math.abs(angle - Math.PI / 2)).toBeLessThan(0.05);
    expect(angle).toBeLessThan(Math.PI / 2);
  });
});
