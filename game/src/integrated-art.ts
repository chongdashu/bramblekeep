/** Game-owned presentation of the compact slice. Simulation remains authoritative. */
import { loadGlb } from "@engine/gltf/glb";
import { Animator, type Layer } from "@engine/gltf/animator";
import { ModelRenderer, type GpuModel } from "@engine/gpu/model";
import type { GameRuntime } from "@engine/runtime";
import { mat4 } from "@engine/math";
import { hex } from "@engine/gpu/meshes";
import { turnToward } from "./turning";
import { loopLayers } from "./loop-layers";
import { runBlend, WALK_STRIDE, RUN_STRIDE } from "./movement";
import { Weapons, attackPose } from "./weapons";

const paths = ["characters/hero-knight-grip.glb", "characters/hero-spellcaster-grip.glb", "characters/hero-scout-grip.glb", "enemies/bloom.glb", "enemies/bramble.glb", "environment/gate-kit.glb", "environment-lab/tripo-tree.glb", "environment-lab/environment-kit-no-keep.glb"];
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
type Actor = { model: GpuModel; animator: Animator; x: number; z: number; yaw: number; gait: number; move: number; run: number; initialized: boolean };

export class IntegratedArt {
  private renderer: ModelRenderer;
  private heroes: Actor[] = [];
  private allies: Actor[] = [];
  private enemies: GpuModel[] = [];
  private weapons!: Weapons;
  private allyWeapons: Weapons[] = [];
  private gate!: GpuModel;
  private trees: GpuModel[] = [];
  private scenery!: GpuModel;
  private root = mat4.identity();
  private elapsed = 0;
  private attackAge = 100;
  private activeClass = -1;

