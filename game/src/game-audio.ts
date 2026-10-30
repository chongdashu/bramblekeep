import assaultRoutes from "./scenes/assault-routes.json";
import type { AudioBus } from "@engine/audio";
import type { Phase } from "@engine/game";
import type { CombatAudioEvent } from "./combat-audio-events";

const effects = {
  grass: { file:"footstep_grass.mp3", gain:1.6 },
  gravel: { file:"footstep_gravel.mp3", gain:0.75 },
  wood: { file:"footstep_wood.mp3", gain:0.9 },
  sword: { file:"sword.mp3", gain:0.18 },
  magic: { file:"magic.mp3", gain:0.28 },
  bow: { file:"bow.mp3", gain:0.15 },
  hit: { file:"hit.mp3", gain:1.0 },
  enemyDefeat: { file:"enemy_defeat.mp3", gain:0.35 },
  playerHurt: { file:"player_hurt.mp3", gain:0.65 },
  respawn: { file:"respawn.mp3", gain:0.24 },
  gateBreach: { file:"gate_open.mp3", gain:0.7 },
  gateImpact: { file:"gate_impact.mp3", gain:0.8 },
  gateClose: { file:"gate_close.mp3", gain:0.7 },
  enemyAttack: { file:"enemy_attack.mp3", gain:0.32 },
  leverHit: { file:"lever_hit.mp3", gain:0.8 },
  leverDown: { file:"lever_down.mp3", gain:0.6 },
  heartHit: { file:"heart_hit.mp3", gain:0.38 },
  coreClear: { file:"core_clear.mp3", gain:0.25 },
  orbImpact: { file:"orb_impact.mp3", gain:0.65 },
  stream: { file:"ambience_stream.mp3", gain:0.24 },
  fire: { file:"ambience_fire.mp3", gain:1.0 },
  menuHover: { file:"menu_hover.mp3", gain:0.35 },
  menuPress: { file:"menu_press.mp3", gain:0.45 },
  menuBack: { file:"menu_back.mp3", gain:0.4 },
  menuOpen: { file:"menu_open.mp3", gain:0.35 },
} as const;
type Effect = keyof typeof effects;
const attackCutoff: Partial<Record<Effect, number>> = { sword:1700, magic:2200, bow:1800, enemyAttack:2200, leverHit:2200, heartHit:800, orbImpact:2200 };
// The Bramble Boss is hit several times a second: a quieter, darker thump with a softer onset,
// spaced a little further apart, so it never turns into a stream of sharp clicks.
const attackRetrigger: Partial<Record<Effect, number>> = { heartHit:.18 };
const attackSounds = new Set<Effect>(['sword','magic','bow','hit','enemyAttack','leverHit','heartHit','orbImpact']);
export type GameCue = "enemyDefeat" | "playerHurt" | "respawn" | "gateBreach" | "gateImpact" | "gateClose" | "enemyAttack" | "leverHit" | "leverDown" | "heartHit" | "coreClear" | "orbImpact";
type Ambient = "stream" | "fire";
export type FootSurface = "grass" | "gravel" | "wood";

/** The environment scene's authored crossing and path footprints, in world metres. */
export function environmentFootSurface(x: number, z: number): FootSurface {
  if ([0, -7.2, 7.2].some(cx => Math.abs(x-cx) < (cx === 0 ? 1.46 : 1.25)) && Math.abs(z-(8-.8*Math.sin(x*.16))) < 2.3) return "wood";
  if (Math.abs(x) < 1.3 && ((z >= 10.3 && z <= 26) || (z >= -15.7 && z <= 5.7))) return "gravel";
  for (const side of [-1, 1]) {
    const points = assaultRoutes.flank;
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i], [bx, bz] = points[i + 1];
      const dx = side * (bx - ax), dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - side * ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(x - (side * ax + t * dx), z - (az + t * dz)) < 1.1) return "gravel";
    }
  }
  return "grass";
}
/** The combat gym's straight central path. */
export function combatFootSurface(x: number, z: number): FootSurface {
  return Math.abs(x) < 1.5 && z >= -9.5 && z <= 10.5 ? "gravel" : "grass";
}

