/** Read-only, development-only view of the two deployed castle worlds. */
const worlds = ['production', 'playtest'] as const;
type World = typeof worlds[number];
type Health = {status?:string;build?:string;protocol?:string;auth?:string;railwayVolumeAttached?:boolean};
type Roster = {protocol?:string;players?:{name:string;classId:string;isBot?:boolean}[];teammateTarget?:number;round?:number;gate?:string;enemies?:number;night?:boolean};
let panel:HTMLElement | undefined;
let timer:ReturnType<typeof setTimeout> | undefined;
let generation=0;

async function get<T>(world:World,endpoint:string):Promise<T> {
 const response=await fetch(`/__dev/world-status/${world}/${endpoint}`,{cache:'no-store',signal:AbortSignal.timeout(6500)});
 if(!response.ok)throw new Error(`HTTP ${response.status}`);
 return response.json() as Promise<T>;
}
function line(container:HTMLElement,text:string,kind='') {
 const el=document.createElement('div');if(kind)el.className=kind;el.textContent=text;container.append(el);
}
async function refresh(token:number){
 if(!panel||panel.hidden||token!==generation)return;
 const target=panel.querySelector<HTMLElement>('.monitor-content')!;
 const results=await Promise.all(worlds.map(async world=>({world,values:await Promise.allSettled([get<Health>(world,'health'),get<Roster>(world,'world-status')])})));
 if(!panel||panel.hidden||token!==generation)return;
 target.replaceChildren();
 for(const {world,values} of results){
  const card=document.createElement('section');card.className='monitor-card';target.append(card);
  const title=document.createElement('h3');title.textContent=world==='production'?'Production':'Playtest';card.append(title);
  const health=values[0].status==='fulfilled'?values[0].value:undefined;
  const roster=values[1].status==='fulfilled'?values[1].value:undefined;
  line(card,health?.status==='ok'?'Server online':health?'Server reports an issue':'Health unavailable',health?.status==='ok'?'monitor-ok':'monitor-error');
  if(health)line(card,`Build ${health.build ?? 'unknown'} · ${health.protocol ?? 'unknown'} · storage ${health.railwayVolumeAttached?'attached':'not confirmed'}`,'monitor-muted');
  if(!roster||!Array.isArray(roster.players)){line(card,'World roster unavailable','monitor-error');continue;}
  line(card,`Round ${roster.round ?? '?'} · gate ${roster.gate ?? '?'} · ${roster.enemies ?? '?'} enemies · ${roster.night?'night':'day'}`,'monitor-muted');
  const identified=roster.players.every(player=>typeof player.isBot==='boolean');
  const ai=roster.players.filter(player=>player.isBot===true);
  const counts=identified?`${roster.players.length-ai.length} human · ${ai.length} AI`:`${roster.players.length} heroes · AI count unavailable`;
  line(card,`${counts} · auto target ${typeof roster.teammateTarget==='number'?roster.teammateTarget:'not reported'}`);
  if(!roster.players.length)line(card,'No heroes in the world','monitor-muted');
  for(const player of roster.players)if(typeof player?.name==='string'&&typeof player.classId==='string')line(card,`${player.name} · ${player.classId}`,'monitor-player');
 }
 line(target,`Updated ${new Date().toLocaleTimeString()} · AI count uses the server roster`,'monitor-footer');
 timer=setTimeout(()=>void refresh(token),5000);
}
export function openWorldMonitor(){
 if(!panel){
  const style=document.createElement('style');style.textContent=`
  .world-monitor{position:fixed;inset:0;z-index:200;display:grid;place-items:center;background:#09101bc9;padding:16px;box-sizing:border-box;color:#edf3ff;font:14px/1.45 system-ui,sans-serif}
  .world-monitor[hidden]{display:none}.monitor-dialog{width:min(720px,100%);max-height:min(90dvh,760px);overflow:auto;background:#172438;border:1px solid #9cbadd;border-radius:16px;padding:20px;box-shadow:0 16px 60px #0009;box-sizing:border-box}
  .monitor-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.monitor-header h2{margin:0;font-size:20px}.monitor-header button{background:#e7eefb;color:#172438;border:0;border-radius:7px;padding:7px 11px;cursor:pointer;font:inherit}
  .monitor-content{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:14px}.monitor-card{background:#22344d;border-radius:10px;padding:12px;overflow-wrap:anywhere}.monitor-card h3{margin:0 0 6px;font-size:16px}.monitor-ok{color:#99e7b3}.monitor-error{color:#ffc1aa}.monitor-muted,.monitor-footer{color:#b1c5dd;font-size:12px}.monitor-player{padding:2px 0}.monitor-footer{grid-column:1/-1}
  `;document.head.append(style);
  panel=document.createElement('aside');panel.className='world-monitor';panel.dataset.devOnly='vgd:dev-only';panel.setAttribute('aria-label','Live world monitor');
  const dialog=document.createElement('div');dialog.className='monitor-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Live world monitor');
  const header=document.createElement('div');header.className='monitor-header';const title=document.createElement('h2');title.textContent='Live world monitor';const close=document.createElement('button');close.type='button';close.textContent='Close';close.addEventListener('click',closeWorldMonitor);header.append(title,close);
  const content=document.createElement('div');content.className='monitor-content';content.textContent='Loading world status…';dialog.append(header,content);panel.append(dialog);document.body.append(panel);
 }
 panel.hidden=false;generation++;if(timer)clearTimeout(timer);void refresh(generation);panel.querySelector<HTMLButtonElement>('button')?.focus();
}
function closeWorldMonitor(){generation++;if(timer)clearTimeout(timer);if(panel)panel.hidden=true;}
