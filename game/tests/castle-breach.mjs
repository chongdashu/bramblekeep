import {launchChrome,connect} from '../../tests/lib/cdp.mjs';import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.argv[2] ?? 'http://127.0.0.1:5191';const sleep=ms=>new Promise(r=>setTimeout(r,ms));const chrome=await launchChrome({width:1280,height:720});const cdp=await connect(chrome.wsUrl);
try{const [t]=await cdp.pages(),p=await cdp.attach(t.targetId);await p.S('Runtime.enable');await p.S('Page.enable');await p.S('Page.navigate',{url:`${base}/?scene=solo&autostart&envDefaults`});await p.waitFor("window.__game?.phase?.()==='playing' && !!window.__game.castlePlay",30000,'game');
await p.evalJS("document.querySelector('.castle-hitboxes').click()");if(!await p.evalJS('window.__game.castlePlay().hitboxes'))throw new Error('hitbox debug did not turn on');await p.evalJS("document.querySelector('.castle-hitboxes').click()");
const keys={};async function set(code,on){if(!!keys[code]===on)return;keys[code]=on;const info={KeyW:['w',87],KeyS:['s',83],KeyA:['a',65],KeyD:['d',68],ShiftLeft:['Shift',16],Space:[' ',32]}[code];await p.S('Input.dispatchKeyEvent',{type:on?'keyDown':'keyUp',code,key:info[0],windowsVirtualKeyCode:info[1]});}
async function walk(x,z){await set('KeyW',z<-.25);await set('KeyS',z>.25);await set('KeyA',x<-.25);await set('KeyD',x>.25);}
await set('ShiftLeft',true);await set('KeyW',true);await p.waitFor('window.__game.castlePlay().playerZ < 3',15000,'bridge');await set('KeyW',false);await set('Space',true);
let s,deadline=Date.now()+95000,last=-1;
while(Date.now()<deadline){s=await p.evalJS('window.__game.castlePlay()');if(s.defeats!==last){last=s.defeats;console.log('defeats',last,'hp',s.health,'pos',s.playerX,s.playerZ);}if(s.gateOpen)break;
 if(s.playerZ>5.4){await walk(-s.playerX,-1);await sleep(180);continue;}
 const es=s.enemies.filter(e=>e.alive).sort((a,b)=>Math.hypot(a.x-s.playerX,a.z-s.playerZ)-Math.hypot(b.x-s.playerX,b.z-s.playerZ));const e=es[0];if(e){const dx=e.x-s.playerX,dz=e.z-s.playerZ,d=Math.hypot(dx,dz);if(d>1.55)await walk(dx,dz);else await walk(0,0);}await sleep(180);
}
await walk(0,0);if(!s.gateOpen)throw new Error('breach not reached');
await sleep(900);mkdirSync('out/castle-breach',{recursive:true});let shot=await p.S('Page.captureScreenshot',{format:'png'});writeFileSync('out/castle-breach/breach.png',Buffer.from(shot.data,'base64'));
await set('Space',false);deadline=Date.now()+30000;
while(Date.now()<deadline){s=await p.evalJS('window.__game.castlePlay()');if(s.playerZ < -24.5 && Math.abs(s.playerX)<1.2)break;let dx= -s.playerX, dz= -25-s.playerZ; if(s.playerZ > -21 && Math.abs(s.playerX)>.6) dz=0;await walk(dx,dz);await sleep(120);}
await walk(0,0);console.log('courtyard',s.playerX,s.playerZ);if(s.playerZ>=-21)throw new Error('could not traverse breach');
await sleep(600);let courtyardShot=await p.S('Page.captureScreenshot',{format:'png'});writeFileSync('out/castle-breach/courtyard.png',Buffer.from(courtyardShot.data,'base64'));await set('Space',true);await p.waitFor('window.__game.castlePlay().cleared',15000,'core cleared');await set('Space',false);console.log('cleared',JSON.stringify(await p.evalJS('window.__game.castlePlay()')));shot=await p.S('Page.captureScreenshot',{format:'png'});writeFileSync('out/castle-breach/core.png',Buffer.from(shot.data,'base64'));
await p.S('Page.navigate',{url:`${base}/?scene=environment&envDefaults`});await p.waitFor("window.__game?.phase?.()==='playing' && !!window.__game.environmentLab",30000,'environment test');if(await p.evalJS('!!window.__game.castlePlay || document.querySelector("#environment-lab").hidden'))throw new Error('environment test no longer opens as a sandbox');console.log('environment test remains separate');
}finally{await cdp.close();await chrome.close();}
