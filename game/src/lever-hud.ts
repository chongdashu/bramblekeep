import type { GameRuntime } from '@engine/runtime';
import { LEVERS } from './gate-mechanism';
import { overlookHeight } from './scenes/overlook';

/** Remove the lock badge when the shared world is unavailable. */
export function clearLeverHud() {
  for (const id of ['gate-lock', 'gate-action-left', 'gate-action-right', 'gate-link-left', 'gate-link-right', 'gate-label-left', 'gate-label-right']) {
    const el = document.getElementById(id); if (el) el.setAttribute('hidden', '');
  }
}

/** Keep the lock attached to the closed door and clear of the player's silhouette. */
export function shouldShowGateLock(pos: [number, number] | null, distance: number, w: number, h: number, playerPoints: Array<[number, number] | null>): boolean {
  return !!pos && distance < 45 && pos[0] >= 25 && pos[0] <= w - 25 && pos[1] >= 85 && pos[1] <= h - 35 &&
    playerPoints.every(p => !p || Math.hypot(p[0] - pos[0], p[1] - pos[1]) > 55);
}

/** Keep an off-screen lever cue on the nearest horizontal edge. */
export function gateCuePosition(pos: [number, number] | null, w: number, h: number): { point: [number, number] | null; edge: '' | 'left' | 'right' } {
  if (!pos) return { point: null, edge: '' };
  return { point: [Math.max(28, Math.min(w - 28, pos[0])), Math.max(100, Math.min(h - 60, pos[1]))], edge: pos[0] < 28 ? 'left' : pos[0] > w - 28 ? 'right' : '' };
}

/** Fade the connecting guidance in only as the player approaches the gate. */
export function gateGuidanceOpacity(distance: number): number {
  return Math.max(0, Math.min(1, (20 - distance) / 5));
}

/** Bend the link into two soft diagonals even when the projected endpoints align. */
export function gateLinkGeometry(lock: [number, number], cue: [number, number]) {
  const span = Math.abs(cue[0] - lock[0]);
  const bend: [number, number] = [(lock[0] + cue[0]) / 2, (lock[1] + cue[1]) / 2 + Math.min(40, Math.max(18, span * .14))];
  const label: [number, number] = [bend[0] + (cue[0] - bend[0]) * .66, bend[1] + (cue[1] - bend[1]) * .66 - 10];
  return { bend, label };
}

/** The game supplies the actual gate state; the camera supplies its rendered position. */
export function updateLeverHud(rt: GameRuntime, health: readonly number[], player: { x: number; z: number; ground?: number }, gateOpen: boolean, cleared: boolean, cinematic: boolean) {
  const marker = document.querySelector<HTMLElement>('#gate-lock');
  if (!marker) return;
  const visible = rt.phase === 'playing' && !document.querySelector<HTMLElement>('#hud')?.hidden && !gateOpen && !cleared && !cinematic;
  if (!visible) { clearLeverHud(); return; }
  const canvas = rt.canvas.getBoundingClientRect(), w = canvas.width, h = canvas.height;
  const ground = player.ground ?? overlookHeight(player.x, player.z);
  const head = rt.camera.project([player.x, ground + 1.9, player.z], w, h);
  const body = rt.camera.project([player.x, ground + .9, player.z], w, h);
  const pos = rt.camera.project([0, 2.4, -15.9], w, h);
  const guidance = gateGuidanceOpacity(Math.hypot(player.x, player.z + 15.9));
  marker.hidden = !shouldShowGateLock(pos, Math.hypot(player.x, player.z + 15.9), w, h, [head, body]);
  if (pos) { marker.style.left = `${canvas.left + pos[0]}px`; marker.style.top = `${canvas.top + pos[1]}px`; }
  for (const [i, lever] of LEVERS.entries()) {
    const action = document.querySelector<HTMLElement>(i === 0 ? '#gate-action-left' : '#gate-action-right');
    const link = document.querySelector<SVGPathElement>(i === 0 ? '#gate-link-left' : '#gate-link-right');
    const label = document.querySelector<SVGTextElement>(i === 0 ? '#gate-label-left' : '#gate-label-right');
    if (!action || !link || !label) continue;
    const leverPos = rt.camera.project([lever.x, 2.55, lever.z], w, h);
    // Keep a directional cue at the edge when a wide gate puts a lever off-screen.
    const { point: cue, edge } = gateCuePosition(leverPos, w, h);
    action.hidden = guidance <= 0 || !shouldShowGateLock(cue, Math.hypot(player.x - lever.x, player.z - lever.z), w, h, [head, body]);
    action.style.opacity = String(guidance);
    action.dataset.edge = edge;
    action.dataset.down = String((health[i] ?? 0) <= 0);
    const hideLink = marker.hidden || action.hidden || !pos || !cue;
    link.toggleAttribute('hidden', hideLink);
    label.toggleAttribute('hidden', hideLink || !!edge || (health[i] ?? 0) <= 0 || !pos || !cue || Math.hypot(pos[0] - cue[0], pos[1] - cue[1]) < 150);
    link.style.opacity = String(guidance * .65); label.style.opacity = String(guidance);
    if (cue && pos) {
      action.style.left = `${canvas.left + cue[0]}px`; action.style.top = `${canvas.top + cue[1]}px`;
      const { bend, label: labelPos } = gateLinkGeometry(pos, cue);
      link.setAttribute('d', `M ${canvas.left + pos[0]} ${canvas.top + pos[1]} L ${canvas.left + bend[0]} ${canvas.top + bend[1]} L ${canvas.left + cue[0]} ${canvas.top + cue[1]}`);
      link.dataset.down = action.dataset.down;
      label.setAttribute('x', String(canvas.left + labelPos[0]));
      label.setAttribute('y', String(canvas.top + labelPos[1]));
    }
  }
}
