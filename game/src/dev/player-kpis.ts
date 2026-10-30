/** Private Convex reports, visible only in the local development preview. */
type PlayerReport = {
  since: number; until: number; traffic: string; build: string; truncated: boolean;
  sessions: number; pageLoads: number; playedSessions: number; uniquePlayers: number;
  completedSessions: number; incompleteSessions: number; medianCompletedSessionMs: number | null; medianObservedActivePlayMs: number | null;
  titleShown: number; menuShown: number; playClicked: number; heroSelected: number; firstMove: number; firstAttack: number;
  gateBreachedEligibleSessions: number; gateEligibleSessions: number; castleClearedEligibleSessions: number; clearEligibleSessions: number;
  joinedWithGateOpen: number; joinedAfterClear: number; enemyDefeats: number; playerDefeated: number; connectionLost: number;
  joinFailures: number; loadFailures: number; unexpectedErrors: number;
  features: { worldStatus: number; settings: number; pause: number; scores: number; achievementsOpened?: number; chatOpened: number; chatSent: number; profileOpened: number; profileEditAttempted: number };
};

const CSS = `
.player-kpis-overlay{position:fixed;inset:0;z-index:210;display:grid;place-items:center;box-sizing:border-box;padding:12px;background:#091018d9;color:#edf5ef;font:14px/1.45 system-ui,sans-serif}
.player-kpis-overlay[hidden]{display:none}.player-kpis-dialog{width:min(780px,100%);max-height:calc(100dvh - 24px);overflow:auto;box-sizing:border-box;background:#172422;border:1px solid #7ea38b;border-radius:14px;box-shadow:0 18px 60px #0009}
.player-kpis-head{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;background:#172422;border-bottom:1px solid #344d40}.player-kpis-head h2{font-size:19px;margin:0}.player-kpis-head p{font-size:12px;color:#b4c9ba;margin:2px 0 0}.player-kpis-dialog button,.player-kpis-dialog select,.player-kpis-dialog input{border:1px solid #7ea38b;border-radius:7px;padding:7px 9px;color:#edf5ef;background:#263d32;font:inherit;box-sizing:border-box}.player-kpis-dialog button{cursor:pointer}.player-kpis-dialog button:hover{background:#385544}.player-kpis-dialog :is(button,select,input):focus-visible{outline:3px solid #f1cf90;outline-offset:2px}
.player-kpis-content{padding:15px 18px 18px}.player-kpis-filters{display:grid;grid-template-columns:1.5fr .8fr 1.4fr auto;align-items:end;gap:9px}.player-kpis-filters label{display:grid;gap:4px;color:#b4c9ba;font-size:11px}.player-kpis-filters :is(select,input){width:100%;min-width:0;font-size:13px}.player-kpis-status{margin:12px 0;color:#b4c9ba;font-size:12px;overflow-wrap:anywhere}.player-kpis-error,.player-kpis-warning{padding:9px 11px;border-radius:8px;background:#49332a;color:#ffe0c6;font-size:12px}.player-kpis-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.player-kpis-card{min-width:0;padding:10px;background:#21342b;border:1px solid #344d40;border-radius:9px}.player-kpis-card strong{display:block;font-size:20px;line-height:1.2;overflow-wrap:anywhere}.player-kpis-card span,.player-kpis-card small{display:block;color:#b4c9ba;font-size:11px}.player-kpis-card small{margin-top:3px}
.player-kpis-content h3{font-size:14px;margin:17px 0 8px}.player-kpis-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:18px}.player-kpis-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid #344d40;font-size:12px}.player-kpis-row span{color:#c3d4c6}.player-kpis-row strong{text-align:right;white-space:nowrap}.player-kpis-note{font-size:12px;color:#b4c9ba;margin:14px 0 0}.player-kpis-warning{margin:0 0 10px}
@media(max-width:600px){.player-kpis-head{padding:11px 12px}.player-kpis-head h2{font-size:17px}.player-kpis-content{padding:12px}.player-kpis-filters{grid-template-columns:1fr 1fr}.player-kpis-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.player-kpis-rows{grid-template-columns:1fr}}
`;

let overlay: HTMLElement | undefined;
let lastFocus: HTMLElement | null = null;
let generation = 0;
let activeRequest: AbortController | undefined;

