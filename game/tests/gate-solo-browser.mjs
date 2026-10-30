import {launchChrome,connect} from '../../tests/lib/cdp.mjs';import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.argv[2] ?? 'http://127.0.0.1:5191';const sleep=ms=>new Promise(r=>setTimeout(r,ms));const chrome=await launchChrome({width:1280,height:720});const cdp=await connect(chrome.wsUrl);
try{const [t]=await cdp.pages(),p=await cdp.attach(t.targetId);await p.S('Runtime.enable');await p.S('Page.enable');await p.S('Page.navigate',{url:`${base}/?scene=solo&envDefaults`});await p.waitFor("window.__game?.phase?.()==='playing' && !!window.__game.castlePlay",30000,'game');
await p.evalJS("document.querySelector('.castle-hitboxes').click()");if(!await p.evalJS('window.__game.castlePlay().hitboxes'))throw new Error('hitbox debug did not turn on');await p.evalJS("document.querySelector('.castle-hitboxes').click()");
const keys={};async function set(code,on){if(!!keys[code]===on)return;keys[code]=on;const info={KeyW:['w',87],KeyS:['s',83],KeyA:['a',65],KeyD:['d',68],ShiftLeft:['Shift',16],Space:[' ',32]}[code];await p.S('Input.dispatchKeyEvent',{type:on?'keyDown':'keyUp',code,key:info[0],windowsVirtualKeyCode:info[1]});}
async function walk(x,z){await set('KeyW',z<-.25);await set('KeyS',z>.25);await set('KeyA',x<-.25);await set('KeyD',x>.25);}
await set('ShiftLeft',true);await set('KeyW',true);await p.waitFor('window.__game.castlePlay().playerZ < 3',15000,'bridge');await set('KeyW',false);await set('Space',true);
let s,deadline=Date.now()+95000,last=-1,sawGateLock=false;
while(Date.now()<deadline){s=await p.evalJS('window.__game.castlePlay()');
 const hud=await p.evalJS(`(()=>{const s=window.__game.castlePlay();return {open:s.gateOpen,shown:!document.querySelector('#gate-lock').hidden}})()`);
 if(!hud.open&&hud.shown)sawGateLock=true;
 if(hud.open&&hud.shown)throw new Error('lock icon remained visible after opening');
 if(s.defeats!==last){last=s.defeats;console.log('defeats',last,'hp',s.health,'pos',s.playerX,s.playerZ);}if(s.gateOpen)break;
 // Follow the clear central route past the torch posts before moving sideways.
 if(s.playerZ>-8){await walk(-s.playerX,-1);await sleep(180);continue;}
 const target=s.leverHealth[0]>.01?{x:-9,z:-14.3}:{x:9,z:-14.3};
 const dx=target.x-s.playerX,dz=target.z-s.playerZ,d=Math.hypot(dx,dz);
 if(d<=1.4)await walk(0,0);
 else if(Math.abs(dx)>1.2 && s.playerZ < -11.8)await walk(0,1);
 else if(Math.abs(dx)>1.2)await walk(dx,0);
 else await walk(0,dz);
 await sleep(180);
}
await walk(0,0);if(!s.gateOpen)throw new Error('breach not reached');if(!sawGateLock)throw new Error('gate lock was never visible');await p.waitFor('window.__game.castlePlay().cinematic',3000,'breach cinematic');
const before=await p.evalJS('window.__game.castlePlay()');if(!await p.evalJS("!document.querySelector('.gate-cinematic').hidden && document.querySelector('.gate-cinematic').textContent.includes('GATE IS DOWN')"))throw new Error('breach announcement missing');
await set('Space',false);let moved=false;for(const key of ['KeyS','KeyA','KeyD','KeyW']){await set(key,true);await sleep(220);await set(key,false);const moving=await p.evalJS('window.__game.castlePlay()');if(Math.hypot(moving.playerX-before.playerX,moving.playerZ-before.playerZ)>.1){moved=true;break;}}if(!moved)throw new Error('movement blocked during breach');
mkdirSync('out/castle-breach',{recursive:true});const cut=await p.S('Page.captureScreenshot',{format:'png'});writeFileSync('out/castle-breach/cinematic.png',Buffer.from(cut.data,'base64'));await p.waitFor('!window.__game.castlePlay().cinematic',6000,'breach announcement ends');
await sleep(900);mkdirSync('out/castle-breach',{recursive:true});let shot=await p.S('Page.captureScreenshot',{format:'png'});writeFileSync('out/castle-breach/breach.png',Buffer.from(shot.data,'base64'));
await set('Space',false);deadline=Date.now()+30000;
while(Date.now()<deadline){s=await p.evalJS('window.__game.castlePlay()');if(s.playerZ < -24.5 && Math.abs(s.playerX)<1.2)break;let dx= -s.playerX, dz= -25-s.playerZ; if(s.playerZ > -21 && Math.abs(s.playerX)>.6) dz=0;await walk(dx,dz);await sleep(120);}
await walk(0,0);console.log('courtyard',s.playerX,s.playerZ);if(s.playerZ>=-21)throw new Error('could not traverse breach');
await sleep(600);let courtyardShot=await p.S('Page.captureScreenshot',{format:'png'});writeFileSync('out/castle-breach/courtyard.png',Buffer.from(courtyardShot.data,'base64'));await set('Space',true);await p.waitFor('window.__game.castlePlay().cleared',15000,'core cleared');await set('Space',false);console.log('cleared',JSON.stringify(await p.evalJS('window.__game.castlePlay()')));shot=await p.S('Page.captureScreenshot',{format:'png'});writeFileSync('out/castle-breach/core.png',Buffer.from(shot.data,'base64'));
await p.S('Page.navigate',{url:`${base}/?scene=environment&envDefaults`});await p.waitFor("window.__game?.phase?.()==='playing' && !!window.__game.environmentLab",30000,'environment test');if(await p.evalJS('!!window.__game.castlePlay || document.querySelector("#environment-lab").hidden'))throw new Error('environment test no longer opens as a sandbox');console.log('environment test remains separate');
}finally{await cdp.close();await chrome.close();}
