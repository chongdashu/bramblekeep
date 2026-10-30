import { describe, expect, it } from "vitest";
import { MAP, PROP_COLLIDERS, canStand, moveOnMap, riverEdge } from "../src/scenes/environment-map";
import { FOREST, TORCHES, forestLayout, blocksCharacterView } from "../src/scenes/environment-forest";
import riverBank from "../src/scenes/river-bank.json";

describe("environment floor plan", () => {
  it("has a clear direct walk from camp across the bridge to the closed castle", () => {
    let [x,z] = [...MAP.camp];
    [x,z] = moveOnMap(x,z,0,-40);
    expect(Math.abs(x)).toBeLessThan(0.01);
    expect(z).toBeGreaterThan(-16.3);
    expect(z).toBeLessThan(-15.4);
    expect(canStand(0,8)).toBe(true);
  });
  it("keeps the new solid props collidable and the main crossing clear", () => {
    expect(PROP_COLLIDERS.length).toBeGreaterThan(5);
    for (const p of PROP_COLLIDERS) expect(canStand(p.x,p.z), `${p.kind} collision`).toBe(false);
    expect(canStand(-9,-13)).toBe(true); // No disconnected arch blocks the flank.
    expect(moveOnMap(...MAP.camp, 0, -40)[1]).toBeLessThan(-15.4);
  });
  it("blocks visible water outside the bridge, trunks and the closed keep", () => {
    const [lo,hi] = riverEdge(5);
    expect(canStand(5,(lo+hi)/2)).toBe(false);
    expect(moveOnMap(5,hi+2,0,-6)[1]).toBeGreaterThan(hi);
    expect(canStand(MAP.trees[0][0],MAP.trees[0][1])).toBe(false);
    expect(canStand(MAP.castle[0],MAP.castle[1])).toBe(false);
    expect(canStand(8,-18)).toBe(false); // curtain wall
    expect(canStand(-11,-18)).toBe(false); // outer tower
    expect(canStand(8,-15)).toBe(true); // approach remains open
    expect(canStand(MAP.tent[0],MAP.tent[1])).toBe(false);
    expect(canStand(23,0)).toBe(false);
  });
  it("blocks the bank rocks and trees while keeping the bridge clear", () => {
    expect(riverBank.rocks).toHaveLength(8);
    expect(riverBank.trees).toHaveLength(4);
    for (const {x,z} of [...riverBank.rocks,...riverBank.trees]) expect(canStand(x,z)).toBe(false);
    expect(canStand(0,8)).toBe(true);
    expect(moveOnMap(...MAP.camp,0,-40)[1]).toBeLessThan(-15.4);
  });
  it("keeps noise-placed woodland repeatable, bounded and collidable", () => {
    expect(forestLayout()).toEqual(FOREST);
    expect(FOREST.near.length).toBeGreaterThan(3);
    expect(FOREST.near.length).toBeLessThanOrEqual(24);
    expect(FOREST.distant.length).toBeGreaterThan(30);
    expect(FOREST.distant.length).toBeLessThanOrEqual(145);
    expect(FOREST.distant.filter(t => t.z > 31 && Math.abs(t.x) < 31).length).toBeGreaterThanOrEqual(40);
    for (const t of FOREST.near) expect(canStand(t.x,t.z)).toBe(false);
    for (const [x,z] of TORCHES) expect(canStand(x,z)).toBe(false);
    expect(FOREST.distant.every(t => Math.abs(t.x)>25 || t.z < -49 || t.z > 31)).toBe(true);
  });
  it("encloses a broad castle courtyard with solid side and rear walls", () => {
    expect(canStand(0,-25)).toBe(true);
    expect(canStand(8,-27)).toBe(true);
    expect(canStand(8,-30)).toBe(false); // barracks body
    expect(canStand(11,-30)).toBe(false);
    expect(canStand(0,-40)).toBe(false);
    expect(canStand(0,-34)).toBe(true); // no phantom second keep
  });
  it("only hides a tree when it crosses the camera-to-character sightline", () => {
    expect(blocksCharacterView({x:0,z:5,scale:1,yaw:0},0,10,0,0)).toBe(true);
    expect(blocksCharacterView({x:5,z:5,scale:1,yaw:0},0,10,0,0)).toBe(false);
    expect(blocksCharacterView({x:0,z:-5,scale:1,yaw:0},0,10,0,0)).toBe(false);
  });
});
