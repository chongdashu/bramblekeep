import { describe, expect, it } from "vitest";
import { Camera } from "../src/camera";
import { FRAME_FLOATS, LOOK_AT, writeFrame } from "../src/gpu/frame";
import { DEFAULT_STYLE, MAX_LIGHTS, type FrameData, type Renderer } from "../src/gpu/renderer";

function fixture(style = DEFAULT_STYLE) {
  const camera = new Camera({}, "first-person");
  camera.setEye({ x: 0, y: 1.65, z: 4, yaw: Math.PI, pitch: 0 });
  camera.update(1 / 60, 0, 0, 16 / 9, [-10, -10, 10, 10]);
  const renderer = {
    sunDir: [-0.5, 0.8, 0.3], shadowHalf: 11, ground: { color: [0.3, 0.3, 0.3], y: -0.02 },
    lights: [], ambient: null, roomAO: null, skyCloud: { tint: [1,1,1], opacity: 1 },
  } as unknown as Renderer;
  const frame: FrameData = {
    camera, style, time: 0, dt: 1 / 60, batches: [],
    particles: new Float32Array(), particleCount: 0, blobs: new Float32Array(), blobCount: 0,
  };
  const u = new Float32Array(FRAME_FLOATS);
  const write = () => writeFrame(renderer, frame, 1280, 720, 2048, u);
  return { renderer, camera, u, write };
}

describe("shared indoor frame data", () => {
  it("packs bounded local lights and clears indoor state when changing scenes", () => {
    const { renderer, u, write } = fixture();
    renderer.ambient = { sky: [1, 0.5, 0.25], ground: [0.25, 0.5, 1] };
    renderer.roomAO = { min: [-5, 0, -6], max: [5, 3, 6], strength: 0.5, reach: 2 };
    renderer.lights = Array.from({ length: MAX_LIGHTS + 1 }, () => ({ at: [1, 2, 3], radius: 4, color: [0.5, 1, 0.25], intensity: 2 }));
    write();
    expect(u[110]).toBe(MAX_LIGHTS);
    expect([...u.slice(116, 132)]).toEqual([1, 0.5, 0.25, 1, 0.25, 0.5, 1, 0, -5, 0, -6, 0.5, 5, 3, 6, 2]);
    expect([...u.slice(132, 140)]).toEqual([1, 2, 3, 4, 1, 2, 0.5, 0]);
    renderer.lights = []; renderer.ambient = null; renderer.roomAO = null;
    write();
    expect(u[110]).toBe(0);
    expect([...u.slice(116, 131), ...u.slice(132, LOOK_AT)].every((n) => n === 0)).toBe(true);
  });

  it("keeps the shadow map on the game's explicit focus as the eye moves", () => {
    const { camera, u, write } = fixture();
    camera.shadowFocus = [2, -3];
    write();
    const shadow = u.slice(48, 64);
    camera.eye = [7, 2, 1];
    write();
    expect(u.slice(48, 64)).toEqual(shadow);
    camera.shadowFocus = [-4, 5];
    write();
    expect(u.slice(48, 64)).not.toEqual(shadow);
  });

  it("packs the look block after the lights with the template's constants by default", () => {
    const { renderer, u, write } = fixture();
    write();
    expect(FRAME_FLOATS).toBe(LOOK_AT + 28);
    const at = (o: number, n = 4) => [...u.slice(LOOK_AT + o, LOOK_AT + o + n)];
    const f = (v: number[]) => v.map((x) => Math.fround(x));
    expect(at(0, 3)).toEqual(f([0.36, 0.44, 0.7]));
    expect(at(4)).toEqual(f([0.34, 0.6, 0.92, 40]));
    expect(at(8)).toEqual(f([0.8, 0.88, 0.96, 150]));
    expect(at(12)).toEqual(f([0.58, 0.54, 0.46, 0]));
    expect(at(16)).toEqual(f([0, 1.5, 30, 2.5]));
    expect(at(20)).toEqual(f([0, 0.35, 0, 1]));
    expect(at(24)).toEqual(f([1,1,1,1]));
    renderer.skyCloud = {tint: [0.16,0.2,0.31], opacity: 0.7};
    write();
    expect(at(24)).toEqual(f([0.16,0.2,0.31,0.7]));
  });

  it("keeps haze and focus ranges ordered whatever the style says", () => {
    const { u, write } = fixture({ ...DEFAULT_STYLE, hazeStart: 80, hazeEnd: 20, dofNear: 0, dofFar: -1, dof: -2 });
    write();
    expect(u[LOOK_AT + 11]).toBeGreaterThan(u[LOOK_AT + 7]);
    expect(u[LOOK_AT + 16]).toBe(0);
    expect(u[LOOK_AT + 17]).toBeGreaterThan(0);
    expect(u[LOOK_AT + 18]).toBeGreaterThanOrEqual(u[LOOK_AT + 17]);
  });
});
