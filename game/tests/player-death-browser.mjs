// Verify real keyboard input against an isolated authoritative server.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@colyseus/sdk';
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
const data=mkdtempSync(join(tmpdir(),'death-check-')),port=25989,frontPort=51989;
const server=spawn(process.execPath,['--import','tsx','game/server/index.ts'],{env:{...process.env,PORT:String(port),CASTLE_DATA_DIR:data},stdio:'ignore'});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(frontPort),'--strictPort'],{env:{...process.env,VITE_COLYSEUS_URL:`http://127.0.0.1:${port}`},stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let chrome,cdp;
async function ready(url){for(let i=0;i<150;i++){try{if((await fetch(url)).ok)return;}catch{}await sleep(100);}throw Error(`Failed to start ${url}`);}
try {
 await Promise.all([ready(`http://127.0.0.1:${port}/health`),ready(`http://127.0.0.1:${frontPort}/`)]);
 chrome=await launchChrome();cdp=await connect(chrome.wsUrl);const [target]=await cdp.pages(),page=await cdp.attach(target.targetId),errors=[];
 page.on(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text)});
 await page.S('Runtime.enable');await page.S('Page.enable');await page.S('Page.navigate',{url:`http://127.0.0.1:${frontPort}/?autostart&envDefaults`});
 await page.waitFor("!!document.querySelector('.multiplayer-join:not([hidden])')",30000,'class selection');await page.evalJS("document.querySelector('[data-class=Knight]').click()");await page.waitFor('window.__game.multiplayer().joined',30000,'joined');
 const sdk=new Client(`http://127.0.0.1:${port}`);const observers=[await sdk.join('castle',{classId:'Scout'}),await sdk.join('castle',{classId:'Scout'})];await sleep(300);
 const key=(type,code,key,n)=>page.S('Input.dispatchKeyEvent',{type,code,key,windowsVirtualKeyCode:n});
 await key('keyDown','ShiftLeft','Shift',16);await key('keyDown','KeyW','w',87);
 await page.waitFor('(()=>{const s=window.__game.multiplayer();return s.playerStates.find(p=>p.id===s.sessionId)?.z< -3.5})()',25000,'reach patrol');
 await key('keyUp','KeyW','w',87);await key('keyUp','ShiftLeft','Shift',16);
 await page.waitFor('window.__game.multiplayer().respawnRemaining>0',40000,'player falls');
 await page.waitFor("document.querySelector('.hero-status-health strong').textContent==='0/6' && document.querySelector('.hero-status-fill').style.width==='0%'",3000,'empty health bar');const before=await page.evalJS('window.__game.multiplayer()');if(before.health!==0||!await page.evalJS("!document.querySelector('.player-death-notice').hidden"))throw Error('death state not presented');
 await key('keyDown','KeyW','w',87);await key('keyDown','Space',' ',32);await sleep(700);await key('keyUp','KeyW','w',87);await key('keyUp','Space',' ',32);
 const during=await page.evalJS('window.__game.multiplayer()'),a=before.playerStates.find(p=>p.id===before.sessionId),b=during.playerStates.find(p=>p.id===during.sessionId);
 if(Math.hypot(a.x-b.x,a.z-b.z)>.1||during.attackSeq!==before.attackSeq||during.respawnRemaining>=before.respawnRemaining)throw Error('death cooldown did not block input or tick');
 await page.waitFor('window.__game.multiplayer().health===6 && window.__game.multiplayer().respawnRemaining===0',6000,'respawn');
 await page.waitFor("document.querySelector('.hero-status-health strong').textContent==='6/6' && document.querySelector('.hero-status-fill').style.width==='100%'",3000,'restored health bar');const after=await page.evalJS('window.__game.multiplayer()'),p=after.playerStates.find(p=>p.id===after.sessionId);if(p.z<15||!await page.evalJS("document.querySelector('.player-death-notice').hidden"))throw Error('respawn did not return to camp');
 if(errors.length)throw Error(errors.join('\n'));for(const observer of observers)await observer.leave();console.log('real browser death, blocked input, countdown and camp respawn passed');
} finally {if(cdp)await cdp.close();if(chrome)await chrome.close();vite.kill('SIGTERM');server.kill('SIGTERM');rmSync(data,{recursive:true,force:true});}
