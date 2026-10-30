import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
const port=Number(process.env.TEST_WORLD_PORT??25982), front=Number(process.env.TEST_FRONT_PORT??51982), data=mkdtempSync(join(tmpdir(),'castle-hud-'));
const server=spawn(process.execPath,['--import','tsx','game/server/index.ts'],{env:{...process.env,PORT:String(port),CASTLE_DATA_DIR:data},stdio:'ignore'});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(front),'--strictPort'],{env:{...process.env,VITE_COLYSEUS_URL:`http://127.0.0.1:${port}`},stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(url){for(let i=0;i<150;i++){try{if((await fetch(url)).ok)return;}catch{}await sleep(100);}throw Error(`not ready: ${url}`);}
let chrome,cdp;
try {
 await Promise.all([ready(`http://127.0.0.1:${port}/health`),ready(`http://127.0.0.1:${front}/`)]);
 chrome=await launchChrome({width:1280,height:720});cdp=await connect(chrome.wsUrl);const [target]=await cdp.pages(),page=await cdp.attach(target.targetId);
 await page.S('Runtime.enable');await page.S('Page.enable');await page.S('Page.navigate',{url:`http://127.0.0.1:${front}/?autostart&envDefaults`});
 await page.waitFor("!!document.querySelector('.multiplayer-join:not([hidden])')",30000,'class picker');await page.evalJS("document.querySelector('[data-class=Knight]').click()");await page.waitFor("window.__game.multiplayer().joined && !document.querySelector('.hero-status').hidden && !document.querySelector('.world-clock').hidden",30000,'world HUD');
 for(const [name,width,height,touch] of [['desktop',1280,720,false],['phone',390,844,true],['short touch',667,375,true],['short desktop',640,360,false]]){
  await page.S('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:touch});await page.S('Emulation.setTouchEmulationEnabled',{enabled:touch,maxTouchPoints:touch?2:1});await sleep(300);
  const r=await page.evalJS(`(()=>{const rect=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,hidden:e.hidden}};return {hero:rect('.hero-status'),clock:rect('.world-clock'),connection:rect('.connection-status'),chat:rect('.chat-panel'),buttons:rect('.touch-btns')};})()`);
  const fits=a=>a.left>=0&&a.right<=width&&a.top>=0&&a.bottom<=height;
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  if(![r.hero,r.clock,r.connection,r.chat].every(fits)||r.hero.left>width/3||r.hero.top<height/2||r.clock.left>width/3||r.clock.top>height/2||r.connection.left>width/2||r.connection.top>height/2||r.chat.right<width*2/3||r.chat.top<height/2||overlap(r.clock,r.connection)||overlap(r.clock,r.chat)||overlap(r.connection,r.chat)||overlap(r.hero,r.chat)||overlap(r.hero,r.clock)||overlap(r.hero,r.connection)||(touch&&!r.buttons.hidden&&(overlap(r.chat,r.buttons)||overlap(r.hero,r.buttons))))throw Error(`${name}: misplaced or overlapping HUD ${JSON.stringify(r)}`);
  console.log(`HUD layout passed: ${name}`);
 }
} finally {if(cdp)await cdp.close();if(chrome)await chrome.close();vite.kill('SIGTERM');server.kill('SIGTERM');rmSync(data,{recursive:true,force:true});}
