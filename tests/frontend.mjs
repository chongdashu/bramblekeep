#!/usr/bin/env node
// Real CDP input against a production-built fixture around the active game.
// Synthetic wins test shell transitions, not the game's mechanics. Never shipped.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import { gameVitePlugins, loadActiveGame, viteGameConfig } from '../scripts/lib/active-game.mjs';
import { connect, launchChrome } from './lib/cdp.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const active = loadActiveGame(ROOT), g = viteGameConfig(active);
const OUT = join(ROOT, 'out/frontend', active.manifest.id);
const buildDir = join(OUT, 'build');
const sizes = [[907,510],[1216,684],[1077,606],[821,462],[1366,768],[1920,1080],[1536,864],[1280,720],[800,450],[1080,607]];
// Dated portal matrix (2026-10-02); update from official gameplay requirements.
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
await build({ configFile: false, root: ROOT, base: './', publicDir: g.publicDir,
  plugins: [...g.plugins, ...await gameVitePlugins(active, { command: 'build', mode: 'production' })], resolve: { alias: [
    { find: /^@game$/, replacement: join(ROOT, 'tests/fixtures/frontend-game.ts') },
    { find: '@fixture-base-game', replacement: join(active.abs, 'src/index.ts') },
    ...g.resolve.alias,
  ] }, define: { ...g.define, 'import.meta.env.VITE_PLATFORM': JSON.stringify('web') },
  build: { target: 'es2022', outDir: buildDir, emptyOutDir: true, rollupOptions: { input: join(ROOT, 'index.html') } },
});
const server = await preview({ configFile: false, root: ROOT, build: { outDir: buildDir }, preview: { host: '127.0.0.1', port: 0 },
  plugins: await gameVitePlugins(active, { command: 'serve', mode: 'production', isPreview: true }) });
