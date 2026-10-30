// Run against a committed checkout served on its own port.
import {launchChrome,connect} from '../../tests/lib/cdp.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:5191',sleep=ms=>new Promise(r=>setTimeout(r,ms));
const chrome=await launchChrome({width:1280,height:720}),cdp=await connect(chrome.wsUrl);
try {
 const [target]=await cdp.pages(),p=await cdp.attach(target.targetId),errors=[];
 p.on(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)});
 await p.S('Runtime.enable');await p.S('Page.enable');await p.S('Page.navigate',{url:`${base}/?scene=solo&autostart&envDefaults`});
 await p.waitFor("window.__game?.phase?.()==='playing' && !!window.__game.castlePlay",30000,'play');
 const key=(type,code,key,n)=>p.S('Input.dispatchKeyEvent',{type,code,key,windowsVirtualKeyCode:n});
 await p.evalJS("document.querySelector('#gym-class').click();document.querySelector('#gym-class').click()");
 await key('keyDown','ShiftLeft','Shift',16);await key('keyDown','KeyW','w',87);
 await p.waitFor('window.__game.castlePlay().playerZ < 2',15000,'bridge crossed');
 await key('keyUp','KeyW','w',87);await key('keyUp','ShiftLeft','Shift',16);
 await key('keyDown','Space',' ',32);await p.waitFor('window.__game.castlePlay().drawProgress>.95',5000,'full draw');
 await p.waitFor('window.__game.castlePlay().aimTarget !== null',5000,'snap target');
 mkdirSync('out/scout-arrows',{recursive:true});const shot=async name=>{const img=await p.S('Page.captureScreenshot',{format:'png'});writeFileSync(`out/scout-arrows/${name}.png`,Buffer.from(img.data,'base64'));};
 await shot('aim');
 await key('keyUp','Space',' ',32);
 await p.waitFor("window.__game.castlePlay().projectiles.some(p=>p.kind==='arrow' && p.height>.35)",5000,'arrow released at hand height');
 await p.waitFor('window.__game.castlePlay().stuckArrows.some(a=>a.target !== null)',8000,'arrow embedded in enemy');
 const initial=await p.evalJS('window.__game.castlePlay().stuckArrows[0]');await sleep(1000);
 const held=await p.evalJS('window.__game.castlePlay().stuckArrows[0]');if(!held || held.age<.8 || initial.y<.4)throw new Error('arrow did not remain embedded');
 await shot('stuck');await p.waitFor('window.__game.castlePlay().stuckArrows.length===0',6000,'arrow expired');
 if(errors.length)throw new Error(errors.join(','));console.log('Scout aim, hit, persistence and expiry passed');
} finally {await cdp.close();await chrome.close();}
