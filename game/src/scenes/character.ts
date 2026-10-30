import "./character.css";
import type { Game, Phase, RoundState, RoundSummary } from "@engine/game";
import type { Shot } from "@engine/camera";
import type { InputSnapshot } from "@engine/input";
import type { GameRuntime } from "@engine/runtime";
import { loadGlb } from "@engine/gltf/glb";
import { Animator, type Layer } from "@engine/gltf/animator";
import { ModelRenderer, type GpuModel } from "@engine/gpu/model";
import { MESH, hex } from "@engine/gpu/meshes";
import { mat4 } from "@engine/math";
import { loopLayers } from "../loop-layers";
import { IdleVariations, heroIdleLayers } from "../idle-motion";
import { movementFactor, RUN_STRIDE } from "../movement";
import { Weapons, attackPose } from "../weapons";

/** Local-only movement and animation experiments. This does not drive the real game sim. */
export const CHARACTER_LAB_DEFAULTS = {
  speed: 3.4, accel: 12, turn: 36, walkToRun: 2.0, runBlendRange: 1.0,
  walkStride: 1.7, runStride: RUN_STRIDE, blend: 10, actionSpeed: 1.7, actionBlend: 0.16,
  cameraYaw: 180, cameraPitch: 35, cameraWidth: 5.5, cameraHeight: 5.5, cameraFollow: 6, cameraFov: 55,
};
type Settings = typeof CHARACTER_LAB_DEFAULTS;
type Setting = keyof Settings;
const STORAGE = "bramblekeep.character-lab.v3";
const FIELDS: { key: Setting; label: string; min: number; max: number; step: number; unit?: string }[] = [
  {key:"speed",label:"Move speed",min:0.5,max:8,step:0.1,unit:"m/s"},
  {key:"accel",label:"Acceleration",min:1,max:30,step:0.5},
  {key:"turn",label:"Turn response",min:1,max:60,step:0.5},
  {key:"walkToRun",label:"Run starts at",min:0.3,max:5,step:0.1,unit:"m/s"},
  {key:"runBlendRange",label:"Walk/run blend range",min:0.2,max:3,step:0.1,unit:"m/s"},
  {key:"walkStride",label:"Walk stride",min:0.4,max:4,step:0.1,unit:"m/cycle"},
  {key:"runStride",label:"Run stride",min:0.4,max:5,step:0.1,unit:"m/cycle"},
  {key:"blend",label:"Blend response",min:1,max:25,step:0.5},
  {key:"actionSpeed",label:"Attack / jump playback",min:0.3,max:4,step:0.1,unit:"×"},
  {key:"actionBlend",label:"Action fade",min:0.02,max:0.5,step:0.01,unit:"s"},
  {key:"cameraYaw",label:"Camera angle",min:-180,max:180,step:1,unit:"°"},
  {key:"cameraPitch",label:"Camera tilt",min:35,max:80,step:1,unit:"°"},
  {key:"cameraWidth",label:"Portrait width",min:5,max:18,step:0.5,unit:"m"},
  {key:"cameraHeight",label:"Landscape height",min:5,max:18,step:0.5,unit:"m"},
  {key:"cameraFollow",label:"Camera follow",min:1,max:18,step:0.5},
  {key:"cameraFov",label:"Field of view",min:25,max:65,step:1,unit:"°"},
];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, v: number) => { const t=clamp((v-a)/(b-a),0,1); return t*t*(3-2*t); };
const blendFactor = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const color = { ground: hex(0x98aa94), floor: hex(0xc8cdb7), edge: hex(0x7d9781), obstacle: hex(0xa1937c), marker: hex(0xcf927d) };

function loadSettings(): Settings {
  const values = { ...CHARACTER_LAB_DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "{}");
    for (const f of FIELDS) if (typeof saved[f.key] === "number" && Number.isFinite(saved[f.key])) values[f.key] = clamp(saved[f.key], f.min, f.max);
  } catch { /* Ignore unavailable or malformed local preferences. */ }
  return values;
}

export class CharacterLab implements Game {
  private idleVariations=new IdleVariations();
  bounds: [number, number, number, number] = [-2000,-2000,2000,2000];
  private rt!: GameRuntime;
  private renderer!: ModelRenderer;
  private equipment!: Weapons;
  private model!: GpuModel;
  private animator!: Animator;
  private characters: { name: string; model: GpuModel; animator: Animator }[] = [];
  private characterIndex = 0;
  private root = mat4.identity();
  private panel!: HTMLElement;
  private settings = loadSettings();
  private x=0; private z=0; private vx=0; private vz=0; private yaw=0;
  private mx=0; private mz=0; private gait=0; private loco=0; private runWeight=0; private idleTime=0;
  private sprinting=false;
  private action: "attack" | "jump" | null = null;
  private actionTime=0; private pendingAction: "attack" | "jump" | null = null;
  private lastMoved=0; private panelOn=false;

