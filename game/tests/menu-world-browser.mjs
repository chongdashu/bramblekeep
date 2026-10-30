// Exercises the read-only menu snapshot against a real isolated Colyseus world.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@colyseus/sdk';
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
const data=mkdtempSync(join(tmpdir(),'bramble-menu-world-'));
const port=Number(process.env.TEST_WORLD_PORT??25992), front=Number(process.env.TEST_FRONT_PORT??52812);
const server=spawn(process.execPath,['--import','tsx','game/server/index.ts'],{env:{...process.env,PORT:String(port),CASTLE_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(front),'--strictPort'],{env:{...process.env,VITE_COLYSEUS_URL:`http://127.0.0.1:${port}`},stdio:['ignore','pipe','pipe']});
let serverLog='', frontLog='', chrome, cdp, guest;
server.stderr.on('data',v=>serverLog+=v); vite.stderr.on('data',v=>frontLog+=v);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitHTTP(url, process, log) { for(let i=0;i<150;i++){if(process.exitCode!==null)throw Error(`process exited: ${log()}`);try{const r=await fetch(url);if(r.ok)return;}catch{}await sleep(100);}throw Error(`timeout: ${url} ${log()}`); }
try {
 await waitHTTP(`http://127.0.0.1:${port}/world-status`,server,()=>serverLog);
 await waitHTTP(`http://127.0.0.1:${front}/`,vite,()=>frontLog);
 const initial=await (await fetch(`http://127.0.0.1:${port}/world-status`)).json();
 if(initial.players.some(p=>!p.isBot))throw Error('isolated world had a human player');
 if(initial.guardian?.x!==0||initial.guardian?.z!==-26||initial.guardian?.health!==30||initial.guardian?.cleared!==false)throw Error(`missing guardian status: ${JSON.stringify(initial.guardian)}`);
 chrome=await launchChrome({width:1280,height:720});cdp=await connect(chrome.wsUrl);
 const [target]=await cdp.pages(),p=await cdp.attach(target.targetId),errors=[];
 p.on(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text)});
 await p.S('Runtime.enable');await p.S('Page.enable');await p.S('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 await p.S('Page.navigate',{url:`http://127.0.0.1:${front}/?renderer=webgl2&envDefaults`});
 await p.waitFor("!!window.__game && !document.querySelector('#press-start').hidden",30000,'ready');
 const [x,y]=await p.evalJS(`(()=>{const r=document.querySelector('#press-start').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);
 for(const type of ['mousePressed','mouseReleased'])await p.S('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});
 await p.waitFor("window.__game.phase()==='menu' && document.querySelector('.world-panel')?.dataset.online==='true'",10000,'online menu');
 if(!(await p.evalJS("document.querySelector('.world-count').textContent.includes('heroes')")))throw Error('world population not shown');
 let after=await (await fetch(`http://127.0.0.1:${port}/world-status`)).json();if(after.players.some(p=>!p.isBot))throw Error('menu consumed a player seat');
 const profile=async payload=>{const r=await fetch(`http://127.0.0.1:${port}/player-profile`,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload)});if(!r.ok)throw Error('profile request failed');return r.json();};
 const guestSecret='a'.repeat(64),identity=await profile({guestSecret,operation:'get'});await profile({guestSecret,operation:'set',name:'Ada',expectedId:identity.id});
 const client=new Client(`http://127.0.0.1:${port}`);guest=await client.join('castle',{classId:'Scout',guestSecret});
 await p.waitFor("[...document.querySelectorAll('.world-player-name')].some(n=>n.textContent==='Ada')",10000,'connected player on menu');
 const dataView=await p.evalJS(`(()=>{const panel=document.querySelector('.world-panel'),play=document.querySelector('[data-act=play]'),a=panel.getBoundingClientRect(),b=play.getBoundingClientRect(),hero=[...document.querySelectorAll('.world-player-name')].find(n=>n.textContent==='Ada');return {state:document.querySelector('.world-state').textContent,role:hero?.parentElement?.querySelector('.world-player-class')?.textContent,overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top}})()`);
 if(dataView.role!=='Scout'||!dataView.state.includes('Gate ')||dataView.overlap)throw Error(`world details ${JSON.stringify(dataView)}`);
 await p.S('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(300);
 if(!await p.evalJS("document.querySelector('.world-toggle').getAttribute('aria-expanded')==='false' && document.querySelector('.world-details').hidden"))throw Error('phone panel did not collapse');
 await p.evalJS("document.querySelector('.world-toggle').click()");if(!await p.evalJS("!document.querySelector('.world-details').hidden"))throw Error('phone panel did not open');
 await guest.leave();guest=undefined;
 await p.waitFor("![...document.querySelectorAll('.world-player-name')].some(n=>n.textContent==='Ada')",10000,'departure on menu');
 server.kill('SIGTERM');await p.waitFor("document.querySelector('.world-panel').dataset.online==='false'",12000,'offline on menu');
 if(errors.length)throw Error(errors.join('\n'));console.log('menu status: real join, leave, no seat, responsive panel and offline recovery passed');
} finally {
 if(guest)await guest.leave().catch(()=>{});if(cdp)await cdp.close();if(chrome)await chrome.close();vite.kill('SIGTERM');server.kill('SIGTERM');
 await sleep(300);rmSync(data,{recursive:true,force:true});
}
