// One local launcher; only reuse servers that belong to this checkout.
import { spawn, execFileSync } from 'node:child_process';
import { realpathSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { developmentAnalytics } from './dev-analytics.mjs';
const protocol=readFileSync(new URL('../src/multiplayer-protocol.ts',import.meta.url),'utf8').match(/CASTLE_PROTOCOL\s*=\s*['"]([^'"]+)['"]/)?.[1];
if(!protocol)throw new Error('Cannot read the multiplayer protocol version');
const root=realpathSync(process.cwd()),checkout=createHash('sha256').update(root).digest('hex'),port=Number(process.env.PORT??2567),children=[];
const readHealth=async()=>{try {const r=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(1000)});return r.ok?await r.json():null;}catch{return null;}};
function owner(p){try{return execFileSync('lsof',['-nP',`-iTCP:${p}`,'-sTCP:LISTEN','-t'],{encoding:'utf8'}).trim().split('\n')[0]||null;}catch{return null;}}
function cwd(pid){try{const s=execFileSync('lsof',['-a','-p',pid,'-d','cwd','-Fn'],{encoding:'utf8'});return realpathSync(s.split('\n').find(x=>x.startsWith('n'))?.slice(1)??'');}catch{return null;}}
let devAnalytics;
function run(cmd,args){const childEnv={...process.env};for(const name of ['BRAMBLEKEEP_ANALYTICS_SITE','BRAMBLEKEEP_ANALYTICS_TRAFFIC','BRAMBLEKEEP_INGEST_KEY'])delete childEnv[name];Object.assign(childEnv,devAnalytics??{}, {CASTLE_DEV_DEBUG:process.env.CASTLE_DEV_DEBUG??'1'});delete childEnv.VITE_COLYSEUS_URL;delete childEnv.VITE_BRAMBLEKEEP_ANALYTICS_LIVE_SITE;const p=spawn(cmd,args,{stdio:'inherit',env:childEnv});children.push(p);p.on('exit',(code,signal)=>{if(!closing){console.error(`${cmd} exited (${signal??code})`);shutdown(1);}});return p;}
let closing=false;function shutdown(code=0){if(closing)return;closing=true;for(const p of children)p.kill('SIGTERM');setTimeout(()=>process.exit(code),250).unref();}
process.on('SIGINT',()=>shutdown());process.on('SIGTERM',()=>shutdown());
let existing=await readHealth();
if(existing&&existing.checkout!==checkout){console.error(`Port ${port} is owned by a different checkout: ${existing.checkout}`);process.exit(1);}
devAnalytics=developmentAnalytics(root);if(!devAnalytics)console.warn('Development Convex analytics is unavailable; the local world will continue without server analytics.');
const wantsDebug=process.env.CASTLE_DEV_DEBUG!=='0';
if(existing&&(existing.protocol!==protocol||(wantsDebug&&!existing.devDebug)||(devAnalytics&&!existing.analytics?.configured))){
 const pid=owner(port);let command='',parent='';try{command=execFileSync('ps',['-p',pid,'-o','command='],{encoding:'utf8'});parent=execFileSync('ps',['-p',pid,'-o','ppid='],{encoding:'utf8'}).trim();}catch{}
 if(!pid||cwd(pid)!==root||!command.includes('game/server/index.ts')){console.error(`The server on ${port} uses protocol ${existing.protocol}, and its owner could not be safely identified.`);process.exit(1);}
 let killPid=pid;try{const parentCommand=execFileSync('ps',['-p',parent,'-o','command='],{encoding:'utf8'});if(parentCommand.includes('tsx')&&cwd(parent)===root)killPid=parent;}catch{}
 console.log(`Restarting local castle server PID ${killPid} to apply the current development configuration.`);process.kill(Number(killPid),'SIGTERM');
 for(let i=0;i<50&&owner(port);i++)await new Promise(r=>setTimeout(r,100));
 if(owner(port)){console.error(`Port ${port} is still occupied after stopping the stale server.`);process.exit(1);}existing=null;
}
if(existing){console.log(`Reusing castle server on ${port}.`);if(process.env.TYPESAFE_API_KEY)console.log('A reused server keeps its original environment; restart it to load changes from .env.local.');}
else {const pid=owner(port);if(pid){console.error(`Port ${port} is occupied by PID ${pid} (${cwd(pid)??'unknown checkout'}). Stop it before starting the world.`);process.exit(1);}run(process.execPath,['node_modules/tsx/dist/cli.mjs','watch','game/server/index.ts']);for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,100));const h=await readHealth();if(h?.protocol===protocol&&h.checkout===checkout)break;if(i===99){console.error('The castle server did not become ready.');shutdown(1);}}}
const wasm=spawn(process.execPath,['scripts/build-wasm.mjs'],{stdio:'inherit'});const wasmExit=await new Promise(resolve=>wasm.on('exit',resolve));if(wasmExit!==0){shutdown(1);throw new Error('WASM build failed');}
const previewPid=owner(5173);
if(previewPid){const dir=cwd(previewPid);if(dir!==root){console.error(`Port 5173 is occupied by PID ${previewPid} in ${dir??'an unknown checkout'}.`);shutdown(1);}else console.log('Reusing this checkout’s preview at http://127.0.0.1:5173');}
else {run(process.execPath,['node_modules/vite/bin/vite.js','--host','0.0.0.0','--port','5173','--strictPort']);}
console.log('Play at http://127.0.0.1:5173');
// Stay alive when reusing the preview so this launcher owns its server child.
setInterval(()=>{},1000);