  async load(rt: GameRuntime, progress: (p: number, label?: string) => void) {
    this.rt = rt;
    rt.renderer.ground.color = color.ground;
    progress(0.1, "Loading the characters…");
    const specs = [["Knight", "hero-knight-grip.glb"], ["Spellcaster", "hero-spellcaster-grip.glb"], ["Scout", "hero-scout-grip.glb"]] as const;
    const docs = await Promise.all(specs.map(([, file]) => loadGlb(new URL(`assets/characters/${file}`, document.baseURI).href)));
    this.renderer = new ModelRenderer(rt.renderer);
    this.characters = docs.map((doc, i) => {
      if (!doc.skins.length) throw new Error(`${specs[i][0]} GLB has no skinned rig`);
      const animator = new Animator(doc,0,"Spine01");
      const missing = ["idle", "walk", "run", "jump"].filter(c => !animator.clipNames.includes(c));
      if (missing.length) throw new Error(`${specs[i][0]} is missing clips: ${missing.join(", ")}`);
      return { name: specs[i][0], model: this.renderer.upload(doc), animator };
    });
    this.equipment = new Weapons(this.renderer); await this.equipment.load();
    this.characters.forEach(c => this.equipment.calibrate(c.animator));
    this.model = this.characters[0].model; this.animator = this.characters[0].animator;
    rt.renderer.sceneHooks.push(() => this.renderer.draw());
    this.createPanel(); this.applyCamera();
    Object.assign(rt.hooks, { characterLab: () => ({ ...this.stats(), model: this.characters[this.characterIndex].name, hasAttack: true, clip: this.action ?? (this.runWeight > 0.5 ? "run" : this.loco > 0.1 ? "walk" : "idle"), settings: { ...this.settings } }) });
    progress(1, "Character lab ready");
  }

