// Real-input solo audio event check; run on an isolated checkout. Chrome is muted.
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
import { LEVERS } from '../src/gate-mechanism.ts';
const base=process.argv[2]; if(!base)throw new Error('Pass the isolated game server URL');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const chrome=await launchChrome(),cdp=await connect(chrome.wsUrl);
try {
 const [target]=await cdp.pages(),p=await cdp.attach(target.targetId),errors=[];
 p.on(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
 await p.S('Runtime.enable');await p.S('Page.enable');
 await p.S('Page.navigate',{url:`${base}/?scene=solo&autostart&envDefaults`});
 await p.waitFor("window.__game?.phase?.()==='playing' && window.__game.gameAudio?.().loaded===Object.keys(window.__game.gameAudio().counts).length",30000,'samples loaded');
 const keys={};async function set(code,on){if(!!keys[code]===on)return;keys[code]=on;const info={KeyW:['w',87],KeyS:['s',83],KeyA:['a',65],KeyD:['d',68],ShiftLeft:['Shift',16],Space:[' ',32]}[code];await p.S('Input.dispatchKeyEvent',{type:on?'keyDown':'keyUp',code,key:info[0],windowsVirtualKeyCode:info[1]});}
 async function walk(x,z){await set('KeyW',z<-.25);await set('KeyS',z>.25);await set('KeyA',x<-.25);await set('KeyD',x>.25);}
 await set('ShiftLeft',true);await set('KeyW',true);await p.waitFor('window.__game.castlePlay().playerZ < 3',15000,'bridge');await set('KeyW',false);await set('Space',true);
 let state,deadline=Date.now()+90000;
 while(Date.now()<deadline){state=await p.evalJS('window.__game.castlePlay()');if(state.gateOpen)break;
  if(state.playerZ>-8){await walk(-state.playerX,-1);await sleep(180);continue;}
  const target=state.leverHealth[0]>.01?LEVERS[0]:LEVERS[1],dx=target.x-state.playerX,dz=target.z-state.playerZ;
  if(Math.hypot(dx,dz)<=1.4)await walk(0,0);
  else if(Math.abs(dx)>1.2 && state.playerZ < -11.8)await walk(0,1);
  else if(Math.abs(dx)>1.2)await walk(dx,0);
  else await walk(0,dz);
  await sleep(180);
 }
 await walk(0,0);await set('Space',false);
 if(!state?.gateOpen)throw new Error('gate did not open');
 await p.waitFor('window.__game.gameAudio().counts.gateImpact>0',6000,'gate landing');
 const counts=await p.evalJS('window.__game.gameAudio().counts');
 for(const name of ['leverHit','leverDown','gateBreach','gateImpact'])if(!counts[name])throw new Error(`missing ${name}: ${JSON.stringify(counts)}`);
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Real-input lever and gate audio events passed',JSON.stringify(counts));
} finally {await cdp.close();await chrome.close();}
