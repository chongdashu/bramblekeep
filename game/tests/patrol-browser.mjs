// Observe real replicated and rendered patrol motion with a player waiting at camp.
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {launchChrome,connect} from '../../tests/lib/cdp.mjs';
const port=25972,frontPort=51972,data=mkdtempSync(join(tmpdir(),'castle-patrol-'));
const server=spawn(process.execPath,['--import','tsx','game/server/index.ts'],{env:{...process.env,PORT:String(port),CASTLE_DATA_DIR:data},stdio:'ignore'});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(frontPort),'--strictPort'],{env:{...process.env,VITE_COLYSEUS_URL:`http://127.0.0.1:${port}`},stdio:'ignore'});let chrome,cdp;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await sleep(100);}throw new Error(`not ready: ${url}`);}
try{
 await Promise.all([ready(`http://127.0.0.1:${port}/health`),ready(`http://127.0.0.1:${frontPort}/`)]);chrome=await launchChrome();cdp=await connect(chrome.wsUrl);const [t]=await cdp.pages(),p=await cdp.attach(t.targetId);const errors=[];p.on(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)});await p.S('Runtime.enable');await p.S('Page.enable');await p.S('Page.navigate',{url:`http://127.0.0.1:${frontPort}/?autostart&envDefaults`});await p.waitFor("!!document.querySelector('.multiplayer-join:not([hidden])')",30000,'class picker');await p.evalJS("document.querySelector('[data-class=Knight]').click()");await p.waitFor('window.__game.multiplayer().joined && window.__game.multiplayer().enemyStates.length>=5',30000,'patrol loaded');
 const samples=await p.evalJS(`new Promise(resolve=>{const samples=[];let start;function frame(t){start??=t;samples.push({t,enemies:window.__game.multiplayer().enemyStates});if(t-start<12000)requestAnimationFrame(frame);else resolve(samples);}requestAnimationFrame(frame);})`);
 let maxTurn=0;const moving=Array(5).fill(0),idle=Array(5).fill(0),changes=Array(5).fill(0);for(let i=1;i<samples.length;i++){for(let j=0;j<5;j++){const a=samples[i-1].enemies.find(e=>e.id===String(j)),b=samples[i].enemies.find(e=>e.id===String(j));if(!a||!b)continue;const turn=Math.abs(Math.atan2(Math.sin(b.renderYaw-a.renderYaw),Math.cos(b.renderYaw-a.renderYaw)));maxTurn=Math.max(maxTurn,turn);if(a.moving!==b.moving)changes[j]++;(b.moving?moving:idle)[j]++;}}
 if(maxTurn>.16)throw new Error(`visible patrol turned too sharply: ${maxTurn}`);if(!moving.some((n,j)=>n>30&&idle[j]>30))throw new Error(`did not see both walking and idling: ${JSON.stringify({moving,idle})}`);if(changes.some(n=>n>15))throw new Error(`patrol changes state too often: ${changes}`);if(errors.length)throw new Error(errors.join(','));console.log('visible patrol motion passed',JSON.stringify({frames:samples.length,maxTurn,moving,idle,changes}));
}finally{if(cdp)await cdp.close();if(chrome)await chrome.close();vite.kill('SIGTERM');server.kill('SIGTERM');await new Promise(r=>{server.once('exit',r);setTimeout(r,2000)});rmSync(data,{recursive:true,force:true});}
