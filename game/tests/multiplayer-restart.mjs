import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@colyseus/sdk';
import {createHash} from 'node:crypto';
const secret='a'.repeat(64),identity=createHash('sha256').update(`guest:${secret}`).digest('hex');
const port=Number(process.env.TEST_WORLD_PORT??25968),data=mkdtempSync(join(tmpdir(),'castle-restart-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let server;
function launch(){return spawn(process.execPath,['--import','tsx','game/server/index.ts'],{env:{...process.env,PORT:String(port),CASTLE_DATA_DIR:data},stdio:'ignore'});}
async function ready(){for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok)return;}catch{}await sleep(100);}throw new Error('server did not start');}
try{
 server=launch();await ready();const client=new Client(`http://127.0.0.1:${port}`),room=await client.join('castle',{classId:'Scout',guestSecret:secret});room.reconnection.enabled=false;
 await sleep(2500);const saved=JSON.parse(readFileSync(join(data,'world.json'),'utf8'));if(!saved.activeSessions.some(p=>p.id===identity))throw new Error('active session was not checkpointed');
 server.kill('SIGKILL');await new Promise(resolve=>server.once('exit',resolve));server=launch();await ready();
 const records=readFileSync(join(data,'results.jsonl'),'utf8').trim().split('\n').map(JSON.parse);if(!records.some(r=>r.id===identity&&!r.won&&r.classId==='Scout'))throw new Error('interrupted session was not recorded');
 const newRoom=await client.join('castle',{classId:'Knight'});await sleep(200);if(newRoom.state.gateOpen||newRoom.state.coreHealth!==6||newRoom.state.enemies.size<5)throw new Error('world did not recover to an idle encounter');await newRoom.leave();console.log('checkpoint restart and interrupted-session recording passed');
}finally{if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>{server.once('exit',r);setTimeout(r,2000)});}rmSync(data,{recursive:true,force:true});}