/** Game-owned samples; Web Audio output remains under the engine's SFX/mute bus. */
export class GameAudio {
  private buffers = new Map<Effect, AudioBuffer>();
  private prepared = false;
  private gameplayPreloaded = false;
  private previous: [number, number] | null = null;
  private stepDistance = 0;
  private playing = false;
  private lastPhase: Phase | null = null;
  private selectedTrack: string | null;
  private count = Object.fromEntries(Object.keys(effects).map(name => [name, 0])) as Record<Effect, number>;
  private lastAttackSound = new Map<Effect, number>();
  private loops = new Map<Ambient, { source: AudioBufferSourceNode; gain: GainNode }>();
  constructor(private readonly bus: AudioBus, track: string | null = "exploration") { this.selectedTrack = track; }

  /** Change the scene's music without interrupting pause or replay. */
  setTrack(track: string | null) {
    if (track === this.selectedTrack) return;
    this.selectedTrack = track;
    if (this.playing) this.bus.playMusic(track);
  }

  /** Optional samples load in the background; missing audio never blocks play. */
  prepare() {
    const ctx = this.bus.ctx;
    if (!ctx) return;
    this.prepared = true;
    this.bus.ui.hover = () => this.play("menuHover");
    this.bus.ui.press = () => this.play("menuPress");
    this.bus.ui.back = () => this.play("menuBack");
    this.bus.ui.whoosh = () => this.play("menuOpen");
    for (const name of ["menuHover", "menuPress", "menuBack", "menuOpen"] as const) this.loadEffect(name, ctx);
  }
  private loadEffect(name: Effect, ctx: AudioContext) {
    void fetch(new URL(`assets/audio/${effects[name].file}`, document.baseURI))
      .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer(); })
      .then(bytes => ctx.decodeAudioData(bytes))
      .then(buffer => { this.buffers.set(name, buffer); })
      .catch(() => console.warn(`[game audio] could not load ${name}`));
  }
  /** Start optional world sounds after the title is visible, or immediately for direct play. */
  private preloadGameplay() {
    const ctx = this.bus.ctx;
    if (!this.prepared || this.gameplayPreloaded || !ctx) return;
    this.gameplayPreloaded = true;
    for (const name of Object.keys(effects) as Effect[]) if (!name.startsWith("menu")) this.loadEffect(name, ctx);
  }
  /** Keep music in sync with game state, including pause, quit and replay. */
  frame(phase: Phase, dt: number, x: number, z: number, sprint: boolean, surface: FootSurface = "grass", ambience = false) {
    const playing = phase === "playing";
    if (phase === "menu" || playing) this.preloadGameplay();
    if (phase !== this.lastPhase) {
      this.lastPhase = phase; this.playing = playing;
      this.bus.playMusic(playing ? this.selectedTrack : phase === "menu" ? "menuTheme" : null);
    }
    if (!playing || dt <= 0 || !ambience) this.stopAmbience();
    else this.updateAmbience(x, z);
    if (!playing || dt <= 0) { this.previous = null; this.stepDistance = 0; return; }
    const prev = this.previous; this.previous = [x,z];
    if (!prev) return;
    const distance = Math.hypot(x-prev[0],z-prev[1]);
    if (distance > 2) { this.stepDistance = 0; return; } // no footsteps on reset/teleport
    this.stepDistance += distance;
    const interval = sprint ? 1.18 : 0.75;
    if (this.stepDistance >= interval) {
      this.stepDistance %= interval;
      this.play(surface);
    }
  }
  private stopAmbience() {
    for (const {source, gain} of this.loops.values()) { source.stop(); source.disconnect(); gain.disconnect(); }
    this.loops.clear();
  }
  private updateAmbience(x: number, z: number) {
    const ctx = this.bus.ctx, out = this.bus.sfxIn;
    if (!ctx || !out || this.bus.now < 0) return;
    const distances: Record<Ambient, number> = {
      stream: Math.abs(z - (8 - 0.8 * Math.sin(x * 0.16))),
      fire: Math.hypot(x - 3.5, z - 20),
    };
    for (const name of ["stream", "fire"] as const) {
      let loop = this.loops.get(name);
      const buffer = this.buffers.get(name);
      if (!loop && buffer) {
        const source = ctx.createBufferSource(), gain = ctx.createGain();
        source.buffer = buffer; source.loop = true; gain.gain.value = 0;
        source.connect(gain); gain.connect(out); source.start();
        loop = {source, gain}; this.loops.set(name, loop);
      }
      if (loop) loop.gain.gain.setTargetAtTime(effects[name].gain * Math.max(0, 1 - distances[name] / (name === "stream" ? 10 : 8)), ctx.currentTime, 0.35);
    }
  }
  cue(name: GameCue) { this.play(name); }
  combat(events: readonly CombatAudioEvent[], listenerX: number, listenerZ: number) {
    // Prefer the nearest impact when several of the same kind arrive together.
    const ordered = [...events].sort((a,b)=>Math.hypot(a.x-listenerX,a.z-listenerZ)-Math.hypot(b.x-listenerX,b.z-listenerZ));
    for (const event of ordered) {
      if (event.cue === 'gateClose') this.cue('gateClose');
      else this.cueAt(event.cue, event.x, event.z, listenerX, listenerZ);
    }
  }
  /** Local world sounds fade with distance; global gate and victory cues use cue(). */
  cueAt(name: GameCue | "hit", x: number, z: number, listenerX: number, listenerZ: number) {
    this.play(name, this.distanceGain(x,z,listenerX,listenerZ));
  }
  attackAt(classId: number, x: number, z: number, listenerX: number, listenerZ: number) {
    this.play(classId === 1 ? "magic" : classId === 2 ? "bow" : "sword", this.distanceGain(x,z,listenerX,listenerZ));
  }
  private distanceGain(x: number, z: number, listenerX: number, listenerZ: number) {
    return Math.max(0, Math.min(1, (20 - Math.hypot(x-listenerX,z-listenerZ)) / 16));
  }
  attack(classId: number) { this.play(classId === 1 ? "magic" : classId === 2 ? "bow" : "sword"); }
  impact() { this.play("hit"); }
  private play(name: Effect, scale = 1) {
    const ctx=this.bus.ctx, out=this.bus.sfxIn, buffer=this.buffers.get(name);
    if (!ctx || !out || !buffer || this.bus.now < 0 || scale <= 0) return false;
    if (this.bus.silent) return true;
    const last = this.lastAttackSound.get(name);
    if (attackSounds.has(name) && last !== undefined && ctx.currentTime >= last && ctx.currentTime - last < (attackRetrigger[name] ?? .12)) return true;
    if (attackSounds.has(name)) this.lastAttackSound.set(name,ctx.currentTime);
    const source=ctx.createBufferSource(), gain=ctx.createGain();
    source.buffer=buffer;
    const footstep = name === "grass" || name === "gravel" || name === "wood";
    let filter: BiquadFilterNode | null = null;
    if (footstep || name === "hit" || attackCutoff[name] !== undefined) {
      // A short fade and low-pass soften footsteps and attack transients.
      filter = ctx.createBiquadFilter(); filter.type = "lowpass";
      filter.frequency.value = name === "hit" ? 1200 : name === "wood" ? 1300 : name === "gravel" ? 700 : name === "grass" ? 1700 : attackCutoff[name]!;
      if (name === "gravel") filter.Q.value = 0.55;
      source.connect(filter).connect(gain);
      gain.gain.setValueAtTime(0,ctx.currentTime);
      gain.gain.linearRampToValueAtTime(effects[name].gain * scale,ctx.currentTime+(name === "hit" ? 0.012 : name === "gravel" || name === "heartHit" ? 0.035 : footstep ? 0.015 : 0.02));
    } else { source.connect(gain); gain.gain.value=effects[name].gain * scale; }
    gain.connect(out); source.start();
    source.onended=() => { source.disconnect(); filter?.disconnect(); gain.disconnect(); };
    this.count[name]++;
    return true;
  }
  status() { return { loaded: this.buffers.size, music: this.bus.music?.playing ?? null, counts: { ...this.count }, unlocked:this.bus.unlocked, muted:this.bus.silent, ambience: [...this.loops.keys()] }; }
}
