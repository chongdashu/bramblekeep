/** Repeatable, art-directable woodland layout in world metres. */
export type ForestTree = { x: number; z: number; scale: number; yaw: number };

function hash(x: number, z: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + 12113;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise, so clearings and clusters are larger than one grid cell. */
function noise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const smooth = (t: number) => t*t*(3-2*t);
  const u = smooth(x-ix), v = smooth(z-iz);
  const a = hash(ix,iz)*(1-u)+hash(ix+1,iz)*u;
  const b = hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u;
  return a*(1-v)+b*v;
}

/** A jittered grid with noise-clustered density, bounded to avoid runaway draw calls. */
export function forestLayout(): { near: ForestTree[]; distant: ForestTree[] } {
  const near: ForestTree[] = [], distant: ForestTree[] = [];
  for (let gx=-11; gx<=11; gx++) for (let gz=-11; gz<=7; gz++) {
    const x = gx*5 + (hash(gx+41,gz)-0.5)*3;
    const z = gz*5 + (hash(gx,gz+73)-0.5)*3;
    const density = noise(gx*0.32+6,gz*0.32-3);
    const scale = 0.8 + hash(gx+12,gz+21)*0.45;
    const tree = { x, z, scale, yaw: hash(gx-31,gz+9)*Math.PI*2 };
    // Leave the centre clear, including the bridge, ruin and existing props.
    if (Math.abs(x)>14 && Math.abs(x)<21 && z>-15 && z<15 && Math.abs(z-8)>4 && density>0.31 && [[-12,-2],[13,-6]].every(([tx,tz]) => Math.hypot(x-tx,z-tz)>3.5)) near.push(tree);
    // Distant silhouettes live outside the playable rectangle; do not screen the castle.
    else if ((Math.abs(x)>25 || z < -49 || z > 31) && !(Math.abs(x)<14 && z < -25) && density>0.42) distant.push(tree);
  }
  const rank = (t: ForestTree) => hash(Math.round(t.x*10), Math.round(t.z*10));
  // A separate, gently irregular row encloses the rear of the camp even if
  // the noise field happens to leave a gap there. It is outside the bounds.
  const rear: ForestTree[] = [];
  for (let row=0; row<3; row++) for (let i=-7; i<=7; i++) rear.push({
    x: i*4 + (row%2)*1.7 + (hash(i,801+row)-0.5)*1.6,
    z: 31.5 + row*5.5 + noise(i*0.36,17+row)*2.5,
    scale: 1.05 + hash(i,802+row)*0.35,
    yaw: hash(i,803+row)*Math.PI*2,
  });
  return { near: near.sort((a,b) => rank(a)-rank(b)).slice(0, 24), distant: [...distant.sort((a,b) => rank(a)-rank(b)).slice(0, 100), ...rear] };
}

export const FOREST = forestLayout();
/** Hide a background tree only when its canopy falls between camera and actor. */
export function blocksCharacterView(tree: ForestTree, eyeX: number, eyeZ: number, actorX: number, actorZ: number): boolean {
  const dx = actorX-eyeX, dz = actorZ-eyeZ, length2 = dx*dx+dz*dz;
  if (length2 < 0.001) return false;
  const t = ((tree.x-eyeX)*dx+(tree.z-eyeZ)*dz)/length2;
  if (t <= 0 || t >= 1) return false;
  return Math.hypot(tree.x-(eyeX+t*dx),tree.z-(eyeZ+t*dz)) < 2.1*tree.scale;
}
/** Two pairs of torch posts: trail and castle approach. */
export const TORCHES = [[-4.5,-3],[4.5,-3],[-3.8,-14.7],[3.8,-14.7]] as const;
