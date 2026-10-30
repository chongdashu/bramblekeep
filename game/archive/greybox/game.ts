import type { DebugAction, Game, Phase, RoundState, RoundSummary } from "@engine/game";
import type { Shot } from "@engine/camera";
import type { InputSnapshot } from "@engine/input";
import { movementFactor } from "./movement";
import { GameAudio, combatFootSurface } from "./game-audio";
import type { GameRuntime } from "@engine/runtime";
import type { Sim } from "@engine/wasm";
import { PARTICLE } from "@engine/fx";
import { MESH, hex } from "@engine/gpu/meshes";
import { EV, ST, STATE, type GameExports } from "./sim-abi";
import { combatHint } from "./combat-hint";
import { IntegratedArt } from "./integrated-art";
import { installSceneLinks } from "./scene-menu";

const color = { grass: hex(0xa1b99a), path: hex(0xc5ae85), hero: hex(0x3980c4), head: hex(0xf3d1a3), enemy: hex(0xca756f), ally: hex(0x4cb69e), wall: hex(0x596365), gate: hex(0x8d6346), marker: hex(0xf3cf4d), core: hex(0xe8a93e), ready: hex(0xf6bd55), bound: hex(0xf04d78), white: hex(0xfff4d1) };

/** Local greybox: test the camp-to-core loop before committing to multiplayer rules. */
export class StarterGame implements Game {
  bounds: [number, number, number, number] = [-2000, -2000, 2000, 2000];
  private rt!: GameRuntime;
  private sound!: GameAudio;
  private sim!: Sim<GameExports>;
  private art!: IntegratedArt;
  private artDt = 0;
  private showBounds = false;
  private facing = 0;
  private swing = 0;
  private target: number | null = null;
  private targetInRange = false;
  private shotStart: [number, number] = [0, 0];
  private shotEnd: [number, number] | null = null;
  async load(rt: GameRuntime, progress: (p: number, label?: string) => void) {
    this.rt = rt; this.sim = rt.sim as Sim<GameExports>;
    this.sound = new GameAudio(rt.audio); this.sound.prepare();
    Object.assign(rt.hooks, { gameAudio: () => this.sound.status() });
    rt.renderer.ground.color = hex(0x719e51);
    rt.renderer.skyVisible = true;
    this.art = new IntegratedArt(rt);
    progress(0.2, "Loading the camp and characters…");
    await this.art.load();
    installSceneLinks();
    Object.assign(rt.hooks, { integratedArt: () => this.art.status() });
    document.querySelector<HTMLButtonElement>("#gym-class")?.addEventListener("click", () => this.cycleClass());
    document.querySelector<HTMLButtonElement>("#gym-allies")?.addEventListener("click", () => this.cycleAllies());
    progress(1, "Castle approach ready");
  }
  private cycleClass() { this.sim.x.sim_set_class((this.sim.f32("stats")[ST.classId] + 1) % 3); }
  private attackRange() { const id = this.sim.f32("stats")[ST.classId]; return id === 1 ? 6 : id === 2 ? 8 : this.sim.x.sim_param_get(1); }
  private cycleAllies() { this.sim.x.sim_set_allies((this.sim.f32("stats")[ST.allies] + 1) % 4); }
  skipCountdown() { return true; }
  reset() { this.facing = 0; this.swing = 0; this.art?.reset(); }
  startRound() { this.sim.x.sim_round_start(); }
  round(): RoundState { return this.sim.f32("stats")[ST.state] === STATE.playing ? "playing" : "ready"; }
  input(snap: InputSnapshot) {
    if (snap.pressed.has("class")) this.cycleClass();
    if (snap.pressed.has("allies")) this.cycleAllies();
    if (snap.pressed.has("bounds")) this.showBounds = !this.showBounds;
    if (snap.pressed.has("reset")) { this.sim.x.sim_reset(); this.sim.x.sim_round_start(); this.reset(); }
    const { right, up } = this.rt.camera.groundBasis();
    const x = right[0] * snap.moveX - up[0] * snap.moveY;
    const z = right[1] * snap.moveX - up[1] * snap.moveY;
    if (Math.hypot(x, z) > 0.1) this.facing = Math.atan2(x, z);
    const factor = movementFactor(snap.held.has("sprint"));
    this.sim.x.sim_set_input(x*factor, z*factor, snap.held.has("attack") ? 1 : 0);
  }
  event(kind: number, ev: Float32Array, i: number) {
    const x = ev[i + 1], z = ev[i + 2];
    if (kind === EV.swing) {
      this.sound.attack(this.sim.f32("stats")[ST.classId]);
      this.swing = 0.22; this.art.attack(); this.shotStart = [x, z]; this.shotEnd = null;
      const s = this.sim.f32("stats");
      const candidates: [number, number][] = [];
      for (let j = 0; j < 3; j++) if (s[ST.enemy0 + j]) candidates.push([s[ST.enemy0x + j * 2], s[ST.enemy0z + j * 2]]);
      if (!s[ST.remaining] && !s[ST.cleared]) candidates.push([0, 8.5]);
      candidates.sort((a, b) => Math.hypot(a[0] - x, a[1] - z) - Math.hypot(b[0] - x, b[1] - z));
      const target = candidates[0];
      if (target && Math.hypot(target[0] - x, target[1] - z) <= this.attackRange()) this.facing = Math.atan2(target[0] - x, target[1] - z);
    }
    if (kind === EV.hit || kind === EV.coreHit) {
      this.sound.impact();
      if (this.swing > 0 && this.sim.f32("stats")[ST.classId] > 0 && !this.shotEnd) this.shotEnd = [x, z];
      this.rt.particles.spawn({ kind: PARTICLE.ring, x, y: 0.1, z, size: 0.9, life: 0.32, color: color.white, glow: 0.2 });
      this.rt.pops.pop(x, 1.1, z, kind === EV.hit ? "Hit!" : "Core hit!", "good", 0.8);
    }
    if (kind === EV.playerHit) { this.sound.impact(); this.rt.pops.pop(x, 1.8, z, "Ouch!", "bad", 1); }
    if (kind === EV.respawn) this.rt.pops.pop(x, 1.7, z, "Back at camp", "good", 1);
    if (kind === EV.gateOpen) this.rt.pops.pop(x, 2.2, z, "Gate open!", "good", 1.2);
    if (kind === EV.coreClear) this.rt.pops.pop(x, 2.0, z, "Core cleared!", "good", 1.3);
  }
  frame(dt: number, snap: InputSnapshot, phase: Phase): [number, number] {
    const s = this.sim.f32("stats");
    this.sound.frame(phase, dt, s[ST.x], s[ST.z], snap.held.has("sprint"), combatFootSurface(s[ST.x], s[ST.z])); this.swing = Math.max(0, this.swing - dt);
    this.rt.style = { ...this.rt.style, grid: 0, inkPx: this.rt.style.inkPx > 0 ? 0.4 : 0, saturation: 1.1, exposure: 0.94, skyZenith: [0.27, 0.52, 0.86], skyHorizon: [0.47, 0.72, 0.96] };
    this.artDt = dt; this.art.step(dt);
    const objective = document.querySelector<HTMLElement>("#gym-status");
    if (objective) objective.textContent = s[ST.cleared] ? "Core cleared!" : s[ST.gateOpen] ? `Enter gate · core ${s[ST.coreHealth]}/${s[ST.maxCoreHealth]}` : `Clear minions · ${s[ST.remaining]} left`;
    const classButton = document.querySelector<HTMLButtonElement>("#gym-class");
    if (classButton) { const name = ["Knight", "Spellcaster", "Scout"][s[ST.classId]]; classButton.textContent = `Class: ${name}`; classButton.setAttribute("aria-label", `Class: ${name}. Activate to change class`); }
    const allies = document.querySelector<HTMLButtonElement>("#gym-allies");
    if (allies) { allies.textContent = `AI allies: ${s[ST.allies]}`; allies.setAttribute("aria-label", `AI allies: ${s[ST.allies]}. Activate to change count`); }
    const hp = document.querySelector<HTMLElement>("#gym-health");
    if (hp) hp.textContent = `♥ ${s[ST.health]}/${s[ST.maxHealth]}`;
    const guidance = combatHint({
      x: s[ST.x], z: s[ST.z], range: this.attackRange(),
      enemies: [0, 1, 2].map(i => ({ alive: !!s[ST.enemy0 + i], x: s[ST.enemy0x + 2 * i], z: s[ST.enemy0z + 2 * i] })),
      gateOpen: !!s[ST.gateOpen], cleared: !!s[ST.cleared],
      touch: snap.touchActive || matchMedia("(pointer: coarse)").matches,
    });
    this.target = guidance.target; this.targetInRange = guidance.inRange;
    const hint = document.querySelector<HTMLElement>("#gym-objective");
    if (hint) hint.textContent = guidance.text;
    return [s[ST.x], s[ST.z] + 1.5];
  }
  draw() {
    const b = this.rt.batches, s = this.sim.f32("stats");
    b[MESH.box].push(0, 0.02, 0.5, 0, 0, 0, 3.0, 0.04, 20, color.path, 0.8);

    for (const x of [-5.95, 5.95]) b[MESH.box].push(x, 1.2, 6, 0, 0, 0, 4.6, 2.4, 0.6, color.wall, 0.8);
    if (!s[ST.cleared]) {
      b[MESH.box].push(0, 0.25, 8.5, 0, 0, 0, 1.5, 0.5, 1.5, color.wall, 0.8);
      b[MESH.sphere].push(0, 1.0, 8.5, 0, 0, 0, 0.55, 0.55, 0.55, this.targetInRange && this.target === null ? color.ready : color.core, 0.6, 0, 1, 1, 0.3);
    }
    const x = s[ST.x], z = s[ST.z], classId = s[ST.classId];
    this.art.draw(s, this.artDt, classId, this.facing, this.target, this.targetInRange);
    if (this.swing > 0 && classId > 0 && this.shotEnd) {
      const dx = this.shotEnd[0] - this.shotStart[0], dz = this.shotEnd[1] - this.shotStart[1];
      const length = Math.hypot(dx, dz);
      if (classId === 2) this.art.arrow(this.shotStart,this.shotEnd,1-this.swing/0.22);
      else b[MESH.box].push((this.shotStart[0]+this.shotEnd[0])/2, 0.8, (this.shotStart[1]+this.shotEnd[1])/2, Math.atan2(dx,dz), 0, 0, 0.18, 0.18, length, hex(0xd996ff), 0.4, 0, 1, 1, 0.4);
    }
    if (this.swing > 0 && classId === 0) b[MESH.sphere].push(x + Math.sin(this.facing)*0.75, 0.55, z + Math.cos(this.facing)*0.75, 0, 0, 0, 0.2, 0.2, 0.2, color.white, 0.4, 0, 1, 1, 0.3);
    if (this.showBounds) {
      for (const edge of [-7.8, 7.8]) b[MESH.box].push(edge, 0.08, 0, 0, 0, 0, 0.12, 0.15, 19.5, color.bound, 0.6);
      for (const edge of [-9.8, 5.5, 10.5]) b[MESH.box].push(0, 0.08, edge, 0, 0, 0, 15.6, 0.15, 0.12, color.bound, 0.6);
    }
  }
  menuShot(): Shot { return { target: [0, 0, 0], pitch: 0.8, yaw: 0, distance: 16 }; }
  heroShot(): Shot { return { target: [0, 0, -7], pitch: 0.9, yaw: 0, distance: 12 }; }
  summary(): RoundSummary { return { won: false, title: "Greybox", ribbon: "Greybox", rows: [], note: "" }; }
  countdown() {}
  showHud(on: boolean) { const h = document.querySelector<HTMLElement>("#hud"); if (h) h.hidden = !on; }
  stats(): Record<string, number> { const s = this.sim.f32("stats"); return Object.fromEntries(Object.entries(ST).map(([k,i]) => [k,s[i]])); }
  debugActions(): DebugAction[] { return [{ label: "Toggle bounds", run: () => { this.showBounds = !this.showBounds; } }]; }
  debugInfo(): string { const s = this.stats(); return `greybox · x ${s.x.toFixed(1)} z ${s.z.toFixed(1)} · minions ${s.remaining} · health ${s.health} · core ${s.coreHealth}`; }
}
