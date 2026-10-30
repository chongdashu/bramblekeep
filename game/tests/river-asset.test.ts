import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guard the export features needed for visible depth and to avoid the large
// thresholded specular disc reported on the original glossy surface.
describe("river crossing export", () => {
  it("ships a textured, matte translucent surface over an authored bed", () => {
    const glb = readFileSync(new URL("../public/assets/environment-lab/river-crossing.glb", import.meta.url));
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8"));
    const water = json.materials.find((m: { name: string }) => m.name === "River water");
    expect(water.extras.vgd_kind).toBe("liquid");
    for (const name of ["Path earth", "River landscape"]) {
      const material = json.materials.find((m: { name: string }) => m.name === name);
      expect(material.extras.vgd_kind).toBe("bump");
      expect(material.pbrMetallicRoughness.baseColorTexture).toBeDefined();
    }
    expect(water.alphaMode).toBe("BLEND");
    expect(water.pbrMetallicRoughness.roughnessFactor).toBeGreaterThanOrEqual(0.6);
    expect(water.pbrMetallicRoughness.baseColorTexture).toBeDefined();
    const path = json.materials.find((m: { name: string }) => m.name === "Path earth");
    expect(path.alphaMode).toBe("BLEND");
    expect(json.materials.map((m: { name: string }) => m.name)).toEqual(expect.arrayContaining(["Riverbed", "Submerged stones", "River edge earth"]));
    expect(json.images.every((image: { uri?: string }) => !image.uri)).toBe(true);
    const bounds = (name: string) => {
      const node = json.nodes.find((n: { name: string }) => n.name === name);
      const primitive = json.meshes[node.mesh].primitives[0];
      return json.accessors[primitive.attributes.POSITION];
    };
    const ground = bounds("crossing_River_landscape");
    const surface = bounds("crossing_River_water");
    const bed = bounds("crossing_Riverbed");
    const banks = bounds("crossing_River_edge_earth");
    expect(ground.min[1]).toBeCloseTo(0);
    expect(surface.max[1]).toBeLessThan(-0.2);
    expect(surface.min[1] - bed.max[1]).toBeGreaterThan(0.5);
    expect(banks.min[1]).toBeLessThan(-0.8);
    expect(banks.max[1]).toBeCloseTo(0);
  });
});
