import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENEMY_NAMES, type PlayerProgress } from '../src/achievements';

type StoredProgress = { version: 1; kills: number[]; bossFinishes: number };
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;

/** Durable, server-authored progress, keyed by the same verified identity as profiles. */
export class ProgressStore {
  private readonly directory: string;
  constructor(directory: string) { this.directory = join(directory, 'progress'); mkdirSync(this.directory, { recursive: true }); }
  private path(id: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid player identity');
    return join(this.directory, `${id}.json`);
  }
  private read(id: string): StoredProgress {
    const path = this.path(id);
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, kills: ENEMY_NAMES.map(() => 0), bossFinishes: 0 };
      throw error;
    }
    const value = JSON.parse(text) as Partial<StoredProgress>;
    if (value.version !== 1 || !Array.isArray(value.kills) || value.kills.length !== ENEMY_NAMES.length ||
        !value.kills.every(v => Number.isSafeInteger(v) && v >= 0) ||
        !Number.isSafeInteger(value.bossFinishes) || value.bossFinishes! < 0) throw new Error('Invalid player progress');
    return { version: 1, kills: [...value.kills], bossFinishes: value.bossFinishes! };
  }
  private write(id: string, progress: StoredProgress) {
    const path = this.path(id), temporary = `${path}.tmp`;
    writeFileSync(temporary, JSON.stringify(progress));
    renameSync(temporary, path);
  }
  get(id: string, battleWins: number): PlayerProgress {
    const { kills, bossFinishes } = this.read(id);
    return { kills, bossFinishes, battleWins: count(battleWins) };
  }
  defeat(id: string, enemy: number) {
    if (!Number.isInteger(enemy) || enemy < 0 || enemy >= ENEMY_NAMES.length) return;
    const progress = this.read(id); progress.kills[enemy]++; this.write(id, progress);
  }
  finish(id: string) {
    const progress = this.read(id); progress.bossFinishes++; this.write(id, progress);
  }
}
