// A separate preview points at a deliberately unavailable local server.
import {spawn} from 'node:child_process';
import {launchChrome,connect} from '../../tests/lib/cdp.mjs';
const frontPort=Number(process.env.TEST_FRONT_PORT??51968),vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(frontPort),'--strictPort'],{env:{...process.env,VITE_COLYSEUS_URL:'http://127.0.0.1:25969'},stdio:'ignore'}),sleep=ms=>new Promise(r=>setTimeout(r,ms));let chrome,cdp;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${frontPort}/`)).ok)break;}catch{}if(i===99)throw new Error('preview failed to start');await sleep(100);}
 chrome=await launchChrome();cdp=await connect(chrome.wsUrl);const [target]=await cdp.pages(),p=await cdp.attach(target.targetId);await p.S('Runtime.enable');await p.S('Page.enable');await p.S('Page.navigate',{url:`http://127.0.0.1:${frontPort}/?autostart`});await p.waitFor("!!document.querySelector('.multiplayer-join:not([hidden])')",30000,'class picker');await p.evalJS("document.querySelector('[data-class=Knight]').click()");await p.waitFor("document.querySelector('.multiplayer-message').textContent.includes('Could not reach') && !document.querySelector('[data-class=Knight]').disabled",10000,'recoverable connection error');if(!(await p.evalJS("!!document.querySelector('.multiplayer-back')")))throw new Error('missing escape from join screen');console.log('unavailable-server recovery passed');
}finally{if(cdp)await cdp.close();if(chrome)await chrome.close();vite.kill('SIGTERM');}
