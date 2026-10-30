import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGlb } from "@engine/gltf/glb";
import { Animator } from "@engine/gltf/animator";
import { mat4 } from "@engine/math";
import { attackPose, Weapons } from "../src/weapons";
import type { ModelRenderer, GpuModel } from "@engine/gpu/model";

describe("equipped characters", () => {
  for (const [index, name] of ["hero-knight", "hero-spellcaster", "hero-scout"].entries()) {
    it(`${name} has hands and visibly moves its weapon arm during an attack`, async () => {
      const bytes=readFileSync(new URL(`../public/assets/characters/${name}.glb`,import.meta.url));
      const doc=await parseGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),name,{textures:false});
      const animator=new Animator(doc), root=mat4.identity();
      for (const hand of ["L_Hand","R_Hand"]) expect(animator.nodeIndex(hand)).toBeGreaterThanOrEqual(0);
      const hand=index===2 ? "L_Hand" : "R_Hand";
      animator.update([{clip:"idle",time:0}],root); const rest=animator.nodeWorld(hand)!.slice();
      animator.update([{clip:"idle",time:0}],root,attackPose(index,0.2)); const posed=animator.nodeWorld(hand)!;
      expect(Math.hypot(posed[12]-rest[12],posed[13]-rest[13],posed[14]-rest[14])).toBeGreaterThan(0.03);
      expect(attackPose(index,0.58)).toBeUndefined();
    });
  }
  it("gives the knight a body-driven slash and recovers before the default repeat", async () => {
    const bytes = readFileSync(new URL("../public/assets/characters/hero-knight-grip.glb", import.meta.url));
    const doc = await parseGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"knight",{textures:false});
    const animator = new Animator(doc), root = mat4.identity();
    const sample = (age:number, name:string) => { animator.update([{clip:"idle",time:0}],root,attackPose(0,age)); return animator.nodeWorld(name)!.slice(); };
    const rest = sample(0,"R_Hand"), windup = sample(0.13,"R_Hand"), cut = sample(0.23,"R_Hand"), recovered = sample(0.46,"R_Hand");
    const delta = (a:Float32Array,b:Float32Array) => Math.hypot(a[12]-b[12],a[13]-b[13],a[14]-b[14]);
    expect(delta(rest,windup)).toBeGreaterThan(0.15);
    expect(delta(windup,cut)).toBeGreaterThan(0.15);
    expect(delta(rest,recovered)).toBeLessThan(0.001);
    const spine0=sample(0,"Spine02"), spine1=sample(0.13,"Spine02");
    expect(Math.hypot(spine1[0]-spine0[0],spine1[1]-spine0[1],spine1[2]-spine0[2])).toBeGreaterThan(0.1);
  });
  it("keeps the knight's sword-arm joints outside the chest during the forward cut", async () => {
    const bytes=readFileSync(new URL("../public/assets/characters/hero-knight-grip.glb",import.meta.url));
    const doc=await parseGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"knight",{textures:false});
    const animator=new Animator(doc);
    for (const time of [0.18,0.20,0.22,0.25,0.28,0.31,0.34]) {
      animator.update([{clip:"idle",time:0}],mat4.identity(),attackPose(0,time));
      const chestInverse=mat4.invert(animator.nodeWorld("Spine02")!);
      for (const name of ["R_Forearm","R_Hand"]) {
        const m=animator.nodeWorld(name)!;
        const local=mat4.transformPoint(chestInverse,[m[12],m[13],m[14]]);
        // A joint-centre guard; the mesh itself still needs visual review.
        expect(local[0],`${name} at ${time}s`).toBeGreaterThan(0.10);
      }
    }
  });
  it("keeps both spellcaster arm joints outside the torso during the cast", async () => {
    const bytes=readFileSync(new URL("../public/assets/characters/hero-spellcaster-grip.glb",import.meta.url));
    const doc=await parseGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"spellcaster",{textures:false});
    const animator=new Animator(doc);
    for (const time of [0.1,0.16,0.22,0.28,0.34,0.40,0.46]) {
      animator.update([{clip:"idle",time:0}],mat4.identity(),attackPose(1,time));
      const inverse=mat4.invert(animator.nodeWorld("Spine02")!);
      for (const [name,side] of [["R_Forearm",1],["R_Hand",1],["L_Forearm",-1],["L_Hand",-1]] as const) {
        const m=animator.nodeWorld(name)!;
        const local=mat4.transformPoint(inverse,[m[12],m[13],m[14]]);
        // Joint-centre guard; see runtime captures for mesh clearance.
        expect(side*local[0],`${name} at ${time}s`).toBeGreaterThan(0.09);
      }
    }
  });
  it("angles the knight sword forward while keeping its grip near the hand",async()=>{
    const bytes=readFileSync(new URL("../public/assets/characters/hero-knight-grip.glb",import.meta.url));
    const doc=await parseGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"knight",{textures:false});
    const animator=new Animator(doc), calls:{root:Float32Array}[]=[];
    const renderer={prepareStatic:(_model:unknown,opts:{root:Float32Array})=>calls.push(opts)} as unknown as ModelRenderer;
    const weapons=new Weapons(renderer);
    (weapons as unknown as {models:GpuModel[]}).models=[{},{},{},{}] as GpuModel[];
    weapons.calibrate(animator); animator.update([{clip:"idle",time:0}],mat4.identity()); weapons.draw(animator,0);
    const m=calls[0].root;
    expect(Math.atan2(m[6],m[5])).toBeCloseTo(Math.PI/6,2);
    const grip=mat4.transformPoint(m,[0,-0.3,0]),hand=animator.nodeWorld("R_Hand")!;
    expect(Math.hypot(grip[0]-hand[12],grip[1]-hand[13],grip[2]-hand[14])).toBeLessThan(0.09);
  });
  it.each(["sword","staff","bow","arrow"])("loads the tracked %s model",async name=>{
    const bytes=readFileSync(new URL(`../public/assets/weapons/${name}.glb`,import.meta.url));
    const doc=await parseGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),name,{textures:false});
    expect(doc.meshes.length).toBeGreaterThan(0);
  });
  it("draws the scout bow and arrow slots independently", async () => {
    const bytes=readFileSync(new URL("../public/assets/characters/hero-scout.glb",import.meta.url));
    const doc=await parseGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"scout",{textures:false});
    const animator=new Animator(doc), draws: unknown[]=[];
    const renderer={prepareStatic: (model: unknown) => draws.push(model)} as unknown as ModelRenderer;
    const weapons=new Weapons(renderer);
    const models=[{id:"sword"},{id:"staff"},{id:"bow"},{id:"arrow"}];
    (weapons as unknown as {models: GpuModel[]}).models=models as unknown as GpuModel[];
    weapons.calibrate(animator);
    weapons.draw(animator,2,Infinity,0,{weapon:true,arrow:true,showArrow:true});
    expect(draws).toEqual([models[2],models[3]]);
    draws.length=0;
    weapons.draw(animator,2,Infinity,0,{weapon:false,arrow:true,showArrow:true});
    expect(draws).toEqual([models[3]]);
    draws.length=0;
    weapons.draw(animator,2,0.1,0,{weapon:true,arrow:false,showArrow:true});
    expect(draws).toEqual([models[2]]);
  });

  it.each(["knight","spellcaster","scout"])("preserves the %s rig and clips in the equipped hand variant",async name=>{
    const load=async (suffix:string)=>{const bytes=readFileSync(new URL(`../public/assets/characters/hero-${name}${suffix}.glb`,import.meta.url));return parseGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),name,{textures:false});};
    const [open,grip]=await Promise.all([load(""),load("-grip")]);
    const names=(d:typeof open)=>d.skins[0].joints.map(i=>d.nodes[i].name);
    expect(names(grip)).toEqual(names(open));
    const a=new Animator(open),b=new Animator(grip);
    for(const clip of ["idle","walk","run","jump"]) {
      expect(b.clipDuration(clip)).toBeCloseTo(a.clipDuration(clip),3);
      for(const phase of [0,0.35,0.7]) {
        const time=a.clipDuration(clip)*phase;
        a.update([{clip,time}],mat4.identity()); b.update([{clip,time}],mat4.identity());
        for(const hand of ["L_Hand","R_Hand"]) {
          const x=a.nodeWorld(hand)!,y=b.nodeWorld(hand)!;
          expect(Math.hypot(x[12]-y[12],x[13]-y[13],x[14]-y[14])).toBeLessThan(0.005);
        }
      }
    }
  });
  it("applies the arrow socket adjustment in aim space", async () => {
    const bytes=readFileSync(new URL("../public/assets/characters/hero-scout-grip.glb",import.meta.url));
    const doc=await parseGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"scout",{textures:false});
    const animator=new Animator(doc),calls:{root:Float32Array}[]=[];
    const renderer={prepareStatic:(_model:unknown,opts:{root:Float32Array})=>calls.push(opts)} as unknown as ModelRenderer;
    const weapons=new Weapons(renderer); (weapons as unknown as {models:GpuModel[]}).models=[{},{},{},{}] as GpuModel[];
    weapons.calibrate(animator); animator.update([{clip:"idle",time:0}],mat4.identity());
    weapons.draw(animator,2,0.2,0,{weapon:false,showArrow:true}); const before=calls.pop()!.root;
    weapons.setSocket("arrow",{x:0.1,y:0,z:0,yaw:0,pitch:30,roll:0});
    weapons.draw(animator,2,0.2,0,{weapon:false,showArrow:true}); const after=calls.pop()!.root;
    expect(after[12]-before[12]).toBeCloseTo(0.1,4);
    expect(Math.atan2(-after[9],after[10])).toBeCloseTo(Math.PI/6,4);
  });
  it("anchors the preview arrow to the animated bowstring",async()=>{
    const bytes=readFileSync(new URL("../public/assets/characters/hero-scout-grip.glb",import.meta.url));
    const doc=await parseGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"scout",{textures:false});
    const animator=new Animator(doc), calls: {model:unknown;root:Float32Array}[]=[];
    const renderer={prepareStatic:(model:unknown,opts:{root:Float32Array})=>calls.push({model,root:opts.root})} as unknown as ModelRenderer;
    const weapons=new Weapons(renderer),models=[{id:"sword"},{id:"staff"},{id:"bow"},{id:"arrow"}];
    (weapons as unknown as {models:GpuModel[]}).models=models as unknown as GpuModel[];
    weapons.calibrate(animator);
    animator.update([{clip:"idle",time:0}],mat4.identity(),attackPose(2,0.22));
    weapons.draw(animator,2,0.22,0,{showArrow:true});
    const bow=calls.find(c=>c.model===models[2])!,arrow=calls.find(c=>c.model===models[3])!;
    const nock=mat4.transformPoint(bow.root,[0,0,-0.08]),tail=mat4.transformPoint(arrow.root,[0,0,-0.27]);
    expect(Math.hypot(nock[0]-tail[0],nock[1]-tail[1],nock[2]-tail[2])).toBeLessThan(0.001);
  });

});
