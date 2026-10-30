/** Presentation dimensions and combat target radii for the four enemy models.
 * Heights are measured from the exported model's ground-level pivot. */
export type EnemyType = { name:string; scale:number; height:number; radius:number };
export const ENEMY_TYPES:readonly EnemyType[] = [
  { name:'Bloom', scale:1, height:1, radius:.48 },
  { name:'Bramble', scale:1.1, height:1.4, radius:.55 },
  { name:'Mushroom', scale:1.15, height:1, radius:.5 },
  { name:'Stump', scale:1.35, height:1.35, radius:.62 },
];
export function enemyType(type:number) { return ENEMY_TYPES[type] ?? ENEMY_TYPES[0]; }
