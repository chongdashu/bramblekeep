import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
const port=Number(process.env.TEST_WORLD_PORT??25971),front=Number(process.env.TEST_FRONT_PORT??51971),data=mkdtempSync(join(tmpdir(),'menu-music-'));
const server=spawn(process.execPath,['--import','tsx','game/server/index.ts'],{env:{...process.env,PORT:String(port),CASTLE_DATA_DIR:data},stdio:'ignore'});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(front),'--strictPort'],{env:{...process.env,VITE_COLYSEUS_URL:`http://127.0.0.1:${port}`},stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let chrome,cdp;
async function ready(url){for(let i=0;i<150;i++){try{if((await fetch(url)).ok)return;}catch{}await sleep(100);}throw Error(`not ready: ${url}`);}
try{
 await Promise.all([ready(`http://127.0.0.1:${port}/health`),ready(`http://127.0.0.1:${front}/`)]);
 chrome=await launchChrome({width:1280,height:720});cdp=await connect(chrome.wsUrl);const [target]=await cdp.pages(),page=await cdp.attach(target.targetId);await page.S('Runtime.enable');await page.S('Page.enable');await page.S('Page.navigate',{url:`http://127.0.0.1:${front}/?envDefaults`});await page.waitFor("!!window.__game && !document.querySelector('#press-start').hidden",30000,'title ready');
 async function click(selector){const [x,y]=await page.evalJS(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);for(const type of ['mousePressed','mouseReleased'])await page.S('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});}
 await click('#press-start');await page.waitFor("window.__game.phase()==='menu' && window.__game.gameAudio().music==='menuTheme'",30000,'menu music');
 await page.evalJS(`(()=>{const audio=window.__game.runtime.audio;window.__menuSource=audio.music.current.src;window.__musicCalls=[];const play=audio.playMusic.bind(audio);audio.playMusic=name=>{window.__musicCalls.push(name);return play(name)}})()`);
 await click('[data-act=play]');await page.waitFor("!!document.querySelector('.multiplayer-join:not([hidden])')",10000,'hero selection');await sleep(600);
 const selection=await page.evalJS("({music:window.__game.gameAudio().music,sameSource:window.__game.runtime.audio.music.current?.src===window.__menuSource,calls:window.__musicCalls})");
 if(selection.music!=='menuTheme'||!selection.sameSource||selection.calls.length)throw Error(`menu music restarted at hero selection: ${JSON.stringify(selection)}`);
 await page.evalJS("document.querySelector('#player-name').focus();document.querySelector('#player-name').value='Unsaved name'");
 for(const type of ['keyDown','keyUp'])await page.S('Input.dispatchKeyEvent',{type,code:'Escape',key:'Escape',windowsVirtualKeyCode:27});
 if(!await page.evalJS("!document.querySelector('.multiplayer-join').hidden && document.querySelector('#player-name').readOnly && document.querySelector('#player-name').value!=='Unsaved name'"))throw Error('Escape did not cancel name editing');
 for(const type of ['keyDown','keyUp'])await page.S('Input.dispatchKeyEvent',{type,code:'Escape',key:'Escape',windowsVirtualKeyCode:27});
 await page.waitFor("window.__game.phase()==='menu' && document.querySelector('.multiplayer-join').hidden && document.querySelector('#pause-pop').hidden",5000,'Escape returns to menu without pause');
 if(!await page.evalJS("window.__game.runtime.audio.music.current?.src===window.__menuSource"))throw Error('returning to menu restarted music');
 await click('[data-act=play]');await page.waitFor("!!document.querySelector('.multiplayer-join:not([hidden]) [data-class=Knight]:not(:disabled)')",10000,'hero selection again');
 await page.evalJS("document.querySelector('[data-class=Knight]').click()");await page.waitFor("window.__game.multiplayer().joined && window.__game.gameAudio().music==='castleCamp'",20000,'gameplay music');
 console.log('menu music stays on the same audio source through hero selection, then changes after joining');
}finally{if(cdp)await cdp.close();if(chrome)await chrome.close();vite.kill('SIGTERM');server.kill('SIGTERM');await Promise.all([vite,server].map(child=>child.exitCode!==null?Promise.resolve():new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,2000)})));rmSync(data,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