const element = (tag: string, text: string, className = '') => {
  const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node;
};
const count = (value: number) => value.toLocaleString();
function duration(value: number | null): string {
  if (value === null) return '—';
  const seconds = Math.round(value / 1000);
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}
function validReport(value: unknown, traffic: string, build: string): value is PlayerReport {
  if (!value || typeof value !== 'object') return false;
  const report = value as PlayerReport;
  const nonnegative = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  const fields: (keyof PlayerReport)[] = ['sessions', 'pageLoads', 'playedSessions', 'uniquePlayers', 'completedSessions', 'incompleteSessions', 'titleShown', 'menuShown', 'playClicked', 'heroSelected', 'firstMove', 'firstAttack', 'gateBreachedEligibleSessions', 'gateEligibleSessions', 'castleClearedEligibleSessions', 'clearEligibleSessions', 'joinedWithGateOpen', 'joinedAfterClear', 'enemyDefeats', 'playerDefeated', 'connectionLost', 'joinFailures', 'loadFailures', 'unexpectedErrors'];
  return report.traffic === traffic && report.build === (build || 'all') && nonnegative(report.since) && nonnegative(report.until) && report.since < report.until &&
    typeof report.truncated === 'boolean' && fields.every(field => nonnegative(report[field])) &&
    [report.medianCompletedSessionMs, report.medianObservedActivePlayMs].every(n => n === null || (typeof n === 'number' && Number.isFinite(n) && n >= 0)) &&
    !!report.features && ['worldStatus', 'settings', 'pause', 'scores', 'chatOpened', 'chatSent', 'profileOpened', 'profileEditAttempted'].every(key => nonnegative(report.features[key as keyof PlayerReport['features']]));
}
function card(label: string, value: string, detail: string) {
  const box = document.createElement('div'); box.className = 'player-kpis-card';
  box.append(element('span', label), element('strong', value), element('small', detail)); return box;
}
function rows(title: string, values: [string, string][]) {
  const section = document.createElement('section'); section.append(element('h3', title));
  const list = document.createElement('div'); list.className = 'player-kpis-rows';
  for (const [label, value] of values) {
    const row = document.createElement('div'); row.className = 'player-kpis-row'; row.append(element('span', label), element('strong', value)); list.append(row);
  }
  section.append(list); return section;
}

function render(target: HTMLElement, report: PlayerReport) {
  const result = document.createDocumentFragment();
  if (report.truncated) result.append(element('p', 'More than 10,000 events were found. Narrow the time window before comparing these figures.', 'player-kpis-warning'));
  const grid = document.createElement('div'); grid.className = 'player-kpis-grid';
  grid.append(
    card('Page loads', count(report.pageLoads), `${count(report.sessions)} measured sessions`),
    card('Sessions that played', count(report.playedSessions), 'Joined the shared world'),
    card('Unique players', count(report.uniquePlayers), 'Pseudonymous joined identities'),
    card('Median session length', duration(report.medianCompletedSessionMs), `${count(report.completedSessions)} completed sessions`),
    card('Median active play', duration(report.medianObservedActivePlayMs), 'Among sessions that played'),
    card('Incomplete sessions', count(report.incompleteSessions), 'Exit beacon not observed'),
  );
  result.append(grid);
  result.append(rows('Path into play · sessions', [
    ['Title shown', count(report.titleShown)], ['Menu shown', count(report.menuShown)], ['Play selected', count(report.playClicked)],
    ['Hero selected', count(report.heroSelected)], ['First movement', count(report.firstMove)], ['First attack', count(report.firstAttack)],
  ]));
  result.append(rows('Game events', [
    ['Gate breached · eligible sessions', `${count(report.gateBreachedEligibleSessions)} / ${count(report.gateEligibleSessions)}`],
    ['Castle cleared · eligible sessions', `${count(report.castleClearedEligibleSessions)} / ${count(report.clearEligibleSessions)}`],
    ['Joined after gate breach', count(report.joinedWithGateOpen)], ['Joined after castle clear', count(report.joinedAfterClear)],
    ['Enemy defeats · events', count(report.enemyDefeats)], ['Player defeated · sessions', count(report.playerDefeated)],
  ]));
  const f = report.features;
  result.append(rows('Feature use · sessions', [
    ['World status', count(f.worldStatus)], ['Settings', count(f.settings)], ['Pause', count(f.pause)], ['Battle wins', count(f.scores)], ['Achievements', count(f.achievementsOpened ?? 0)],
    ['Chat opened', count(f.chatOpened)], ['Chat sent', count(f.chatSent)], ['Profile opened', count(f.profileOpened)], ['Profile edit attempted', count(f.profileEditAttempted)],
  ]));
  result.append(rows('Problems · sessions', [
    ['Join failures', count(report.joinFailures)], ['Load failures', count(report.loadFailures)],
    ['Connection lost', count(report.connectionLost)], ['Unexpected errors', count(report.unexpectedErrors)],
  ]));
  result.append(element('p', 'Active time excludes menus, pause, results and hidden tabs. Incomplete sessions can understate active time. Wavedash can issue anonymous identities, so unique players are not necessarily registered accounts or distinct people.', 'player-kpis-note'));
  target.replaceChildren(result);
}

