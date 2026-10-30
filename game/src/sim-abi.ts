// Mirror of this game's Rust ABI (crate/src/{world,params,lib}.rs). Keep in sync: the
// version, strides, indices, event kinds and param ids are the contract. The engine's loader
// checks SIM_ABI_VERSION and every stride at boot, so a stale public/wasm/sim.wasm fails
// loudly instead of rendering garbage. When you change the Rust side, change this file too
// and bump both versions.
import type { ParamDef } from "@engine/game";
import type { SimExports, SimLayout } from "@engine/wasm";

/** Must equal `world::ABI_VERSION` (exported as `sim_abi_version()`). */
export const SIM_ABI_VERSION = 5;

/** This game's output buffers: name → floats per record (`buf_<name>_stride()`). The engine adds `events`. */
export const STRIDES = {
  stats: 39,
} as const;

/** What the engine checks at boot (GameModule.abi). */
export const ABI: SimLayout = { version: SIM_ABI_VERSION, strides: STRIDES };

/**
 * This game's exports on top of the engine's (crate/src/lib.rs). None yet; add yours here as
 * you export them, e.g. `sim_set_input(moveX: number, moveZ: number): void;`.
 */
export type GameExports = SimExports & { sim_set_input(x: number, z: number, attack: number): void; sim_set_allies(count: number): void; sim_set_class(classId: number): void };

/** Stats record (`STATS_FLOATS` in world.rs). */
export const ST = { time: 0, roundTime: 1, state: 2, paused: 3, round: 4, steps: 5, x: 6, z: 7, enemy0: 8, enemy1: 9, enemy2: 10, remaining: 11, cooldown: 12, gateOpen: 13, health: 14, coreHealth: 15, cleared: 16, invulnerable: 17, enemy0x: 18, enemy0z: 19, enemy1x: 20, enemy1z: 21, enemy2x: 22, enemy2z: 23, maxHealth: 24, maxCoreHealth: 25, inputX: 26, inputZ: 27, allies: 28, ally0x: 29, ally0z: 30, ally1x: 31, ally1z: 32, ally2x: 33, ally2z: 34, ally0hp: 35, ally1hp: 36, ally2hp: 37, classId: 38 } as const;

export const STATE = { ready: 0, playing: 1, won: 2, lost: 3 } as const;

/** Event kinds: record = [kind, a, b, c, d, e]. */
export const EV = {
  /** a round number */
  roundStart: 1, swing: 2, hit: 3, playerHit: 4, gateOpen: 5, coreHit: 6, coreClear: 7, respawn: 8,
} as const;

/** DEV tuning sliders: [id, label, min, max, step]; ids match crate/src/params.rs (empty for now). */
export const PARAMS: ParamDef[] = [
  [0, "Move speed", 1, 8, 0.1], [1, "Attack reach", 0.5, 4, 0.1],
  [2, "Attack interval", 0.15, 1.5, 0.05], [3, "Minion speed", 0, 4, 0.1],
  [4, "Minion awareness", 1, 8, 0.25], [5, "Minion attack interval", 0.4, 3, 0.1],
  [6, "Ally speed", 0.5, 6, 0.1], [7, "Ally attack interval", 0.4, 3, 0.1],
];
