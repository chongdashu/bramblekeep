// Browser regression: menu hierarchy and the gate's screen-space lock at host-like sizes.
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
const base = process.argv[2] ?? 'http://127.0.0.1:5191';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
for (const [name, width, height, touch] of [['desktop',1280,720,false], ['phone',390,844,true], ['short',667,375,true]]) {
  const chrome = await launchChrome({width,height}), cdp = await connect(chrome.wsUrl);
  try {
    const [target] = await cdp.pages(), page = await cdp.attach(target.targetId);
    await page.S('Runtime.enable'); await page.S('Page.enable');
    await page.S('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:touch});
    if (touch) await page.S('Emulation.setTouchEmulationEnabled', {enabled:true,maxTouchPoints:5});
    await page.S('Page.navigate', {url:`${base}/?renderer=webgl2&envDefaults`});
    await page.waitFor("!!window.__game && !document.querySelector('#press-start').hidden",30000,'ready');
    const click = async selector => {
      const [x,y] = await page.evalJS(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);
      if (touch) { await page.S('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]}); await page.S('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); }
      else for (const type of ['mousePressed','mouseReleased']) await page.S('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});
    };
    await click('#press-start'); await page.waitFor("window.__game.phase()==='menu'",5000,'menu'); await sleep(800);
    if (!await page.evalJS("window.__game.environmentLab().lights.some(l=>Math.abs(l.at[0]-7.2)<.01 && l.at[2]<-16)")) throw Error(`${name}: castle menu lighting missing`);
    const menu = await page.evalJS(`(()=>{const get=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {hidden:e.hidden,bg:getComputedStyle(e).backgroundImage,top:r.top,bottom:r.bottom}};return {help:get('[data-act=help]'),settings:get('[data-act=settings]'),tests:get('.scene-toggle'),dev:document.querySelector('.mbtn.dev')?get('.mbtn.dev'):null,tag:document.querySelector('[data-game-tagline]').textContent}})()`);
    if (!menu.help.hidden || /prototype/i.test(menu.tag) || menu.tests.top <= menu.settings.bottom || (menu.dev && (menu.dev.top <= menu.tests.bottom || menu.dev.bg === menu.tests.bg))) throw Error(`${name}: menu hierarchy ${JSON.stringify(menu)}`);
    await click('.scene-toggle');
    if (!await page.evalJS("document.querySelector('.scene-toggle').getAttribute('aria-expanded')==='true' && [...document.querySelectorAll('.scene-link')].some(e=>!e.hidden)")) throw Error(`${name}: test scene list did not open`);
    await click('.scene-toggle');
    if (await page.evalJS("typeof window.__game.multiplayer === 'function'")) {
      await page.S('Page.navigate', {url:`${base}/?scene=solo&autostart&renderer=webgl2&envDefaults`});
    } else await click('[data-act=play]');
    await page.waitFor("window.__game.phase()==='playing' && !!window.__game.castlePlay",10000,'playing');
    if (!await page.evalJS("getComputedStyle(document.querySelector('#gate-link-left')).display==='none' && getComputedStyle(document.querySelector('#gate-action-left')).display==='none'")) throw Error(`${name}: distant guidance visible`);
    const key = async (type,code,key,windowsVirtualKeyCode) => page.S('Input.dispatchKeyEvent',{type,code,key,windowsVirtualKeyCode});
    await key('keyDown','ShiftLeft','Shift',16); await key('keyDown','KeyW','w',87);
    await page.waitFor('window.__game.castlePlay().playerZ < 2',15000,'approach');
    await key('keyUp','KeyW','w',87); await key('keyUp','ShiftLeft','Shift',16); await sleep(500);
    const hud = await page.evalJS(`(()=>{const l=document.querySelector('#gate-lock'),r=l.getBoundingClientRect();const health=document.querySelector('#gym-health').getBoundingClientRect(), classButton=document.querySelector('#gym-class').getBoundingClientRect();return {classRect:[classButton.left,classButton.top,classButton.right,classButton.bottom],shown:!l.hidden,rect:[r.left,r.top,r.right,r.bottom],health:[health.left,health.top,health.right,health.bottom],actions:['left','right'].map(s=>({visible:!document.querySelector('#gate-action-'+s).hidden, linked:!document.querySelector('#gate-link-'+s).hasAttribute('hidden')})),note:getComputedStyle(document.querySelector('.gym-note')).display,status:getComputedStyle(document.querySelector('#gym-status').parentElement).display,tracker:!!document.querySelector('#lever-tracker'),controls:[...document.querySelectorAll('.touch-btn')].map(e=>getComputedStyle(e,'::before').maskImage)}})()`);
    if (!hud.shown || hud.note!=='none' || hud.status!=='none' || hud.tracker || hud.classRect[3]-hud.classRect[1]>60 || (hud.health[0]<hud.classRect[2] && hud.health[2]>hud.classRect[0] && hud.health[1]<hud.classRect[3] && hud.health[3]>hud.classRect[1]) || hud.actions.some(a=>!a.visible || !a.linked) || hud.health[0]>width/2 || hud.health[1]<height/2 || hud.rect[0]<0 || hud.rect[2]>width || hud.controls.some(mask=>mask==='none')) throw Error(`${name}: HUD ${JSON.stringify(hud)}`);
    if (!await page.evalJS("(()=>{const p=document.querySelector('#gate-link-left');return p.tagName.toLowerCase()==='path' && (p.getAttribute('d')||'').includes(' L ') && getComputedStyle(p).animationName==='gate-flow'})()")) throw Error(`${name}: gate guidance is not animated diagonally`);
    console.log(`ok ${name}: menu hierarchy, control icons and gate lock`);
  } finally { await cdp.close(); await chrome.close(); }
}
