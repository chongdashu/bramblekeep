// Real two-client server run; isolated backend and result directory. No test-only gameplay commands.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@colyseus/sdk';
import { createHash } from 'node:crypto';
const secret='a'.repeat(64),identity=createHash('sha256').update(`guest:${secret}`).digest('hex');
import { canStand } from '../src/scenes/environment-map.ts';
import { CORE_MAX_HP } from '../src/castle-patrol.ts';
const data=mkdtempSync(join(tmpdir(),'castle-world-')),port=Number(process.env.TEST_WORLD_PORT??25967);
const server=spawn(process.execPath,['--import','tsx','game/server/index.ts'],{env:{...process.env,PORT:String(port),CASTLE_DATA_DIR:data},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',v=>output+=v);server.stderr.on('data',v=>output+=v);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function health(){for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error(`server exited: ${output}`);try{const r=await fetch(`http://127.0.0.1:${port}/health`);if(r.ok)return;}catch{}await sleep(100);}throw new Error(`server failed to start: ${output}`);}
// Navigate a grid derived from the same collision function as the simulation.
function nextStep(x,z,tx,tz,gate){
 const size=.5, key=(a,b)=>`${a},${b}`, ix=v=>Math.round(v/size), start=[ix(x),ix(z)],goal=[ix(tx),ix(tz)],q=[start],prev=new Map([[key(...start),null]]);let end=null;
 for(let i=0;i<q.length&&i<12000;i++){const [a,b]=q[i];if(Math.hypot((a-goal[0])*size,(b-goal[1])*size)<.7){end=[a,b];break;}for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=a+dx,nz=b+dz,k=key(nx,nz);if(!prev.has(k)&&canStand(nx*size,nz*size,gate)){prev.set(k,[a,b]);q.push([nx,nz]);}}}
 if(!end)return [tx-x,tz-z];let next=end,parent=prev.get(key(...next));while(parent&&key(...parent)!==key(...start)){next=parent;parent=prev.get(key(...next));}return [next[0]*size-x,next[1]*size-z];
}
try{
 await health();const client=new Client(`http://127.0.0.1:${port}`),a=await client.join('castle',{classId:'Knight',guestSecret:secret}),b=await client.join('castle',{classId:'Scout'});if(a.roomId!==b.roomId)throw new Error('different worlds');
 await sleep(250);
 a.reconnection.minUptime=0;a.reconnection.delay=100;const reconnect=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('reconnection timed out')),8000);a.onReconnect(()=>{clearTimeout(timeout);resolve();});});
 a.connection.close();await reconnect;await sleep(250);if(!b.state.players.get(a.sessionId)?.connected)throw new Error('reconnected player was not restored');
 const firstRound=a.state.round;let sawGate=false,sawClear=false,lastPrint=0;
 for(let tick=0;tick<2600;tick++){
  const state=a.state,me=state.players.get(a.sessionId);if(!me){await sleep(50);continue;}
  if(state.gateOpen)sawGate=true;if(state.cleared){sawClear=true;a.send('input',{x:0,z:0,sprint:false,attack:false});b.send('input',{x:0,z:0,sprint:false,attack:false});}
  else if(!sawClear){const targets=[...state.enemies.values()].filter(e=>e.alive).sort((u,v)=>Math.hypot(me.x-u.x,me.z-u.z)-Math.hypot(me.x-v.x,me.z-v.z));const target=state.gateOpen||me.z < -20?{x:0,z:-26}:state.defeats>=5?(state.leverLeft>.05?{x:-9,z:-14.3}:{x:9,z:-14.3}):targets[0];if(target){const dist=Math.hypot(target.x-me.x,target.z-me.z),attack=dist<1.65;let [dx,dz]=attack?[0,0]:nextStep(me.x,me.z,target.x,target.z,state.gateOpen);const len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;a.send('input',{x:dx,z:dz,sprint:true,attack});}b.send('input',{x:0,z:0,sprint:false,attack:false});}
  if(tick-lastPrint>200){lastPrint=tick;console.log('progress',JSON.stringify({tick,x:me.x,z:me.z,health:me.health,defeats:state.defeats,core:state.coreHealth,gate:state.gateOpen}));}
  if(sawClear&&state.round>firstRound){if(state.gateOpen||state.coreHealth!==CORE_MAX_HP)throw new Error('round did not reset');break;}
  await sleep(50);
 }
 if(!sawGate||!sawClear||a.state.round<=firstRound)throw new Error(`did not complete round; gate=${sawGate}, clear=${sawClear}, state=${JSON.stringify(a.state.toJSON())}`);
 const records=readFileSync(join(data,'results.jsonl'),'utf8').trim().split('\n').map(JSON.parse),wins=records.filter(r=>r.won&&r.round===firstRound);if(wins.length!==2||!wins.some(r=>r.id===identity&&r.kills>=5))throw new Error(`incorrect results: ${JSON.stringify(records)}`);
 console.log('full multiplayer round passed',JSON.stringify({wins,round:a.state.round,night:a.state.night}));await a.leave();await b.leave();
} finally {server.kill('SIGTERM');await new Promise(r=>{server.once('exit',r);setTimeout(r,2000)});rmSync(data,{recursive:true,force:true});}
