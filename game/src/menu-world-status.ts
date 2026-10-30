import './menu-world-status.css';
import { CASTLE_PROTOCOL } from './multiplayer-protocol';

type Player = { name: string; classId: string };
type WorldStatus = { protocol: string; players: Player[]; gate: 'locked' | 'open' | 'cleared'; night: boolean; enemies: number; round: number };

/** A menu-only, read-only snapshot. It does not join or create a player. */
export function installWorldStatus(endpoint: string, doc: Document = document) {
  const menu = doc.querySelector<HTMLElement>('#menu');
  if (!menu || menu.querySelector('.world-panel')) return;
  const panel = doc.createElement('aside'); panel.className = 'world-panel'; panel.hidden = true;
  panel.innerHTML = `<button type="button" class="world-toggle mbtn" aria-expanded="false"><span class="world-dot"></span><span class="world-heading">World</span><span class="world-count"></span><span class="world-chevron" aria-hidden="true">⌄</span></button><div class="world-details" hidden><div class="world-state"></div><div class="world-player-heading">HEROES IN THE WORLD</div><ul class="world-players"></ul><p class="world-empty" hidden>No heroes yet</p></div>`;
  menu.append(panel);
  const toggle = panel.querySelector<HTMLButtonElement>('.world-toggle')!;
  const details = panel.querySelector<HTMLElement>('.world-details')!;
  const heading = panel.querySelector<HTMLElement>('.world-heading')!;
  const count = panel.querySelector<HTMLElement>('.world-count')!;
  const state = panel.querySelector<HTMLElement>('.world-state')!;
  const list = panel.querySelector<HTMLUListElement>('.world-players')!;
  const empty = panel.querySelector<HTMLElement>('.world-empty')!;
  const desktop = matchMedia('(min-width: 1000px) and (min-height: 480px)');
  toggle.hidden = true;
  let expanded = desktop.matches, timer: ReturnType<typeof setTimeout> | undefined, request: AbortController | undefined, generation = 0;
  const expand = () => { details.hidden = !expanded; toggle.setAttribute('aria-expanded', String(expanded)); };
  toggle.addEventListener('click', () => { expanded = !expanded; expand(); });
  expand();
  const onLayout = () => { expanded = desktop.matches; expand(); };
  desktop.addEventListener('change', onLayout);
  const render = (value: WorldStatus) => {
    panel.dataset.online = 'true'; heading.textContent = 'World online';
    count.textContent = `${value.players.length} ${value.players.length === 1 ? 'hero' : 'heroes'}`;
    state.textContent = `${value.gate === 'open' ? 'Gate open' : value.gate === 'cleared' ? 'Castle cleared' : 'Gate locked'} · ${value.night ? 'Night' : 'Day'} · ${value.enemies} foes`;
    list.replaceChildren();
    for (const player of value.players.slice(0,24)) {
      const row = doc.createElement('li'), dot = doc.createElement('span'), name = doc.createElement('span'), role = doc.createElement('span');
      dot.className = 'world-player-dot'; name.className = 'world-player-name'; role.className = 'world-player-class';
      name.textContent = player.name; role.textContent = player.classId; row.append(dot, name, role); list.append(row);
    }
    empty.hidden = value.players.length > 0;
  };
  const offline = () => {
    panel.dataset.online = 'false'; heading.textContent = 'World unavailable'; count.textContent = '';
    state.textContent = 'Waiting for a connection'; list.replaceChildren(); empty.hidden = true;
  };
  const polling = () => doc.body.dataset.phase === 'menu' && !doc.hidden;
  const stop = () => { generation++; if (timer) clearTimeout(timer); timer = undefined; request?.abort(); request = undefined; panel.hidden = true; toggle.hidden = true; };
  const poll = async (token: number) => {
    if (!polling() || token !== generation) return;
    const controller = new AbortController(); request = controller;
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(new URL('world-status', endpoint.replace(/\/$/, '') + '/'), { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      const value: unknown = await response.json();
      if (!validWorldStatus(value)) throw new Error('invalid status');
      if (token === generation && polling()) { panel.hidden = false; toggle.hidden = false; render(value); }
    } catch {
      if (token === generation && polling()) { panel.hidden = false; toggle.hidden = false; offline(); }
    } finally {
      clearTimeout(timeout);
      if (request === controller) request = undefined;
      if (token === generation && polling()) timer = setTimeout(() => void poll(token), 4000);
    }
  };
  const sync = () => { stop(); if (polling()) void poll(generation); };
  const observer = new MutationObserver(sync); observer.observe(doc.body, { attributes:true, attributeFilter:['data-phase'] });
  doc.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { stop(); observer.disconnect(); desktop.removeEventListener('change', onLayout); doc.removeEventListener('visibilitychange', sync); }, { once:true });
  sync();
}

export function validWorldStatus(value: unknown): value is WorldStatus {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<WorldStatus>;
  return s.protocol === CASTLE_PROTOCOL && Array.isArray(s.players) && s.players.length <= 24 &&
    s.players.every(p => !!p && typeof p.name === 'string' && p.name.length <= 24 && typeof p.classId === 'string' && ['Knight','Spellcaster','Scout'].includes(p.classId)) &&
    (s.gate === 'open' || s.gate === 'locked' || s.gate === 'cleared') && typeof s.night === 'boolean' &&
    Number.isInteger(s.enemies) && (s.enemies ?? -1) >= 0 && Number.isInteger(s.round) && (s.round ?? -1) >= 0;
}
