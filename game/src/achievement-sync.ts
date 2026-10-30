import type { LeaderboardService, StatsService } from '@engine/platform/types';
import { BATTLE_WINS_BOARD, earnedAchievements, type PlayerProgress } from './achievements';

/** Mirror server-owned progress to optional host services; retries happen on the next refresh. */
export class AchievementSync {
  private submittedWins = 0;
  private submitting = false;
  constructor(private readonly stats?: StatsService, private readonly boards?: LeaderboardService) {}
  update(progress: PlayerProgress) {
    if (this.stats) {
      for (const achievement of earnedAchievements(progress)) this.stats.unlock(achievement.id);
      void this.stats.load().then(loaded => { if (loaded) this.stats?.store(); });
    }
    if (this.boards && progress.battleWins > this.submittedWins && !this.submitting) {
      const wins = progress.battleWins;
      this.submitting = true;
      void this.boards.submit(BATTLE_WINS_BOARD, wins).then(result => {
        if (result) this.submittedWins = Math.max(this.submittedWins, wins);
      }).finally(() => { this.submitting = false; });
    }
  }
}
