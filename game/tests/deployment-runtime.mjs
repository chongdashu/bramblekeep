// Run against the bundled server and production-only dependencies, not tsx.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@colyseus/sdk';

const bundle=resolve(process.argv[2] ?? 'out/server/index.mjs');
const data=mkdtempSync(join(tmpdir(),'bramblekeep-deploy-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let child, output='';
async function freePort(){return new Promise((ok,fail)=>{const probe=createServer();probe.on('error',fail);probe.listen(0,'127.0.0.1',()=>{const port=probe.address().port;probe.close(()=>ok(port));});});}
function start(env){output='';const proc=spawn(process.execPath,[bundle],{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});proc.stdout.on('data',s=>output+=s);proc.stderr.on('data',s=>output+=s);return proc;}
async function exit(proc){if(proc.exitCode!==null)return proc.exitCode;return await new Promise((ok,fail)=>{const timer=setTimeout(()=>{proc.kill('SIGKILL');fail(new Error(`server did not exit: ${output}`));},8000);proc.once('exit',code=>{clearTimeout(timer);ok(code);});});}
async function ready(proc,port){for(let i=0;i<100;i++){if(proc.exitCode!==null)throw new Error(`server exited before readiness: ${output}`);try{const response=await fetch(`http://127.0.0.1:${port}/health`);if(response.ok)return response.json();}catch{}await sleep(100);}throw new Error(`server did not become ready: ${output}`);}
function check(value,message){if(!value)throw new Error(message);}

try{
 const port=await freePort();
 const base={PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'production',CASTLE_AUTH_MODE:'wavedash',CASTLE_DATA_DIR:data,RAILWAY_ENVIRONMENT:'production',RAILWAY_VOLUME_MOUNT_PATH:data,WAVEDASH_GAME_CLOUD_ID:''};
 child=start(base);check(await exit(child)!==0 && output.includes('WAVEDASH_GAME_CLOUD_ID'),'missing Wavedash cloud ID should prevent startup');
 child=start({...base,WAVEDASH_GAME_CLOUD_ID:'test-cloud',BUILD_LABEL:'runtime-test'});
 const health=await ready(child,port);
 check(health.protocol && health.build==='runtime-test' && health.auth==='wavedash' && health.wavedashConfigured && health.railwayVolumeAttached,'health did not expose expected runtime configuration');
 const allowed=await fetch(`http://127.0.0.1:${port}/health`,{headers:{Origin:'https://demo.builds.wavedashcdn.com'}});
 const denied=await fetch(`http://127.0.0.1:${port}/health`,{headers:{Origin:'https://bad.test'}});
 check(allowed.headers.get('access-control-allow-origin')==='https://demo.builds.wavedashcdn.com','Wavedash CORS failed');
 check(denied.headers.get('access-control-allow-origin')!=='https://bad.test','unlisted origin was allowed');
 let rejected=false;try{await new Client(`http://127.0.0.1:${port}`).join('castle',{guestSecret:'a'.repeat(64)});}catch{rejected=true;}
 check(rejected,'production accepted an unsigned guest');
 child.kill('SIGTERM');check(await exit(child)===0,'production did not shut down cleanly');
 check(JSON.parse(readFileSync(join(data,'world.json'),'utf8')).version===1,'shutdown did not persist the world');

 child=start({...base,NODE_ENV:'development',CASTLE_AUTH_MODE:'guest',RAILWAY_ENVIRONMENT:'',RAILWAY_VOLUME_MOUNT_PATH:'',WAVEDASH_GAME_CLOUD_ID:''});
 await ready(child,port);
 const client=new Client(`http://127.0.0.1:${port}`);
 const a=await client.join('castle',{classId:'Knight',guestSecret:'a'.repeat(64)});
 const b=await client.join('castle',{classId:'Scout',guestSecret:'b'.repeat(64)});
 check(a.roomId===b.roomId,'clients joined different worlds');
 for(let i=0;i<30 && !(a.state.players.has(a.sessionId)&&a.state.players.has(b.sessionId));i++)await sleep(100);
 check(a.state.players.has(a.sessionId)&&a.state.players.has(b.sessionId),'clients did not receive both players in the shared state');
 await a.leave();await b.leave();child.kill('SIGTERM');check(await exit(child)===0,'development server did not shut down cleanly');
 console.log('Bundled server: startup guard, health, CORS, rejected guest, shutdown checkpoint and two-client shared world passed.');
}finally{
 if(child && child.exitCode===null){child.kill('SIGTERM');await exit(child).catch(()=>{});}
 rmSync(data,{recursive:true,force:true});
}
