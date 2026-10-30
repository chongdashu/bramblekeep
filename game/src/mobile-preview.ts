import type { GameRuntime } from '@engine/runtime';

/** DEV-only popup has its own viewport and guest identity, so it cannot take over the main session. */
export function installMobilePreview(rt: GameRuntime) {
  if (!import.meta.env.DEV || document.querySelector('.mobile-preview-toggle')) return;
  const preview = new URLSearchParams(location.search).has('mobilePreview');
  if (preview) { document.body.dataset.mobilePreview = 'true'; rt.input.emulateTouch = true; }
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'mobile-preview-toggle';
  button.textContent = preview ? 'Close mobile view' : 'Mobile view';
  button.setAttribute('aria-label', preview ? 'Close mobile preview' : 'Open mobile preview');
  let popup: Window | null = null;
  button.addEventListener('click', () => {
    if (preview) { window.close(); return; }
    if (popup && !popup.closed) { popup.close(); popup = null; button.setAttribute('aria-pressed', 'false'); return; }
    const url = new URL(location.href); url.searchParams.set('mobilePreview', '1');
    if (rt.phase === 'playing') url.searchParams.set('autostart', '');
    popup = window.open(url.href, 'bramblekeep-mobile-preview', 'popup=yes,width=844,height=390,resizable=yes');
    button.setAttribute('aria-pressed', String(!!popup));
  });
  if (!preview) {
    button.setAttribute('aria-pressed', 'false');
    const sync = () => { if (popup?.closed) { popup = null; button.setAttribute('aria-pressed', 'false'); } };
    window.addEventListener('focus', sync);
  }
  document.body.append(button);
}
