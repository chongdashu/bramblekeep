// Real two-client server run; isolated backend and result directory. No test-only gameplay commands.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@colyseus/sdk';
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
import { canStand } from '../src/scenes/environment-map.ts';
const data=mkdtempSync(join(tmpdir(),'castle-world-')),port=Number(process.env.TEST_WORLD_PORT??25977);
const server=spawn(process.execPath,['--import','tsx','game/server/index.ts'],{env:{...process.env,PORT:String(port),CASTLE_DATA_DIR:data},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',v=>output+=v);server.stderr.on('data',v=>output+=v);
const frontPort=Number(process.env.TEST_FRONT_PORT??51977);
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(frontPort),'--strictPort'],{env:{...process.env,VITE_COLYSEUS_URL:`http://127.0.0.1:${port}`},stdio:['ignore','pipe','pipe']});let frontLog='';vite.stdout.on('data',v=>frontLog+=v);vite.stderr.on('data',v=>frontLog+=v);
let chrome,cdp;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function health(){for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error(`server exited: ${output}`);try{const r=await fetch(`http://127.0.0.1:${port}/health`);if(r.ok)return;}catch{}await sleep(100);}throw new Error(`server failed to start: ${output}`);}
// Navigate a grid derived from the same collision function as the simulation.
function nextStep(x,z,tx,tz,gate){
 const size=.5, key=(a,b)=>`${a},${b}`, ix=v=>Math.round(v/size), start=[ix(x),ix(z)],goal=[ix(tx),ix(tz)],q=[start],prev=new Map([[key(...start),null]]);let end=null;
 for(let i=0;i<q.length&&i<12000;i++){const [a,b]=q[i];if(Math.hypot((a-goal[0])*size,(b-goal[1])*size)<.7){end=[a,b];break;}for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=a+dx,nz=b+dz,k=key(nx,nz);if(!prev.has(k)&&canStand(nx*size,nz*size,gate)){prev.set(k,[a,b]);q.push([nx,nz]);}}}
 if(!end)return [tx-x,tz-z];let next=end,parent=prev.get(key(...next));while(parent&&key(...parent)!==key(...start)){next=parent;parent=prev.get(key(...next));}return [next[0]*size-x,next[1]*size-z];
}
try{
 await health();for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${frontPort}/`)).ok)break;}catch{}if(i===99)throw new Error(`preview failed: ${frontLog}`);await sleep(100);}
 chrome=await launchChrome();cdp=await connect(chrome.wsUrl);const [target]=await cdp.pages(),page=await cdp.attach(target.targetId);const errors=[];page.on(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);});await page.S('Runtime.enable');await page.S('Page.enable');await page.S('Page.navigate',{url:`http://127.0.0.1:${frontPort}/?autostart&envDefaults`});
 await page.waitFor("!!document.querySelector('.multiplayer-join:not([hidden])')",30000,'class selection');await page.evalJS("document.querySelector('[data-class=Scout]').click()");await page.waitFor('window.__game.multiplayer().joined',30000,'browser joined');
 const client=new Client(`http://127.0.0.1:${port}`),a=await client.join('castle',{classId:'Knight'});await page.waitFor('window.__game.multiplayer().players>=2',10000,'two players');
 let sawGate=false,lastPrint=0;
 for(let tick=0;tick<2400;tick++){
  const state=a.state,me=state?.players?.get(a.sessionId);if(!me){await sleep(50);continue;}
  if(state.gateOpen){sawGate=true;break;}
  const target=state.leverLeft>.01?{x:-9,z:-14.3}:{x:9,z:-14.3};const dist=Math.hypot(target.x-me.x,target.z-me.z);const attack=dist<1.55;let [dx,dz]=attack?[0,0]:nextStep(me.x,me.z,target.x,target.z,false);const len=Math.hypot(dx,dz)||1;a.send('input',{x:dx/len,z:dz/len,sprint:true,attack});
  if(tick-lastPrint>250){lastPrint=tick;console.log('progress',JSON.stringify({tick,x:me.x,z:me.z,left:state.leverLeft,right:state.leverRight}));}
  await sleep(50);
 }
 if(!sawGate)throw new Error(`gate did not open: ${JSON.stringify(a.state.toJSON())}`);
 a.send('input',{x:0,z:0,sprint:false,attack:false});
 await page.waitFor('window.__game.multiplayer().gateOpen && window.__game.multiplayer().cinematic',10000,'shared breach cinematic');
 const before=await page.evalJS('window.__game.multiplayer()');
 if(before.leverHealth.some(h=>h>.2))throw new Error(`levers not replicated: ${JSON.stringify(before.leverHealth)}`);
 if(!await page.evalJS("!document.querySelector('.gate-cinematic').hidden && document.querySelector('.gate-cinematic').textContent.includes('GATE IS DOWN')"))throw new Error('breach announcement missing');
 const position=await page.evalJS('(()=>{const s=window.__game.multiplayer();return s.playerStates.find(p=>p.id===s.sessionId)})()');
 await page.S('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w',windowsVirtualKeyCode:87});await sleep(600);await page.S('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w',windowsVirtualKeyCode:87});
 const after=await page.evalJS('window.__game.multiplayer()');const moved=after.playerStates.find(p=>p.id===after.sessionId);if(Math.hypot(moved.x-position.x,moved.z-position.z)<.1)throw new Error('movement blocked during breach announcement');if(after.gateRemaining>=before.gateRemaining)throw new Error('server timer stopped during announcement');
 await page.waitFor("window.__game.multiplayer().enemyStates.some(e=>e.id==='10' && e.z < -22)",10000,'courtyard defender visible to browser');
 await page.waitFor("window.__game.multiplayer().enemyStates.some(e=>e.id==='11' && e.z < -22)",12000,'second courtyard defender');
 await page.waitFor("window.__game.multiplayer().enemyStates.some(e=>e.id==='13' && e.z < -22)",22000,'fourth courtyard defender');
 const inside=[...a.state.enemies].filter(([id,e])=>Number(id)>=10&&e.alive&&e.z< -22);
 if(inside.length<4)throw new Error(`expected four authoritative courtyard defenders: ${JSON.stringify(inside)}`);
 if(new Set(inside.map(([,e])=>e.type)).size!==4)throw new Error('courtyard did not receive all four minion types');
 if(errors.length)throw new Error(errors.join('\n'));console.log('two-client lever sync, breach and four courtyard minion types passed');await a.leave();
} finally {if(cdp)await cdp.close();if(chrome)await chrome.close();vite.kill('SIGTERM');server.kill('SIGTERM');await new Promise(r=>{server.once('exit',r);setTimeout(r,2000)});rmSync(data,{recursive:true,force:true});}
