// Muted real-browser test with 250 ms delayed server-to-client WebSocket messages.
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {launchChrome,connect} from '../../tests/lib/cdp.mjs';
const port=25971,frontPort=51971,data=mkdtempSync(join(tmpdir(),'castle-latency-'));
const server=spawn(process.execPath,['--import','tsx','game/server/index.ts'],{env:{...process.env,PORT:String(port),CASTLE_DATA_DIR:data,CASTLE_TEST_LATENCY_MS:'250'},stdio:'ignore'});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(frontPort),'--strictPort'],{env:{...process.env,VITE_COLYSEUS_URL:`http://127.0.0.1:${port}`},stdio:'ignore'});let chrome,cdp;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await sleep(100);}throw new Error(`not ready: ${url}`);}
try{
 await Promise.all([ready(`http://127.0.0.1:${port}/health`),ready(`http://127.0.0.1:${frontPort}/`)]);
 chrome=await launchChrome();cdp=await connect(chrome.wsUrl);const [t]=await cdp.pages(),p=await cdp.attach(t.targetId);const errors=[];p.on(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)});await p.S('Runtime.enable');await p.S('Page.enable');await p.S('Page.navigate',{url:`http://127.0.0.1:${frontPort}/?autostart&envDefaults`});await p.waitFor("!!document.querySelector('.multiplayer-join:not([hidden])')",30000,'class picker');await p.evalJS("document.querySelector('[data-class=Knight]').click()");await p.waitFor('window.__game.multiplayer().joined && window.__game.multiplayer().enemyStates.some(e=>e.moving)',30000,'joined and patrol moving');
 const samples=await p.evalJS(`new Promise(resolve=>{const samples=[];let start;function frame(t){start??=t;const e=window.__game.multiplayer().enemyStates.find(e=>e.moving);if(e)samples.push(e);if(t-start<1500)requestAnimationFrame(frame);else resolve(samples);}requestAnimationFrame(frame);})`);
 let raw=0,rendered=0;for(let i=1;i<samples.length;i++){if(samples[i].id!==samples[i-1].id)continue;if(Math.hypot(samples[i].x-samples[i-1].x,samples[i].z-samples[i-1].z)>.001)raw++;if(Math.hypot(samples[i].renderX-samples[i-1].renderX,samples[i].renderZ-samples[i-1].renderZ)>.001)rendered++;}
 if(rendered<raw*1.4)throw new Error(`enemy interpolation not apparent: raw=${raw}, rendered=${rendered}`);
 const before=await p.evalJS('window.__game.environmentLab().playerZ');await p.S('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w',windowsVirtualKeyCode:87});await sleep(180);
 const early=await p.evalJS(`(()=>{const s=window.__game.multiplayer();return {visual:window.__game.environmentLab().playerZ,server:s.playerStates.find(p=>p.id===s.sessionId).z}})()`);
 if(Math.abs(early.visual-before)<.15 || Math.abs(early.server-before)>.12)throw new Error(`prediction not ahead of delayed server: ${JSON.stringify({before,early})}`);
 await p.S('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w',windowsVirtualKeyCode:87});await sleep(1800);
 const final=await p.evalJS(`(()=>{const s=window.__game.multiplayer();return {visual:window.__game.environmentLab().playerZ,server:s.playerStates.find(p=>p.id===s.sessionId).z}})()`);
 if(Math.abs(final.visual-final.server)>.15)throw new Error(`prediction failed to converge: ${JSON.stringify(final)}`);if(errors.length)throw new Error(errors.join(','));
 console.log('latency and interpolation passed',JSON.stringify({rawChanges:raw,renderedChanges:rendered,before,early,final}));
}finally{if(cdp)await cdp.close();if(chrome)await chrome.close();vite.kill('SIGTERM');server.kill('SIGTERM');await new Promise(r=>{server.once('exit',r);setTimeout(r,2000)});rmSync(data,{recursive:true,force:true});}
