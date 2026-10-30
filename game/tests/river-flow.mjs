// Run against an isolated committed checkout served on its own port:
// node game/tests/river-flow.mjs http://127.0.0.1:59241
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
const base = process.argv[2] ?? 'http://127.0.0.1:59241';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
for (const mode of ['webgpu', 'webgl2']) {
  const chrome = await launchChrome({ width: 1280, height: 720 });
  const cdp = await connect(chrome.wsUrl);
  try {
    const [target] = await cdp.pages(); const p = await cdp.attach(target.targetId);
    await p.S('Runtime.enable'); await p.S('Page.enable');
    await p.S('Emulation.setDeviceMetricsOverride', { width:1280, height:720, deviceScaleFactor:1, mobile:false });
    await p.S('Page.navigate', { url:`${base}/?scene=environment&envDefaults&renderer=${mode}` });
    await p.waitFor("window.__game?.phase?.() === 'playing'", 30000, 'environment ready');
    if ((await p.evalJS('window.__game.environmentLab().renderer')) !== mode) throw new Error(`${mode}: wrong backend`);
    await p.S('Input.dispatchKeyEvent', { type:'keyDown', code:'ShiftLeft', key:'Shift', windowsVirtualKeyCode:16 });
    await p.S('Input.dispatchKeyEvent', { type:'keyDown', code:'KeyW', key:'w', windowsVirtualKeyCode:87 });
    await sleep(2100);
    await p.S('Input.dispatchKeyEvent', { type:'keyUp', code:'KeyW', key:'w', windowsVirtualKeyCode:87 });
    await p.S('Input.dispatchKeyEvent', { type:'keyUp', code:'ShiftLeft', key:'Shift', windowsVirtualKeyCode:16 });
    await sleep(1300); // allow the chase camera to settle before comparing the water
    const first = await p.S('Page.captureScreenshot', { format:'png' });
    await sleep(1400);
    const second = await p.S('Page.captureScreenshot', { format:'png' });
    // Compare a water-only region to avoid counting the animated character or UI.
    const difference = await p.evalJS(`(async () => {
      const load = src => new Promise((resolve, reject) => {const i=new Image(); i.onload=()=>resolve(i); i.onerror=reject; i.src=src;});
      const a=await load('data:image/png;base64,${first.data}'), b=await load('data:image/png;base64,${second.data}');
      const c=document.createElement('canvas'); c.width=310; c.height=45; const ctx=c.getContext('2d');
      ctx.drawImage(a,40,380,310,45,0,0,310,45); const x=ctx.getImageData(0,0,310,45).data;
      ctx.drawImage(b,40,380,310,45,0,0,310,45); const y=ctx.getImageData(0,0,310,45).data;
      let sum=0; for(let i=0;i<x.length;i+=4) for(let j=0;j<3;j++) sum+=Math.abs(x[i+j]-y[i+j]);
      return sum/(310*45*3);
    })()`);
    if (difference < 2) throw new Error(`${mode}: water region hardly changes (${difference})`);
    console.log(`${mode}: water region changes over time (mean channel delta ${difference.toFixed(2)})`);
  } finally { await cdp.close(); await chrome.close(); }
}
