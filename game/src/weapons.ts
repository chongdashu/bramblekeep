/** Character-owned equipment and animation; simulation continues to own hits. */
import { loadGlb, type GltfDoc } from "@engine/gltf/glb";
import { Animator } from "@engine/gltf/animator";
import { ModelRenderer, type GpuModel } from "@engine/gpu/model";
import { mat4 } from "@engine/math";
import equipmentConfig from "./equipment-config.json";
import { readSocketSettings, saveSocketSettings, defaultSocketSettings, type SocketAdjustment, type SocketName } from "./socket-adjustments";

type Quat = [number, number, number, number];
const axis = (x: number, y: number, z: number, angle: number): Quat => {
  const s = Math.sin(angle / 2); return [x*s,y*s,z*s,Math.cos(angle/2)];
};
function euler(x: number, y: number, z: number): Quat {
  const cx=Math.cos(x/2), sx=Math.sin(x/2), cy=Math.cos(y/2), sy=Math.sin(y/2), cz=Math.cos(z/2), sz=Math.sin(z/2);
  return [sx*cy*cz+cx*sy*sz,cx*sy*cz-sx*cy*sz,cx*cy*sz+sx*sy*cz,cx*cy*cz-sx*sy*sz];
}
/** A quick anticipation, decisive swing/cast/release, and a slower recovery. */
export function attackPose(kind: number, age: number): Record<string, Quat> | undefined {
  if (age < 0 || age >= 0.58) return undefined;
  const t = age / 0.58;
  const power = t < 0.22 ? t/0.22 : t < 0.48 ? 1 - 1.7*(t-0.22)/0.26 : -0.7 * (1-(t-0.48)/0.52);
  const rise = Math.sin(Math.PI * t);
  if (kind === 0) {
    // Load the torso and sword arm, cut across decisively, then ease back to idle.
    // Keep the legs on their locomotion layer so the planted stance is not displaced.
    const smooth = (v:number) => { const x=Math.max(0,Math.min(1,v)); return x*x*(3-2*x); };
    const swingTime = age / 0.46; // Return to idle before the default 0.48 s repeat.
    const windup = smooth(swingTime/0.28) * (1-smooth((swingTime-0.28)/0.25));
    const follow = smooth((swingTime-0.28)/0.19) * (1-smooth((swingTime-0.55)/0.45));
    return {
      Waist: euler(0.10*windup-0.12*follow,-0.18*windup+0.24*follow,0),
      Spine01: euler(-0.10*windup+0.22*follow,-0.22*windup+0.28*follow,0.10*windup-0.10*follow),
      Spine02: euler(-0.12*windup+0.16*follow,-0.26*windup+0.34*follow,0),
      R_Upperarm: euler(1.55*windup-0.8*follow,0.2*windup-0.25*follow,-0.65*windup-0.4*follow),
      R_Forearm: euler(0.9*windup+0.45*follow,0,0.20*windup-0.18*follow),
      R_Hand: euler(0.10*windup-0.25*follow,0,0.20*windup-0.22*follow),
      L_Upperarm: euler(0.25*windup-0.3*follow,0, -0.55*windup+0.35*follow),
      L_Forearm: euler(-0.35*windup-0.25*follow,0,0),
    };
  }
  if (kind === 1) return {
    R_Upperarm: euler(0.75*rise,0.12*rise,-0.55*rise), R_Forearm: euler(0.3*rise,0,0.15*rise), R_Hand: euler(-0.6*rise,0,0.55*rise),
    L_Upperarm: euler(0.55*rise,0,0.4*rise), L_Forearm: euler(0.3*rise,0,0),
    Spine02: axis(0,1,0,0.16*power),
  };
  // Angles are fitted to this rig's lowered-arm idle: bow hand extends forward,
  // arrow hand draws back toward the face. Do not assume a T-pose skeleton.
  return { L_Upperarm: euler(1.14*rise,0.06*rise,-0.32*rise), L_Forearm: euler(0.35*rise,0.05*rise,0.15*rise), R_Upperarm: euler(0.41*rise,-0.44*rise,0.56*rise), R_Forearm: euler(1.16*rise,-0.44*rise,-0.44*rise) };
}

