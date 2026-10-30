// Verify real keyboard input against an isolated authoritative server.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
const data=mkdtempSync(join(tmpdir(),'scout-draw-')),port=25987,frontPort=51987;
const server=spawn(process.execPath,['--import','tsx','game/server/index.ts'],{env:{...process.env,PORT:String(port),CASTLE_DATA_DIR:data},stdio:'ignore'});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(frontPort),'--strictPort'],{env:{...process.env,VITE_COLYSEUS_URL:`http://127.0.0.1:${port}`},stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let chrome,cdp;
async function ready(url){for(let i=0;i<150;i++){try{if((await fetch(url)).ok)return;}catch{}await sleep(100);}throw Error(`Failed to start ${url}`);}
try {
 await Promise.all([ready(`http://127.0.0.1:${port}/health`),ready(`http://127.0.0.1:${frontPort}/`)]);
 chrome=await launchChrome();cdp=await connect(chrome.wsUrl);const [target]=await cdp.pages(),page=await cdp.attach(target.targetId),errors=[];
 page.on(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text)});
 await page.S('Runtime.enable');await page.S('Page.enable');await page.S('Page.navigate',{url:`http://127.0.0.1:${frontPort}/?autostart&envDefaults`});
 await page.waitFor("!!document.querySelector('.multiplayer-join:not([hidden])')",30000,'class selection');await page.evalJS("document.querySelector('[data-class=Scout]').click()");await page.waitFor('window.__game.multiplayer().joined',30000,'joined');
 const initial=await page.evalJS('window.__game.multiplayer().attackSeq');
 await page.S('Input.dispatchKeyEvent',{type:'keyDown',code:'Space',key:' ',windowsVirtualKeyCode:32});
 await page.waitFor('window.__game.multiplayer().drawProgress>.95',5000,'full draw');
 const held=await page.evalJS('window.__game.multiplayer()');if(held.attackSeq!==initial||held.drawRange<15.5)throw Error(`Invalid held state: ${JSON.stringify(held)}`);
 await page.S('Input.dispatchKeyEvent',{type:'keyUp',code:'Space',key:' ',windowsVirtualKeyCode:32});
 await page.waitFor(`window.__game.multiplayer().attackSeq>${initial}`,5000,'release shot');await page.waitFor('window.__game.multiplayer().drawProgress<0',5000,'draw ended');
 await sleep(900);const after=await page.evalJS('window.__game.multiplayer()');if(after.attackSeq!==initial+1)throw Error(`Unexpected repeat shot: ${after.attackSeq}`);
 if(errors.length)throw Error(errors.join('\n'));console.log('Scout full draw, release and single shot passed through the browser and server');
} finally {if(cdp)await cdp.close();if(chrome)await chrome.close();vite.kill('SIGTERM');server.kill('SIGTERM');rmSync(data,{recursive:true,force:true});}
