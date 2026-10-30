// A game's own menu entries (GameModule.menu.extra), each opening a standard engine popup with
// the game's markup ("About", "Credits"), and the switch that takes "How to play" out
// (GameModule.help === false). Game-neutral: with neither set the page is untouched.
//
// The popups are ordinary `.popup` sections, so the Frontend gives them the same focus
// handling as Settings and Help: focus lands on [data-autofocus], Tab and arrows stay inside,
// Escape, Backspace and gamepad B close, and focus returns to the opener. The flow (src/flow.ts)
// opens them from the menu (`data-act="extra:<id>"`), from the pause card (`data-extra="<id>"`)
// and from game code (`GameRuntime.openPopup(id)`, e.g. a button on the results card), and
// closing one returns to the card it was opened from.

/** One extra menu entry. */
export interface MenuEntry {
  /** A lowercase slug, unique among the game's entries: `[a-z][a-z0-9-]*`. The popup is `#extra-<id>-pop`, the menu button's action `extra:<id>`. */
  id: string;
  /** The menu button's text (plain text). */
  label: string;
  /** The popup's heading (plain text); the label when absent. */
  title?: string;
  /** The popup's body: the game's own markup (trusted, like GameModule.help). Links and buttons in it are reachable by keyboard and touch. */
  body: string;
  /** Text of the popup's closing button. Default "Close". */
  close?: string;
  /** Also offer it on the pause card (above "Quit to menu"); closing it there returns to the pause card. Default false. */
  pause?: boolean;
}

export const MENU_ENTRY_ID = /^[a-z][a-z0-9-]*$/;

/** The popup element id of an entry. */
export const extraPopupId = (id: string) => `extra-${id}-pop`;

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape plain text for markup (element content and attribute values). */
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ENTITIES[c]);

/** Throws unless every id is a safe slug used once and every label is non-empty text. */
export function checkMenuEntries(entries: readonly MenuEntry[]): void {
  const seen = new Set<string>();
  for (const e of entries) {
    if (typeof e?.id !== "string" || !MENU_ENTRY_ID.test(e.id)) throw new Error(`GameModule.menu.extra: id ${JSON.stringify(e?.id)} must match [a-z][a-z0-9-]*`);
    if (seen.has(e.id)) throw new Error(`GameModule.menu.extra: id "${e.id}" is used twice`);
    if (typeof e.label !== "string" || !e.label.trim()) throw new Error(`GameModule.menu.extra: "${e.id}" needs a label`);
    if (typeof e.body !== "string") throw new Error(`GameModule.menu.extra: "${e.id}" needs a body (markup)`);
    seen.add(e.id);
  }
}

/** The menu button, pause-card button (empty unless `pause`) and popup markup for one entry. */
export function menuEntryMarkup(e: MenuEntry): { menuButton: string; pauseButton: string; popup: string } {
  const label = esc(e.label);
  const pop = extraPopupId(e.id);
  return {
    menuButton: `<button class="mbtn" data-act="extra:${e.id}" data-stagger>${label}</button>`,
    pauseButton: e.pause ? `<button class="btn" data-extra="${e.id}" id="pause-extra-${e.id}" data-stagger>${label}</button>` : "",
    popup:
      `<section id="${pop}" class="popup extra-pop" data-extra="${e.id}" hidden>` +
      `<div class="pcard" role="dialog" aria-modal="true" aria-labelledby="extra-${e.id}-title">` +
      `<div class="ribbon" id="extra-${e.id}-title">${esc(e.title ?? e.label)}</div>` +
      `<button class="pclose" data-close aria-label="Close">✕</button>` +
      `<div class="extra-body">${e.body}</div>` +
      `<div class="row-buttons"><button class="btn primary" data-close data-autofocus>${esc(e.close ?? "Close")}</button></div>` +
      `</div></section>`,
  };
}

/** Add the entries to the page: menu buttons after the engine's (before any dev entry), pause buttons above Quit, popups after the help popup. */
export function installMenuExtras(entries: readonly MenuEntry[], doc: Document = document): void {
  checkMenuEntries(entries);
  const list = doc.querySelector("#menu .menu-list");
  const quit = doc.querySelector("#pause-quit");
  let after = doc.querySelector("#help-pop");
  for (const e of entries) {
    if (doc.getElementById(extraPopupId(e.id))) continue;
    const m = menuEntryMarkup(e);
    const dev = list?.querySelector(".mbtn.dev");
    if (dev) dev.insertAdjacentHTML("beforebegin", m.menuButton);
    else list?.insertAdjacentHTML("beforeend", m.menuButton);
    if (m.pauseButton) quit?.insertAdjacentHTML("beforebegin", m.pauseButton);
    after?.insertAdjacentHTML("afterend", m.popup);
    after = doc.getElementById(extraPopupId(e.id)) ?? after; // keep the popups in the game's order
  }
}

/** GameModule.help === false: no "How to play" on the menu or the pause card, and its popup never opens. */
export function removeHelp(doc: Document = document): void {
  for (const sel of ['#menu .mbtn[data-act="help"]', "#pause-help"]) {
    const el = doc.querySelector<HTMLElement>(sel);
    if (el) el.hidden = true;
  }
  doc.body.dataset.help = "off";
}
