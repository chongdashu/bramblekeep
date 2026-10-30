import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGlb } from "@engine/gltf/glb";
import { Animator } from "@engine/gltf/animator";
import { mat4 } from "@engine/math";
import { loopLayers } from "../src/loop-layers";

describe("generated character run loops", () => {
  for (const name of ["hero-knight", "hero-spellcaster", "hero-scout"]) {
    it(`${name} keeps the run centered on the walk pivot`, async () => {
      const bytes = readFileSync(new URL(`../public/assets/characters/${name}.glb`, import.meta.url));
      const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const doc = await parseGlb(data, name, { textures: false });
      const actor = new Animator(doc), root = mat4.identity();
      const hip = (clip: string) => {
        actor.update([{ clip, time: 0 }], root);
        const world = actor.nodeWorld("Hip");
        expect(world).not.toBeNull();
        return [world![12], world![14]];
      };
      const walk = hip("walk"), run = hip("run");
      expect(Math.hypot(run[0] - walk[0], run[1] - walk[1])).toBeLessThan(0.01);
    });

    it(`${name} blends the run loop seam`, async () => {
      const bytes = readFileSync(new URL(`../public/assets/characters/${name}.glb`, import.meta.url));
      const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const doc = await parseGlb(data, name, { textures: false });
      const actor = new Animator(doc), duration = actor.clipDuration("run"), root = mat4.identity();
      const pose = (layers: ReturnType<typeof loopLayers>) => { actor.update(layers, root); return actor.jointMatrices.slice(); };
      for (const weight of [0.3, 0.65, 1]) {
        const start = pose(loopLayers("run", 0.00001, duration, weight));
        const end = pose(loopLayers("run", 0.99999, duration, weight));
        const jump = Math.max(...start.map((value, i) => Math.abs(value - end[i])));
        expect(jump).toBeLessThan(0.01);
      }
    });
  }
});
