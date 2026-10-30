// Run against a local server and the preview; browser is always muted.
import { launchChrome,connect } from '../../tests/lib/cdp.mjs';
const base=process.argv[2]??'http://127.0.0.1:5173';
const chrome=await launchChrome({width:Number(process.env.TEST_WIDTH??1280),height:Number(process.env.TEST_HEIGHT??720)});const cdp=await connect(chrome.wsUrl);
try {
 const [target]=await cdp.pages(), a=await cdp.attach(target.targetId);
 const {browserContextId}=await cdp.send('Target.createBrowserContext');const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank',browserContextId}),b=await cdp.attach(targetId);const errors=[];
 for(const p of [a,b]){p.on(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);});await p.S('Runtime.enable');await p.S('Page.enable');await p.S('Page.navigate',{url:`${base}/?autostart&envDefaults`});}
 for(const p of [a,b]){await p.waitFor("window.__game?.phase?.()==='playing' && !!document.querySelector('.multiplayer-join:not([hidden])')",30000,'class selection');const fit=await p.evalJS(`Array.from(document.querySelectorAll('.multiplayer-classes button')).every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})`);if(!fit)throw new Error('class buttons do not fit in the viewport');}
 await a.evalJS("document.querySelector('[data-class=Knight]').click()");await b.evalJS("document.querySelector('[data-class=Scout]').click()");
 for(const p of [a,b])await p.waitFor('window.__game?.multiplayer?.().joined && window.__game.multiplayer().players===2',30000,'two players joined');
 for(const [p,id] of [[a,target.targetId],[b,targetId]]){await cdp.send('Target.activateTarget',{targetId:id});await p.waitFor('window.__game.multiplayer().remoteActors.length===1',10000,'remote hero rendered');}
 const s1=await a.evalJS('window.__game.multiplayer()'),s2=await b.evalJS('window.__game.multiplayer()');if(s1.remoteActors[0].kind!=='Scout'||s2.remoteActors[0].kind!=='Knight')throw new Error('remote hero classes do not match');if(s1.roomId!==s2.roomId)throw new Error('players joined different rooms');const [p1,p2]=s1.playerStates;if(Math.hypot(p1.x-p2.x,p1.z-p2.z)<1.05)throw new Error('players spawned too close together');
 await cdp.send('Target.activateTarget',{targetId:target.targetId});
 const before=await a.evalJS('window.__game.environmentLab().playerZ');await a.S('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w',windowsVirtualKeyCode:87});await new Promise(r=>setTimeout(r,1200));await a.S('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w',windowsVirtualKeyCode:87});
 const after=await a.evalJS('window.__game.environmentLab().playerZ');if(Math.abs(after-before)<.5)throw new Error(`authoritative movement did not reach view: ${before}, ${after}`);
 await cdp.send('Target.activateTarget',{targetId});await b.waitFor(`Math.abs(window.__game.multiplayer().remoteActors[0].z-${before})>.5`,5000,'remote movement visible');
 if(errors.length)throw new Error(errors.join('\n'));console.log(JSON.stringify({sameRoom:true,players:2,before,after,state:s1}));
} finally {await cdp.close();await chrome.close();}
