// Smoke the shipped multiplayer entry against a disposable, same-revision world.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const port=await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
const data=mkdtempSync(join(tmpdir(),'bramble-smoke-world-'));
const origin=`http://127.0.0.1:${port}`;
process.env.VITE_COLYSEUS_URL=origin;
const server=spawn(process.execPath,['--import','tsx','game/server/index.ts'],{env:{...process.env,PORT:String(port),CASTLE_DATA_DIR:data,CASTLE_DEV_DEBUG:'0'},stdio:'ignore'});
server.unref();
process.once('exit',()=>server.kill('SIGTERM'));
async function cleanup(){if(server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,2000).unref();});}rmSync(data,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
let ready=false;for(let i=0;i<150;i++){if(server.exitCode!==null)break;try{if((await fetch(`${origin}/health`)).ok){ready=true;break;}}catch{}await sleep(100);}
if(!ready)throw new Error('isolated smoke world did not start');
async function drive(t){
 const {p,check,press,key,touch}=t;
 await p.waitFor("!!document.querySelector('.multiplayer-join:not([hidden])')",15000,'hero selection');
 check(await p.evalJS("document.querySelectorAll('.multiplayer-join button[data-class]').length===3"),`${t.name}: three hero classes available`);
 await press('[data-class="Knight"]');await p.waitFor('window.__game.multiplayer().joined',20000,'join isolated world');
 const before=await p.evalJS('(()=>{const s=window.__game.multiplayer();return s.playerStates.find(p=>p.id===s.sessionId)})()');
 if(touch){const x=40,y=t.height-115;await p.S('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:7}]});await p.S('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-55,id:7}]});await sleep(700);await p.S('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});check(await p.evalJS("!document.querySelector('.touch-btns').hidden && !!document.querySelector('.touch-btn[data-action=attack]')"),`${t.name}: touch attack is available`);}
 else {await key('KeyW',true);await sleep(700);await key('KeyW',false);}
 const after=await p.evalJS('(()=>{const s=window.__game.multiplayer();return s.playerStates.find(p=>p.id===s.sessionId)})()');
 check(!!before&&!!after&&Math.hypot(after.x-before.x,after.z-before.z)>.3,`${t.name}: player moves in the shared world`);
 check((await p.evalJS('window.__game.multiplayer().enemyStates.length'))>=8,`${t.name}: patrols replicated`);
 await t.shot('play');
}
export default {allowedOrigins:[origin],sharedWorld:true,cleanup,desktop:{drive},phone:{drive}};
