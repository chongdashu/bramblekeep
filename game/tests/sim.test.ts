// This game's ABI mirror (src/sim-abi.ts) against its built module (public/wasm/sim.wasm,
// from `npm run wasm`), driven through the same exports the page uses. The engine's own
// tests/abi.test.ts already checks versions, strides and the lifecycle for whichever game is
// active; tests here are about this game's rules. Grow them with your rules (the Rust tests
// in crate/ cover the rules themselves; these prove the page reads them right).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EVENT_FLOATS, Sim } from "@engine/wasm";
import { ABI, EV, ST, STATE, type GameExports } from "../src/sim-abi";

const WASM = new URL("../public/wasm/sim.wasm", import.meta.url);

async function load(seed = 1): Promise<Sim<GameExports>> {
  const { instance } = await WebAssembly.instantiate(readFileSync(WASM), {});
  const sim = new Sim<GameExports>(instance, ABI);
  sim.x.sim_init(seed);
  sim.verifyAbi();
  return sim;
}

describe.skipIf(!existsSync(WASM))("this game's sim.wasm (run `npm run wasm` first)", () => {
  it("lets optional allies join, leave, and advance the shared objective", async () => {
    const sim = await load(); sim.x.sim_round_start();
    sim.x.sim_set_allies(9);
    expect(sim.f32("stats")[ST.allies]).toBe(3);
    sim.x.sim_set_allies(1);
    const startZ = sim.f32("stats")[ST.ally0z];
    for (let f = 0; f < 900; f++) sim.x.sim_advance(1 / 60);
    const state = sim.f32("stats");
    expect(state[ST.ally0z]).not.toBe(startZ);
    expect(state[ST.remaining]).toBe(0); expect(state[ST.gateOpen]).toBe(1); expect(state[ST.cleared]).toBe(1);
    sim.x.sim_set_allies(0); expect(sim.f32("stats")[ST.allies]).toBe(0);
    sim.x.sim_set_allies(1); expect(sim.f32("stats")[ST.ally0z]).toBeCloseTo(-8);
  });
  it("starts a round on GO, keeps its time, and freezes it while paused", async () => {
    const sim = await load();
    expect(sim.f32("stats")[ST.state]).toBe(STATE.ready);
    sim.x.sim_round_start();
    const ev = sim.f32("events");
    expect(ev.length).toBe(EVENT_FLOATS);
    expect(ev[0]).toBe(EV.roundStart);
    sim.x.sim_clear_frame();
    for (let f = 0; f < 60; f++) sim.x.sim_advance(1 / 60);
    let st = sim.f32("stats");
    expect(st[ST.state]).toBe(STATE.playing);
    expect(st[ST.roundTime]).toBeCloseTo(1, 4);
    sim.x.sim_set_paused(1);
    for (let f = 0; f < 60; f++) sim.x.sim_advance(1 / 60);
    st = sim.f32("stats");
    expect(st[ST.paused]).toBe(1);
    expect(st[ST.roundTime]).toBeCloseTo(1, 4);
  });
});
