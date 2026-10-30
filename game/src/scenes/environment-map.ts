import routes from "./assault-routes.json";
import courtyard from "./courtyard-layout.json";
import camp from "./camp-layout.json";
import outskirts from "./castle-outskirts.json";
import propLayout from "./world-props.json";
import riverBank from "./river-bank.json";
import { FOREST, TORCHES } from "./environment-forest";
import { BAD_TREE_NESTS } from "../castle-spawns";

/** Measured environment exploration blockout, in world metres (Y is height). */
export const MAP = {
  bounds: [-22, -45, 22, 26] as const,
  camp: [0, 22] as const,
  bridge: [0, 8] as const,
  tent: [-7, 22] as const,
  tentHalf: [1.668, 1.492] as const,
  castle: [0, -18] as const,
  speed: 6,
  radius: 0.30,
  bridgeHalfWidth: 1.35,
  trees: [[-14, 17], [12, 15], [-12, -2], [13, -6], [-15, -21], [15, -21], ...riverBank.trees.map(t => [t.x,t.z] as const)] as readonly (readonly [number, number])[],
};

/** Prop collision circles are derived from the same layout used by the Blender export. */
export const PROP_COLLIDERS = propLayout.placements.flatMap(prop => {
  const yaw = prop.yaw ?? 0, c = Math.cos(yaw), s = Math.sin(yaw);
  return prop.colliders.map(([x, z, radius]) => ({ x: prop.x + c*x + s*z, z: prop.z - s*x + c*z, radius, kind: prop.kind }));
});

/** The water edge follows the same ribbon used in build-kit.py. */
export function riverEdge(x: number): [number, number] {
  const centre = 8 - 0.8 * Math.sin(x * 0.16);
  const half = 1.7 * (1 + 0.12 * Math.sin(x * 0.32));
  return [centre - half, centre + half];
}

/** Point/player-radius against visible water, keep footprint, tree trunks and boundary. */
export function canStand(x: number, z: number, gateOpen = false): boolean {
  const r=MAP.radius, [xmin,zmin,xmax,zmax]=MAP.bounds;
  if (x < xmin+r || x > xmax-r || z < zmin+r || z > zmax-r) return false;
  const [lo,hi]=riverEdge(x);
  if (z > lo-r && z < hi+r && !routes.crossings.some(cx => Math.abs(x-cx) < (cx === 0 ? MAP.bridgeHalfWidth : routes.sideHalfWidth)-r)) return false;
  if (x > -5.4-r && x < 5.4+r && z > -20.1-r && z < -15.9+r && !(gateOpen && Math.abs(x) < 1.2-r)) return false;
  // Curtain walls and the outer towers flank the existing closed gate.
  if (Math.abs(x) < 11.3+r && Math.abs(x) > 5.1-r && z > -19.1-r && z < -16.9+r) return false;
  if ([-11,11].some(tx => Math.hypot(x-tx,z+18) < 1.8+r)) return false;
  // Side and rear walls enclose a roughly 20 × 20 m castle courtyard.
  if (Math.abs(Math.abs(x)-11) < 1.1+r && z > -40.5-r && z < -19+r) return false;
  if (Math.abs(x) < 12.5+r && z > -41.2-r && z < -39-r) return false;
  // Low stone garden planters sit against the rear wall.
  if (courtyard.planters.some(p => Math.abs(x-p.x) < p.halfWidth+r && Math.abs(z-p.z) < p.halfDepth+r)) return false;
  // The barracks bodies are solid; their front doors face the open arena.
  if (courtyard.barracks.some(b => Math.abs(x-b.x) < b.halfWidth+r && z > b.back-r && z < b.front+r)) return false;
  // Invisible collision volumes follow the visible perimeter barricades.
  if (outskirts.sideFences.some(f => Math.abs(x-f.x) < .12+r && Math.abs(z-f.z) < 2.53+r)) return false;
  if (outskirts.rearFences.some(f => Math.abs(x-f.x) < 2.53+r && Math.abs(z-f.z) < .12+r)) return false;
  if (outskirts.supplyGroups.some(g => Math.abs(x-g.x) < .45+r && Math.abs(z-g.z) < .45+r || Math.hypot(x-(g.x+g.side*.75),z-(g.z+.7)) < .36+r)) return false;
  if (outskirts.lights.some(([lx,lz]) => Math.hypot(x-lx,z-lz) < .10+r)) return false;
  if (camp.tents.some(t => Math.abs(x-t.x) < t.halfWidth+r && Math.abs(z-t.z) < t.halfDepth+r)) return false;
  if (camp.solids.some(p => Math.hypot(x-p.x,z-p.z) < p.radius+r)) return false;
  if (camp.lights.some(([lx,lz]) => Math.hypot(x-lx,z-lz) < 0.18+r)) return false;
  if (PROP_COLLIDERS.some(p => Math.hypot(x-p.x,z-p.z) < p.radius+r)) return false;
  if (riverBank.rocks.some(p => Math.hypot(x-p.x,z-p.z) < p.radius+r)) return false;
  if (MAP.trees.some(([tx,tz]) => Math.hypot(x-tx,z-tz) < 0.55+r)) return false;
  if (BAD_TREE_NESTS.some(t => Math.hypot(x-t.x,z-t.z) < 0.72+r)) return false;
  if (FOREST.near.some(t => Math.hypot(x-t.x,z-t.z) < 0.55*t.scale+r)) return false;
  if (TORCHES.some(([tx,tz]) => Math.hypot(x-tx,z-tz) < 0.22+r)) return false;
  return true;
}

/** Slide along visible obstacles with small steps to prevent tunnelling. */
export function moveOnMap(x: number, z: number, dx: number, dz: number, gateOpen = false): [number, number] {
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.15));
  for (let i=0;i<n;i++) {
    // A player already inside can leave after the gate reseals; entry stays blocked.
    const exitOnly = !gateOpen && z < -15.9+MAP.radius && dz > 0 && Math.abs(x) < 1.2-MAP.radius;
    if (canStand(x+dx/n,z,gateOpen || exitOnly)) x+=dx/n;
    if (canStand(x,z+dz/n,gateOpen || exitOnly)) z+=dz/n;
  }
  return [x,z];
}
