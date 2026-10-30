/** The legacy "distant hills" overlap the courtyard and bury the rear keep. */
const landscape = new Set(['environment_meadow_light','environment_meadow_shadow','environment_flowers']);
export function showEnvironmentKitNode(name:string):boolean {
  return !name.startsWith('environment_') || landscape.has(name);
}
