/** The old isolated lookout is no longer part of the playable world.
 * Keep these exports for callers while old asset files remain available for review. */
export function overlookHeight(_x: number, _z: number): number { return 0; }
export function overlookTransition(_x: number, _z: number, _nx: number, _nz: number): boolean { return true; }
export const overlookColliders: { x: number; z: number; radius: number }[] = [];
