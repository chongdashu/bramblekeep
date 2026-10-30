// Isolated environment-lab browser check. From a clean detached worktree:
// npm ci && npm run dev -- --host 127.0.0.1 --port 5191
// node game/tests/environment-lab.mjs http://127.0.0.1:5191
// This tests real browser interaction and writes evidence only under out/.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { launchChrome, connect } from "../../tests/lib/cdp.mjs";

const base = process.argv[2] ?? "http://127.0.0.1:5191";
const renderer = process.env.ENV_RENDERER ?? "";
const rendererQuery = renderer ? `&renderer=${encodeURIComponent(renderer)}` : "";
const output = resolve("out/environment-lab-browser", renderer || "webgpu");
mkdirSync(output, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (ok, msg) => { if (!ok) throw new Error(msg); console.log(`ok ${msg}`); };

async function checkDevice(name, width, height, touch) {
  const chrome = await launchChrome({ width, height });
  const cdp = await connect(chrome.wsUrl);
  const errors = [];
  try {
    const [target] = await cdp.pages();
    const p = await cdp.attach(target.targetId);
    p.on((m) => {
      if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text);
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console error");
    });
    await p.S("Runtime.enable"); await p.S("Page.enable");
    await p.S("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: touch });
    if (touch) await p.S("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await p.S("Page.navigate", { url: `${base}/?scene=environment&envDefaults${rendererQuery}` });
    await p.waitFor(`window.__game?.phase?.() === 'playing' && !!document.querySelector('#environment-lab')`, 30000, `${name} environment playing`);
    await sleep(500);
    const shot = async (label) => { const { data } = await p.S("Page.captureScreenshot", { format: "png" }); writeFileSync(resolve(output, `${name}-${label}.png`), Buffer.from(data, "base64")); };
    await shot("camp");
    if (renderer) assert((await p.evalJS(`window.__game.environmentLab().renderer`)) === renderer, `${name}: selected ${renderer}`);
    assert(await p.evalJS(`document.querySelector('#countdown').hidden`), `${name}: opens without countdown`);
    assert(!(await p.evalJS(`window.__game.environmentLab().possessed`)), `${name}: opens in free camera without possession`);
    assert(await p.evalJS(`document.querySelector('#environment-lab .env-cast button').textContent === 'Possess'`), `${name}: possession action is explicit`);
    assert(await p.evalJS(`!!document.querySelector('#environment-lab [aria-label="Boss state"]')`), `${name}: boss state selector is available`);
    await p.evalJS(`(()=>{const s=document.querySelector('#environment-lab [aria-label="Boss state"]');s.value='emerging';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await p.waitFor(`window.__game.environmentLab().bossPreview?.emerge > 0`,5000,`${name} boss emerges`);
    assert(await p.evalJS(`window.__game.environmentLab().cameraMode==='free' && Math.abs(window.__game.environmentLab().cameraZ+26)<.1`),`${name}: boss preview frames the courtyard`);
    await p.evalJS(`(()=>{const s=document.querySelector('#environment-lab [aria-label="Boss state"]');s.value='defeated';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    assert(await p.evalJS(`window.__game.environmentLab().bossPreview?.health===0`),`${name}: defeated boss preview`);
    await p.evalJS(`(()=>{const s=document.querySelector('#environment-lab [aria-label="Boss state"]');s.value='rooted';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    for (const [view,x,z] of [['interior',3,-29.2],['barracks',-8,-29],['lantern',-2.3,11.3]]) {
      await p.evalJS(`(()=>{const s=document.querySelector('.env-camera select');s.value=${JSON.stringify(view)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await p.waitFor(`Math.abs(window.__game.environmentLab().cameraX-(${x}))<0.1 && Math.abs(window.__game.environmentLab().cameraZ-(${z}))<0.1 && Math.abs(window.__game.environmentLab().targetX-(${x}))<0.1 && Math.abs(window.__game.environmentLab().targetZ-(${z}))<0.1`,5000,`${name} ${view} view`);
      assert(!(await p.evalJS(`window.__game.environmentLab().possessed`)), `${name}: ${view} view leaves the hero released`);
      await shot(view);
    }
    const previousPage = await p.evalJS(`performance.timeOrigin`);
    await p.S("Page.reload");
    await p.waitFor(`performance.timeOrigin !== ${previousPage} && window.__game?.phase?.() === 'playing' && !!document.querySelector('#environment-lab .env-cast button')`,30000,`${name} reloaded environment`);
    await p.evalJS(`document.querySelector('#environment-lab .env-cast button').click()`);
    assert(await p.evalJS(`window.__game.environmentLab().possessed`), `${name}: hero can be possessed for traversal`);
    assert((await p.evalJS(`window.__game.environmentLab().assets`)).includes("river-crossing.glb"), `${name}: Blender river crossing loaded`);
    assert((await p.evalJS(`window.__game.environmentLab().characters`)).length === 3, `${name}: three characters are present`);
    assert((await p.evalJS(`window.__game.environmentLab().corePreview`)) === 'heart-tree', `${name}: scene previews the playable heart tree`);
    const lighting = await p.evalJS(`window.__game.environmentLab()`);
    assert(lighting.forest.near >= 4 && lighting.forest.distant >= 30, `${name}: forest surrounds the map`);
    assert(lighting.forest.rear >= 40, `${name}: rear camp boundary has several rows of trees`);
    assert(lighting.style.haze >= 0.6 && lighting.style.hazeEnd <= 100, `${name}: distance haze softens the woodland`);
    assert(lighting.lights.length === 8, `${name}: camp, bridge, approach and castle lights are active`);
    await sleep(350);
    assert((await p.evalJS(`window.__game.environmentLab().lights[0].intensity`)) !== lighting.lights[0].intensity, `${name}: lights flicker over time`);
    const animated = await p.evalJS(`window.__game.environmentLab()`);
    assert(animated.treeSway !== lighting.treeSway, `${name}: trees sway over time`);
    assert(animated.flagWave !== lighting.flagWave, `${name}: castle flags wave over time`);
    assert(animated.embersEmitted > lighting.embersEmitted, `${name}: fire emits embers over time`);
    assert(animated.smokeEmitted > lighting.smokeEmitted, `${name}: fires emit drifting smoke over time`);
    assert(lighting.lights[0].intensity < 1.5, `${name}: campfire light remains bounded`);
    await p.waitFor(`window.__game.environmentLab().leafCount > 0`, 8000, `${name} leaves near trees`);
    assert((await p.evalJS(`window.__game.environmentLab().leafCount`)) <= 16, `${name}: drifting leaves stay bounded`);
    assert(lighting.night === 1, `${name}: opens at night by default`);
    assert(await p.evalJS(`window.__game.environmentLab().skyInView`), `${name}: default camera can see the real sky`);
    const spawn = await p.evalJS(`window.__game.environmentLab()`);
    assert(Math.abs(spawn.playerX) < 0.1 && Math.abs(spawn.playerZ - 22) < 0.1, `${name}: explorer starts at camp`);
    if (!touch) {
      await p.S("Input.dispatchKeyEvent", {type:"keyDown",code:"ShiftLeft",key:"Shift",windowsVirtualKeyCode:16});
      await p.S("Input.dispatchKeyEvent", {type:"keyDown",code:"KeyW",key:"w",windowsVirtualKeyCode:87});
      await sleep(2100); await shot("bridge");
      await sleep(4900);
      await p.S("Input.dispatchKeyEvent", {type:"keyUp",code:"KeyW",key:"w",windowsVirtualKeyCode:87});
      const reached = await p.evalJS(`window.__game.environmentLab()`);
      await shot("castle");
      assert(reached.playerZ < -15 && reached.playerZ > -16.4, `${name}: real keyboard walks across bridge to closed castle (${reached.playerZ})`);
      await p.S("Input.dispatchKeyEvent", {type:"keyDown",code:"KeyR",key:"r",windowsVirtualKeyCode:82});
      await p.S("Input.dispatchKeyEvent", {type:"keyUp",code:"KeyR",key:"r",windowsVirtualKeyCode:82});
      await p.waitFor(`Math.abs(window.__game.environmentLab().playerZ - 22) < 0.1`,5000,"reset to camp");
      // Walk beside the bridge and approach the visibly blocked water.
      await p.S("Input.dispatchKeyEvent", {type:"keyDown",code:"KeyD",key:"d",windowsVirtualKeyCode:68});
      await sleep(850); await p.S("Input.dispatchKeyEvent", {type:"keyUp",code:"KeyD",key:"d",windowsVirtualKeyCode:68});
      await p.S("Input.dispatchKeyEvent", {type:"keyDown",code:"KeyW",key:"w",windowsVirtualKeyCode:87});
      await sleep(2700); await p.S("Input.dispatchKeyEvent", {type:"keyUp",code:"KeyW",key:"w",windowsVirtualKeyCode:87});
      const bank = await p.evalJS(`window.__game.environmentLab()`);
      assert(bank.playerX > 4 && bank.playerZ > 9.4, `${name}: visible water blocks an off-bridge approach (${bank.playerX}, ${bank.playerZ})`);
      await p.S("Input.dispatchKeyEvent", {type:"keyDown",code:"KeyR",key:"r",windowsVirtualKeyCode:82});
      await p.S("Input.dispatchKeyEvent", {type:"keyUp",code:"KeyR",key:"r",windowsVirtualKeyCode:82});
      await p.waitFor(`Math.abs(window.__game.environmentLab().playerZ - 22) < 0.1`,5000,"second reset to camp");
      await p.S("Input.dispatchKeyEvent", {type:"keyUp",code:"ShiftLeft",key:"Shift",windowsVirtualKeyCode:16});
    } else {
      const sx=width*0.22, sy=height*0.73;
      await p.S("Input.dispatchTouchEvent", {type:"touchStart", touchPoints:[{x:sx,y:sy,id:8}]});
      await p.S("Input.dispatchTouchEvent", {type:"touchMove", touchPoints:[{x:sx,y:sy-55,id:8}]});
      await sleep(7300);
      await p.S("Input.dispatchTouchEvent", {type:"touchEnd", touchPoints:[]});
      const walked = await p.evalJS(`window.__game.environmentLab()`);
      assert(walked.playerZ < 6, `${name}: left touch stick walks over bridge (${walked.playerZ})`);
      assert(Math.abs(walked.cameraX-spawn.cameraX) < 0.2, `${name}: movement stick does not pan the camera sideways`);
      await shot("bridge-crossed");
      // Keep the movement stick held while a second finger pans the camera.
      const rightX=width*0.72, rightY=height*0.82;
      await p.S("Input.dispatchTouchEvent", {type:"touchStart", touchPoints:[{x:sx,y:sy,id:8}]});
      await p.S("Input.dispatchTouchEvent", {type:"touchMove", touchPoints:[{x:sx,y:sy-55,id:8}]});
      await sleep(200);
      const beforeBoth = await p.evalJS(`window.__game.environmentLab()`);
      await p.S("Input.dispatchTouchEvent", {type:"touchStart", touchPoints:[{x:sx,y:sy-55,id:8},{x:rightX,y:rightY,id:9}]});
      await p.S("Input.dispatchTouchEvent", {type:"touchMove", touchPoints:[{x:sx,y:sy-55,id:8},{x:rightX+45,y:rightY+12,id:9}]});
      await sleep(250);
      const both = await p.evalJS(`window.__game.environmentLab()`);
      assert(both.playerZ < beforeBoth.playerZ-0.3, `${name}: movement continues during two-finger pan`);
      assert(Math.abs(both.cameraX-beforeBoth.cameraX)>0.2, `${name}: second finger pans independently`);
      await p.S("Input.dispatchTouchEvent", {type:"touchEnd", touchPoints:[{x:sx,y:sy-55,id:8}]});
      await p.S("Input.dispatchTouchEvent", {type:"touchEnd", touchPoints:[]});
    }
    const panStart = await p.evalJS(`window.__game.environmentLab()`);
    const startX = width * (touch ? 0.75 : 0.20), startY = height * (touch ? 0.82 : 0.56);
    if (touch) {
      await p.S("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: startX, y: startY, id: 9 }] });
      await p.S("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: startX + 65, y: startY + 25, id: 9 }] });
      await sleep(120);
      await p.S("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await p.S("Input.dispatchMouseEvent", { type: "mouseMoved", x: startX, y: startY });
      await p.S("Input.dispatchMouseEvent", { type: "mousePressed", x: startX, y: startY, button: "left", buttons: 1, clickCount: 1 });
      await p.S("Input.dispatchMouseEvent", { type: "mouseMoved", x: startX + 65, y: startY + 25, button: "left", buttons: 1 });
      await p.S("Input.dispatchMouseEvent", { type: "mouseReleased", x: startX + 65, y: startY + 25, button: "left", buttons: 0, clickCount: 1 });
    }
    await p.waitFor(`Math.abs(window.__game.environmentLab().targetX - ${panStart.targetX}) > 0.1`, 5000, `${name} rendered camera pans`);
    assert(Math.abs((await p.evalJS(`window.__game.environmentLab().cameraX`)) - panStart.cameraX) > 0.1, `${name}: ${touch ? "touch" : "mouse"} drag pans the rendered camera`);
    if (!touch) {
      const beforeOrbit = await p.evalJS(`window.__game.environmentLab()`);
      await p.S("Input.dispatchMouseEvent", { type: "mousePressed", x: startX, y: startY, button: "right", buttons: 2, clickCount: 1 });
      await p.S("Input.dispatchMouseEvent", { type: "mouseMoved", x: startX + 80, y: startY + 20, button: "right", buttons: 2 });
      await p.S("Input.dispatchMouseEvent", { type: "mouseReleased", x: startX + 80, y: startY + 20, button: "right", buttons: 0, clickCount: 1 });
      assert(Math.abs((await p.evalJS(`window.__game.environmentLab().yaw`)) - beforeOrbit.yaw) > 0.1, `${name}: right drag orbits`);
      const beforeZoom = await p.evalJS(`window.__game.environmentLab().viewWidth`);
      await p.S("Input.dispatchMouseEvent", { type: "mouseWheel", x: startX, y: startY, deltaX: 0, deltaY: -120 });
      assert((await p.evalJS(`window.__game.environmentLab().viewWidth`)) < beforeZoom, `${name}: wheel zooms in`);
    }
    await shot("scene");
    const rect = async (selector) => p.evalJS(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || e.closest('[hidden]')) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
    const clickAt = async (x, y) => {
      if (touch) {
        await p.S("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
        await p.S("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else {
        await p.S("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        await p.S("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
        await p.S("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
      }
    };
    const click = async (selector) => { const r = await rect(selector); assert(!!r, `${name}: ${selector} is visible`); await clickAt(r.x + r.width / 2, r.y + r.height / 2); };
    await p.evalJS(`(() => { const e = document.querySelector('#environment-lab select'); e.value = 'Scout'; e.dispatchEvent(new Event('change', {bubbles:true})); })()`);
    assert((await p.evalJS(`window.__game.environmentLab().selected`)) === 'Scout', `${name}: choose Scout`);
    await click("#environment-lab .env-cast button:nth-of-type(2)");
    assert(await p.evalJS(`window.__game.environmentLab().attackActive`), `${name}: attack button starts the selected character action`);
    await click('#environment-lab .env-cast button');
    assert(!(await p.evalJS(`window.__game.environmentLab().possessed`)), `${name}: release character`);
    if (!touch) {
      const released = await p.evalJS(`window.__game.environmentLab()`);
      await p.S("Input.dispatchKeyEvent", {type:"keyDown",code:"KeyW",key:"w",windowsVirtualKeyCode:87});
      await sleep(400);
      await p.S("Input.dispatchKeyEvent", {type:"keyUp",code:"KeyW",key:"w",windowsVirtualKeyCode:87});
      const moved = await p.evalJS(`window.__game.environmentLab()`);
      assert(Math.abs(moved.playerZ - released.playerZ) < 0.01 && Math.abs(moved.cameraZ - released.cameraZ) > 0.2, `${name}: released movement pans camera without moving Scout`);
    }
    await click('#environment-lab .env-cast button');
    assert(await p.evalJS(`window.__game.environmentLab().possessed`), `${name}: possess character again`);
    if (!touch) {
      const before = await p.evalJS(`window.__game.environmentLab()`);
      await p.S("Input.dispatchKeyEvent", {type:"keyDown",code:"KeyW",key:"w",windowsVirtualKeyCode:87});
      await sleep(400);
      await p.S("Input.dispatchKeyEvent", {type:"keyUp",code:"KeyW",key:"w",windowsVirtualKeyCode:87});
      const after = await p.evalJS(`window.__game.environmentLab()`);
      assert(Math.hypot(after.playerX-before.playerX,after.playerZ-before.playerZ) > 0.3 && after.characters[0].z === before.characters[0].z, `${name}: selected Scout moves while Knight stays put`);
    }
    await click('#environment-lab .env-camera button');
    assert((await p.evalJS(`window.__game.environmentLab().cameraMode`)) === 'free', `${name}: free camera selected while possessed`);
    if (!touch) {
      const before = await p.evalJS(`window.__game.environmentLab()`);
      await p.S("Input.dispatchKeyEvent", {type:"keyDown",code:"KeyS",key:"s",windowsVirtualKeyCode:83});
      await sleep(400);
      await p.S("Input.dispatchKeyEvent", {type:"keyUp",code:"KeyS",key:"s",windowsVirtualKeyCode:83});
      const after = await p.evalJS(`window.__game.environmentLab()`);
      assert(Math.hypot(after.playerX-before.playerX,after.playerZ-before.playerZ) > 0.3 && Math.hypot(after.cameraX-before.cameraX,after.cameraZ-before.cameraZ) < 0.1, `${name}: free camera stays put while character moves`);
    }
    await click('#environment-lab .env-camera button');
    assert((await p.evalJS(`window.__game.environmentLab().cameraMode`)) === 'chase', `${name}: chase camera selected`);
    await p.waitFor(`Math.abs(window.__game.environmentLab().cameraX - window.__game.environmentLab().playerX) < 0.1`,5000,"chase follows explorer");
    await p.evalJS(`(() => { const e = document.querySelector('#environment-lab select'); e.value = 'Knight'; e.dispatchEvent(new Event('change', {bubbles:true})); })()`);
    await click("#environment-lab .env-recenter");
    await p.waitFor(`Math.abs(window.__game.environmentLab().cameraX - window.__game.environmentLab().playerX) < 0.1`,5000,"recenter");
    assert(true, `${name}: recenter returns camera to explorer`);
    const panel = await rect("#environment-lab");
    assert(panel && panel.x >= 0 && panel.x + panel.width <= width && panel.y >= 0, `${name}: header is inside viewport`);
    if (name === "short-landscape") assert(panel.x > width * 0.6, `${name}: header stays clear of the central landmark`);
    await click("#environment-lab button");
    await p.waitFor(`!document.querySelector('#environment-controls').hidden`, 5000, "look controls open");
    await p.evalJS(`document.querySelector("#environment-controls .env-camp").scrollIntoView({block:"nearest"})`);
    await click("#environment-controls .env-camp");
    await p.waitFor(`Math.abs(window.__game.environmentLab().playerZ - 22) < 0.1`,5000,"return to camp");
    assert(true, `${name}: return to camp resets explorer`);
    const controls = await rect("#environment-controls");
    assert(controls && controls.x >= 0 && controls.x + controls.width <= width && controls.y + controls.height <= height + 1, `${name}: look panel is inside viewport`);
    if (touch) {
      const noDevOverlay = await p.evalJS(`(() => ['#dbg', '#dbg-toggle', '#tuning', '#tune-toggle', '#tune-badge'].every(s => { const el = document.querySelector(s); if (!el) return true; const r = el.getBoundingClientRect(); return !r.width || !r.height || getComputedStyle(el).display === 'none' || !!el.closest('[hidden]'); }))()`);
      assert(noDevOverlay, `${name}: inherited dev overlays do not cover touch controls`);
    }
    // The cloud slider controls the sky layer, including when saved on a prior visit.
    await p.evalJS(`(() => { const row = [...document.querySelectorAll('#environment-controls label')].find(e => e.textContent.includes('Sky cloud cover')); const input = row.querySelector('input'); input.value = '0'; input.dispatchEvent(new Event('input', {bubbles:true})); })()`);
    assert((await p.evalJS(`window.__game.environmentLab().skyCloud.opacity`)) === 0, `${name}: cloud cover can be turned off`);
    await p.evalJS(`(() => { const row = [...document.querySelectorAll('#environment-controls label')].find(e => e.textContent.includes('Sky cloud cover')); const input = row.querySelector('input'); input.value = '0.8'; input.dispatchEvent(new Event('input', {bubbles:true})); })()`);
    assert((await p.evalJS(`window.__game.environmentLab().skyCloud.opacity`)) === 0.8, `${name}: cloud cover can be restored`);
    await shot("controls");
    const sunSelector = "#environment-controls details:first-of-type input[type=range]";
    await p.evalJS(`document.querySelector(${JSON.stringify(sunSelector)}).scrollIntoView({ block: "nearest" })`);
    const sunRect = await rect(sunSelector);
    assert(!!sunRect, `${name}: sun control visible`);
    await clickAt(sunRect.x + sunRect.width * 0.8, sunRect.y + sunRect.height / 2);
    await p.waitFor(`Math.abs(window.__game.environmentLab().sunAzimuth - ${lighting.sunAzimuth}) > 1`, 5000, "sun changed");
    const changed = await p.evalJS(`window.__game.environmentLab().sunAzimuth`);
    assert(changed !== lighting.sunAzimuth, `${name}: slider changes live sun (${changed})`);
    await p.evalJS(`(() => { const label = [...document.querySelectorAll('#environment-controls label')].find(e => e.textContent.includes('Day → night')); const input = label.querySelector('input'); input.value = '0'; input.dispatchEvent(new Event('input', {bubbles:true})); })()`);
    assert((await p.evalJS(`window.__game.environmentLab().night`)) === 0, `${name}: day control changes scene`);
    await shot("day");
    // Reload without envDefaults: the changed value must be restored from this origin's storage.
    await p.S("Page.navigate", { url: `${base}/?scene=environment${rendererQuery}` });
    await p.waitFor(`window.__game?.phase?.() === 'playing' && !!document.querySelector('#environment-lab')`, 30000, "environment reload");
    const restored = await p.evalJS(`window.__game.environmentLab().sunAzimuth`);
    assert(restored === changed, `${name}: look override persists on reload`);
    assert((await p.evalJS(`window.__game.environmentLab().night`)) === 0, `${name}: day override persists on reload`);
    await click("#environment-lab button");
    await click("#environment-controls .env-actions button:first-child");
    await p.waitFor(`window.__game.environmentLab().sunAzimuth === ${lighting.sunAzimuth}`, 5000, "look defaults restored");
    assert((await p.evalJS(`window.__game.environmentLab().night`)) === 1, `${name}: reset restores night`);
    assert(await p.evalJS(`localStorage.getItem('castle-environment-lab-v7') === null`), `${name}: reset clears saved override`);
    await click("#environment-lab .env-menu");
    await p.waitFor(`location.search === '' && !!document.querySelector('#press-start')`, 10000, "main menu boot");
    assert(errors.length === 0, `${name}: no browser errors (${errors.join('; ')})`);
  } finally { cdp.close(); await chrome.close(); }
}

for (const [name, width, height, touch] of [["desktop", 1280, 720, false], ["phone", 390, 844, true], ["short-landscape", 568, 320, true]]) await checkDevice(name, width, height, touch);
console.log("Environment lab browser checks passed.");
