// Exercise a frozen Wavedash package at a nested, cross-origin-isolated path.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { launchChrome, connect } from '../../tests/lib/cdp.mjs';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const endpoint=(process.env.VITE_COLYSEUS_URL??'https://world.up.railway.app').replace(/\/$/,'');
const port=await new Promise((ok,fail)=>{const probe=createServer();probe.on('error',fail);probe.listen(0,'127.0.0.1',()=>{const value=probe.address().port;probe.close(()=>ok(value));});});
const server=spawn(process.execPath,['scripts/serve-release.mjs','wavedash','--port',String(port),'--isolated'],{stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',s=>output+=s);server.stderr.on('data',s=>output+=s);
let chrome,cdp;
try{
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/__misses`)).ok)break;}catch{}if(server.exitCode!==null||i===99)throw new Error(`release server failed: ${output}`);await sleep(100);}
 chrome=await launchChrome();cdp=await connect(chrome.wsUrl);
 const [target]=await cdp.pages(),page=await cdp.attach(target.targetId);
 const remote=[],analytics=[];
 await page.S('Page.enable');await page.S('Runtime.enable');
 await page.S('Page.addScriptToEvaluateOnNewDocument',{source:`window.__wd={ready:0};window.Wavedash={init:()=>{window.__wd.ready++;return true},updateLoadProgressZeroToOne:()=>{},getUserJwt:async()=>({success:true,data:'test-token'}),getUsername:()=>'Test'};`});
 await page.S('Fetch.enable',{patterns:[{urlPattern:`${endpoint}/*`},{urlPattern:'https://*.convex.site/*'}]});
 page.on('Fetch.requestPaused',event=>{(new URL(event.request.url).hostname.endsWith('.convex.site')?analytics:remote).push(event.request.url);void page.S('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:503,responseHeaders:[{name:'Access-Control-Allow-Origin',value:`http://127.0.0.1:${port}`},{name:'Access-Control-Allow-Credentials',value:'true'},{name:'Content-Type',value:'application/json'}],body:btoa('{"status":"unavailable"}')}).catch(()=>{});});
 await page.S('Page.navigate',{url:`http://127.0.0.1:${port}/builds/bramblekeep/?scene=character`});
 await page.waitFor("window.__wd?.ready===1 && !!document.querySelector('#press-start') && !document.querySelector('#press-start').hidden",45000,'host readiness and title');
 await page.evalJS("document.querySelector('#press-start').click()");
 await page.waitFor("document.body.dataset.phase==='menu'",15000,'release menu');
 const leaked=await page.evalJS("!!document.querySelector('.scene-toggle, #menu [data-act^=\"extra:\"]') || !!document.querySelector('#character-lab')");
 if(leaked)throw new Error('a test scene was reachable from the release menu or URL');
 await page.evalJS("document.querySelector('#menu [data-act=play]').click()");
 await page.waitFor("!!document.querySelector('.multiplayer-join') && !document.querySelector('.multiplayer-join').hidden",15000,'multiplayer class picker');
 await page.evalJS("document.querySelector('[data-class=Knight]').click()");
 for(let i=0;i<60 && !remote.some(url=>url.endsWith('/health'));i++)await sleep(100);
 if(!remote.some(url=>url===`${endpoint}/health`))throw new Error(`release did not contact its configured server: ${remote.join(', ')}`);
 await page.waitFor("document.querySelector('.multiplayer-message').textContent.includes('Could not reach the castle server')",10000,'server unavailable message');
 const misses=await (await fetch(`http://127.0.0.1:${port}/__misses`)).json();
 if(misses.length)throw new Error(`nested package asset misses: ${misses.join(', ')}`);
 if(analytics.length)throw new Error('Automated package checks must not send analytics');
 console.log('Nested Wavedash package: host readiness, release-only menu, class picker, configured server URL and asset requests passed.');
}finally{
 if(cdp)await cdp.close();if(chrome)await chrome.close();server.kill('SIGTERM');
}