const base = server.resolvedUrls.local[0];
try {
  for (const renderer of ['webgpu','webgl2']) for (const touch of [false,true]) {
    if (process.argv.includes('--only=phone') && !touch) continue;
    const chrome = await launchChrome({ width:1280, height:720 });
    let cdp;
    try {
      cdp = await connect(chrome.wsUrl);
      const [target] = await cdp.pages();
      const p = await cdp.attach(target.targetId), problems = [];
      p.on(m => {
        if (m.method === 'Runtime.exceptionThrown') problems.push(m.params.exceptionDetails.text);
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push(m.params.args.map(a => a.value ?? a.description).join(' '));
      });
      for (const d of ['Runtime','Page']) await p.S(`${d}.enable`);
      await p.S('Emulation.setFocusEmulationEnabled', { enabled:true });
      await p.S('Page.bringToFront');
      await cdp.send('Target.activateTarget', { targetId:target.targetId });
      const size = async (width,height) => p.S('Emulation.setDeviceMetricsOverride', { width,height,deviceScaleFactor:1,mobile:touch });
      await size(touch ? 390 : 1280,touch ? 844 : 720);
      if (touch) await p.S('Emulation.setTouchEmulationEnabled', { enabled:true,maxTouchPoints:5 });
      await p.S('Page.navigate', { url:`${base}?renderer=${renderer}` });
      const wait = (expr, label=expr) => p.waitFor(expr,10000,label);
      const phase = value => wait(`window.__game.phase() === '${value}'`, value);
      // A click that starts a round at once (Restart round, Play again) also reaches the fixture's window click listener, which
      // skips its intro: the countdown then lasts one frame, too short to poll for. Watch the phase attribute across such a click.
      const watchStart = () => p.evalJS(`window.__startSeen=[]; window.__startObs?.disconnect(); window.__startObs=new MutationObserver(()=>__startSeen.push(document.body.dataset.phase)); __startObs.observe(document.body,{attributes:true,attributeFilter:['data-phase']}); 0`);
      const started = value => wait(`window.__startSeen.includes('${value}')`, `${value} after the click`);
      const state = () => p.evalJS('window.__game.stats()');
      const locked = () => p.evalJS('!!document.pointerLockElement');
      const center = sel => p.evalJS(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]; })()`);
      const move = (x,y) => p.S('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
      const click = async target => {
        const [x,y] = Array.isArray(target) ? target : await center(target);
        if (touch) {
          await p.S('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
          await p.S('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        } else {
          await move(x,y);
          for (const type of ['mousePressed','mouseReleased']) await p.S('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
        }
      };
      const key = async (code,vk) => {
        for (const type of ['keyDown','keyUp']) await p.S('Input.dispatchKeyEvent',{type,code,key:code,windowsVirtualKeyCode:vk});
      };
      const shot = async label => {
        const {data} = await p.S('Page.captureScreenshot',{format:'png'});
        writeFileSync(join(OUT,`${renderer}-${touch?'phone':'desktop'}-${label}.png`),Buffer.from(data,'base64'));
      };
      const fits = async sel => {
        const failures = await p.evalJS(`Array.from(document.querySelectorAll(${JSON.stringify(sel)})).filter(e => !e.closest('[hidden]') && getComputedStyle(e).display !== 'none').flatMap(e => { const r=e.getBoundingClientRect(); return r.width && r.height && (r.left < -1 || r.top < -1 || r.right > innerWidth+1 || r.bottom > innerHeight+1) ? [e.id || e.textContent] : []; })`);
        assert.deepEqual(failures,[],`visible controls fit ${sel}`);
      };
      await wait('!!window.__game && !document.querySelector("#press-start").hidden');
      // Long titles must not widen the grid track and push the ready prompt off centre.
      for (const [w,h] of [[1920,1080],[1280,720],[390,844],[667,375]]) {
        await size(w,h);
        const centers = await p.evalJS(`['.boot-col','#boot .logo','#press-start'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return r.x+r.width/2})`);
        assert.ok(centers.every(x => Math.abs(x-w/2)<2), `ready screen centered at ${w}x${h}: ${centers}`);
      }
      await size(touch ? 390 : 1280,touch ? 844 : 720);
      await p.evalJS(`window.__wipeSeen=false; window.__wipeObserver=new MutationObserver(()=>{if(!document.querySelector('#wipe').hidden) window.__wipeSeen=true}); window.__wipeObserver.observe(document.querySelector('#wipe'),{attributes:true,attributeFilter:['hidden']}); 0`);
      await p.evalJS(`window.__menuFrames=[]; window.__sampleMenu=()=>{const e=document.querySelector('[data-act="play"]');if(!document.querySelector('#menu').hidden) __menuFrames.push({opacity:getComputedStyle(e).opacity,transform:getComputedStyle(e).transform});if(__menuFrames.length<60) requestAnimationFrame(__sampleMenu)};requestAnimationFrame(__sampleMenu); 0`);
      await click('#press-start'); await phase('menu');
      assert.equal(await p.evalJS('window.__wipeSeen'),false,'cut start never reveals the wipe');
      assert.equal(await p.evalJS(`document.querySelector('#boot').hidden && !document.querySelector('#menu').hidden`),true,'cut swaps directly to menu');
      await sleep(600);
      if (!touch) {
        const frames = await p.evalJS('window.__menuFrames');
        assert.ok(frames.length > 1 && Number(frames[0].opacity) < 0.2 && new Set(frames.map(f => f.transform)).size > 4, 'menu choices animate from hidden into place');
        for (const [w,h] of sizes) { await size(w,h); await sleep(50); await fits('#menu button'); }
        await size(907,510); await shot('portal-menu'); await size(1280,720);
        // The game's own popups (menu.extra) replace "How to play" (help: false), on the menu and the pause card.
        assert.equal(await p.evalJS(`[...document.querySelectorAll('#menu .mbtn')].filter(b => !b.hidden).map(b => b.dataset.act).join()`),'play,settings,extra:about,extra:credits','menu entries');
        assert.equal(await p.evalJS(`document.querySelector('#pause-help').hidden && !!document.querySelector('#pause-extra-about') && !document.querySelector('#pause-extra-credits')`),true,'pause card entries');
        assert.equal(await p.evalJS(`document.querySelector('#extra-credits-title').textContent`),'Credits <&> "quotes"','plain-text titles are escaped');
        await click('.mbtn[data-act="extra:credits"]'); await wait(`!document.querySelector('#extra-credits-pop').hidden && document.activeElement?.textContent === 'Done'`,'credits popup');
        await key('Escape',27); await wait(`document.querySelector('#extra-credits-pop').hidden && document.activeElement?.dataset.act === 'extra:credits'`,'credits closed, focus back on its menu button');
        await sleep(300);
      }
      await click('.mbtn[data-act="play"]'); await phase('countdown');
      if (!touch) {
        await wait('!!document.pointerLockElement');
        assert.equal((await state()).yaw,0,'look neutral during intro');
        await p.evalJS(`window.__lockSamples=[]; window.__lockTimer=setInterval(()=>window.__lockSamples.push(!!document.pointerLockElement),10)`);
      }
      await phase('playing');
      if (!touch) {
        const samples = await p.evalJS('clearInterval(window.__lockTimer); window.__lockSamples');
        assert.ok(samples.length && samples.every(Boolean),'capture survives setup');
        for (let k=1;k<=5;k++) { await move(640+k*20,360); await sleep(20); }
        assert.ok(Math.abs((await state()).yaw)>0.01,'real mouse look at GO');
        // pauseOnBlur "input": alt-tab (focus lost, then the capture released) keeps the round running with input withheld.
        const steps0 = await p.evalJS('window.__game.simSteps()');
        await p.evalJS(`document.hasFocus = () => false; window.dispatchEvent(new Event('blur')); 0`);
        await wait('!document.pointerLockElement', 'blur released the capture'); await sleep(300);
        assert.equal(await p.evalJS('window.__game.phase()'),'playing','blur under pauseOnBlur "input" does not pause');
        assert.equal(await p.evalJS('window.__game.runtime.inputSuspended'),true,'input withheld while away');
        assert.ok(await p.evalJS('window.__game.simSteps()') > steps0,'the sim keeps running while away');
        await p.evalJS(`delete document.hasFocus; window.dispatchEvent(new Event('focus')); 0`);
        assert.equal(await p.evalJS('window.__game.runtime.inputSuspended'),false,'input restored with focus');
        await click([740,360]); await wait('!!document.pointerLockElement','the next click captures again');
        await click([740,360]); // also catches setPointerCapture while locked
      } else {
        assert.equal(await locked(),false,'a touch menu gesture never requests mouse lock');
        await wait(`document.querySelector('[data-action="use"]').getBoundingClientRect().width > 0`);
        await p.evalJS(`window.__ptr=[]; for(const type of ['pointerdown','pointermove','pointercancel']) document.addEventListener(type,e=>window.__ptr.push([type,e.pointerId,e.pointerType,e.target.id||e.target.className,e.clientX,e.clientY]),true)`);
        const [bx,by] = await center('[data-action="use"]');
        const points = [{id:1,x:65,y:650},{id:2,x:250,y:350},{id:3,x:bx,y:by}];
        await p.S('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
        points[0].y-=40; points[1].x+=35;
        await p.S('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points});
        await sleep(200);
        const s=await state(); assert.ok(s.moved>0 && s.looked>0 && s.used>0,`simultaneous touch move/look/action: ${JSON.stringify(s)}; events ${JSON.stringify(await p.evalJS("window.__ptr"))}`);
        await p.S('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }
      await phase('results'); await sleep(350);
      assert.equal(await locked(),false,'results releases lock');
      assert.equal(await p.evalJS('document.querySelector("#results-again").hidden'),true);
      assert.equal(await p.evalJS('document.activeElement.id'),'results-menu');
      assert.ok(await p.evalJS('document.querySelector("#results-custom h2").getBoundingClientRect().width > 10'), 'custom headings remain visible');
      await fits('#results-pop button'); await shot('custom-results');
      if (!touch) {
        // A results-card button opens a game popup through rt.openPopup; closing it returns to the card, not the menu.
        await click('#results-about'); await wait(`!document.querySelector('#extra-about-pop').hidden && document.querySelector('#results-pop').hidden`,'about over results');
        await sleep(300); await key('Escape',27);
        await wait(`!document.querySelector('#results-pop').hidden && document.querySelector('#extra-about-pop').hidden`,'back to the results card');
        assert.equal(await p.evalJS('window.__game.phase()'),'results','still on the results');
        await sleep(450);
      }
      await key('Escape',27); await phase('menu'); await sleep(600);
      await click('.mbtn[data-act="play"]'); await phase('countdown');
      await sleep(200); await click([200,200]); await phase('playing'); // skip intro while locked
      if (!touch) {
        assert.equal(await locked(),true,'skip preserves lock');
        await p.evalJS('document.exitPointerLock()'); await phase('paused'); await sleep(350);
        // The pause card's game entry opens over it and comes back to it, still paused.
        await click('#pause-extra-about'); await wait(`!document.querySelector('#extra-about-pop').hidden`,'about from pause'); await sleep(300);
        await key('Escape',27); await wait(`!document.querySelector('#pause-pop').hidden && document.querySelector('#extra-about-pop').hidden`,'back to the pause card');
        assert.equal(await p.evalJS('window.__game.phase()'),'paused','closing it does not resume');
        await sleep(350);
        await click('#pause-resume'); await phase('playing'); await wait('!!document.pointerLockElement'); await sleep(80);
        // rt.openPopup in play pauses first and opens over the pause card.
        assert.equal(await p.evalJS(`window.__game.runtime.openPopup('about')`),true,'openPopup in play');
        await phase('paused'); await wait(`!document.querySelector('#extra-about-pop').hidden`,'about over the pause card'); await sleep(300);
        await key('Escape',27); await wait(`!document.querySelector('#pause-pop').hidden`,'pause card again'); await sleep(350);
        assert.equal(await p.evalJS(`window.__game.runtime.openPopup('nope')`),false,'unknown popup id');
        await click('#pause-resume'); await phase('playing'); await wait('!!document.pointerLockElement'); await sleep(80);
        await p.evalJS('document.exitPointerLock()'); await phase('paused'); await sleep(350);
        await watchStart(); await click('#pause-restart'); await started('countdown'); await wait('!!document.pointerLockElement');
        await phase('playing');
        await click([640,360]);
      } else await click('[data-action="use"]');
      await phase('results'); await sleep(350);
      assert.equal(await p.evalJS('document.querySelector("#results-custom").childElementCount'),0,'plain results clear custom content');
      assert.equal(await p.evalJS('document.querySelector("#results-again").hidden'),false,'default replay restored');
      await watchStart(); await click('#results-again'); await started('countdown'); await phase('playing');
      if (!touch) {
        // Escape with focus off the card's buttons (a click on its ribbon) resumes once: the handled key must not pause again next frame.
        await wait('!!document.pointerLockElement'); await p.evalJS('document.exitPointerLock()'); await phase('paused'); await sleep(350);
        await click('#pause-title'); await sleep(100);
        await p.evalJS(`window.__phases=[]; window.__phaseObs=new MutationObserver(()=>__phases.push(document.body.dataset.phase)); __phaseObs.observe(document.body,{attributes:true,attributeFilter:['data-phase']}); 0`);
        await key('Escape',27); await phase('playing'); await sleep(300);
        assert.deepEqual(await p.evalJS('__phaseObs.disconnect(), __phases'),['playing'],'one Escape on the pause card resumes and stays resumed');
        await wait('!!document.pointerLockElement'); await sleep(80);
      }
      await click(touch ? '[data-action="use"]' : [640,360]);
      await phase('results'); await sleep(350);
      await key('Backspace',8); await phase('menu'); await sleep(600);
      // Game.skipCountdown: Play goes straight to playing (no countdown phase, number or intro), with control at once.
      await p.evalJS('window.__game.setSkipCountdown(true)');
      await p.evalJS(`window.__phases=[]; window.__phaseObs=new MutationObserver(()=>__phases.push(document.body.dataset.phase)); __phaseObs.observe(document.body,{attributes:true,attributeFilter:['data-phase']}); 0`);
      await click('.mbtn[data-act="play"]'); await phase('playing');
      assert.deepEqual(await p.evalJS('__phaseObs.disconnect(), __phases'),['playing'],'skipCountdown: menu → playing with no countdown');
      assert.equal(await p.evalJS('document.querySelector("#countdown").hidden'),true,'skipCountdown: no number on screen');
      assert.equal((await state()).intro,0,'skipCountdown: no intro');
      assert.equal(await p.evalJS('window.__game.runtime.input.gameplay'),true,'skipCountdown: control at once');
      if (!touch) {
        await wait('!!document.pointerLockElement','skipCountdown: the Play click captured the mouse');
        // The focus policy changes mid-game (rt.setPauseOnBlur): from the fixture's "input" to "pause", then "none".
        assert.equal(await p.evalJS('window.__game.pauseOnBlur()'),'input','GameModule.pauseOnBlur reached the runtime');
        await p.evalJS(`window.__game.runtime.setPauseOnBlur('pause'); window.dispatchEvent(new Event('blur')); 0`);
        await phase('paused');
        assert.equal(await p.evalJS('window.__game.pauseOnBlur()'),'pause','setPauseOnBlur("pause") took effect');
        await sleep(350); await click('#pause-resume'); await phase('playing');
        const steps1 = await p.evalJS('window.__game.simSteps()');
        // (A real focus loss: with the page still focused, losing the capture reads as Esc and pauses in every mode.)
        await p.evalJS(`window.__game.runtime.setPauseOnBlur('none'); document.hasFocus = () => false; window.dispatchEvent(new Event('blur')); 0`); await sleep(300);
        assert.equal(await p.evalJS('window.__game.phase()'),'playing','"none": blur leaves the round running');
        assert.equal(await p.evalJS('window.__game.runtime.inputSuspended'),false,'"none": input is not withheld');
        assert.ok(await p.evalJS('window.__game.simSteps()') > steps1,'"none": the sim keeps running');
        await p.evalJS(`delete document.hasFocus; window.dispatchEvent(new Event('focus')); 0`);
      }
      assert.deepEqual(problems,[],'no exceptions or console errors');
      console.log(`[frontend] ${renderer} ${touch?'touch':'desktop'}: PASS`);
    } finally { cdp?.close(); await chrome.close(); }
  }
} finally { await new Promise(r=>server.httpServer.close(r)); }
