// Run after npm run dev from a detached checkout; Chrome is launched muted.
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
const base=process.argv[2] ?? 'http://127.0.0.1:59257';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const chrome=await launchChrome({width:1280,height:720}); const cdp=await connect(chrome.wsUrl);
try {
 const [target]=await cdp.pages(); const p=await cdp.attach(target.targetId); const errors=[];
 p.on(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text); if(m.method==='Runtime.consoleAPICalled' && m.params.type==='error') errors.push('console error');});
 await p.S('Runtime.enable'); await p.S('Page.enable');
 await p.S('Page.navigate',{url:`${base}/?scene=environment&envDefaults`});
 await p.waitFor("window.__game?.phase?.() === 'playing' && window.__game?.gameAudio?.().loaded === Object.keys(window.__game.gameAudio().counts).length",30000,'audio samples ready');
 await p.evalJS("document.querySelector('#environment-lab .env-cast button').click()");
 const key=(type,code,key,windowsVirtualKeyCode)=>p.S('Input.dispatchKeyEvent',{type,code,key,windowsVirtualKeyCode});
 await key('keyDown','ShiftLeft','Shift',16); await key('keyDown','KeyD','d',68);
 await p.waitFor("window.__game.gameAudio().unlocked && window.__game.gameAudio().music === null",10000,'scene has no music');
 await p.waitFor('window.__game.gameAudio().ambience.length === 2',5000,'ambience started');
 await sleep(1100); await key('keyUp','KeyD','d',68);
 await p.waitFor('window.__game.gameAudio().counts.grass > 0',5000,'grass footsteps');
 await key('keyDown','KeyR','r',82); await key('keyUp','KeyR','r',82); await sleep(400);
 await key('keyDown','KeyW','w',87);
 await sleep(2500); await key('keyUp','KeyW','w',87); await key('keyUp','ShiftLeft','Shift',16);
 let status=await p.evalJS('window.__game.gameAudio()');
 if(status.counts.gravel<1 || status.counts.wood<1) throw new Error(`footsteps did not play on gravel and wood: ${JSON.stringify(status)}`);
 await key('keyDown','Space',' ',32); await key('keyUp','Space',' ',32);
 await p.waitFor("window.__game.gameAudio().counts.sword > 0",5000,'sword played');
 await key('keyDown','Escape','Escape',27); await key('keyUp','Escape','Escape',27);
 await p.waitFor("window.__game.phase() === 'paused' && window.__game.gameAudio().music === null",5000,'music paused');
 if((await p.evalJS('window.__game.gameAudio().ambience.length')) !== 0) throw new Error('ambience continued while paused');
 await key('keyDown','Escape','Escape',27); await key('keyUp','Escape','Escape',27);
 await p.waitFor("window.__game.phase() === 'playing' && window.__game.gameAudio().music === null",5000,'scene remains without music after resume');
 await p.waitFor('window.__game.gameAudio().ambience.length === 2',5000,'ambience resumed');
 await key('keyDown','KeyM','m',77); await key('keyUp','KeyM','m',77);
 await p.waitFor('window.__game.gameAudio().muted',5000,'muted');
 status=await p.evalJS('window.__game.gameAudio()');
 const before=status.counts.sword; await key('keyDown','Space',' ',32); await key('keyUp','Space',' ',32); await sleep(300);
 if((await p.evalJS('window.__game.gameAudio().counts.sword'))!==before) throw new Error('muted attack emitted an SFX');
 if(errors.length) throw new Error(errors.join(', '));
 console.log(`Audio browser checks passed: ${JSON.stringify(status)}`);
} finally {await cdp.close(); await chrome.close();}
