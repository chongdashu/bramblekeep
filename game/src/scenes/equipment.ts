/** Standalone equipment inspection using the same animated models as gameplay. */
import "./equipment.css";
import type { Game, Phase, RoundState, RoundSummary } from "@engine/game";
import type { Shot } from "@engine/camera";
import type { InputSnapshot } from "@engine/input";
import type { GameRuntime } from "@engine/runtime";
import { loadGlb } from "@engine/gltf/glb";
import { Animator, type Layer } from "@engine/gltf/animator";
import { ModelRenderer, type GpuModel } from "@engine/gpu/model";
import { MESH, hex } from "@engine/gpu/meshes";
import { mat4 } from "@engine/math";
import { attackPose, Weapons } from "../weapons";
import { type SocketField, type SocketName } from "../socket-adjustments";

const names = ["Knight", "Spellcaster", "Scout"] as const;
const files = ["hero-knight", "hero-spellcaster", "hero-scout"] as const;
type Animation = "idle" | "walk" | "run" | "attack" | "jump";
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class EquipmentPreview implements Game {
  readonly bounds: [number, number, number, number] = [-2000,-2000,2000,2000];
  private rt!: GameRuntime;
  private renderer!: ModelRenderer;
  private weapons!: Weapons;
  private actors: { animator: Animator; model: GpuModel; equipped: { animator: Animator; model: GpuModel } }[] = [];
  private panel!: HTMLElement;
  private selected = 0;
  private animation: Animation = "idle";
  private paused = false;
  private socketSlot: SocketName = "sword";
  private weaponOn = true;
  private arrowOn = true;
  private cameraAngle = 0;
  private cameraPitch = 15;
  private cameraZoom = 1;
  private drag: { id: number; x: number; y: number } | null = null;
  private clock = 0;
  private root = mat4.identity();

  async load(rt: GameRuntime, progress: (p: number, label?: string) => void) {
    this.rt = rt; progress(0.1, "Loading equipment…");
    this.renderer = new ModelRenderer(rt.renderer);
    const docs = await Promise.all(files.map(f => Promise.all(["", "-grip"].map(suffix => loadGlb(new URL(`assets/characters/${f}${suffix}.glb`,document.baseURI).href)))));
    this.actors = docs.map(([doc,grip],i) => {
      if (!doc.skins.length) throw new Error(`${names[i]} has no character rig`);
      const animator = new Animator(doc);
      for (const clip of ["idle","walk","run","jump"]) if (!animator.clipNames.includes(clip)) throw new Error(`${names[i]} is missing ${clip}`);
      return { animator, model: this.renderer.upload(doc), equipped: { animator: new Animator(grip), model: this.renderer.upload(grip) } };
    });
    this.weapons = new Weapons(this.renderer); await this.weapons.load();
    this.actors.forEach(a => { this.weapons.calibrate(a.animator); this.weapons.calibrate(a.equipped.animator); });
    rt.renderer.ground.color = hex(0xa6b4a3);
    rt.camera.rig.fovY=50*Math.PI/180;
    // This is an inspection orbit, centred on the character rather than its feet.
    rt.input.stickZone = () => false;
    rt.renderer.sceneHooks.push(() => this.renderer.draw());
    this.mount(); this.mountOrbit();
    Object.assign(rt.hooks, { equipmentPreview: () => ({ character:names[this.selected], animation:this.animation, weapon:this.weaponOn, arrow:this.arrowOn, arrowAvailable:this.selected===2, cameraAngle:this.cameraAngle, cameraPitch:this.cameraPitch, zoom:this.cameraZoom, time:this.clock, paused:this.paused, socketSlot:this.socketSlot, socket:this.weapons.socket(this.socketSlot) }) });
    progress(1,"Equipment ready");
  }
  private mount() {
    const panel = document.createElement("aside"); panel.id="equipment-preview"; panel.className="equipment-preview"; panel.hidden=true;
    panel.innerHTML = `<div class="equipment-heading"><strong>Equipment preview</strong><a href="./">Menu</a></div>
      <label>Character <select id="equipment-character" aria-label="Character"><option>Knight</option><option>Spellcaster</option><option>Scout</option></select></label>
      <label>Animation <select id="equipment-animation" aria-label="Animation"><option value="idle">Idle</option><option value="walk">Walk</option><option value="run">Run</option><option value="attack">Attack</option><option value="jump">Jump</option></select></label>
      <div class="equipment-playback"><button type="button" id="equipment-pause">Pause pose</button><label>Pose <output id="equipment-pose-value">0%</output><input id="equipment-pose" aria-label="Animation pose" type="range" min="0" max="100" value="0" step="1"></label></div>
      <fieldset><legend>Visible slots</legend><label><input id="equipment-weapon" type="checkbox" checked> <span id="equipment-weapon-label">Sword</span></label><label id="equipment-arrow-row"><input id="equipment-arrow" type="checkbox" checked> Arrow <small>Scout only</small></label></fieldset>
      <label>Camera angle <output id="equipment-angle-value">0°</output><input id="equipment-angle" aria-label="Camera angle" type="range" min="-180" max="180" value="0" step="1"></label>
      <label>Zoom <output id="equipment-zoom-value">100%</output><input id="equipment-zoom" aria-label="Zoom" type="range" min="65" max="180" value="100" step="5"></label>
      <button type="button" id="equipment-reset-view">Reset view</button>
      <details id="equipment-sockets"><summary>Edit sockets</summary>
        <div class="equipment-playback socket-playback"><button type="button" id="equipment-edit-pause">Pause pose</button><label>Pose <output id="equipment-edit-pose-value">0%</output><input id="equipment-edit-pose" aria-label="Socket animation pose" type="range" min="0" max="100" value="0" step="1"></label></div>
        <label>Attachment <select id="equipment-socket" aria-label="Attachment"><option value="sword">Sword</option><option value="staff">Staff</option><option value="bow">Bow</option><option value="arrow">Arrow (nocked)</option></select></label>
        <p class="socket-help">Adjust position and rotation in the attachment's local frame. Edits save on this device and override the shared config after reload. Reset restores the config. Arrow edits affect the nocked arrow.</p>
        <div id="equipment-socket-fields"></div>
        <div class="socket-actions"><button type="button" id="equipment-socket-reset">Reset attachment</button><button type="button" id="equipment-socket-copy">Copy settings</button></div>
        <output id="equipment-socket-status" aria-live="polite"></output>
      </details>
      <p>Drag the character to orbit. Scroll or use Zoom to move closer.</p>`;
    panel.addEventListener("pointerdown", e=>e.stopPropagation());
    document.body.append(panel); this.panel=panel;
    const character = panel.querySelector<HTMLSelectElement>("#equipment-character")!;
    const animation = panel.querySelector<HTMLSelectElement>("#equipment-animation")!;
    const weapon = panel.querySelector<HTMLInputElement>("#equipment-weapon")!;
    const arrow = panel.querySelector<HTMLInputElement>("#equipment-arrow")!;
    const arrowRow = panel.querySelector<HTMLElement>("#equipment-arrow-row")!;
    const weaponLabel = panel.querySelector<HTMLElement>("#equipment-weapon-label")!;
    const angle = panel.querySelector<HTMLInputElement>("#equipment-angle")!;
    const angleValue = panel.querySelector<HTMLOutputElement>("#equipment-angle-value")!;
    const zoom = panel.querySelector<HTMLInputElement>("#equipment-zoom")!;
    const zoomValue = panel.querySelector<HTMLOutputElement>("#equipment-zoom-value")!;
    const pause = panel.querySelector<HTMLButtonElement>("#equipment-pause")!;
    const pose = panel.querySelector<HTMLInputElement>("#equipment-pose")!;
    const poseValue = panel.querySelector<HTMLOutputElement>("#equipment-pose-value")!;
    const editPause = panel.querySelector<HTMLButtonElement>("#equipment-edit-pause")!;
    const editPose = panel.querySelector<HTMLInputElement>("#equipment-edit-pose")!;
    const editPoseValue = panel.querySelector<HTMLOutputElement>("#equipment-edit-pose-value")!;
    const socketSelect = panel.querySelector<HTMLSelectElement>("#equipment-socket")!;
    const socketFields = panel.querySelector<HTMLElement>("#equipment-socket-fields")!;
    const socketStatus = panel.querySelector<HTMLOutputElement>("#equipment-socket-status")!;
    const refreshSockets = () => {
      socketSelect.value=this.socketSlot;
      for (const option of socketSelect.options) option.disabled = option.value !== (["sword","staff","bow"] as const)[this.selected] && !(this.selected===2 && option.value==="arrow");
      socketFields.replaceChildren();
      const values=this.weapons.socket(this.socketSlot);
      const fields: [SocketField,string,number,number,number,string][] = [
        ["x","Position X",-0.5,0.5,0.005,"m"],["y","Position Y",-0.5,0.5,0.005,"m"],["z","Position Z",-0.5,0.5,0.005,"m"],
        ["yaw","Yaw",-180,180,1,"°"],["pitch","Pitch",-180,180,1,"°"],["roll","Roll",-180,180,1,"°"]
      ];
      for (const [key,label,min,max,step,unit] of fields) {
        const row=document.createElement("label"), title=document.createElement("span"), output=document.createElement("output"), input=document.createElement("input");
        title.textContent=label; output.textContent=`${values[key]} ${unit}`; input.type="range"; input.min=String(min); input.max=String(max); input.step=String(step); input.value=String(values[key]); input.dataset.socketField=key; input.setAttribute("aria-label",label);
        input.addEventListener("input",()=>{ const next=this.weapons.socket(this.socketSlot); next[key]=Number(input.value); output.textContent=`${next[key]} ${unit}`; socketStatus.textContent=this.weapons.setSocket(this.socketSlot,next)?"Saved on this device":"Could not save; this preview only"; });
        row.append(title,output,input);socketFields.append(row);
      }
    };
    const syncPause = () => { pause.textContent=editPause.textContent=this.paused?"Play animation":"Pause pose"; };
    const togglePause = () => { this.paused=!this.paused; syncPause(); };
    const seek = (input:HTMLInputElement) => { this.paused=true; syncPause(); this.clock=this.animationDuration()*Number(input.value)/100; pose.value=editPose.value=input.value; poseValue.value=editPoseValue.value=`${input.value}%`; };
    pause.addEventListener("click",togglePause); editPause.addEventListener("click",togglePause);
    pose.addEventListener("input",()=>seek(pose)); editPose.addEventListener("input",()=>seek(editPose));
    socketSelect.addEventListener("change",()=>{this.socketSlot=socketSelect.value as SocketName;socketStatus.textContent="";refreshSockets();});
    panel.querySelector<HTMLButtonElement>("#equipment-socket-reset")!.addEventListener("click",()=>{socketStatus.textContent=this.weapons.resetSocket(this.socketSlot)?"Attachment reset":"Reset for this preview";refreshSockets();});
    panel.querySelector<HTMLButtonElement>("#equipment-socket-copy")!.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(this.weapons.socketJSON());socketStatus.textContent="Settings copied";}catch{socketStatus.textContent="Copy unavailable";}});
    const refresh = () => { weaponLabel.textContent=["Sword","Staff","Bow"][this.selected]; arrow.disabled=this.selected!==2; arrowRow.classList.toggle("unavailable",arrow.disabled); };
    character.addEventListener("change",()=>{ this.selected=character.selectedIndex; this.clock=0; this.socketSlot=(["sword","staff","bow"] as const)[this.selected]; refresh(); refreshSockets(); });
    animation.addEventListener("change",()=>{ this.animation=animation.value as Animation; this.clock=0; });
    weapon.addEventListener("change",()=>{ this.weaponOn=weapon.checked; });
    arrow.addEventListener("change",()=>{ this.arrowOn=arrow.checked; });
    angle.addEventListener("input",()=>{ this.cameraAngle=Number(angle.value); angleValue.value=`${this.cameraAngle}°`; });
    zoom.addEventListener("input",()=>{ this.cameraZoom=Number(zoom.value)/100; zoomValue.value=`${zoom.value}%`; });
    panel.querySelector<HTMLButtonElement>("#equipment-reset-view")!.addEventListener("click",()=>{ this.cameraAngle=0; this.cameraPitch=15; this.cameraZoom=1; this.syncViewControls(); });
    refresh(); refreshSockets();
  }
  private animationDuration() { return this.animation === "attack" ? 0.9 : this.actors[this.selected].animator.clipDuration(this.animation) || 1; }
  private syncViewControls() {
    const angle=this.panel.querySelector<HTMLInputElement>("#equipment-angle")!;
    const zoom=this.panel.querySelector<HTMLInputElement>("#equipment-zoom")!;
    angle.value=String(Math.round(this.cameraAngle));
    this.panel.querySelector<HTMLOutputElement>("#equipment-angle-value")!.value=`${angle.value}°`;
    zoom.value=String(Math.round(this.cameraZoom*100/5)*5);
    this.panel.querySelector<HTMLOutputElement>("#equipment-zoom-value")!.value=`${zoom.value}%`;
  }
  private mountOrbit() {
    const canvas=this.rt.canvas;
    canvas.addEventListener("pointerdown", e=>{
      if (this.rt.phase!=="playing" || this.drag || (e.pointerType==="mouse" && e.button!==0)) return;
      this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};
      try { canvas.setPointerCapture(e.pointerId); } catch { /* capture may be held already */ }
    });
    canvas.addEventListener("pointermove", e=>{
      if (!this.drag || this.drag.id!==e.pointerId) return;
      const dx=e.clientX-this.drag.x, dy=e.clientY-this.drag.y;
      this.drag.x=e.clientX; this.drag.y=e.clientY;
      this.cameraAngle=Math.atan2(Math.sin((this.cameraAngle-dx*0.35)*Math.PI/180),Math.cos((this.cameraAngle-dx*0.35)*Math.PI/180))*180/Math.PI;
      this.cameraPitch=clamp(this.cameraPitch+dy*0.25,-10,70);
      this.syncViewControls(); e.preventDefault();
    });
    const end=(e: PointerEvent)=>{ if(this.drag?.id===e.pointerId) this.drag=null; };
    canvas.addEventListener("pointerup",end); canvas.addEventListener("pointercancel",end); canvas.addEventListener("lostpointercapture",end);
    canvas.addEventListener("wheel",e=>{
      if(this.rt.phase!=="playing") return;
      e.preventDefault(); this.cameraZoom=clamp(this.cameraZoom*Math.exp(-e.deltaY*0.001),0.65,1.8); this.syncViewControls();
    },{passive:false});
  }
  skipCountdown() { return true; }
  reset() { this.clock=0; }
  startRound() { this.rt.sim.x.sim_round_start(); }
  round(): RoundState { return "playing"; }
  input(_snap: InputSnapshot) {}
  event() {}
  frame(dt: number, _snap: InputSnapshot, phase: Phase): [number,number] {
    if (this.panel) this.panel.hidden=phase!=="playing";
    if (phase==="playing") {
      if (!this.paused) this.clock+=dt;
      const progress=(this.clock % this.animationDuration())/this.animationDuration();
      const pose=this.panel.querySelector<HTMLInputElement>("#equipment-pose")!; pose.value=String(Math.round(progress*100));
      this.panel.querySelector<HTMLOutputElement>("#equipment-pose-value")!.value=`${pose.value}%`;
      this.panel.querySelector<HTMLInputElement>("#equipment-edit-pose")!.value=pose.value;
      this.panel.querySelector<HTMLOutputElement>("#equipment-edit-pose-value")!.value=`${pose.value}%`;
      const aspect=this.rt.canvas.clientWidth/Math.max(1,this.rt.canvas.clientHeight);
      const portrait=aspect<1;
      const distance=(portrait ? 2.7/(2*Math.tan(25*Math.PI/180)*aspect) : 3.4)/this.cameraZoom;
      this.rt.camera.shot={target:[0,portrait ? -0.1 : 0.85,0],yaw:this.cameraAngle*Math.PI/180,pitch:this.cameraPitch*Math.PI/180,distance};
      this.rt.camera.shotBlend=1;
    }
    return [0,0];
  }
  draw() {
    const entry=this.actors[this.selected];
    const actor=this.weaponOn ? entry.equipped : entry;
    this.rt.batches[MESH.box].push(0,-0.04,0,0,0,0,12,0.08,12,hex(0xcbd4c3),0.8);
    const layers: Layer[]=[{clip:"idle",time:this.clock}];
    if (this.animation==="walk" || this.animation==="run") layers.push({clip:this.animation,time:this.clock});
    if (this.animation==="jump") layers.push({clip:"jump",time:this.clock,loop:true});
    const attackAge=this.animation==="attack" ? this.clock % 0.9 : Infinity;
    actor.animator.update(layers,this.root,attackPose(this.selected,attackAge));
    this.renderer.prepareSkinned(actor.model,actor.animator);
    this.weapons.draw(actor.animator,this.selected,attackAge,0,{weapon:this.weaponOn,arrow:this.arrowOn,showArrow:true});
    this.rt.blob(0,0,0.45,0.4);
  }
  menuShot(): Shot { return {target:[0,0,0],pitch:0.9,yaw:0,distance:8}; }
  heroShot(): Shot { return this.menuShot(); }
  summary(): RoundSummary { return {won:false,title:"Equipment preview",ribbon:"Preview",rows:[],note:""}; }
  countdown() {}
  showHud(on: boolean) { const h=document.querySelector<HTMLElement>("#hud"); if (h) h.hidden=true; if(this.panel)this.panel.hidden=!on; }
  stats(): Record<string,number> { return { character:this.selected, weapon:Number(this.weaponOn), arrow:Number(this.arrowOn), cameraAngle:this.cameraAngle }; }
}