  constructor(private rt: GameRuntime) { this.renderer = new ModelRenderer(rt.renderer); }
  async load() {
    const docs = await Promise.all(paths.map(path => loadGlb(new URL(`assets/${path}`, document.baseURI).href)));
    const actor = (doc: typeof docs[number], model: GpuModel): Actor => {
      const animator = new Animator(doc);
      if (!doc.skins.length || ["idle", "walk", "run"].some(clip => !animator.clipNames.includes(clip))) throw new Error("Playable character is missing rig or locomotion clips");
      return { model, animator, x: 0, z: 0, yaw: 0, gait: 0, move: 0, run: 0, initialized: false };
    };
    this.heroes = docs.slice(0, 3).map(doc => actor(doc, this.renderer.upload(doc)));
    this.allies = [0, 1, 2].map(() => actor(docs[0], this.renderer.instance(this.heroes[0].model)));
    this.weapons = new Weapons(this.renderer); await this.weapons.load();
    this.heroes.forEach(a => this.weapons.calibrate(a.animator));
    this.allyWeapons = this.allies.map(a => { const w = this.weapons.instance(); w.calibrate(a.animator); return w; });
    const bloom = this.renderer.upload(docs[3]);
    this.enemies = [bloom, this.renderer.upload(docs[4]), this.renderer.instance(bloom)];
    this.gate = this.renderer.upload(docs[5]);
    this.renderer.recolor(this.gate, new Map([["Stone warm", hex(0x555d61)], ["Stone shade", hex(0x3e464b)], ["Stone trim", hex(0x687175)]]));
    const tree = this.renderer.upload(docs[6]); this.trees = [tree, this.renderer.instance(tree)];
    this.scenery = this.renderer.upload(docs[7]);
    this.rt.renderer.sceneHooks.push(() => this.renderer.draw());
  }
  reset() { for (const a of [...this.heroes, ...this.allies]) a.initialized = false; this.attackAge = 100; }
  attack() { this.attackAge = 0; }
  arrow(start: [number,number], end: [number,number], progress: number) { this.weapons.drawProjectile(start,end,progress); }
  status() {
    const doors = this.gate.doc.nodes.map((node, i) => ({ name: node.name, hidden: !!this.gate.hidden[i] })).filter(node => ["gate door", "gate-kit Door alternate", "gate-kit Iron"].includes(node.name));
    return { hero: ["Knight", "Spellcaster", "Scout"][this.activeClass] ?? "Knight", yaw: this.heroes[Math.max(0, this.activeClass)].yaw, assets: paths, doors };
  }
  step(dt: number) { this.elapsed += dt; this.attackAge += dt; }
  private drawActor(a: Actor, x: number, z: number, dt: number, facing?: number, attack = false, kind = 0, weapons = this.weapons) {
    let distance = a.initialized ? Math.hypot(x-a.x, z-a.z) : 0;
    if (distance > 2 || dt <= 0) distance = 0; // respawn and pause do not animate a teleport
    const speed = dt > 0 ? distance / dt : 0;
    const desired = facing !== undefined ? facing : distance > 0.001 ? Math.atan2(x-a.x,z-a.z) : a.yaw;
    a.yaw = a.initialized ? turnToward(a.yaw, desired, dt) : desired;
    a.x=x; a.z=z; a.initialized=true;
    const target = clamp((speed - 0.08) / 1.2, 0, 1);
    a.move += (target - a.move) * (1 - Math.exp(-10*dt));
    a.run += (runBlend(speed,this.rt.sim.x.sim_param_get(0)) - a.run) * (1 - Math.exp(-8*dt));
    a.gait = (a.gait + distance / (WALK_STRIDE*(1-a.run)+RUN_STRIDE*a.run)) % 1;
    const layers: Layer[] = [{ clip:"idle", time:this.elapsed }];
    if (a.move > 0.001) layers.push(...loopLayers("walk",a.gait,a.animator.clipDuration("walk"),a.move*(1-a.run)));
    if (a.run > 0.001) layers.push(...loopLayers("run",a.gait,a.animator.clipDuration("run"),a.move*a.run));
    mat4.compose(this.root,0,x,0,z,a.yaw,0,0,1,1,1);
    a.animator.update(layers,this.root,attack ? attackPose(kind,this.attackAge) : undefined); this.renderer.prepareSkinned(a.model,a.animator);
    weapons.draw(a.animator,kind,attack ? this.attackAge : Infinity,a.yaw);
    this.rt.blob(x,z,0.45,0.4);
  }
  draw(s: Float32Array, dt: number, classId: number, facing: number, target: number | null, targetInRange: boolean) {
    if (this.activeClass !== classId) { this.heroes[classId].initialized = false; this.activeClass = classId; }
    this.drawActor(this.heroes[classId],s[6],s[7],dt,facing,true,classId);
    for (let i=0;i<3;i++) {
      if (i < s[28]) this.drawActor(this.allies[i],s[29+i*2],s[30+i*2],dt,undefined,false,0,this.allyWeapons[i]);
      else this.allies[i].initialized=false;
    }
    for (let i=0;i<3;i++) if (s[8+i]) {
      const x=s[18+i*2], z=s[19+i*2];
      const yaw=Math.atan2(s[6]-x,s[7]-z);
      mat4.compose(this.root,0,x,0,z,yaw,0,0,1,1,1);
      this.renderer.prepareStatic(this.enemies[i],{root:this.root,flash:targetInRange && target===i ? 0.35 : 0});
      this.rt.blob(x,z,0.48,0.35);
    }
    mat4.compose(this.root,0,0,0,6,Math.PI,0,0,1.15,1,1);
    this.renderer.prepareStatic(this.gate,{root:this.root,skip:name => !!s[13] && ["gate door","gate-kit Door alternate","gate-kit Iron"].includes(name)});
    for (const [i,x] of [-9,9].entries()) {
      mat4.compose(this.root,0,x,0,i ? 0 : -1,0,0,0,1,1,1);
      this.renderer.prepareStatic(this.trees[i],{root:this.root});
    }
    // The tent canvas sits outside the playable bounds. Other merged kit geometry
    // is positioned for the look lab, not for this collision map.
    mat4.compose(this.root,0,-5,0,0,0,0,0,1,1,1);
    const keep = new Set(["environment_tent_canvas"]);
    this.renderer.prepareStatic(this.scenery,{root:this.root,skip:name=>name.startsWith("environment_") && !keep.has(name)});
  }
}
