#!/usr/bin/env node
// Run against an isolated, already-served committed build:
// CHARACTER_LAB_URL=http://127.0.0.1:5193/ node game/tests/character-lab.mjs
// Uses the repository's muted headless Chrome/CDP harness and real keyboard/mouse/touch input.
import { launchChrome, connect } from "../../tests/lib/cdp.mjs";
import assert from "node:assert/strict";

const base = process.env.CHARACTER_LAB_URL ?? "http://127.0.0.1:5193/";
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function session(touch) {
  const width = touch ? 390 : 1280, height = touch ? 844 : 720;
  const chrome = await launchChrome({ width, height });
  const cdp = await connect(chrome.wsUrl);
  const errors = [];
  try {
    const [target] = await cdp.pages();
    const p = await cdp.attach(target.targetId);
    p.on("Runtime.exceptionThrown", e => errors.push(e.exceptionDetails.text));
    await p.S("Runtime.enable"); await p.S("Page.enable");
    await p.S("Emulation.setFocusEmulationEnabled", {enabled:true});
    await p.S("Emulation.setDeviceMetricsOverride", {width,height,deviceScaleFactor:1,mobile:touch});
    if (touch) await p.S("Emulation.setTouchEmulationEnabled", {enabled:true,maxTouchPoints:5});
    await p.S("Page.addScriptToEvaluateOnNewDocument", {source:`(() => {
      window.__labStart = {countdown: false};
      const obs = new MutationObserver(() => { const e = document.querySelector('#countdown'); if (e && !e.hidden && e.textContent.trim()) window.__labStart.countdown = true; });
      addEventListener('DOMContentLoaded', () => { obs.observe(document.body,{subtree:true,attributes:true,childList:true,characterData:true}); });
    })()`});
    const origin = new URL(base);
    const go = new URL(origin); go.searchParams.set("scene","character");
    await p.S("Page.navigate",{url:go.href});
    await p.waitFor(`window.__game?.phase() === 'playing' && !!window.__game?.characterLab`,30000,"direct character scene");
    const get = expr => p.evalJS(expr);
    const read = () => get("window.__game.characterLab()");
    const center = sel => get(`(() => {const e=document.querySelector(${JSON.stringify(sel)}); if(!e || e.closest('[hidden]')) return null; const r=e.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2];})()`);
    const point = async (x,y) => {
      if(touch) { await p.S("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:1}]}); await p.S("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]}); }
      else { await p.S("Input.dispatchMouseEvent",{type:"mouseMoved",x,y}); await p.S("Input.dispatchMouseEvent",{type:"mousePressed",x,y,button:"left",buttons:1,clickCount:1}); await p.S("Input.dispatchMouseEvent",{type:"mouseReleased",x,y,button:"left",buttons:0,clickCount:1}); }
    };
    const press = async sel => { const c=await center(sel); assert.ok(c,`${sel} is visible`); await point(...c); };
    const key = async (code, text, vk, down) => p.S("Input.dispatchKeyEvent",{type:down?"keyDown":"keyUp",code,key:text,windowsVirtualKeyCode:vk});
    assert.equal(await get("window.__labStart.countdown"),false,"scene skips countdown");
    assert.equal(await get("!!document.querySelector('#gym-health')?.closest('[hidden]')"),true,"health hidden");
    assert.equal(await get("!!document.querySelector('#gym-objective')?.closest('[hidden]')"),true,"gym objective hidden");
    const start=await read();
    if (touch) {
      await p.S("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:90,y:600,id:7}]});
      await p.S("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:140,y:600,id:7}]});
      await sleep(700); await p.S("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    } else { await key("KeyD","d",68,true); await sleep(700); await key("KeyD","d",68,false); }
    assert.ok(Math.abs((await read()).x-start.x)>0.4,"real input moves knight");
    if (!touch) {
      await key("KeyW","w",87,true); await sleep(350); await key("KeyW","w",87,false);
      await key("KeyD","d",68,true); await sleep(60); const corner=await read();
      await sleep(200); const afterCorner=await read(); await key("KeyD","d",68,false);
      assert.ok(Math.abs(afterCorner.x-corner.x)>0.25,"turn steers into the new direction");
      assert.ok(Math.abs(afterCorner.z-corner.z)<0.08,"turn does not drift through a wide arc");
    }
    await press(".character-lab-toggle");
    await p.waitFor("!document.querySelector('.character-lab-panel').hidden",3000,"tuning opens");
    const before=(await read()).settings.speed;
    const slider=await get(`(() => {const r=document.querySelector('[data-field="speed"]').getBoundingClientRect(); return [r.left+r.width*.8,r.top+r.height/2]})()`);
    await point(...slider); await sleep(50);
    assert.notEqual((await read()).settings.speed,before,"slider changes movement speed");
    assert.notEqual((await read()).clip,"attack","panel click does not trigger attack");
    const angle=await get(`(() => {const e=document.querySelector('[data-field="cameraYaw"]'); e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return [r.left+r.width*.25,r.top+r.height/2]})()`);
    await point(...angle); await sleep(50);
    assert.ok(Math.abs((await read()).settings.cameraYaw-180)>20,"camera angle control changes the view");
    await get(`document.querySelector('.character-lab-panel').scrollTop=0`);
    // Inject a select change as a browser fixture; native select UI is covered by visual interaction review.
    for (const [index, model] of [[1, "Spellcaster"], [2, "Scout"], [0, "Knight"]]) {
      await get(`(() => { const e=document.querySelector('.character-lab-model'); e.selectedIndex=${index}; e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await p.waitFor(`window.__game.characterLab().model === ${JSON.stringify(model)}`,3000,`${model} selected`);
      assert.equal((await read()).hasAttack,true,`${model} has an attack preview`);
    }
    await press(".character-lab-defaults");
    assert.equal((await read()).settings.speed,3.4,"defaults restore speed");
    await press(".character-lab-reset");
    await sleep(60); assert.ok(Math.abs((await read()).x)<0.1,"reset pose restores position");
    await press(".character-lab-toggle");
    if (touch) await press('.touch-btn[data-action="attack"]');
    else {await key("Space"," ",32,true); await key("Space"," ",32,false);}
    await p.waitFor("window.__game.characterLab().clip === 'attack'",2000,"attack clip");
    await press(".character-lab-jump");
    await p.waitFor("window.__game.characterLab().clip === 'jump'",2000,"jump clip");
    if (!touch) {await key("KeyD","d",68,true); await sleep(350); await key("KeyD","d",68,false); await key("KeyR","r",82,true); await key("KeyR","r",82,false); await sleep(60); assert.ok(Math.abs((await read()).x)<0.1,"R resets position");}
    const rects=await get(`(() => {const a=document.querySelector('#btn-pause').getBoundingClientRect(), b=document.querySelector('.character-lab-bar').getBoundingClientRect();return {a:{l:a.left,r:a.right,t:a.top,b:a.bottom},b:{l:b.left,r:b.right,t:b.top,b:b.bottom}}})()`);
    assert.ok(rects.a.r<=rects.b.l || rects.b.r<=rects.a.l || rects.a.b<=rects.b.t || rects.b.b<=rects.a.t,"pause does not overlap scene controls");
    if (touch) {
      const clear = await get(`(() => { const a=document.querySelector('.touch-btn[data-action="attack"]'), b=document.querySelector('#dbg-toggle'); if (!b || getComputedStyle(b).display==='none') return true; const x=a.getBoundingClientRect(), y=b.getBoundingClientRect(); return x.right<=y.left || y.right<=x.left || x.bottom<=y.top || y.bottom<=x.top; })()`);
      assert.ok(clear,"debug toggle does not overlap the touch attack button");
    }
    await press(".character-lab-exit");
    await p.waitFor("!!document.querySelector('#press-start') && !document.querySelector('#press-start').hidden",30000,"main game start");
    await press("#press-start"); await p.waitFor("window.__game.phase() === 'menu'",10000,"main menu");
    await press('#menu a[href="?scene=character"]');
    await p.waitFor("window.__game?.phase() === 'playing' && !!window.__game?.characterLab",30000,"menu entry to character scene");
    assert.equal(await get("window.__labStart.countdown"),false,"menu entry skips countdown");
    assert.deepEqual(errors,[],"no uncaught browser exceptions");
    console.log(`character lab ${touch?"phone DPR 1":"desktop DPR 1"}: direct/menu entry, movement, tuning, attack, jump, menu and countdown PASS${touch?" (keyboard R not applicable on touch)":"; R reset PASS"}`);
  } finally { cdp.close(); await chrome.close(); }
}
await session(false);
await session(true);
