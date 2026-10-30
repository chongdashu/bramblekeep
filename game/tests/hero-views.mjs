// Run against a committed isolated checkout on its own port.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
const base = process.argv[2] ?? 'http://127.0.0.1:59253';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const out = 'out/hero-views'; mkdirSync(out, { recursive:true });
for (const [name,width,height,touch] of [['desktop',1280,720,false],['phone',390,844,true],['short',844,390,true]]) {
 const chrome=await launchChrome({width,height}); const cdp=await connect(chrome.wsUrl);
 try {
  const [target]=await cdp.pages(); const p=await cdp.attach(target.targetId);
  await p.S('Runtime.enable'); await p.S('Page.enable');
  await p.S('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:touch});
  if(touch) await p.S('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await p.S('Page.navigate',{url:`${base}/?scene=environment&envDefaults`});
  await p.waitFor("window.__game?.phase?.() === 'playing'",30000,'environment ready');
  const initial=await p.evalJS('window.__game.environmentLab()');
  for (const [view,x,z] of [['river',-3,8],['castle',0,-13]]) {
   await p.evalJS(`(() => {const s=document.querySelector('[aria-label="Choose a hero view"]'); s.value=${JSON.stringify(view)}; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   await p.waitFor(`Math.abs(window.__game.environmentLab().cameraX - (${x})) < .2 && Math.abs(window.__game.environmentLab().cameraZ - (${z})) < .2`,5000,`${view} target`);
   await wait(700);
   const state=await p.evalJS('window.__game.environmentLab()');
   if(state.cameraMode!=='free' || state.playerX!==initial.playerX || state.playerZ!==initial.playerZ) throw new Error(`${name} ${view}: view or character changed unexpectedly`);
   const shot=await p.S('Page.captureScreenshot',{format:'png'}); writeFileSync(`${out}/${name}-${view}.png`,Buffer.from(shot.data,'base64'));
   console.log(`${name}: ${view} view selected without moving character`);
   if (!(await p.evalJS(`(() => {const s=document.querySelector('[aria-label="Choose a hero view"]'); return s.getBoundingClientRect().width > 0 && getComputedStyle(s).visibility !== 'hidden';})()`))) throw new Error(`${name}: view selector is hidden`);
  }
  await p.evalJS(`document.querySelector('#environment-lab .env-camera button').click()`);
  if((await p.evalJS('window.__game.environmentLab().cameraMode'))!=='chase') throw new Error(`${name}: could not return to chase`);
  console.log(`${name}: chase camera restored`);
 } finally {await cdp.close(); await chrome.close();}
}
