/** Game-owned menu destinations. The engine's menu already supports focused links. */
export const SCENE_LINKS = [
  { id: "solo", label: "Solo castle test", href: "?scene=solo" },
  { id: "greybox", label: "Greybox archive", href: "?scene=greybox" },
  { id: "character", label: "Character test", href: "?scene=character" },
  { id: "equipment", label: "Equipment preview", href: "?scene=equipment" },
  { id: "environment", label: "Environment test", href: "?scene=environment" },
  { id: "assets", label: "Asset viewer", href: "./preview.html" },
] as const;

/** Replace the generic popup buttons with direct scene links after the shell creates them. */
export function installSceneLinks(doc: Document = document) {
  if (!import.meta.env.DEV) return;
  const list = doc.querySelector<HTMLElement>("#menu .menu-list");
  if (!list || list.querySelector(".scene-toggle")) return;
  // Keep keyboard and gamepad focus visible when the test list scrolls on short screens.
  list.addEventListener("focusin", event => {
    const target = event.target as HTMLElement;
    if (target.closest(".scene-link, .scene-toggle, .mbtn.dev")) target.scrollIntoView({ block: "nearest" });
  });
  const links: HTMLAnchorElement[] = [];
  for (const scene of SCENE_LINKS) {
    const button = doc.querySelector<HTMLButtonElement>(`#menu [data-act="extra:${scene.id}"]`);
    if (!button) continue;
    const link = doc.createElement("a");
    link.className = "mbtn scene-link";
    link.href = scene.href;
    if (doc.body.dataset.mobilePreview === 'true' && scene.href.startsWith('?')) {
      const url = new URL(link.href); url.searchParams.set('mobilePreview', '1'); link.href = url.href;
    }
    link.textContent = scene.label;
    link.dataset.stagger = "";
    link.hidden = true;
    links.push(link);
    button.replaceWith(link);
  }
  if (!links.length) return;
  const toggle = doc.createElement("button");
  toggle.type = "button";
  toggle.className = "mbtn scene-toggle";
  toggle.textContent = "Test scenes ▾";
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "Test scenes ▴" : "Test scenes ▾";
    links.forEach(link => { link.hidden = !expanded; });
  });
  links[0].before(toggle);
}