  private createPanel() {
    const host = document.createElement("aside"); host.id = "character-lab"; host.className = "character-lab"; host.hidden = true;
    host.innerHTML = `<div class="character-lab-bar"><button type="button" class="character-lab-toggle" aria-expanded="false">Character tuning</button><button type="button" class="character-lab-jump">Jump</button><a href="./" class="character-lab-exit">Menu</a></div><section class="character-lab-panel" hidden><div class="character-lab-heading"><strong>Character test</strong><button type="button" class="character-lab-reset">Reset pose</button><button type="button" class="character-lab-defaults">Defaults</button></div><p>Walk with WASD or the stick; hold Shift or Run to run. Space / Attack previews the equipped action; J / Jump previews a jump clip. This scene uses local test movement.</p><label>Character <select class="character-lab-model" aria-label="Character model"><option>Knight</option><option>Spellcaster</option><option>Scout</option></select></label><p class="character-lab-model-note">Each character has a weapon and a class-specific attack preview.</p><div class="character-lab-fields">${FIELDS.map(f=>`<label><span>${f.label}</span><output data-value="${f.key}"></output><input type="range" data-field="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${this.settings[f.key]}"></label>`).join("")}</div><p class="character-lab-foot">Stride and animation timing are estimates; check foot contact and clipping before accepting them.</p></section>`;
    host.addEventListener("pointerdown", e => e.stopPropagation());
    document.body.append(host); this.panel = host;
    const panel = host.querySelector<HTMLElement>(".character-lab-panel")!;
    const toggle = host.querySelector<HTMLButtonElement>(".character-lab-toggle")!;
    toggle.addEventListener("click", () => { this.panelOn = !this.panelOn; panel.hidden = !this.panelOn; toggle.setAttribute("aria-expanded", String(this.panelOn)); });
    host.querySelector<HTMLSelectElement>(".character-lab-model")!.addEventListener("change", e => {
      this.characterIndex = (e.currentTarget as HTMLSelectElement).selectedIndex;
      const character = this.characters[this.characterIndex]; this.model = character.model; this.animator = character.animator;
      this.action = null; this.pendingAction = null; this.actionTime = 0;
    });
    host.querySelector<HTMLButtonElement>(".character-lab-jump")!.addEventListener("click", () => { this.pendingAction = "jump"; });
    host.querySelector<HTMLButtonElement>(".character-lab-reset")!.addEventListener("click", () => this.resetScene());
    for (const f of FIELDS) {
      const input = host.querySelector<HTMLInputElement>(`[data-field="${f.key}"]`)!;
      input.addEventListener("input", () => { this.settings[f.key] = clamp(Number(input.value), f.min, f.max); this.refreshPanel(); this.applyCamera(); this.saveSettings(); });
    }
    host.querySelector<HTMLButtonElement>(".character-lab-defaults")!.addEventListener("click", () => {
      this.settings = { ...CHARACTER_LAB_DEFAULTS }; this.refreshPanel(); this.applyCamera(); this.saveSettings();
    });
    this.refreshPanel();
  }
  private saveSettings() { try { localStorage.setItem(STORAGE, JSON.stringify(this.settings)); } catch { /* still usable without storage */ } }
  private refreshPanel() {
    for (const f of FIELDS) {
      const input = this.panel.querySelector<HTMLInputElement>(`[data-field="${f.key}"]`)!;
      const value = this.settings[f.key]; input.value = String(value);
      this.panel.querySelector<HTMLOutputElement>(`[data-value="${f.key}"]`)!.value = `${value.toFixed(f.step < 0.1 ? 2 : f.step < 1 ? 1 : 0)}${f.unit ? ` ${f.unit}` : ""}`;
    }
  }
  private applyCamera() {
    if (!this.rt) return;
    const rig = this.rt.camera.rig;
    rig.yaw = this.settings.cameraYaw * Math.PI / 180;
    rig.pitch = this.settings.cameraPitch * Math.PI / 180; rig.fovY = this.settings.cameraFov * Math.PI / 180;
    rig.portraitWidth = this.settings.cameraWidth; rig.landscapeHeight = this.settings.cameraHeight; rig.follow = this.settings.cameraFollow;
  }
  private resetScene() {
    this.rt.resetRound(); this.startRound();
    const aspect=this.rt.canvas.clientWidth / Math.max(1,this.rt.canvas.clientHeight);
    this.rt.camera.snap(0,0,aspect,this.bounds);
  }
  skipCountdown() { return true; }
  reset() { this.idleVariations.clear(); this.x=this.z=this.vx=this.vz=this.mx=this.mz=this.yaw=this.gait=this.loco=this.runWeight=this.idleTime=this.lastMoved=0; this.action=null; this.pendingAction=null; this.actionTime=0; this.sprinting=false; }
  startRound() { this.rt.sim.x.sim_round_start(); }
  round(): RoundState { return "playing"; }
  input(snap: InputSnapshot) {
    this.sprinting = snap.held.has("sprint");
    const basis = this.rt.camera.groundBasis();
    this.mx = basis.right[0] * snap.moveX - basis.up[0] * snap.moveY;
    this.mz = basis.right[1] * snap.moveX - basis.up[1] * snap.moveY;
    if (snap.pressed.has("attack")) this.pendingAction = "attack";
    if (snap.pressed.has("jump")) this.pendingAction = "jump";
    if (snap.pressed.has("reset")) { this.resetScene(); return; }
  }
  event() {}
  frame(dt: number, _snap: InputSnapshot, phase: Phase): [number, number] {
    if (this.panel) this.panel.hidden = phase !== "playing";
    if (phase !== "playing" || dt <= 0) return [this.x,this.z];
    if (this.pendingAction) { this.action = this.pendingAction; this.pendingAction = null; this.actionTime=0; }
    const s = this.settings;
    const magnitude = Math.min(1, Math.hypot(this.mx,this.mz));
    const rate = blendFactor(s.accel, dt);
    // Acceleration changes speed, while steering immediately follows the input.
    // Interpolating X/Z independently makes the character carve a wide arc.
    const currentSpeed = Math.hypot(this.vx, this.vz);
    const nextSpeed = currentSpeed + (magnitude * s.speed * movementFactor(this.sprinting) - currentSpeed) * rate;
    if (magnitude > 0.05) {
      const length = Math.hypot(this.mx, this.mz);
      this.vx = this.mx / length * nextSpeed; this.vz = this.mz / length * nextSpeed;
    } else if (currentSpeed > 0.001) {
      this.vx = this.vx / currentSpeed * nextSpeed; this.vz = this.vz / currentSpeed * nextSpeed;
    } else { this.vx = 0; this.vz = 0; }
    const ox=this.x, oz=this.z;
    this.x=clamp(this.x+this.vx*dt,-10.8,10.8); this.z=clamp(this.z+this.vz*dt,-10.8,10.8);
    const displacement=Math.hypot(this.x-ox,this.z-oz);
    this.lastMoved=dt > 0 ? displacement/dt : 0;
    if (magnitude > 0.05) { const want=Math.atan2(this.mx,this.mz); const diff=Math.atan2(Math.sin(want-this.yaw),Math.cos(want-this.yaw)); this.yaw += diff*blendFactor(s.turn,dt); }
    this.idleVariations.update(String(this.characterIndex),dt,this.lastMoved<.05 && !this.action);
    const targetLoco=smooth(0.05,0.4,this.lastMoved);
    const targetRun=smooth(s.walkToRun,s.walkToRun+s.runBlendRange,this.lastMoved);
    this.loco+=(targetLoco-this.loco)*blendFactor(s.blend,dt); this.runWeight+=(targetRun-this.runWeight)*blendFactor(s.blend,dt);
    const stride=s.walkStride*(1-this.runWeight)+s.runStride*this.runWeight;
    if (displacement > 0) this.gait=(this.gait+displacement/stride)%1;
    this.idleTime+=dt;
    if (this.action) { this.actionTime+=dt*s.actionSpeed; if (this.actionTime>=(this.action === "attack" ? 0.58 : this.animator.clipDuration(this.action))) { this.action=null; this.actionTime=0; } }
    const status=document.querySelector<HTMLElement>("#gym-status"); if (status) status.textContent=`${this.action ?? (this.runWeight > 0.5 ? "Run" : this.loco > 0.1 ? "Walk" : "Idle")} · ${this.lastMoved.toFixed(1)} m/s`;
    return [this.x,this.z];
  }
  draw() {
    const b=this.rt.batches;
    b[MESH.box].push(0,-0.04,0,0,0,0,21.5,0.08,21.5,color.floor,0.8);
    for (const z of [-8,-4,0,4,8]) for (const x of [-8,-4,0,4,8]) b[MESH.box].push(x,0.01,z,0,0,0,0.10,0.03,0.10,color.edge,0.7);
    // A few low simple visual markers make motion easier to judge without clutter.
    for (const [x,z] of [[-6,-6],[6,-6],[-6,6],[6,6]]) b[MESH.box].push(x,0.35,z,0,0,0,0.5,0.7,0.5,color.obstacle,0.8);
    b[MESH.sphere].push(0,0.3,5,0,0,0,0.35,0.35,0.35,color.marker,0.6);
    mat4.compose(this.root,0,this.x,0,this.z,this.yaw,0,0,1,1,1);
    const layers: Layer[] = heroIdleLayers();
    if (this.loco>0.001) layers.push(...loopLayers("walk", this.gait, this.animator.clipDuration("walk"), this.loco));
    if (this.runWeight>0.001) layers.push(...loopLayers("run", this.gait, this.animator.clipDuration("run"), this.runWeight*this.loco));
    if (this.action === "jump") {
      const duration=this.animator.clipDuration(this.action), fade=this.settings.actionBlend*this.settings.actionSpeed;
      const weight=Math.min(1,this.actionTime/fade,(duration-this.actionTime)/fade);
      layers.push({clip:this.action,time:this.actionTime,weight:Math.max(0,weight),loop:false});
    }
    const age = this.action === "attack" ? this.actionTime : Infinity;
    this.animator.update(layers,this.root,attackPose(this.characterIndex,age) ?? (this.action ? undefined : this.idleVariations.pose(String(this.characterIndex),this.characterIndex))); this.renderer.prepareSkinned(this.model,this.animator);
    this.equipment.draw(this.animator,this.characterIndex,age,this.yaw); this.rt.blob(this.x,this.z,0.45,0.4);
  }
  menuShot(): Shot { return {target:[0,0,0],pitch:0.9,yaw:0,distance:11}; }
  heroShot(): Shot { return {target:[0,0,0],pitch:0.9,yaw:0,distance:11}; }
  summary(): RoundSummary { return {won:false,ribbon:"Character test",title:"Character test",rows:[],note:""}; }
  countdown() {}
  showHud(on: boolean) { const h=document.querySelector<HTMLElement>("#hud"); if (h) h.hidden=!on; const note=document.querySelector<HTMLElement>(".gym-note"); if (note) note.hidden=true; const health=document.querySelector<HTMLElement>("#gym-health")?.closest<HTMLElement>(".pill"); if (health) health.hidden=true; if (this.panel) this.panel.hidden=!on; }
  stats(): Record<string,number> { return {x:this.x,z:this.z,speed:this.lastMoved,locomotion:this.loco,runBlend:this.runWeight,actionTime:this.actionTime}; }
  debugInfo() { return `character lab · x ${this.x.toFixed(2)} z ${this.z.toFixed(2)} · speed ${this.lastMoved.toFixed(2)} · ${this.action ?? "locomotion"}`; }
}
