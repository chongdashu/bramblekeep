// Run against an isolated checkout and its own game and multiplayer servers. Chrome is muted.
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';
const base = process.argv[2];
if (!base) throw new Error('Pass the isolated game-server URL');
const chrome = await launchChrome({width:1280,height:720});
const cdp = await connect(chrome.wsUrl);
try {
  const [target] = await cdp.pages();
  const page = await cdp.attach(target.targetId);
  const errors = [];
  page.on(m => { if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text); });
  await page.S('Runtime.enable'); await page.S('Page.enable');
  const key = (type, code, value, number) => page.S('Input.dispatchKeyEvent',{type,code,key:value,windowsVirtualKeyCode:number});
  const down = (code, value, number) => key('keyDown',code,value,number);
  const up = (code, value, number) => key('keyUp',code,value,number);
  for (const mode of ['solo','multiplayer']) {
    const scene = mode === 'solo' ? '&scene=solo' : '';
    await page.S('Page.navigate',{url:`${base}/?autostart&envDefaults${scene}`});
    await page.waitFor("window.__game?.phase?.()==='playing' && !!window.__game.gameAudio",30000,`${mode} ready`);
    await down('KeyW','w',87); await up('KeyW','w',87); // trusted activation unlocks Web Audio
    if (mode === 'multiplayer') {
      await page.waitFor("!!document.querySelector('.multiplayer-join:not([hidden]) [data-class=Knight]')",10000,'class selection');
      await page.evalJS("document.querySelector('.multiplayer-join [data-class=Knight]').click()");
      await page.waitFor('window.__game.multiplayer?.().joined',15000,'multiplayer joined');
    }
    await page.waitFor("window.__game.gameAudio().unlocked && window.__game.gameAudio().music==='castleCamp'",15000,`${mode} camp cue`);
    await down('ShiftLeft','Shift',16); await down('KeyW','w',87);
    await page.waitFor("window.__game.gameAudio().music==='castleAction'",15000,`${mode} approach cue`);
    await up('KeyW','w',87);
    await down('KeyS','s',83);
    await page.waitFor("window.__game.gameAudio().music==='castleCamp'",15000,`${mode} return to camp`);
    await up('KeyS','s',83); await up('ShiftLeft','Shift',16);
    console.log(`${mode}: camp → approach → camp passed`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await cdp.close(); await chrome.close(); }
