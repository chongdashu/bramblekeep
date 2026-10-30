import layout from "./terrain.json";

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

/** Height of the authored meadow in world metres. The river and path stay flat. */
export function terrainHeight(x: number, z: number): number {
  let height = 0;
  for (const [cx, cz, rise, rx, rz] of layout.hills) {
    const d = Math.hypot((x-cx)/rx, (z-cz)/rz);
    height += rise * smooth(1-d);
  }
  // Flat pads under static props, plus a smooth apron around the bridge/path.
  let mask = smooth((Math.abs(x)-2.2)/2);
  const centre = 8 - 0.8 * Math.sin(x * 0.16);
  const half = 1.7 * (1 + 0.12 * Math.sin(x * 0.32));
  mask *= smooth((Math.abs(z-centre)-half-1.4)/2);
  for (const [cx, cz, radius] of layout.flatAreas) mask *= smooth((Math.hypot(x-cx,z-cz)-radius)/1.2);
  return height * mask;
}