function controls() {
  return {
    traffic: overlay!.querySelector<HTMLSelectElement>('#player-kpis-traffic')!,
    days: overlay!.querySelector<HTMLSelectElement>('#player-kpis-days')!,
    build: overlay!.querySelector<HTMLInputElement>('#player-kpis-build')!,
    status: overlay!.querySelector<HTMLElement>('.player-kpis-status')!,
    result: overlay!.querySelector<HTMLElement>('.player-kpis-result')!,
  };
}
async function refresh() {
  if (!overlay || overlay.hidden) return;
  const ui = controls(), traffic = ui.traffic.value, days = ui.days.value, build = ui.build.value.trim();
  generation++; const token = generation; activeRequest?.abort();
  if (build && !/^[a-zA-Z0-9_.-]{1,100}$/.test(build)) {
    ui.status.textContent = 'Use a build label containing letters, numbers, dots, underscores, or hyphens.';
    ui.status.className = 'player-kpis-status player-kpis-error'; ui.result.replaceChildren(); return;
  }
  ui.status.className = 'player-kpis-status'; ui.status.textContent = 'Reading the private Convex report…'; ui.result.replaceChildren();
  const query = new URLSearchParams({ traffic, days, ...(build ? { build } : {}) });
  const controller = new AbortController(); activeRequest = controller;
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`/__dev/player-kpis/report?${query}`, { headers: { 'X-Bramblekeep-Dev': '1' }, cache: 'no-store', signal: controller.signal });
    const data: unknown = await response.json();
    if (!response.ok) {
      const message = data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string' ? (data as { error: string }).error : 'The report is unavailable.';
      throw new Error(message);
    }
    if (!validReport(data, traffic, build)) throw new Error('The Convex report had an unexpected format.');
    if (!overlay || overlay.hidden || token !== generation) return;
    const source = traffic === 'live' ? 'Production · live Wavedash' : traffic === 'playtest' ? 'Development · Wavedash playtests' : 'Development · all traffic, including tests';
    ui.status.textContent = `${source} · ${new Date(data.since).toLocaleString()} – ${new Date(data.until).toLocaleString()} · build ${data.build}`;
    render(ui.result, data);
  } catch (error) {
    if (!overlay || overlay.hidden || token !== generation) return;
    ui.status.className = 'player-kpis-status player-kpis-error';
    ui.status.textContent = controller.signal.aborted ? 'The report timed out. Try Refresh again.' : error instanceof Error ? error.message : 'The report is unavailable.';
  } finally { clearTimeout(timer); if (activeRequest === controller) activeRequest = undefined; }
}

function closePlayerKpis() {
  generation++; activeRequest?.abort(); activeRequest = undefined;
  if (overlay) overlay.hidden = true;
  lastFocus?.focus();
}
function select(id: string, items: [string, string][]) {
  const node = document.createElement('select'); node.id = id;
  for (const [value, label] of items) { const option = document.createElement('option'); option.value = value; option.textContent = label; node.append(option); }
  node.addEventListener('change', () => void refresh()); return node;
}
function labeled(label: string, input: HTMLElement) {
  const wrapper = document.createElement('label'); wrapper.append(element('span', label), input); return wrapper;
}

export function openPlayerKpis() {
  if (!import.meta.env.DEV) return;
  if (!overlay) {
    const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
    overlay = document.createElement('aside'); overlay.className = 'player-kpis-overlay'; overlay.dataset.devOnly = 'vgd:dev-only';
    const dialog = document.createElement('div'); dialog.className = 'player-kpis-dialog'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', 'Player KPIs');
    const header = document.createElement('div'); header.className = 'player-kpis-head';
    const heading = document.createElement('div'); heading.append(element('h2', 'Player KPIs'), element('p', 'Dev-only · private Convex report'));
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; close.addEventListener('click', closePlayerKpis); header.append(heading, close);
    const content = document.createElement('div'); content.className = 'player-kpis-content';
    const filters = document.createElement('div'); filters.className = 'player-kpis-filters';
    const traffic = select('player-kpis-traffic', [['live', 'Production · live'], ['playtest', 'Development · playtests'], ['all', 'Development · all traffic']]);
    const days = select('player-kpis-days', [['7', 'Last 7 days'], ['1', 'Last 24 hours'], ['30', 'Last 30 days']]);
    const build = document.createElement('input'); build.id = 'player-kpis-build'; build.placeholder = 'All builds'; build.maxLength = 100; build.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void refresh(); } });
    const reload = document.createElement('button'); reload.type = 'button'; reload.textContent = 'Refresh'; reload.addEventListener('click', () => void refresh());
    filters.append(labeled('Source', traffic), labeled('Window', days), labeled('Exact build label', build), reload);
    const status = element('p', '', 'player-kpis-status'); status.setAttribute('aria-live', 'polite');
    const result = document.createElement('div'); result.className = 'player-kpis-result';
    content.append(filters, status, result); dialog.append(header, content); overlay.append(dialog); document.body.append(overlay);
    dialog.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); closePlayerKpis(); }
      if (event.key === 'Tab') {
        const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled)')];
        if (focusable.length && event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
        else if (focusable.length && !event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
      }
    });
  }
  lastFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : document.querySelector<HTMLElement>('#dbg-toggle');
  overlay.hidden = false; void refresh(); overlay.querySelector<HTMLButtonElement>('.player-kpis-head button')?.focus();
}
