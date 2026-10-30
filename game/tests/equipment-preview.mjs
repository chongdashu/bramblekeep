// Run against an isolated committed checkout served on its own port.
import assert from "node:assert/strict";
import { launchChrome, connect } from "../../tests/lib/cdp.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
const base=process.argv[2] ?? "http://127.0.0.1:5207";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for (const [name,width,height,touch] of [["desktop",1280,720,false],["phone",390,844,true],["short-landscape",568,320,true]]) {
  const chrome=await launchChrome({width,height}), cdp=await connect(chrome.wsUrl), errors=[];
  try {
    const [target]=await cdp.pages(), p=await cdp.attach(target.targetId);
    p.on("Runtime.exceptionThrown",e=>errors.push(e.exceptionDetails.text));
    await p.S("Runtime.enable"); await p.S("Page.enable");
    await p.S("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:touch});
    if(touch) await p.S("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:5});
    await p.S("Page.navigate",{url:`${base}/?scene=equipment`});
    await p.waitFor(`window.__game?.phase() === 'playing' && !!window.__game?.equipmentPreview`,30000,`${name}: direct preview`);
    const read=()=>p.evalJS("window.__game.equipmentPreview()");
    const click=async selector=>{
      const r=await p.evalJS(`(() => {const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      if(touch){await p.S("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{...r,id:1}]});await p.S("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});}
      else {await p.S("Input.dispatchMouseEvent",{type:"mouseMoved",...r});await p.S("Input.dispatchMouseEvent",{type:"mousePressed",...r,button:"left",buttons:1,clickCount:1});await p.S("Input.dispatchMouseEvent",{type:"mouseReleased",...r,button:"left",buttons:0,clickCount:1});}
    };
    assert.equal(await p.evalJS("document.querySelector('#countdown').hidden"),true,`${name}: skips countdown`);
    assert.equal((await read()).character,"Knight");
    const start=await read(), x=Math.round(width*.22), y=Math.round(height*(height>width?.28:.48));
    if(touch) {
      await p.S("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:7}]});
      await p.S("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+60,y:y+35,id:7}]});
      await p.S("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    } else {
      await p.S("Input.dispatchMouseEvent",{type:"mouseMoved",x,y});
      await p.S("Input.dispatchMouseEvent",{type:"mousePressed",x,y,button:"left",buttons:1,clickCount:1});
      await p.S("Input.dispatchMouseEvent",{type:"mouseMoved",x:x+60,y:y+35,button:"left",buttons:1});
      await p.S("Input.dispatchMouseEvent",{type:"mouseReleased",x:x+60,y:y+35,button:"left",buttons:0,clickCount:1});
    }
    assert.ok(Math.abs((await read()).cameraAngle-start.cameraAngle)>10,`${name}: drag orbits horizontally`);
    assert.ok(Math.abs((await read()).cameraPitch-start.cameraPitch)>3,`${name}: drag orbits vertically`);
    await click("#equipment-reset-view");
    assert.equal((await read()).cameraAngle,0,`${name}: reset view restores angle`);
    const zoom=await p.evalJS(`(() => {const e=document.querySelector('#equipment-zoom');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width*.75,y:r.top+r.height/2}})()`);
    if(touch){await p.S("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{...zoom,id:3}]});await p.S("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});}
    else {await p.S("Input.dispatchMouseEvent",{type:"mouseMoved",...zoom});await p.S("Input.dispatchMouseEvent",{type:"mousePressed",...zoom,button:"left",buttons:1,clickCount:1});await p.S("Input.dispatchMouseEvent",{type:"mouseReleased",...zoom,button:"left",buttons:0,clickCount:1});}
    assert.ok((await read()).zoom>1.2,`${name}: zoom control moves closer`);
    await click("#equipment-reset-view"); assert.equal((await read()).zoom,1,`${name}: reset view restores zoom`);
    await click("#equipment-weapon"); assert.equal((await read()).weapon,false,`${name}: hide weapon`);
    await click("#equipment-weapon"); assert.equal((await read()).weapon,true,`${name}: show weapon`);
    // Native select popup is platform-owned; dispatch its selection change as a fixture.
    await p.evalJS(`(() => {const e=document.querySelector('#equipment-character');e.value='Scout';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    assert.equal((await read()).character,"Scout"); assert.equal((await read()).arrowAvailable,true);
    await click("#equipment-arrow"); assert.equal((await read()).arrow,false,`${name}: hide arrow`);
    await click("#equipment-arrow"); assert.equal((await read()).arrow,true,`${name}: show arrow`);
    await p.evalJS(`(() => {const e=document.querySelector('#equipment-animation');e.value='attack';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    assert.equal((await read()).animation,"attack");
    const range=await p.evalJS(`(() => {const e=document.querySelector('#equipment-angle');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.left+r.width*.75,y:r.top+r.height/2}})()`);
    if(touch){await p.S("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{...range,id:1}]});await p.S("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});}
    else {await p.S("Input.dispatchMouseEvent",{type:"mouseMoved",...range});await p.S("Input.dispatchMouseEvent",{type:"mousePressed",...range,button:"left",buttons:1,clickCount:1});await p.S("Input.dispatchMouseEvent",{type:"mouseReleased",...range,button:"left",buttons:0,clickCount:1});}
    assert.ok(Math.abs((await read()).cameraAngle)>20,`${name}: camera angle changes`);
    await sleep(100); const bounds=await p.evalJS(`(()=>{const r=document.querySelector('#equipment-preview').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};})()`);
    assert.ok(bounds.x>=0 && bounds.y>=0 && bounds.right<=width && bounds.bottom<=height,`${name}: controls fit viewport`);
    for (const h of [0.1,0.9,1.6]) {
      const body=await p.evalJS(`window.__game.project(0,${h},0)`);
      assert.ok(body && body[0]>0 && body[0]<width && body[1]>0 && body[1]<height,`${name}: character stays in frame at height ${h}`);
      assert.ok(body[0]<bounds.x || body[0]>bounds.right || body[1]<bounds.y || body[1]>bounds.bottom,`${name}: controls do not cover the character at height ${h}`);
    }
    mkdirSync("out/equipment-preview",{recursive:true}); const {data}=await p.S("Page.captureScreenshot",{format:"png"});writeFileSync(`out/equipment-preview/${name}.png`,Buffer.from(data,"base64"));
    assert.deepEqual(errors,[]);console.log(`${name}: selection, animation, slots, camera and viewport pass`);
  } finally {cdp.close();await chrome.close();}
}
