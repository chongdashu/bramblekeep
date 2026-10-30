import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {launchChrome,connect} from '../../tests/lib/cdp.mjs';
const port=25987,front=51987,data=mkdtempSync(join(tmpdir(),'wavedash-anon-'));let chrome,cdp;
const server=spawn(process.execPath,['--import','tsx','game/server/index.ts'],{env:{...process.env,PORT:String(port),CASTLE_DATA_DIR:data,CASTLE_AUTH_MODE:'guest'},stdio:'ignore'});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(front),'--strictPort'],{env:{...process.env,VITE_COLYSEUS_URL:`http://127.0.0.1:${port}`},stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await sleep(100);}throw Error(`not ready ${url}`)}
try{
 await Promise.all([ready(`http://127.0.0.1:${port}/health`),ready(`http://127.0.0.1:${front}/`)]);chrome=await launchChrome();cdp=await connect(chrome.wsUrl);const [target]=await cdp.pages(),page=await cdp.attach(target.targetId);await page.S('Runtime.enable');await page.S('Page.enable');
 await page.S('Page.addScriptToEvaluateOnNewDocument',{source:`window.Wavedash={init:()=>true,getUserJwt:async()=>({success:false}),getUser:()=>null,getUsername:()=>null,updateLoadProgressZeroToOne:()=>{}}`});
 const url=`http://127.0.0.1:${front}/?platform=wavedash&autostart&envDefaults`;await page.S('Page.navigate',{url});await page.waitFor("!!document.querySelector('.multiplayer-join:not([hidden])') && !document.querySelector('.player-name-input').disabled",30000,'anonymous profile');const first=await page.evalJS("document.querySelector('.player-name-input').value");if(!first)throw Error('no generated name for anonymous Wavedash');
 await page.evalJS('window.__profileBeforeReload = true');await page.S('Page.reload');await page.waitFor("!window.__profileBeforeReload && !!document.querySelector('.multiplayer-join:not([hidden])') && !document.querySelector('.player-name-input').disabled",30000,'anonymous profile after reload');const second=await page.evalJS("document.querySelector('.player-name-input').value");if(first!==second)throw Error('anonymous name did not persist');await page.evalJS("document.querySelector('[data-class=Knight]').click()");await page.waitFor('window.__game.multiplayer().joined',30000,'anonymous joined');console.log('Wavedash anonymous browser passed',JSON.stringify({name:first,persistent:true,joined:true}));
}finally{if(cdp)await cdp.close();if(chrome)await chrome.close();vite.kill('SIGTERM');server.kill('SIGTERM');rmSync(data,{recursive:true,force:true});}