const paths = ["sword", "staff", "bow", "arrow"] as const;
const handNames = ["R_Hand", "R_Hand", "L_Hand"] as const;
/** Remove accumulated skeleton scale while preserving the complete hand orientation and translation. */
function rigid(m: Float32Array): Float32Array {
  const out = m.slice();
  for (const i of [0,4,8]) { const n = Math.hypot(out[i],out[i+1],out[i+2]) || 1; for (let j=0;j<3;j++) out[i+j] /= n; }
  return out;
}
export class Weapons {
  private models: GpuModel[] = [];
  private projectile!: GpuModel;
  private socketSettings = readSocketSettings();
  private calibrations = new WeakMap<Animator, Map<string, Float32Array>>();
  constructor(private renderer: ModelRenderer) {}
  async load(existing?: readonly GltfDoc[]) {
    const docs = existing ?? await Promise.all(paths.map(p => loadGlb(new URL(`assets/weapons/${p}.glb`, document.baseURI).href)));
    this.models = docs.map(d => this.renderer.upload(d));
    this.projectile = this.renderer.instance(this.models[3]);
  }
  documents(): GltfDoc[] { return this.models.map(model => model.doc); }
  socket(slot: SocketName): SocketAdjustment { return { ...this.socketSettings[slot] }; }
  setSocket(slot: SocketName, value: SocketAdjustment): boolean {
    this.socketSettings[slot] = { ...value };
    return saveSocketSettings(this.socketSettings);
  }
  resetSocket(slot: SocketName): boolean { return this.setSocket(slot, defaultSocketSettings()[slot]); }
  socketJSON(): string { return JSON.stringify(this.socketSettings, null, 2); }
  /** Each extra actor needs independent draw buffers. */
  instance(): Weapons {
    const copy = new Weapons(this.renderer); copy.models = this.models.map(m => this.renderer.instance(m)); copy.projectile = this.renderer.instance(this.models[3]); return copy;
  }
  calibrate(animator: Animator) {
    animator.update([{clip:"idle",time:0}],mat4.identity());
    const result = new Map<string,Float32Array>();
    for (const hand of ["L_Hand","R_Hand"]) {
      const m = animator.nodeWorld(hand); if (!m) throw new Error(`Character is missing ${hand}`);
      const rotation = rigid(m); rotation[12]=rotation[13]=rotation[14]=0;
      result.set(hand,mat4.invert(rotation));
    }
    this.calibrations.set(animator,result);
  }
  private root(animator: Animator, hand: string, px: number, py: number, pz: number, yaw: number, pitch: number, roll: number, size: number, width = 1) {
    const world=animator.nodeWorld(hand), calibration=this.calibrations.get(animator)?.get(hand);
    if (!world || !calibration) throw new Error(`Weapon hand ${hand} was not calibrated`);
    const local=mat4.identity(); mat4.compose(local,0,px,py,pz,yaw,pitch,roll,size*width,size,size*width);
    return mat4.mul(mat4.mul(rigid(world),calibration),local);
  }
  drawProjectile(start: [number, number], end: [number, number], progress: number) {
    const t=Math.max(0,Math.min(1,progress)), dx=end[0]-start[0], dz=end[1]-start[1];
    const root=mat4.identity(); mat4.compose(root,0,start[0]+dx*t,0.85+0.12*Math.sin(Math.PI*t),start[1]+dz*t,Math.atan2(dx,dz),0,0,1,1,1);
    this.renderer.prepareStatic(this.projectile,{root});
  }
  draw(animator: Animator, kind: number, age = Infinity, facing = 0, slots: { weapon?: boolean; arrow?: boolean; showArrow?: boolean } = {}) {
    // Tripo models are centred. Shift the sword grip to the hand; staff and bow
    // are held near their middles. Asset dimensions are roughly one metre.
    const hand=handNames[kind] ?? handNames[0];
    const slot = paths[kind] ?? paths[0], base=equipmentConfig.base[slot], adjust=this.socketSettings[slot];
    const radians=Math.PI/180;
    const weaponRoot=this.root(animator,hand,base.x+adjust.x,base.y+adjust.y,base.z+adjust.z,(base.yaw+adjust.yaw)*radians,(base.pitch+adjust.pitch)*radians,(base.roll+adjust.roll)*radians,base.scale,base.width);
    if (slots.weapon !== false) this.renderer.prepareStatic(this.models[kind] ?? this.models[0],{root:weaponRoot});
    if (kind === 2 && slots.arrow !== false && (slots.showArrow || (age >= 0 && age < 0.32))) {
      // The arrow is nocked at the bowstring. It follows the posed bow, while
      // its long axis aims in the character's facing direction.
      const nock=mat4.transformPoint(weaponRoot,[0,0,-0.08]);
      const anchor=mat4.identity(); mat4.compose(anchor,0,nock[0],nock[1],nock[2],facing,0,0,1,1,1);
      const adjustment=this.socketSettings.arrow, arrowBase=equipmentConfig.base.arrow, local=mat4.identity();
      mat4.compose(local,0,arrowBase.x+adjustment.x,arrowBase.y+adjustment.y,arrowBase.z+adjustment.z,(arrowBase.yaw+adjustment.yaw)*radians,(arrowBase.pitch+adjustment.pitch)*radians,(arrowBase.roll+adjustment.roll)*radians,arrowBase.scale*arrowBase.width,arrowBase.scale,arrowBase.scale*arrowBase.width);
      this.renderer.prepareStatic(this.models[3],{root:mat4.mul(anchor,local)});
    }
  }
}
