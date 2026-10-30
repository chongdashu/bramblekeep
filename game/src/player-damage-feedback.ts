import type { GameRuntime } from '@engine/runtime';
import { motion } from '@engine/ui/tween';

/** Local damage should register immediately, without obscuring the action. */
export function playerDamageFeedback(rt: GameRuntime, defeated: boolean) {
  if (!motion.reduced) rt.camera.addTrauma(defeated ? .72 : .54);
  const vignette = document.querySelector<HTMLElement>('#damage-vignette');
  vignette?.getAnimations().forEach(animation => animation.cancel());
  vignette?.animate([
    { opacity: 0 },
    { opacity: defeated ? 1 : .8, offset: .12 },
    { opacity: 0 },
  ], { duration: defeated ? 700 : 480, easing: 'ease-out' });
  const health = document.querySelector<HTMLElement>('.hero-status:not([hidden])') ?? document.querySelector<HTMLElement>('#gym-health');
  health?.getAnimations().forEach(animation => animation.cancel());
  health?.animate([{ filter: 'brightness(2.4)', transform: 'scale(1.18)' }, { filter: 'brightness(1)', transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
}
