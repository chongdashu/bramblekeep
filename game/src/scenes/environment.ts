/** Environment lab: deliberately sparse, in-engine study of the selected garden world. */
import type { Game, Phase, RoundState, RoundSummary } from "@engine/game";
import type { Shot } from "@engine/camera";
import type { InputSnapshot } from "@engine/input";
import type { GameRuntime } from "@engine/runtime";
import { loadGlb } from "@engine/gltf/glb";
import { ModelRenderer, type GpuModel } from "@engine/gpu/model";
import { MESH, hex } from "@engine/gpu/meshes";
import { DEFAULT_STYLE, STYLE_RANGES, STYLE_COLORS, type Style, type StyleColor, type StyleNumberKey } from "@engine/gpu/renderer";
import { mat4 } from "@engine/math";
import { Animator, type Layer } from "@engine/gltf/animator";
import { TouchStickView } from "@engine/ui/stick";
import { motion } from "@engine/ui/tween";
import { loopLayers } from "../loop-layers";
import { IdleVariations, heroIdleLayers } from "../idle-motion";
import { movementFactor, WALK_STRIDE, RUN_STRIDE } from "../movement";
import { GameAudio, environmentFootSurface } from "../game-audio";
import { turnToward } from "../turning";
import { Weapons, attackPose } from "../weapons";
import { PARTICLE } from "@engine/fx";
import { drawFlame } from "./fire";
import { overlookHeight } from "./overlook";
import { MAP, moveOnMap } from "./environment-map";
import { FOREST, TORCHES, blocksCharacterView } from "./environment-forest";
import { drawCastleAtmosphere, flagWave } from "./castle-atmosphere";
import { drawBadTreeNests } from "../bad-tree-nests";
import { deathTilt } from "../player-death";
import { terrainHeight } from "./terrain";
import courtyardLayout from "./courtyard-layout.json";
import { environmentLights } from "./environment-lighting";
import { CORE_X, CORE_Z } from "../castle-patrol";
import { HeartTree } from "../heart-tree";
import { BossPreview, type BossPreviewMode } from "../boss-preview";
import { showEnvironmentKitNode } from "./environment-kit-nodes";

