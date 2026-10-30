/** Lifetime progress is decided by the game server, not by the browser. */
export interface PlayerProgress {
  kills: number[];
  battleWins: number;
  bossFinishes: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'enemy' | 'wins' | 'finish';
  target: number;
  enemy?: number;
}

export const ENEMY_NAMES = ['Bloom', 'Bramble', 'Mushroom', 'Stump'] as const;
export const ENEMY_MILESTONES = [5, 10, 50, 100] as const;
export const WIN_MILESTONES = [1, 5, 10, 50, 100] as const;
export const BATTLE_WINS_BOARD = { name: 'battle_wins', sort: 'desc', display: 'numeric' } as const;

export const ACHIEVEMENTS: readonly Achievement[] = [
  ...ENEMY_NAMES.flatMap((name, enemy) => ENEMY_MILESTONES.map(target => ({
    id: `${name.toLowerCase()}_${target}`,
    title: `${name} defeats: ${target}`,
    description: `Defeat ${target} ${name} enemies.`,
    category: 'enemy' as const, target, enemy,
  }))),
  ...WIN_MILESTONES.map(target => ({
    id: `battle_wins_${target}`,
    title: target === 1 ? 'Castle conquered' : `Castle victories: ${target}`,
    description: `Win ${target} ${target === 1 ? 'battle' : 'battles'} against the castle.`,
    category: 'wins' as const, target,
  })),
  { id: 'guardian_last_hit', title: 'The finishing blow', description: 'Deal the final hit to the Bramble Boss.', category: 'finish', target: 1 },
];

export function achievementValue(achievement: Achievement, progress: PlayerProgress): number {
  if (achievement.category === 'enemy') return progress.kills[achievement.enemy ?? -1] ?? 0;
  return achievement.category === 'wins' ? progress.battleWins : progress.bossFinishes;
}

export function earnedAchievements(progress: PlayerProgress): Achievement[] {
  return ACHIEVEMENTS.filter(achievement => achievementValue(achievement, progress) >= achievement.target);
}
