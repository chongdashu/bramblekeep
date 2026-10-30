import './achievements.css';
import { ACHIEVEMENTS, achievementValue, earnedAchievements, type PlayerProgress } from './achievements';

/** A local view of server-owned milestones, also usable when the host has no achievements UI. */
export class AchievementsUI {
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private readonly toast: HTMLElement;
  private previous: Set<string> | null = null;
  private opener: HTMLElement | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.root = document.createElement('section');
    this.root.className = 'achievements-overlay'; this.root.hidden = true;
    this.root.innerHTML = '<div class="achievements-card" role="dialog" aria-modal="true" aria-label="Achievements"><div class="achievements-header"><div><span>YOUR ADVENTURE</span><h2>Achievements</h2></div><button type="button" class="achievements-close" aria-label="Close achievements">Close</button></div><p class="achievements-intro">Defeat enemies and win battles to earn milestones.</p><div class="achievements-list"></div></div>';
    this.list = this.root.querySelector('.achievements-list')!;
    this.root.querySelector('button')!.addEventListener('click', () => this.close());
    this.root.addEventListener('click', event => { if (event.target === this.root) this.close(); });
    document.addEventListener('keydown', event => { if (this.root.hidden) return; if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.close(); } else if (event.key === 'Tab') { event.preventDefault(); event.stopImmediatePropagation(); this.root.querySelector<HTMLButtonElement>('button')?.focus(); } }, true);
    this.toast = document.createElement('div'); this.toast.className = 'achievement-toast'; this.toast.hidden = true;
    this.toast.setAttribute('role', 'status'); this.toast.setAttribute('aria-live', 'polite');
    document.body.append(this.root, this.toast);
  }
  get isOpen() { return !this.root.hidden; }
  open(opener: HTMLElement) { this.opener = opener; this.root.hidden = false; this.root.querySelector<HTMLButtonElement>('button')?.focus(); }
  close() { this.root.hidden = true; this.opener?.focus(); }
  reset() { this.previous = null; this.root.hidden = true; this.toast.hidden = true; clearTimeout(this.toastTimer); }
  update(progress: PlayerProgress) {
    const earned = new Set(earnedAchievements(progress).map(achievement => achievement.id));
    if (this.previous) {
      const newly = ACHIEVEMENTS.filter(achievement => earned.has(achievement.id) && !this.previous!.has(achievement.id));
      if (newly.length) {
        this.toast.textContent = `Achievement unlocked: ${newly.map(a => a.title).join(', ')}`;
        this.toast.hidden = false; clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { this.toast.hidden = true; }, 5000);
      }
    }
    this.previous = earned;
    this.list.replaceChildren(...ACHIEVEMENTS.map(achievement => {
      const row = document.createElement('div'); row.className = 'achievement-row';
      row.dataset.unlocked = String(earned.has(achievement.id));
      const icon = document.createElement('span'); icon.className = 'achievement-icon'; icon.textContent = earned.has(achievement.id) ? '★' : '◇'; icon.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span'); text.className = 'achievement-copy';
      const name = document.createElement('strong'); name.textContent = achievement.title;
      const description = document.createElement('small'); description.textContent = achievement.description;
      text.append(name, description);
      const amount = document.createElement('span'); amount.className = 'achievement-count'; amount.textContent = `${Math.min(achievementValue(achievement, progress), achievement.target)} / ${achievement.target}`;
      row.append(icon, text, amount); return row;
    }));
  }
}
