import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACHIEVEMENTS, BATTLE_WINS_BOARD, ENEMY_NAMES, earnedAchievements } from '../src/achievements';
import { ENEMY_TYPES } from '../src/enemy-types';
import { AchievementSync } from '../src/achievement-sync';
import { ProgressStore } from '../server/progress';
import { WorldStorage } from '../server/storage';
import { World } from '../server/world';
import { CORE_Z } from '../src/castle-patrol';

describe('achievement and battle-win progress', () => {
  it('covers every enemy type and awards only milestones reached', () => {
    expect(ENEMY_NAMES).toEqual(ENEMY_TYPES.map(enemy => enemy.name));
    expect(new Set(ACHIEVEMENTS.map(achievement => achievement.id)).size).toBe(22);
    const ids = earnedAchievements({ kills: [5, 10, 49, 100], battleWins: 5, bossFinishes: 1 }).map(achievement => achievement.id);
    expect(ids).toContain('bloom_5'); expect(ids).not.toContain('bloom_10');
    expect(ids).toContain('mushroom_10'); expect(ids).not.toContain('mushroom_50');
    expect(ids).toContain('stump_100'); expect(ids).toContain('battle_wins_5');
    expect(ids).toContain('guardian_last_hit'); expect(ids).not.toContain('battle_wins_10');
  });

  it('persists defeats by verified identity and does not overwrite corrupt progress', () => {
    const directory = mkdtempSync(join(tmpdir(), 'castle-progress-')), id = 'a'.repeat(64), other = 'b'.repeat(64);
    try {
      const store = new ProgressStore(directory);
      store.defeat(id, 0); store.defeat(id, 2); store.defeat(id, 2); store.finish(id); store.defeat(id, 9);
      expect(new ProgressStore(directory).get(id, 3)).toEqual({ kills: [1, 0, 2, 0], bossFinishes: 1, battleWins: 3 });
      expect(store.get(other, 0).kills).toEqual([0, 0, 0, 0]);
      const path = join(directory, 'progress', `${id}.json`); writeFileSync(path, '{broken');
      expect(() => store.defeat(id, 0)).toThrow(); expect(readFileSync(path, 'utf8')).toBe('{broken');
      expect(() => store.defeat('../bad', 0)).toThrow();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('ranks unique victories, including a departed player whose result was upgraded', () => {
    const directory = mkdtempSync(join(tmpdir(), 'castle-wins-')), a = 'a'.repeat(64), b = 'b'.repeat(64);
    try {
      const store = new WorldStorage(directory);
      const result = { round: 1, id: a, classId: 'Knight' as const, kills: 2, won: false, finishedAt: 'now' };
      store.record(result); store.record({ ...result, won: true }); store.record({ ...result, won: true });
      store.record({ ...result, round: 2, won: true });
      store.record({ ...result, id: b, won: true, classId: 'Scout' });
      const reopened = new WorldStorage(directory);
      expect(reopened.wins(a)).toBe(2); expect(reopened.wins(b)).toBe(1);
      expect(reopened.leaderboard()).toEqual([{ id: a, wins: 2, classId: 'Knight' }, { id: b, wins: 1, classId: 'Scout' }]);
      reopened.record({ ...result, won: true }); expect(reopened.wins(a)).toBe(2);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('identifies the enemy and the actual player landing the guardian final hit', () => {
    const events: Array<[string, string, number | undefined]> = [];
    const world = new World(() => {}, (kind, id, enemy) => events.push([kind, id, enemy]));
    const hero = world.join('hero', 'Knight'); world.join('teammate', 'Scout');
    const enemy = world.enemies[2]; for (const other of world.enemies) other.alive = false;
    Object.assign(enemy, { alive: true, x: 0, z: 0, homeX: 0, homeZ: 0, hp: 1 });
    hero.x = 0; hero.z = 1; hero.yaw = Math.PI; world.setInput('hero', { x: 0, z: 0, sprint: false, attack: true });
    for (let i = 0; i < 10 && enemy.alive; i++) world.step(.05);
    expect(events).toContainEqual(['kill', 'hero', 2]);

    const finish = new World(() => {}, (kind, id, type) => events.push([kind, id, type]));
    const winner = finish.join('winner', 'Knight'); finish.join('participant', 'Scout');
    for (let i = 0; i < 4; i++) { finish.gate.hit(0); finish.gate.hit(1); }
    finish.coreHealth = 1; finish.guardian.phase = 2; finish.guardian.emerge = 1; finish.guardian.cooldown = 2;
    winner.x = 0; winner.z = CORE_Z + 1.05; winner.yaw = Math.PI;
    finish.setInput('winner', { x: 0, z: 0, sprint: false, attack: true });
    for (let i = 0; i < 10 && !finish.cleared; i++) finish.step(.05);
    expect(finish.cleared).toBe(true); expect(events.filter(event => event[0] === 'victory')).toEqual([['victory', 'winner', undefined]]);
  });

  it('mirrors earned achievements and submits lifetime wins to the host', async () => {
    const stats = { load: vi.fn(async () => true), getStat: vi.fn(), setStat: vi.fn(), isUnlocked: vi.fn(), unlock: vi.fn(() => true), store: vi.fn() };
    const boards = { submit: vi.fn(async () => ({ rank: 1, best: true, runRank: 1 })), top: vi.fn(), around: vi.fn() };
    const sync = new AchievementSync(stats, boards);
    sync.update({ kills: [5, 0, 0, 0], battleWins: 1, bossFinishes: 1 });
    await Promise.resolve(); await Promise.resolve();
    expect(stats.unlock).toHaveBeenCalledWith('bloom_5'); expect(stats.unlock).toHaveBeenCalledWith('guardian_last_hit');
    expect(stats.unlock).not.toHaveBeenCalledWith('bloom_10'); expect(stats.store).toHaveBeenCalled();
    expect(boards.submit).toHaveBeenCalledWith(BATTLE_WINS_BOARD, 1);
  });
});