const STORAGE = "castle-environment-lab-v7";
type SceneValues = { sunAzimuth: number; sunElevation: number; groundColor: string; keepShade: number; pitch: number; fov: number; viewWidth: number; night: number; fireLight: number; torchLight: number; wind: number; leaves: number; speed: number; clouds: number };
type Saved = { style: Style; scene: SceneValues };
const SCENE_DEFAULT: SceneValues = { sunAzimuth: -60, sunElevation: 32, groundColor: "#668d53", keepShade: 0.42, pitch: 19, fov: 65, viewWidth: 15, night: 1, fireLight: 1, torchLight: 0.9, wind: 0.35, leaves: 0.35, speed: 6, clouds: 0.8 };
const copyStyle = (): Style => ({ ...DEFAULT_STYLE, toon: 0.25, toonSoft: 0.14, inkPx: 0, rim: 0.36, saturation: 1.1, bloom: 0.48, bloomThreshold: 1.05, exposure: 1.0, vignette: 0.06, shadowSoft: 2.1, liquidWave: 0.025, liquidSpeed: 0.7, keyLight: 1.12, ambient: 0.38, contrast: 1.14, warmth: 0.65, haze: 0.7, hazeStart: 40, hazeEnd: 95, grid: 0, shadowTint: [...DEFAULT_STYLE.shadowTint], skyZenith: [0.27, 0.52, 0.86], skyHorizon: [0.47, 0.72, 0.96], groundBounce: [...DEFAULT_STYLE.groundBounce] });
const toHex = (v: readonly number[]) => `#${v.map(c => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, "0")).join("")}`;
const fromHex = (v: string): StyleColor => [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16) / 255) as StyleColor;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export class EnvironmentScene implements Game {
  // A sky-facing camera has a very large ground footprint; generous visual bounds
  // keep the engine camera clamp from pinning the view when the horizon is visible.
  readonly bounds: [number, number, number, number] = [-2000, -2000, 2000, 2000];
  private rt!: GameRuntime;
  protected sound!: GameAudio;
  private modelRenderer!: ModelRenderer;
  private gate!: GpuModel;
  private kit!: GpuModel;
  private keep!: GpuModel;
  private trees: GpuModel[] = [];
  private distantTrees: GpuModel[] = [];
  private camp!: GpuModel;
  private props!: GpuModel;
  private crossing!: GpuModel;
  private routes!: GpuModel;
  private courtyard!: GpuModel;
  private outskirts!: GpuModel;
  private core!: GpuModel;
  private heartPreview?: HeartTree;
  private bossPreview = new BossPreview();
  private terrain!: GpuModel;
  private characters: { name: string; model: GpuModel; animator: Animator; x: number; z: number; yaw: number }[] = [];
  private equipment: Weapons[] = [];
  private attackAge = Infinity;
  private heroIdles = new IdleVariations();
  private selected = 0;
  private possessed = true;
  private cameraMode: "chase" | "free" = "chase";
  private freeX = 0; private freeZ = 19;
  private leafClock = 0;
  private driftingLeaves: { x: number; y: number; z: number; age: number; life: number; phase: number; size: number }[] = [];
  private emberClock = 0;
  private smokeClock = 0;
  private smokeEmitted = 0;
  private embersEmitted = 0;
  private stickView!: TouchStickView;
  private playerX = MAP.camp[0] as number;
  private playerZ = MAP.camp[1] as number;
  private playerYaw = Math.PI;
  private gait = 0; private locomotion = 0; private runWeight = 0; private elapsed = 0;
  private panX = 0; private panZ = 0;
  private keepShadeApplied = -1;
  private groundColorApplied = "";
  private panel!: HTMLElement;
  private controls!: HTMLElement;
  private look: Style = copyStyle();
  private values: SceneValues = { ...SCENE_DEFAULT };
  private x = 0;
  private z = 0;
  private root = mat4.identity();
  private drag: { id: number; x: number; y: number; orbit: boolean } | null = null;
  private yaw = 0;

  async load(rt: GameRuntime, progress: (p: number, label?: string) => void) {
    this.rt = rt;
    this.sound = new GameAudio(rt.audio, this.musicTrack()); this.sound.prepare();
    Object.assign(rt.hooks, { gameAudio: () => this.sound.status() });
    rt.renderer.ground.visible = false; // Blender landscape includes a recessed river channel.
    rt.setPauseOnBlur("none");
    // Cover the playable woodland and tall tree crowns, not only the camera centre.
    rt.renderer.shadowHalf = 40;
    progress(0.2, "Loading garden gate…");
    this.modelRenderer = new ModelRenderer(rt.renderer);
    const [gate, kit, keep, tree, distantTree, knight, spellcaster, scout, camp, props, crossing, routes, terrain, courtyard, core, outskirts] = await Promise.all([
      loadGlb(new URL("assets/environment/gate-kit.glb", document.baseURI).href),
      loadGlb(new URL("assets/environment-lab/environment-kit-no-keep.glb", document.baseURI).href),
      loadGlb(new URL("assets/environment-lab/tripo-keep.glb", document.baseURI).href),
      loadGlb(new URL("assets/environment-lab/tripo-tree.glb", document.baseURI).href),
      loadGlb(new URL("assets/environment-lab/tree-lod.glb", document.baseURI).href),
      loadGlb(new URL("assets/characters/hero-knight-grip.glb", document.baseURI).href),
      loadGlb(new URL("assets/characters/hero-spellcaster-grip.glb", document.baseURI).href),
      loadGlb(new URL("assets/characters/hero-scout-grip.glb", document.baseURI).href),
      loadGlb(new URL("assets/environment-lab/camp-kit.glb", document.baseURI).href),
      loadGlb(new URL("assets/environment-lab/world-props.glb", document.baseURI).href),
      loadGlb(new URL("assets/environment-lab/river-crossing.glb", document.baseURI).href),
      loadGlb(new URL("assets/environment-lab/assault-routes.glb", document.baseURI).href),
      loadGlb(new URL("assets/environment-lab/rolling-meadow.glb", document.baseURI).href),
      loadGlb(new URL("assets/environment-lab/castle-courtyard.glb", document.baseURI).href),
      loadGlb(new URL("assets/environment-lab/castle-core.glb", document.baseURI).href),
      loadGlb(new URL("assets/environment-lab/castle-outskirts.glb", document.baseURI).href),
    ]);
    this.gate = this.modelRenderer.upload(gate);
    this.kit = this.modelRenderer.upload(kit);
    this.keep = this.modelRenderer.upload(keep);
    if (!this.initialPossessed()) {
      const guardian=await loadGlb(new URL("assets/enemies/stump-animated.glb", document.baseURI).href);
      this.heartPreview = new HeartTree(this.modelRenderer,guardian);
    }
    const treeModel = this.modelRenderer.upload(tree);
    this.trees = Array.from({length:MAP.trees.length + FOREST.near.length}, (_, i) => i ? this.modelRenderer.instance(treeModel) : treeModel);
    const distantModel = this.modelRenderer.upload(distantTree);
    this.distantTrees = FOREST.distant.map((_,i) => i ? this.modelRenderer.instance(distantModel) : distantModel);
    this.camp = this.modelRenderer.upload(camp);
    this.props = this.modelRenderer.upload(props);
    this.crossing = this.modelRenderer.upload(crossing);
    this.routes = this.modelRenderer.upload(routes);
    this.courtyard = this.modelRenderer.upload(courtyard);
    this.outskirts = this.modelRenderer.upload(outskirts);
    this.core = this.modelRenderer.upload(core);
    this.terrain = this.modelRenderer.upload(terrain);
    this.characters = [knight, spellcaster, scout].map((doc, i) => {
      const name = ["Knight", "Spellcaster", "Scout"][i];
      if (!doc.skins.length) throw new Error(`${name} has no character rig`);
      const animator = new Animator(doc,0,"Spine01");
      if (["idle", "run"].some(c => !animator.clipNames.includes(c))) throw new Error(`${name} lacks locomotion clips`);
      return { name, model: this.modelRenderer.upload(doc), animator, x: [0,-2.2,2.2][i], z: 22, yaw: Math.PI };
    });
    const weapons = new Weapons(this.modelRenderer); await weapons.load();
    this.equipment = this.characters.map((c,i) => { const w = i ? weapons.instance() : weapons; w.calibrate(c.animator); return w; });
    // The left half of a touch screen owns movement; the right half remains drag-to-pan.
    rt.input.stickZone = (x) => x < rt.canvas.clientWidth * 0.5;
    this.stickView = new TouchStickView();
    // C direction calls for slate stone. The gate has separate stone materials;
    // the Tripo keep has a single packed texture, so its neutral multiplier also
    // darkens roofs. This is a reversible lab comparison, not final texturing.
    this.modelRenderer.recolor(this.gate, new Map([
      ["Stone warm", hex(0x555d61)], ["Stone shade", hex(0x3e464b)], ["Stone trim", hex(0x687175)],
    ]));
    rt.renderer.sceneHooks.push(() => this.modelRenderer.draw());
    this.loadSaved();
    this.possessed = this.initialPossessed();
    this.cameraMode = this.possessed ? "chase" : "free";
    this.mountControls();
    this.mountPan();
    this.apply();
    Object.assign(rt.hooks, { environmentLab: () => ({ ...this.values, style: { ...this.look }, skyCloud: { ...this.rt.renderer.skyCloud }, renderer: this.rt.renderer.backend, corePreview: this.heartPreview ? "heart-tree" : "game-owned", bossPreview: this.heartPreview ? {mode:this.bossPreview.mode,phase:this.bossPreview.guardian.phase,emerge:this.bossPreview.guardian.emerge,health:this.bossPreview.health,windup:this.bossPreview.guardian.windup,attackCue:this.bossPreview.guardian.attackCue} : null, cameraX: this.x, cameraZ: this.z, cameraMode: this.cameraMode, targetX: this.rt.camera.target[0], targetZ: this.rt.camera.target[2], playerX: this.playerX, playerZ: this.playerZ, playerHeight: Math.max(terrainHeight(this.playerX,this.playerZ),overlookHeight(this.playerX,this.playerZ)), selected: this.characters[this.selected].name, possessed: this.possessed, attackActive: this.attackAge < 0.58, characters: this.characters.map(({name,x,z}) => ({name,x,z})), forest: { near: FOREST.near.length, distant: FOREST.distant.length, rear: FOREST.distant.filter(t => t.z > 31 && Math.abs(t.x) < 31).length }, lights: this.rt.renderer.lights.map(({at,intensity}) => ({at,intensity})), treeSway: this.treeSway(0), flagWave: flagWave(this.elapsed,this.values.wind,6), leafCount: this.driftingLeaves.length, embersEmitted: this.embersEmitted, smokeEmitted: this.smokeEmitted, yaw: this.yaw, distance: this.rt.camera.distance, skyInView: this.rt.renderer.skyVisible && this.values.pitch < this.values.fov / 2, assets: ["gate-kit.glb", "environment-kit-no-keep.glb", "tripo-keep.glb", "tripo-tree.glb", "tree-lod.glb", "hero-knight.glb", "hero-spellcaster.glb", "hero-scout.glb", "camp-kit.glb", "world-props.glb", "river-crossing.glb", "rolling-meadow.glb", "assault-routes.glb", "castle-courtyard.glb", "castle-core.glb"] }) });
    progress(1, "Environment lab ready");
  }

  /** Game mode can open its own gate; the test scene stays closed. */
  protected musicTrack(): string | null { return null; }
  /** A game may keep a front-end music state during its own pre-play UI. */
  protected audioPhase(phase: Phase): Phase { return phase; }
  protected initialPossessed(): boolean { return false; }
  protected coreVisible(): boolean { return true; }
  protected playerDeathRemaining(): number { return 0; }
  protected castleBreached(): boolean { return false; }
  protected playablePose() { return { x: this.playerX, z: this.playerZ, yaw: this.playerYaw }; }
  /** Multiplayer scenes supply an authoritative pose and keep the lab's camp cast hidden. */
  protected showCampCompanions(): boolean { return true; }
  /** Reuse already decoded title-scene assets when the multiplayer world warms up. */
  protected characterDocuments() { return this.characters.map(character => character.model.doc); }
  protected weaponDocuments() { return this.equipment[0].documents(); }
  protected setAuthoritativePose(x: number, z: number, yaw: number, dt: number, sprint: boolean) {
    const distance=Math.hypot(x-this.playerX,z-this.playerZ);
    this.playerX=x;this.playerZ=z;this.playerYaw=yaw;
    Object.assign(this.characters[this.selected], {x,z,yaw});
    const moving=dt>0 && distance>0.001 && distance<2;
    const target=moving?1:0;this.locomotion+=(target-this.locomotion)*(1-Math.exp(-10*dt));
    this.runWeight+=((sprint && moving?1:0)-this.runWeight)*(1-Math.exp(-8*dt));
    if(distance<2)this.gait=(this.gait+distance/(WALK_STRIDE*(1-this.runWeight)+RUN_STRIDE*this.runWeight))%1;
  }
  protected animateAuthoritativeAttack() { this.attackAge=0; this.sound.attack(this.selected); }
  protected holdScoutDrawPose() { this.attackAge=.12; }
  protected setWorldNight(night: boolean) { this.values.night=night?1:0; }
  protected setWorldDaylight(night: number, hour: number) { this.values.night=Math.max(0,Math.min(1,night));this.values.sunAzimuth=(hour/24)*360-180;this.values.sunElevation=Math.max(4,Math.sin((hour-6)*Math.PI/12)*42); }

  /** Hand socket from the last rendered pose, with a safe first-frame fallback. */
  protected scoutArrowOrigin() {
    const hand=this.characters[this.selected]?.animator.nodeWorld("L_Hand");
    if(hand && Math.hypot(hand[12]-this.playerX,hand[14]-this.playerZ)<2)
      return { x:hand[12], y:hand[13], z:hand[14] };
    return { x:this.playerX, y:.9, z:this.playerZ };
  }
  protected showNockedArrow(_age:number) { return true; }

  protected playCombatImpact() { this.sound.impact(); }
  protected aimPlayableAt(x: number, z: number) {
    this.playerYaw = Math.atan2(x-this.playerX,z-this.playerZ);
    this.characters[this.selected].yaw = this.playerYaw;
  }

  /** Change class in the playable scene without teleporting back to camp. */
  selectPlayableCharacter(index: number) {
    if (index < 0 || index >= this.characters.length || index === this.selected) return;
    // The previous hero returns to camp instead of overlapping the new one.
    Object.assign(this.characters[this.selected], { x: [-3.8,-2.2,2.2][this.selected], z: 22, yaw: Math.PI });
    this.selected = index;
    Object.assign(this.characters[index], { x: this.playerX, z: this.playerZ, yaw: this.playerYaw });
    this.locomotion = 0;
  }

  skipCountdown() { return true; }
  reset() {
    this.heroIdles.clear();
    this.characters.forEach((c,i) => { c.x = [0,-2.2,2.2][i]; c.z = 22; c.yaw = Math.PI; });
    const c = this.characters[this.selected];
    this.playerX = c?.x ?? MAP.camp[0]; this.playerZ = c?.z ?? MAP.camp[1]; this.playerYaw = Math.PI;
    this.panX = this.panZ = this.gait = this.locomotion = this.runWeight = this.elapsed = 0; this.attackAge = Infinity;
    this.freeX = this.playerX; this.freeZ = this.playerZ - 3;
  }
  startRound() { this.rt.sim.x.sim_round_start(); }
  round(): RoundState { return this.rt.sim.f32("stats")[2] === 1 ? "playing" : "ready"; }
  input(snap: InputSnapshot, dt: number) {
    if (this.rt.phase !== "playing" || dt <= 0) return;
    if (snap.pressed.has("reset")) this.reset();
    if (snap.pressed.has("attack") && this.possessed) { this.attackAge = 0; this.sound.attack(this.selected); }
    const { right, up } = this.rt.camera.groundBasis();
    const dx = right[0] * snap.moveX - up[0] * snap.moveY;
    const dz = right[1] * snap.moveX - up[1] * snap.moveY;
    const magnitude = Math.min(1, Math.hypot(dx, dz));
    const ox = this.playerX, oz = this.playerZ;
    if (magnitude > 0.05 && this.possessed) {
      const speed = this.values.speed * movementFactor(snap.held.has("sprint"));
      [this.playerX, this.playerZ] = moveOnMap(ox, oz, dx * dt * speed, dz * dt * speed, this.castleBreached());
      this.playerYaw = turnToward(this.playerYaw, Math.atan2(dx,dz), dt);
      Object.assign(this.characters[this.selected], { x: this.playerX, z: this.playerZ, yaw: this.playerYaw });
    } else if (magnitude > 0.05) {
      this.shiftView(dx * dt * this.values.speed, dz * dt * this.values.speed);
    }
    const distance=Math.hypot(this.playerX-ox,this.playerZ-oz);
    const target = distance > 0.001 ? 1 : 0;
    this.locomotion += (target - this.locomotion) * (1 - Math.exp(-10*dt));
    const targetRun = snap.held.has("sprint") && target > 0 ? 1 : 0;
    this.runWeight += (targetRun-this.runWeight)*(1-Math.exp(-8*dt));
    this.gait = (this.gait + distance / (WALK_STRIDE*(1-this.runWeight)+RUN_STRIDE*this.runWeight)) % 1;
  }
  event() {}
  private treeSway(i: number) {
    return this.values.wind * (0.07 * Math.sin(this.elapsed * 1.2 + i * 1.7) + 0.025 * Math.sin(this.elapsed * 2.1 + i));
  }
  frame(dt: number, snap: InputSnapshot, phase: Phase): [number, number] {
    this.sound.frame(this.audioPhase(phase), dt, this.playerX, this.playerZ, snap.held.has("sprint"), environmentFootSurface(this.playerX, this.playerZ), true);
    this.elapsed += dt; this.attackAge += dt;
    for(const [i] of this.characters.entries())this.heroIdles.update(String(i),phase === "playing" ? dt : 0, i !== this.selected || !this.possessed || (this.locomotion < .05 && this.attackAge >= .58 && this.playerDeathRemaining() <= 0));
    if (this.heartPreview && phase === "playing") this.bossPreview.step(dt);
    // Leaves fall from nearby trees instead of filling the view with square confetti.
    this.driftingLeaves = this.driftingLeaves.filter(leaf => {
      leaf.age += dt;
      leaf.x += dt * (0.12 + this.values.wind * 0.3);
      leaf.y -= dt * 0.42;
      return leaf.age < leaf.life && leaf.y > 0.08;
    });
    this.leafClock += dt * this.values.leaves * 1.5;
    while (this.leafClock >= 1) {
      this.leafClock -= 1;
      const random = this.rt.particles.random;
      const nearby = [...MAP.trees, ...FOREST.near.map(t => [t.x,t.z] as const)]
        .filter(([x,z]) => Math.hypot(x-this.x,z-this.z) < 22);
      if (!nearby.length || this.driftingLeaves.length >= 16) continue;
      const [x,z] = nearby[Math.floor(random()*nearby.length)];
      this.driftingLeaves.push({ x:x+(random()-0.5)*2, y:2.5+random()*1.5, z:z+(random()-0.5)*2, age:0, life:4+random()*2, phase:random()*Math.PI*2, size:0.12+random()*0.06 });
    }
    // Small rising embers are presentation-only and follow the pause clock.
    this.emberClock += dt * 12;
    while (this.emberClock >= 1) {
      this.emberClock -= 1;
      const random = this.rt.particles.random;
      const sources: readonly (readonly [number, number, number])[] = [[3.5, 20, 0.65], ...TORCHES.map(([x,z]) => [x,z,1.9] as const), [-9.2,-16.9,4.9], [9.2,-16.9,4.9]];
      const [x,z,y] = sources[this.embersEmitted % sources.length];
      this.rt.particles.spawn({ kind: PARTICLE.glow, x: x+(random()-0.5)*0.25, y, z: z+(random()-0.5)*0.25, vx: (random()-0.5)*0.9, vy: 0.55+random()*0.8, vz: (random()-0.5)*0.9, size: 0.025+random()*0.035, life: 0.7+random()*0.8, color: [1,0.32+random()*0.3,0.04], glow: 0.9, gravity: 0.25, alpha: 0.85 });
      this.embersEmitted++;
    }
    // Pale, translucent smoke rises and drifts with the wind; a low emission
    // rate keeps each fire readable without filling the scene with haze.
    this.smokeClock += dt * 12;
    while (this.smokeClock >= 1) {
      this.smokeClock -= 1;
      const random = this.rt.particles.random;
      const sources: readonly (readonly [number,number,number])[] = [[3.5,20,1], [3.5,20,1], [3.5,20,1], ...TORCHES.map(([x,z]) => [x,z,2.05] as const), [-9.2,-16.9,5], [9.2,-16.9,5]];
      const [x,z,y] = sources[this.smokeEmitted % sources.length];
      this.rt.particles.spawn({kind:PARTICLE.glow,x:x+(random()-.5)*.12,y,z:z+(random()-.5)*.12,vx:.08+this.values.wind*.18+(random()-.5)*.1,vy:.35+random()*.2,vz:(random()-.5)*.1,size:.25+random()*.14,life:2.2+random()*.8,color:[.35,.37,.39],alpha:.16});
      this.smokeEmitted++;
    }
    this.stickView.update(this.rt.input.touchStick);
    this.x = this.isFreeCamera() ? this.freeX : this.playerX + this.panX;
    this.z = this.isFreeCamera() ? this.freeZ : this.playerZ - 3 + this.panZ;
    this.apply();
    return [this.x, this.z];
  }
  private isFreeCamera() { return !this.possessed || this.cameraMode === "free"; }
  private shiftView(dx: number, dz: number) {
    if (this.isFreeCamera()) { this.freeX = clamp(this.freeX+dx,-50,50); this.freeZ = clamp(this.freeZ+dz,-70,55); }
    else { this.panX = clamp(this.panX+dx,-30,30); this.panZ = clamp(this.panZ+dz,-30,30); }
  }
  private recenterView() { this.panX = this.panZ = 0; this.freeX = this.playerX; this.freeZ = this.playerZ-3; }
  draw() {
    const b = this.rt.batches;
    const leafColor = hex(0x829b46);
    for (const leaf of this.driftingLeaves) {
      const flutter = leaf.age*2.2+leaf.phase;
      b[MESH.sphere].push(leaf.x+Math.sin(flutter)*0.12,leaf.y,leaf.z,flutter,0.5*Math.sin(flutter),0.3*Math.cos(flutter),leaf.size,leaf.size*0.12,leaf.size*0.55,leafColor,0.15,0,0,0);
    }
    // The textured path is part of the crossing asset at walking height.
    // Matte green slopes stay subdued by day and night; gloss created a white stripe.
    const mountainColors = [hex(0x54734e), hex(0x456743), hex(0x65815a)];
    for (const [i, x, z, width, height] of [[0,-70,-95,55,18],[1,-40,-90,50,22],[2,-9,-102,55,19],[0,24,-94,52,23],[1,55,-100,55,18],[2,82,-93,48,16]])
      b[MESH.cone].push(x,-3,z,0,0,0,width,height,width*0.65,mountainColors[i],0,0,0,0);
    this.modelRenderer.prepareStatic(this.kit,{skip:name=>!showEnvironmentKitNode(name)});
    // Keep the older gate as an off-map inspectable sample, out of the opening view.
    mat4.compose(this.root,0,-55,0,0,0,0,0,1,1,1);
    this.modelRenderer.prepareStatic(this.gate,{root:this.root});
    this.modelRenderer.prepareStatic(this.camp);
    this.modelRenderer.prepareStatic(this.props,{skip:name=>name === "world-props-fire-orange" || name === "world-props-fire-glow"});
    this.modelRenderer.prepareStatic(this.crossing,{skip:name=>name === "crossing_River_landscape"});
    this.modelRenderer.prepareStatic(this.routes);
    this.modelRenderer.prepareStatic(this.terrain);
    this.modelRenderer.prepareStatic(this.courtyard);
    this.modelRenderer.prepareStatic(this.outskirts);
    for (const [i,[x,z]] of MAP.trees.entries()) {
      mat4.compose(this.root,0,x,terrainHeight(x,z),z,0,0,this.treeSway(i),1,1,1);
      this.modelRenderer.prepareStatic(this.trees[i],{root:this.root});
    }
    for (const [i,t] of FOREST.near.entries()) {
      mat4.compose(this.root,0,t.x,terrainHeight(t.x,t.z),t.z,t.yaw,0,this.treeSway(i),t.scale,t.scale,t.scale);
      this.modelRenderer.prepareStatic(this.trees[MAP.trees.length+i],{root:this.root});
    }
    // These instances share the LOD's geometry and textures; each still has
    // its own model draw, rather than GPU hardware-instanced submission.
    for (const [i,t] of FOREST.distant.entries()) {
      if (this.possessed && blocksCharacterView(t,this.rt.camera.eye[0],this.rt.camera.eye[2],this.playerX,this.playerZ)) continue;
      mat4.compose(this.root,0,t.x,terrainHeight(t.x,t.z),t.z,t.yaw,0,this.treeSway(i+37)*0.65,t.scale,t.scale,t.scale);
      this.modelRenderer.prepareStatic(this.distantTrees[i],{root:this.root});
    }
    const post = hex(0x544436);
    // Keep the logs, but give each small fire a different moving silhouette.
    drawFlame(b,3.5,0.22,20,0.92,this.elapsed,0);
    for (const [i,[x,z]] of TORCHES.entries()) {
      b[MESH.cylinder].push(x,0,z,0,0,0,0.17,1.65,0.17,post,0.8);
      drawFlame(b,x,1.62,z,0.42,this.elapsed,i*1.7+2);
    }
    for (const [i,[x,z]] of [...courtyardLayout.sconces,...courtyardLayout.portalSconces].entries())
      drawFlame(b,x,2.46,z,0.38,this.elapsed,12+i*1.6);
    // The menu's castle portrait gets two extra lit sconces on the frontage.
    if (this.rt.phase === "menu") for (const [i,x] of [-7.2,7.2].entries()) {
      b[MESH.cylinder].push(x,3.15,-16.7,0,0,0,.11,.5,.11,post,.8);
      drawFlame(b,x,3.55,-16.7,.55,this.elapsed,30+i*3);
    }
    // A broader fortified frontage frames the original keep, keeping the gate
    // centered on the approach. Cylinders and cones are grounded at their base.
    const stone = hex(0x596268), trim = hex(0x778184), roof = hex(0x384b68), window = hex(0xd9b971);
    for (const side of [-1, 1]) {
      const wallX = side * 8.1, towerX = side * 11;
      b[MESH.box].push(wallX,2.05,-18,0,0,0,5.8,4.1,2.2,stone,0.8);
      b[MESH.box].push(wallX,4.12,-18,0,0,0,5.8,0.3,2.45,trim,0.8);
      b[MESH.box].push(wallX,0.32,-16.85,0,0,0,5.8,0.38,0.12,trim,0.8);
      // Each front-wall doorway marks a closed-gate reinforcement exit.
      const doorway=hex(0x1d272b);
      b[MESH.box].push(wallX,1.05,-16.79,0,0,0,1.6,2.1,0.08,doorway,0.95);
      for(const dx of [-0.86,0.86]) b[MESH.box].push(wallX+dx,1.08,-16.72,0,0,0,0.16,2.2,0.1,trim,0.8);
      b[MESH.box].push(wallX,2.19,-16.72,0,0,0,1.88,0.18,0.1,trim,0.8);
      // A violet sigil identifies the protected enemy-only doorway.
      b[MESH.sphere].push(wallX,1.82,-16.65,0,0,0,.24,.24,.10,hex(0xb975ce),.45,0,1,1,.22);
      for (const offset of [-1.3, 1.3])
        b[MESH.box].push(wallX+offset,2.65,-16.86,0,0,0,0.25,0.82,0.08,roof,0.8);
      for (let i = 0; i < 5; i++)
        b[MESH.box].push(side*(5.9+i*1.1),4.55,-17.0,0,0,0,0.62,0.65,0.45,trim,0.8);
      b[MESH.cylinder].push(towerX,0,-18,0,0,0,3.6,6.3,3.6,stone,0.8);
      b[MESH.cylinder].push(towerX,6.15,-18,0,0,0,4,0.4,4,trim,0.8);
      b[MESH.cone].push(towerX,6.55,-18,0,0,0,4.4,2.9,4.4,roof,0.8);
      b[MESH.box].push(towerX,3.9,-16.18,0,0,0,0.38,0.95,0.08,window,0.7);
      // Long curtain walls and rear towers give the castle an actual footprint.
      b[MESH.box].push(towerX,2.05,-29.5,0,0,0,2.2,4.1,21,stone,0.8);
      b[MESH.box].push(towerX,4.12,-29.5,0,0,0,2.45,0.3,21,trim,0.8);
      for (let i=0; i<10; i++) b[MESH.box].push(towerX,4.55,-20.5-i*2,0,0,0,0.5,0.65,0.8,trim,0.8);
      b[MESH.cylinder].push(towerX,0,-40,0,0,0,3.6,7.5,3.6,stone,0.8);
      b[MESH.cone].push(towerX,7.5,-40,0,0,0,4.4,2.9,4.4,roof,0.8);
    }
    drawCastleAtmosphere(b,this.elapsed,this.values.wind,this.values.night);
    drawBadTreeNests(this.rt,this.elapsed);
    b[MESH.box].push(0,2.05,-40,0,0,0,22,4.1,2.2,stone,0.8);
    b[MESH.box].push(0,4.12,-40,0,0,0,22,0.3,2.45,trim,0.8);
    mat4.compose(this.root,0,MAP.castle[0],0,MAP.castle[1],0,0,0,1.2,1.4,1);
    if (!this.castleBreached()) this.modelRenderer.prepareStatic(this.keep,{root:this.root});
    if (this.coreVisible()) {
      if (this.heartPreview) this.heartPreview.draw(this.rt,this.bossPreview.health,this.elapsed,this.bossPreview.cleared,this.bossPreview.guardian);
      else {
        mat4.compose(this.root,0,CORE_X,0,CORE_Z,0,0,0,1,1,1);
        this.modelRenderer.prepareStatic(this.core,{root:this.root});
      }
    }
    for (const [i, c] of this.characters.entries()) {
      if(i !== this.selected && !this.showCampCompanions()) continue;
      mat4.compose(this.root,0,c.x,Math.max(terrainHeight(c.x,c.z),overlookHeight(c.x,c.z)),c.z,c.yaw,i===this.selected&&this.possessed?deathTilt(this.playerDeathRemaining()):0,0,1,1,1);
      const layers: Layer[] = heroIdleLayers();
      if (i === this.selected && this.possessed && this.locomotion > 0.001) {
        layers.push(...loopLayers("walk",this.gait,c.animator.clipDuration("walk"),this.locomotion*(1-this.runWeight)));
        if (this.runWeight > 0.001) layers.push(...loopLayers("run",this.gait,c.animator.clipDuration("run"),this.locomotion*this.runWeight));
      }
      const age = i === this.selected && this.possessed ? this.attackAge : Infinity;
      c.animator.update(layers,this.root,attackPose(i,age) ?? this.heroIdles.pose(String(i),i)); this.modelRenderer.prepareSkinned(c.model,c.animator);
      this.equipment[i].draw(c.animator,i,age,c.yaw,{arrow:i!==2 || this.showNockedArrow(age)});
      // The engine's blob shadow is fixed at y=0; directional shadows follow
      // the meadow, so avoid showing a detached blob on the raised parts.
      if (Math.max(terrainHeight(c.x,c.z),overlookHeight(c.x,c.z)) < 0.02) this.rt.blob(c.x,c.z,0.45,0.4);
    }
  }
  // A slow presentation-only orbit frames the approach; the player's pose is untouched.
  menuShot(t = 0): Shot { return { target: [0, 2, -9], pitch: 0.22, yaw: motion.reduced ? 0 : 0.16 * Math.sin(t * 0.11), distance: 27 }; }
  heroShot(): Shot { return { target: [0,0,0], pitch: 0.9, yaw: 0, distance: 18 }; }
  summary(): RoundSummary { return { won: false, ribbon: "Environment", title: "Environment lab", rows: [], note: "" }; }
  countdown() {}
  showHud(on: boolean) {
    const h = document.querySelector<HTMLElement>("#hud"); if (h) h.hidden = true;
    if (this.panel) this.panel.hidden = !on;
    document.body.classList.toggle("environment-lab-active", on);
  }
  stats(): Record<string, number> { return { x: this.x, z: this.z, sunAzimuth: this.values.sunAzimuth, sunElevation: this.values.sunElevation, pitch: this.values.pitch, viewWidth: this.values.viewWidth, gate: 1 }; }
  debugInfo() { return `environment lab · gate loaded · sun ${this.values.sunAzimuth}° / ${this.values.sunElevation}°`; }

  private apply() {
    const night = this.values.night;
    const blend = (a: StyleColor, b: StyleColor): StyleColor => a.map((v,i) => v*(1-night)+b[i]*night) as StyleColor;
    this.rt.style = { ...this.look, keyLight: this.look.keyLight*(1-0.74*night), ambient: this.look.ambient*(1-0.38*night), skyZenith: blend(this.look.skyZenith,[0.035,0.055,0.16]), skyHorizon: blend(this.look.skyHorizon,[0.12,0.17,0.29]) };
    // Keep the closest relevant pools active across zone boundaries, within the
    // renderer's eight-light limit. Animated flames provide their visible source.
    const lightX = this.rt.phase === "menu" ? 0 : this.x;
    const lightZ = this.rt.phase === "menu" ? -16 : this.z;
    this.rt.renderer.lights = environmentLights(lightX,lightZ,this.elapsed,this.values.fireLight,this.values.torchLight,night);
    if (this.keep && this.keepShadeApplied !== this.values.keepShade) {
      const shade = this.values.keepShade;
      this.modelRenderer.recolor(this.keep, new Map([["tripo_material_7b637080-eb7c-480b-a995-2928cb1e52c9", [shade, shade, shade]]]));
      this.keepShadeApplied = shade;
    }
    const az = this.values.sunAzimuth * Math.PI / 180, el = this.values.sunElevation * Math.PI / 180;
    this.rt.renderer.sunDir = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    this.rt.renderer.ground.color = hex(parseInt(this.values.groundColor.slice(1), 16));
    if (this.groundColorApplied !== this.values.groundColor) {
      this.modelRenderer.recolor(this.crossing, new Map([["River landscape", this.rt.renderer.ground.color]]));
      this.modelRenderer.recolor(this.terrain, new Map([["River landscape", this.rt.renderer.ground.color]]));
      this.groundColorApplied = this.values.groundColor;
    }
    this.rt.renderer.skyVisible = true;
    // Clouds are moonlit blue-grey at night, rather than bright white or shiny meshes.
    this.rt.renderer.skyCloud = { tint: [1-0.84*night,1-0.80*night,1-0.69*night], opacity: clamp(this.values.clouds,0,1) };
    this.rt.camera.rig.yaw = this.yaw;
    this.rt.camera.rig.pitch = this.values.pitch * Math.PI / 180;
    this.rt.camera.rig.fovY = this.values.fov * Math.PI / 180;
    this.rt.camera.rig.portraitWidth = this.values.viewWidth;
    this.rt.camera.rig.landscapeHeight = this.values.viewWidth;
  }
  private save() {
    try { localStorage.setItem(STORAGE, JSON.stringify({ style: this.look, scene: this.values } satisfies Saved)); }
    catch { /* private mode or quota: live controls still work */ }
  }
  private loadSaved() {
    if (new URLSearchParams(location.search).has("envDefaults")) return;
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE) ?? "null") as Partial<Saved> | null;
      if (!s) return;
      for (const [key,,min,max] of STYLE_RANGES) {
        const v = s.style?.[key]; if (typeof v === "number" && Number.isFinite(v)) this.look[key] = clamp(v,min,max);
      }
      for (const [key] of STYLE_COLORS) {
        const v = s.style?.[key]; if (Array.isArray(v) && v.length === 3 && v.every(c => typeof c === "number" && Number.isFinite(c))) this.look[key] = v.map(c => clamp(c,0,1)) as StyleColor;
      }
      const v = s.scene;
      if (v) {
        if (Number.isFinite(v.sunAzimuth)) this.values.sunAzimuth = clamp(v.sunAzimuth,-180,180);
        if (Number.isFinite(v.sunElevation)) this.values.sunElevation = clamp(v.sunElevation,5,85);
        if (Number.isFinite(v.keepShade)) this.values.keepShade = clamp(v.keepShade,0.1,1);
        if (Number.isFinite(v.pitch)) this.values.pitch = clamp(v.pitch,8,80);
        if (Number.isFinite(v.fov)) this.values.fov = clamp(v.fov,30,80);
        if (Number.isFinite(v.viewWidth)) this.values.viewWidth = clamp(v.viewWidth,8,28);
        if (Number.isFinite(v.night)) this.values.night = clamp(v.night,0,1);
        if (Number.isFinite(v.fireLight)) this.values.fireLight = clamp(v.fireLight,0,3);
        if (Number.isFinite(v.torchLight)) this.values.torchLight = clamp(v.torchLight,0,3);
        if (Number.isFinite(v.wind)) this.values.wind = clamp(v.wind,0,2);
        if (Number.isFinite(v.leaves)) this.values.leaves = clamp(v.leaves,0,2);
        if (Number.isFinite(v.speed)) this.values.speed = clamp(v.speed,1,10);
        if (Number.isFinite(v.clouds)) this.values.clouds = clamp(v.clouds,0,1);
        if (/^#[0-9a-f]{6}$/i.test(v.groundColor)) this.values.groundColor = v.groundColor;
      }
    } catch { /* malformed stored state gets safe defaults */ }
  }
  /** Grab the visible world with mouse, pen or touch. UI elements are not canvas
   * descendants, so changing a slider never starts a pan. */
  private mountPan() {
    const canvas = this.rt.canvas;
    canvas.addEventListener("pointerdown", (e) => {
      // Input has already assigned the movement pointer. Never also pan with
      // that pointer, including mouse drags used by the mobile preview.
      if (this.rt.input.touchStick?.id === e.pointerId) return;
      if (this.rt.phase !== "playing" || this.drag || (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) || (e.pointerType === "touch" && e.clientX < canvas.clientWidth * 0.5)) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, orbit: e.pointerType === "mouse" && e.button === 2 };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* browser may already own capture */ }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      if (this.drag.orbit) {
        this.yaw = Math.atan2(Math.sin(this.yaw - dx * 0.006), Math.cos(this.yaw - dx * 0.006));
        this.values.pitch = clamp(this.values.pitch + dy * 0.15, 8, 80);
        this.apply(); this.syncCameraControls();
        e.preventDefault(); return;
      }
      const { right, up } = this.rt.camera.groundBasis();
      const size = Math.max(1, canvas.clientWidth < canvas.clientHeight ? canvas.clientWidth : canvas.clientHeight);
      const metres = this.values.viewWidth / size;
      this.shiftView((-right[0] * dx + up[0] * dy) * metres, (-right[1] * dx + up[1] * dy) * metres);
      e.preventDefault();
    });
    canvas.addEventListener("contextmenu", e => { if (this.rt.phase === "playing") e.preventDefault(); });
    canvas.addEventListener("wheel", e => {
      if (this.rt.phase !== "playing") return;
      e.preventDefault();
      this.values.viewWidth = clamp(this.values.viewWidth * Math.exp(e.deltaY * 0.001), 8, 28);
      this.apply(); this.syncCameraControls();
    }, { passive: false });
    const end = (e: PointerEvent) => { if (this.drag?.id === e.pointerId) this.drag = null; };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("lostpointercapture", end);
  }
  private syncCameraControls() {
    if (!this.controls) return;
    for (const [name, value] of [["Camera orbit (°)", this.yaw * 180 / Math.PI], ["Camera pitch (°)", this.values.pitch], ["View width (m)", this.values.viewWidth]] as const) {
      const row = [...this.controls.querySelectorAll("label")].find(el => el.querySelector("span")?.textContent === name);
      const input = row?.querySelector<HTMLInputElement>("input"), out = row?.querySelector<HTMLOutputElement>("output");
      if (input && out) { input.value = String(value); out.textContent = String(+value.toFixed(2)); }
    }
  }
  private mountControls() {
    const style = document.createElement("style");
    style.textContent = `
      .environment-lab-active .touch-btn[data-action="attack"] { display:none !important }
      #environment-lab { position:fixed; z-index:65; top:calc(10px + env(safe-area-inset-top)); right:calc(10px + env(safe-area-inset-right)); width:min(350px,calc(100vw - 20px)); max-height:calc(100dvh - 20px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); display:flex; flex-direction:column; font:13px/1.3 system-ui; color:#edf3f4; }
      #environment-lab > :not(#environment-controls) { flex-shrink:0; }
      #environment-lab button, #environment-lab .env-menu { text-decoration:none; cursor:pointer; border:0; border-radius:7px; padding:7px 10px; color:#122323; background:#dbeee3; font:600 13px system-ui }
      #environment-lab .env-head { display:flex; align-items:center; justify-content:space-between; gap:8px; background:#152b2be8; border-radius:10px; padding:7px 9px; }
      #environment-lab .env-hint { display:block; margin-top:4px; padding:5px 9px; border-radius:7px; background:#152b2bcc; color:#e0eee6; font-size:12px; pointer-events:none; }
      #environment-lab .env-cast { display:flex; gap:6px; align-items:center; margin-top:4px; padding:5px 9px; border-radius:7px; background:#152b2be8; }
      #environment-lab .env-camera { display:flex; gap:8px; align-items:center; margin-top:4px; padding:5px 9px; border-radius:7px; background:#152b2be8; }
      #environment-lab .env-boss { display:flex; gap:8px; align-items:center; margin-top:4px; padding:5px 9px; border-radius:7px; background:#152b2be8; }
      #environment-lab .env-boss select { min-width:0; flex:1; padding:6px; border-radius:6px; color:#122323; background:#dbeee3; }
      #environment-lab .env-camera select { min-width:0; flex:1; padding:6px; border-radius:6px; color:#122323; background:#dbeee3; }
      #environment-lab .env-cast select { flex:1; min-width:0; padding:6px; border-radius:6px; color:#122323; background:#dbeee3; }
      #environment-controls { box-sizing:border-box; min-height:0; margin-top:4px; max-height:calc(100dvh - 250px - env(safe-area-inset-top)); overflow:auto; overscroll-behavior:contain; touch-action:pan-y; padding:8px; background:#152b2bf2; border-radius:10px; }
      #environment-controls[hidden] { display:none }
      #environment-controls p { margin:4px 0 10px; color:#c2d5cb; }
      #environment-controls details { border-top:1px solid #8caaaa66; padding:6px 0; }
      #environment-controls summary { cursor:pointer; font-weight:700; }
      #environment-controls label { display:grid; grid-template-columns:1fr 104px 42px; align-items:center; gap:5px; min-height:27px; }
      #environment-controls input[type=range] { width:100%; } #environment-controls input[type=color] { width:100%; height:28px; } #environment-controls label:has(input[type=color]) { grid-template-columns:1fr 80px 65px; }
      #environment-controls output { text-align:right; font-variant-numeric:tabular-nums; }
      #environment-controls .env-actions { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px; }
      @media (max-width:600px) { #environment-lab { width:min(330px,calc(100vw - 20px)); } }
      @media (max-height:400px) and (min-aspect-ratio:1/1) {
        #environment-lab { width:min(210px,calc(100vw - 20px)); font-size:11px; }
        #environment-lab .env-head strong { display:none; }
        #environment-lab .env-head { gap:4px; padding:5px; }
        #environment-lab button, #environment-lab .env-menu { font-size:11px; padding:6px; }
        #environment-lab .env-hint { display:none; }
        #environment-controls { max-height:calc(100dvh - 175px - env(safe-area-inset-top)); }
      }
      @media (pointer:coarse) {
        .environment-lab-active #dbg, .environment-lab-active #dbg-toggle,
        .environment-lab-active #tuning, .environment-lab-active #tune-toggle,
        .environment-lab-active #tune-badge { display:none !important; }
      }
    `;
    document.head.append(style);
    this.panel = document.createElement("aside"); this.panel.id = "environment-lab"; this.panel.setAttribute("aria-label", "Environment lab");
    const head = document.createElement("div"); head.className = "env-head";
    head.append(Object.assign(document.createElement("strong"), { textContent: "Environment lab" }));
    const toggle = Object.assign(document.createElement("button"), { type: "button", textContent: "Tune look", title: "Show or hide look controls" });
    toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-controls", "environment-controls");
    const menu = Object.assign(document.createElement("a"), { href: "./", className: "env-menu", textContent: "Menu", title: "Return to the game menu" });
    const recenter = Object.assign(document.createElement("button"), { type: "button", textContent: "Recenter", title: "Recenter on the explorer" });
    recenter.className = "env-recenter";
    recenter.addEventListener("click", () => this.recenterView());
    head.append(toggle, recenter, menu); this.panel.append(head);
    const cast = document.createElement("div"); cast.className = "env-cast";
    const select = document.createElement("select"); select.setAttribute("aria-label", "Character to control");
    for (const c of this.characters) select.add(new Option(c.name,c.name));
    const possess = Object.assign(document.createElement("button"), { type:"button", textContent:"Release", title:"Release the character and move the camera freely" });
    const updatePossess = () => { possess.textContent = this.possessed ? "Release" : "Possess"; possess.setAttribute("aria-pressed", String(this.possessed)); };
    possess.addEventListener("click", () => {
      if (this.possessed) { this.freeX = this.x; this.freeZ = this.z; }
      this.possessed = !this.possessed;
      this.cameraMode = this.possessed ? "chase" : "free";
      if (this.possessed) this.recenterView();
      this.locomotion = 0; updatePossess(); updateCameraButton();
    });
    select.addEventListener("change", () => {
      this.selected = select.selectedIndex; const c = this.characters[this.selected];
      this.playerX = c.x; this.playerZ = c.z; this.playerYaw = c.yaw; this.locomotion = 0;
      if (!this.isFreeCamera()) this.recenterView();
    });
    const attack = Object.assign(document.createElement("button"), { type:"button", textContent:"Attack", title:"Preview the selected character’s attack" });
    attack.addEventListener("click", () => { if (this.possessed && this.rt.phase === "playing") { this.attackAge = 0; this.sound.attack(this.selected); } });
    updatePossess();
    cast.append(select, possess, attack); this.panel.append(cast);
    const cameraRow = document.createElement("div"); cameraRow.className = "env-camera";
    const cameraButton = Object.assign(document.createElement("button"), {type:"button", textContent:"Chase camera"});
    cameraButton.setAttribute("aria-label", "Camera mode: chase");
    const heroViews = document.createElement("select");
    heroViews.setAttribute("aria-label", "Choose a hero view");
    heroViews.add(new Option("Hero views…", ""));
    heroViews.add(new Option("River crossing", "river"));
    heroViews.add(new Option("Bridge lanterns", "lantern"));
    heroViews.add(new Option("Castle approach", "castle"));
    heroViews.add(new Option("Castle interior", "interior"));
    heroViews.add(new Option("Castle side", "castle-side"));
    heroViews.add(new Option("Castle rear", "castle-rear"));
    if (this.heartPreview) heroViews.add(new Option("Boss", "boss"));
    heroViews.add(new Option("Enemy barracks", "barracks"));
    const updateCameraButton = () => {
      cameraButton.textContent = this.cameraMode === "chase" ? "Chase camera" : "Free camera";
      cameraButton.setAttribute("aria-label", `Camera mode: ${this.cameraMode}`);
    };
    cameraButton.addEventListener("click", () => {
      if (this.cameraMode === "chase") { this.freeX = this.x; this.freeZ = this.z; this.cameraMode = "free"; }
      else { this.cameraMode = "chase"; if (this.possessed) this.recenterView(); }
      heroViews.value = ""; updateCameraButton();
    });
    heroViews.addEventListener("change", () => {
      if (!heroViews.value) return;
      const views: Record<string,{x:number;z:number;yaw:number;pitch:number;width:number}> = {
        river:{x:-3,z:8,yaw:-0.35,pitch:28,width:13},
        lantern:{x:-2.3,z:11.3,yaw:0,pitch:25,width:8},
        castle:{x:0,z:-13,yaw:0,pitch:18,width:26},
        interior:{x:3,z:-29.2,yaw:0,pitch:45,width:15},
        "castle-side":{x:17,z:-30,yaw:0,pitch:47,width:15},
        "castle-rear":{x:0,z:-43,yaw:Math.PI,pitch:48,width:19},
        boss:{x:0,z:-26,yaw:0,pitch:35,width:10},
        barracks:{x:-8,z:-29,yaw:-0.15,pitch:28,width:10},
      };
      const view=views[heroViews.value]; if (!view) return;
      this.possessed = false; updatePossess();
      this.cameraMode = "free";
      this.freeX=view.x; this.freeZ=view.z; this.yaw=view.yaw;
      const aspect = this.rt.canvas.clientWidth / Math.max(1,this.rt.canvas.clientHeight);
      // Portrait fitting otherwise pulls the eye outside the castle walls.
      this.values.pitch=aspect<1 && heroViews.value === "interior" ? 60 : view.pitch;
      this.values.viewWidth=aspect<1 && (heroViews.value === "interior" || heroViews.value === "barracks" || heroViews.value === "boss") ? Math.max(8,view.width*aspect) : view.width;
      this.apply();
      this.rt.camera.snap(view.x, view.z, aspect, this.bounds);
      this.syncCameraControls(); updateCameraButton();
    });
    updateCameraButton();
    cameraRow.append(cameraButton,heroViews); this.panel.append(cameraRow);
    if (this.heartPreview) {
      const row=document.createElement("div");row.className="env-boss";
      const states=document.createElement("select");states.setAttribute("aria-label","Boss state");
      for(const [label,value] of [["Boss: Rooted","rooted"],["Boss: Emerging","emerging"],["Boss: Walking in place","walking"],["Boss: Attacking","attacking"],["Boss: Hit reaction","hit"],["Boss: Defeated","defeated"]])states.add(new Option(label,value));
      const replay=Object.assign(document.createElement("button"),{type:"button",textContent:"Replay",title:"Replay the selected boss state"});
      const start=()=>{this.bossPreview.select(states.value as BossPreviewMode);this.heartPreview?.resetMotion();};
      const focusBoss=()=>{heroViews.value="boss";heroViews.dispatchEvent(new Event("change"));};
      states.addEventListener("change",()=>{start();focusBoss();});
      replay.addEventListener("click",()=>{start();focusBoss();});row.append(states,replay);this.panel.append(row);
    }
    const hint = Object.assign(document.createElement("small"), { className: "env-hint", textContent: "Walk: WASD / stick · Run: Shift / hold Run · Attack: Space · Pan: drag · Orbit: right-drag · Zoom: scroll" });
    this.panel.append(hint);
    this.controls = document.createElement("div"); this.controls.id = "environment-controls"; this.controls.hidden = true;
    toggle.addEventListener("click", () => { this.controls.hidden = !this.controls.hidden; toggle.setAttribute("aria-expanded", String(!this.controls.hidden)); });
    this.panel.append(this.controls); document.body.append(this.panel);
    this.buildControls();
  }
  private buildControls() {
    this.controls.replaceChildren();
    const intro = document.createElement("p");
    intro.textContent = "Walk: WASD or left-side touch stick. Hold Shift or Run to run. Pan: mouse drag or right-side touch drag. Orbit: right-drag. Zoom: scroll. Look settings save on this device.";
    this.controls.append(intro);
    const actions = document.createElement("div"); actions.className = "env-actions";
    const defaults = Object.assign(document.createElement("button"), { type: "button", textContent: "Reset defaults" });
    defaults.addEventListener("click", () => { this.look = copyStyle(); this.values = { ...SCENE_DEFAULT }; this.yaw = 0; this.apply(); try { localStorage.removeItem(STORAGE); } catch {} this.buildControls(); });
    const copy = Object.assign(document.createElement("button"), { type: "button", textContent: "Copy settings" });
    copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(JSON.stringify({ style: this.look, scene: this.values }, null, 2)); copy.textContent = "Copied"; } catch { copy.textContent = "Copy unavailable"; } });
    const center = Object.assign(document.createElement("button"), { type: "button", textContent: "Center view" });
    center.addEventListener("click", () => this.recenterView());
    const camp = Object.assign(document.createElement("button"), { type: "button", className: "env-camp", textContent: "Return to camp" });
    camp.addEventListener("click", () => this.reset());
    actions.append(defaults, copy, center, camp); this.controls.append(actions);
    const createGroup = (title: string, open = false) => {
      const d = document.createElement("details"); d.open = open;
      const sum = document.createElement("summary"); sum.textContent = title; d.append(sum); this.controls.append(d); return d;
    };
    const slider = (parent: HTMLElement, label: string, min: number, max: number, step: number, value: number, onInput: (v:number) => void) => {
      const row = document.createElement("label"); const name = document.createElement("span"); name.textContent = label;
      const input = document.createElement("input"); input.type = "range"; input.min = `${min}`; input.max = `${max}`; input.step = `${step}`; input.value = `${value}`;
      const out = document.createElement("output"); out.textContent = `${+value.toFixed(3)}`;
      input.addEventListener("input", () => { const v = +input.value; onInput(v); out.textContent = `${+v.toFixed(3)}`; this.apply(); this.save(); });
      row.append(name,input,out); parent.append(row);
    };
    const color = (parent: HTMLElement, label: string, value: string, onInput: (v:string) => void) => {
      const row = document.createElement("label"), name = document.createElement("span"), input = document.createElement("input"), out = document.createElement("output");
      name.textContent = label; input.type = "color"; input.value = value; out.textContent = value;
      input.addEventListener("input", () => { onInput(input.value); out.textContent = input.value; this.apply(); this.save(); });
      row.append(name,input,out); parent.append(row);
    };
    const scene = createGroup("Sun, camera and ground", true);
    slider(scene,"Sun direction (°)",-180,180,1,this.values.sunAzimuth,v => this.values.sunAzimuth=v);
    slider(scene,"Sun elevation (°)",5,85,1,this.values.sunElevation,v => this.values.sunElevation=v);
    slider(scene,"Camera orbit (°)",-180,180,1,this.yaw * 180 / Math.PI,v => this.yaw=v * Math.PI / 180);
    slider(scene,"Camera pitch (°)",8,80,1,this.values.pitch,v => this.values.pitch=v);
    slider(scene,"Field of view (°)",30,80,1,this.values.fov,v => this.values.fov=v);
    slider(scene,"View width (m)",8,28,0.5,this.values.viewWidth,v => this.values.viewWidth=v);
    color(scene,"Ground colour",this.values.groundColor,v => this.values.groundColor=v);
    slider(scene,"Keep tint (all materials)",0.1,1,0.01,this.values.keepShade,v => this.values.keepShade=v);
    const life = createGroup("World and atmosphere", true);
    slider(life,"Day → night",0,1,0.01,this.values.night,v => this.values.night=v);
    slider(life,"Camp and lantern light",0,3,0.05,this.values.fireLight,v => this.values.fireLight=v);
    slider(life,"Trail and gate torch light",0,3,0.05,this.values.torchLight,v => this.values.torchLight=v);
    slider(life,"Wind strength",0,2,0.05,this.values.wind,v => this.values.wind=v);
    slider(life,"Blowing leaves",0,2,0.05,this.values.leaves,v => this.values.leaves=v);
    slider(life,"Sky cloud cover",0,1,0.1,this.values.clouds,v => this.values.clouds=v);
    slider(life,"Movement speed (m/s)",1,10,0.1,this.values.speed,v => this.values.speed=v);
    const groups: Record<string, HTMLElement> = {};
    const groupOf = (key: StyleNumberKey) => ["toon","toonSoft","inkPx","rim"].includes(key) ? "Shading and outline" : ["shadow","shadowSoft","shadowLift","blobShadow","keyLight","ambient","warmth","groundAO","groundBounceStrength","groundBounceReach"].includes(key) ? "Lighting and shadows" : ["bloom","bloomThreshold","exposure","vignette","saturation","contrast","rolloff","splitTone"].includes(key) ? "Post-processing" : "Atmosphere and depth";
    for (const [key,label,min,max,step] of STYLE_RANGES) {
      const group = groupOf(key); groups[group] ??= createGroup(group);
      slider(groups[group],label,min,max,step,this.look[key],v => this.look[key]=v);
    }
    const colours = createGroup("Sky and light colours");
    for (const [key,label] of STYLE_COLORS) color(colours,label,toHex(this.look[key]),v => this.look[key]=fromHex(v));
    const limitation = document.createElement("p"); limitation.textContent = "Night blends the sky and lighting; it is not a clock. Wind rocks whole trees, and small leaves drift down near them. Cloud cover adjusts the procedural sky. Tree and grass materials are not individually editable here."; this.controls.append(limitation);
  }
}
