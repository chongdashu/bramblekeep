// Run from an isolated committed checkout against its own dev server.
import assert from 'node:assert/strict';
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
const base=process.argv[2] ?? 'http://127.0.0.1:5191';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for (const [name,width,height,touch] of [['desktop',1280,720,false],['portrait',390,844,true],['short-landscape',568,320,true]]) {
  const chrome=await launchChrome({width,height}); const cdp=await connect(chrome.wsUrl);
  try {
    const [target]=await cdp.pages(); const p=await cdp.attach(target.targetId);
    await p.S('Runtime.enable'); await p.S('Page.enable');
    await p.S('Emulation.setFocusEmulationEnabled',{enabled:true});
    await p.S('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:touch});
    if(touch) await p.S('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    const click=async selector=>{
      const rect=await p.evalJS(`(() => {const e=document.querySelector(${JSON.stringify(selector)});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      if(touch) {await p.S('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...rect,id:1}]});await p.S('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
      else {await p.S('Input.dispatchMouseEvent',{type:'mouseMoved',...rect});await p.S('Input.dispatchMouseEvent',{type:'mousePressed',...rect,button:'left',buttons:1,clickCount:1});await p.S('Input.dispatchMouseEvent',{type:'mouseReleased',...rect,button:'left',buttons:0,clickCount:1});}
    };
    const openMenu=async()=>{
      await p.S('Page.navigate',{url:base+'/'});
      await p.waitFor("document.querySelector('#press-start') && !document.querySelector('#press-start').hidden",30000,'start');
      await click('#press-start'); await p.waitFor("window.__game?.phase?.() === 'menu'",30000,'menu'); await sleep(300);
    };
    await openMenu();
    const layout=await p.evalJS(`(() => [...document.querySelectorAll('#menu .mbtn')].filter(e=>!e.hidden).map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,href:e.getAttribute('href'),x:r.x,y:r.y,right:r.right,bottom:r.bottom}}))()`);
    for (const text of ['Play','Character test','Equipment preview','Environment test','Asset viewer']) assert.ok(layout.some(e=>e.text.trim()===text),`${name}: ${text} appears`);
    for (const e of layout) assert.ok(e.x>=-1 && e.y>=-1 && e.right<=width+1 && e.bottom<=height+1,`${name}: ${e.text} is within viewport: ${JSON.stringify(e)}`);
    const rects=await p.evalJS(`(() => {const a=document.querySelector('#menu .logo').getBoundingClientRect(),b=document.querySelector('#menu .menu-list').getBoundingClientRect();return {logoBottom:a.bottom,listTop:b.top}})()`);
    assert.ok(rects.logoBottom<=rects.listTop+1,`${name}: logo does not cover scene links`);
    console.log(`${name}: menu entries visible and within viewport`);
    if(!touch) {
      for(const [selector, expected] of [['#menu a[href="?scene=character"]','character'],['#menu a[href="?scene=equipment"]','equipment'],['#menu a[href="?scene=environment"]','environment'],['#menu a[href="./preview.html"]','viewer']]) {
        await click(selector);
        if(expected==='viewer') await p.waitFor("location.pathname.endsWith('/preview.html')",30000,'viewer');
        else await p.waitFor(`window.__game?.phase?.() === 'playing' && document.body.dataset.scene === ${JSON.stringify(expected)}`,30000,expected);
        console.log(`desktop: ${expected} opens directly`); await openMenu();
      }
      await click('[data-act="play"]'); await p.waitFor("window.__game?.phase?.() === 'playing'",30000,'playing');
      const key=async(code,key,vk,down)=>p.S('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key,windowsVirtualKeyCode:vk});
      await key('KeyW','w',87,true); await sleep(300); await key('KeyW','w',87,false);
      const start=await p.evalJS('window.__game.integratedArt().yaw');
      await key('KeyS','s',83,true); await sleep(35); const early=await p.evalJS('window.__game.integratedArt().yaw');
      await sleep(140); const late=await p.evalJS('window.__game.integratedArt().yaw'); await key('KeyS','s',83,false);
      const diff=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
      assert.ok(diff(early,start)>0.05 && diff(early,start)<Math.PI,`turn progresses without snapping: ${start}, ${early}`);
      assert.ok(diff(late,start)>Math.PI-0.06,`turn quickly aligns to the new direction: ${early}, ${late}`);
      console.log('desktop: reversal changes rendered facing smoothly over multiple frames');
    }
  } finally {cdp.close(); await chrome.close();}
}
