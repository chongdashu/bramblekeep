// Real keyboard and touch input against an isolated served revision.
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
import assert from 'node:assert/strict';
const base=process.argv[2] ?? 'http://127.0.0.1:53995/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for (const touch of [false,true]) {
 const width=touch?390:1280,height=touch?844:720, chrome=await launchChrome({width,height}),cdp=await connect(chrome.wsUrl);
 try {
  const [target]=await cdp.pages(),p=await cdp.attach(target.targetId);
  await p.S('Page.enable');await p.S('Runtime.enable');
  await p.S('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:touch});
  if(touch)await p.S('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await p.S('Page.navigate',{url:`${base}?scene=environment&envDefaults`});
  await p.waitFor("window.__game?.phase?.() === 'playing'",30000,'environment');
  const z=()=>p.evalJS('window.__game.environmentLab().playerZ');
  const key=(code,k,v,down)=>p.S('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:k,windowsVirtualKeyCode:v});
  const reset=async()=>{await p.evalJS("document.querySelector('#environment-lab button').click(); document.querySelector('.env-camp').click(); document.querySelector('#environment-lab button').click()"); await sleep(150)};
  const move=async sprint=>{
   const start=await z();
   if(!touch){if(sprint)await key('ShiftLeft','Shift',16,true);await key('KeyW','w',87,true);await sleep(650);await key('KeyW','w',87,false);if(sprint)await key('ShiftLeft','Shift',16,false);}
   else {
    const x=80,y=600; await p.S('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:7}]});await p.S('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-55,id:7}]});
    if(sprint){await sleep(120);const b=await p.evalJS(`(()=>{const r=document.querySelector('.touch-btn[data-action="sprint"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await p.S('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y-55,id:7},{...b,id:9}]});await sleep(530);await p.S('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x,y:y-55,id:7}]});}
    else await sleep(650);
    await p.S('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }
   return start-await z();
  };
  const walk=await move(false);await reset();const run=await move(true);
  assert.ok(walk>1,`walk moved ${walk}`);assert.ok(run>walk*1.3,`run ${run} should exceed walk ${walk}`);
  console.log(`${touch?'touch':'keyboard'}: walk ${walk.toFixed(2)} m; held run ${run.toFixed(2)} m`);
 } finally {cdp.close();await chrome.close();}
}
// The compact game uses the same named action to scale simulation input.
{
 const chrome=await launchChrome({width:1280,height:720}),cdp=await connect(chrome.wsUrl);
 try {
  const [target]=await cdp.pages(),p=await cdp.attach(target.targetId);await p.S('Page.enable');await p.S('Runtime.enable');
  await p.S('Page.navigate',{url:`${base}?scene=gym`});await p.waitFor("window.__game?.phase?.() === 'playing'",30000,'combat');
  const read=()=>p.evalJS('window.__game.stats()');
  const key=(code,k,v,down)=>p.S('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:k,windowsVirtualKeyCode:v});
  async function move(sprint){const before=await read();if(sprint)await key('ShiftLeft','Shift',16,true);await key('KeyW','w',87,true);await sleep(650);await key('KeyW','w',87,false);if(sprint)await key('ShiftLeft','Shift',16,false);const after=await read();return Math.hypot(after.x-before.x,after.z-before.z)}
  const walk=await move(false);await key('KeyR','r',82,true);await key('KeyR','r',82,false);await sleep(120);const run=await move(true);
  assert.ok(walk>0.5 && run>walk*1.5,`combat walk ${walk}, run ${run}`);console.log(`combat: walk ${walk.toFixed(2)} m; held Shift ${run.toFixed(2)} m`);
 } finally {cdp.close();await chrome.close();}
}
// Character test must select the matching locomotion clip for each pace.
{
 const chrome=await launchChrome({width:1280,height:720}),cdp=await connect(chrome.wsUrl);
 try {
  const [target]=await cdp.pages(),p=await cdp.attach(target.targetId);await p.S('Page.enable');await p.S('Runtime.enable');
  await p.S('Page.navigate',{url:`${base}?scene=character`});await p.waitFor("window.__game?.phase?.() === 'playing'",30000,'character');
  const key=(code,k,v,down)=>p.S('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:k,windowsVirtualKeyCode:v});
  await key('KeyD','d',68,true);await sleep(650);const walk=await p.evalJS('window.__game.characterLab()');await key('KeyD','d',68,false);
  await key('KeyR','r',82,true);await key('KeyR','r',82,false);await sleep(120);
  await key('ShiftLeft','Shift',16,true);await key('KeyD','d',68,true);await sleep(650);const run=await p.evalJS('window.__game.characterLab()');await key('KeyD','d',68,false);await key('ShiftLeft','Shift',16,false);
  assert.equal(walk.clip,'walk');assert.equal(run.clip,'run');assert.ok(run.speed>walk.speed*1.5);console.log(`character: ${walk.clip} ${walk.speed.toFixed(2)} m/s; ${run.clip} ${run.speed.toFixed(2)} m/s`);
 } finally {cdp.close();await chrome.close();}
}
