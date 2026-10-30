import { describe, expect, it } from 'vitest';
import { World } from '../server/world';
import { isTeammate, teammateName, TeammateDirector } from '../server/teammates';
import { TeammateChat } from '../server/teammate-chat';

const bots=(w:World)=>[...w.players.values()].filter(p=>isTeammate(p.id));
describe('helpful teammates',()=>{
 it('uses distinct short names with varied capitalization and underscores',()=>{
  const names=Array.from({length:24},(_,i)=>teammateName(`ai-teammate:${i}`));
  expect(new Set(names).size).toBe(24);expect(names.every(name=>/^\w+$/.test(name))).toBe(true);
  expect(names.some(name=>name.includes('_'))).toBe(true);expect(names.some(name=>/^[a-z]/.test(name))).toBe(true);expect(names.some(name=>/^[A-Z]/.test(name))).toBe(true);
 });
 it('fills ten places with bots and gives every human priority',()=>{
  const w=new World(),director=new TeammateDirector(w);director.step();expect(bots(w)).toHaveLength(10);
  const humans=Array.from({length:10},(_,i)=>{const p=w.join(`human-${i}`,'Knight');director.reconcile();return p;});
  expect(bots(w)).toHaveLength(0);expect(w.players.size).toBe(10);
  humans[0].connected=false;director.reconcile();expect(bots(w)).toHaveLength(0);
  w.leave(humans[0].id);director.reconcile();expect(bots(w)).toHaveLength(1);
  for(let i=10;i<24;i++){w.join(`human-${i}`,'Scout');director.reconcile();}
  expect(w.players.size).toBe(23);expect(bots(w)).toHaveLength(0);expect(director.addDebugPlayer()).toBe(true);expect(w.players.size).toBe(24);expect(director.addDebugPlayer()).toBe(false);
 });
 it('fills a party for humans, yields to joining players, and preserves a reconnecting seat',()=>{
  const w=new World(),director=new TeammateDirector(w,3);director.step();expect(bots(w)).toHaveLength(3);
  const a=w.join('a','Knight');director.step();expect(bots(w)).toHaveLength(2);
  w.join('b','Scout');director.step();expect(bots(w)).toHaveLength(1);
  a.connected=false;director.step();expect(bots(w)).toHaveLength(1);
  a.connected=true;w.join('c','Knight');director.step();expect(bots(w)).toHaveLength(0);
  w.leave('b');w.leave('c');a.connected=false;director.step();expect(bots(w)).toHaveLength(2);
 });
 it('keeps teammates present without humans and resumes help on reconnect',()=>{
  const w=new World(),director=new TeammateDirector(w,3);director.step();const initial=bots(w);expect(initial).toHaveLength(3);
  const positions=initial.map(p=>({x:p.x,z:p.z}));
  for(let i=0;i<100;i++){director.step();w.step(.05);}
  expect(bots(w).map(p=>p.id)).toEqual(initial.map(p=>p.id));
  expect(bots(w).some((p,i)=>Math.hypot(p.x-positions[i].x,p.z-positions[i].z)>.5)).toBe(true);
  expect(new Set(bots(w).map(p=>teammateName(p.id))).size).toBe(3);
  expect(bots(w).map(p=>teammateName(p.id))).toEqual(['Pip','moss','Bramble']);
  const human=w.join('hero','Knight');director.step();expect(bots(w)).toHaveLength(2);
  const ids=bots(w).map(p=>p.id);human.connected=false;director.step();expect(bots(w).map(p=>p.id)).toEqual(ids);
  human.connected=true;director.step();expect(bots(w).map(p=>p.id)).toEqual(ids);
 });
 it('occasionally chats with AI names in an empty camp and with human teammates',()=>{
  const w=new World(),director=new TeammateDirector(w,3),messages:{name:string;text:string}[]=[];
  const chat=new TeammateChat(w,(name,text)=>messages.push({name,text}),{key:''});director.step();chat.step();
  w.time=15;chat.step();expect(messages).toHaveLength(1);expect(messages[0].name).toBe('Pip');
  w.time=59;chat.step();expect(messages).toHaveLength(1);
  w.join('hero','Knight');director.step();w.time=60;chat.step();expect(messages).toHaveLength(2);
  expect(messages[1].text).toBe('Ready when you are.');
 });
 it('uses Jev to choose only an eligible line without exposing player chat',async()=>{
  const w=new World(),director=new TeammateDirector(w,3),messages:string[]=[],requests:RequestInit[]=[];director.step();
  const send:typeof fetch=async (_url,init)=>{requests.push(init!);return new Response(JSON.stringify({model:'test',answers:{line:{choice:'line_2'}}}),{status:200});};
  const chat=new TeammateChat(w,(_name,text)=>messages.push(text),{key:'test',send});chat.step();w.time=15;chat.step();
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(messages).toEqual(['I wonder what grows beyond the river.']);
  const body=JSON.parse(String(requests[0].body));expect(body.state.situation).toBe('camp');expect(body.questions.line.criteria.line_2).toBe(messages[0]);expect(body.state).not.toHaveProperty('chat');
 });
 it('falls back on Jev errors and discards results after the situation changes',async()=>{
  const w=new World(),director=new TeammateDirector(w,3),messages:string[]=[];director.step();
  const failing:typeof fetch=async()=>{throw new Error('unavailable');};
  const chat=new TeammateChat(w,(_name,text)=>messages.push(text),{key:'test',send:failing});chat.step();w.time=15;chat.step();await new Promise(resolve=>setTimeout(resolve,0));expect(messages).toHaveLength(1);
  let finish!:(response:Response)=>void;
  const delayed:typeof fetch=()=>new Promise(resolve=>{finish=resolve;});
  const pending=new TeammateChat(w,(_name,text)=>messages.push(text),{key:'test',send:delayed});pending.step();w.time=30;pending.step();w.join('hero','Knight');
  finish(new Response(JSON.stringify({answers:{line:{choice:'line_0'}}}),{status:200}));await new Promise(resolve=>setTimeout(resolve,0));expect(messages).toHaveLength(1);
 });
 it('balances classes and keeps manually added debug teammates in the world',()=>{
  const w=new World(),director=new TeammateDirector(w,3);w.join('hero','Knight');director.step();
  expect(bots(w).map(p=>p.classId).sort()).toEqual(['Scout','Spellcaster']);
  expect(director.addDebugPlayer()).toBe(true);director.step();expect(bots(w)).toHaveLength(3);
  expect(new Set(bots(w).map(p=>p.classId)).size).toBe(3);
  w.join('second','Scout');director.step();expect(bots(w)).toHaveLength(2);
 });
 for(const kind of ['Scout','Spellcaster'] as const)it(`${kind} teammates use their ranged attacks`,()=>{
  const w=new World(),human=w.join('hero','Knight'),director=new TeammateDirector(w,3);director.step();
  const bot=bots(w).find(p=>p.classId===kind)!;for(const enemy of w.enemies)enemy.alive=false;
  const enemy=w.enemies[0];Object.assign(enemy,{alive:true,x:0,z:14,homeX:0,homeZ:14,hp:30,maxHp:30});
  human.x=0;human.z=17;bot.x=kind==='Scout'?-2:2;bot.z=18;
  for(let i=0;i<160;i++){director.step();w.step(.05);}
  expect(bot.attackSeq).toBeGreaterThan(0);expect(enemy.hp).toBeLessThan(30);
 });
 it('follows a human, helps fight nearby enemies and never records bots as human sessions',()=>{
  const records:unknown[]=[];const w=new World(r=>records.push(r)),human=w.join('hero','Knight'),director=new TeammateDirector(w,3);
  director.step();const bot=bots(w)[0];human.x=0;human.z=16;
  const before=bot.z;for(let i=0;i<30;i++){director.step();w.step(.05);}expect(bot.z).toBeLessThan(before);
  const enemy=w.enemies[0];Object.assign(enemy,{alive:true,x:bot.x,z:bot.z-1,homeX:bot.x,homeZ:bot.z,hp:2});human.x=bot.x;human.z=bot.z;
  for(let i=0;i<80&&enemy.alive;i++){director.step();w.step(.05);}expect(enemy.alive).toBe(false);
  expect(w.snapshot().activeSessions?.map(p=>p.id)).toEqual(['hero']);w.leave(bot.id);expect(records).toHaveLength(0);
 });
 it('navigates across the river to follow a human',()=>{
  const w=new World(),human=w.join('hero','Knight'),director=new TeammateDirector(w,3);director.step();
  for(const enemy of w.enemies)enemy.alive=false;
  const bot=bots(w)[0];human.x=0;human.z=2;
  for(let i=0;i<400;i++){director.step();w.step(.05);}
  expect(bot.z).toBeLessThan(6);
 });
 it('routes around the camp tent rather than stopping at its wall',()=>{
  const w=new World(),human=w.join('hero','Knight'),director=new TeammateDirector(w,3);director.step();
  for(const enemy of w.enemies)enemy.alive=false;
  const [bot]=bots(w);bot.x=-7;bot.z=25;human.x=-5.2;human.z=18;
  for(let i=0;i<300;i++){director.step();w.step(.05);}
  expect(bot.z).toBeLessThan(20);
  expect(bot.z).toBeLessThan(6);
 });
 it('gets both companions across a narrow river crossing',()=>{
  const w=new World(),human=w.join('hero','Knight'),director=new TeammateDirector(w,3);director.step();
  for(const enemy of w.enemies)enemy.alive=false;
  human.x=0;human.z=2;
  for(let i=0;i<600;i++){director.step();w.step(.05);}
  for(const bot of bots(w))expect(bot.z).toBeLessThan(6);
 });
 it('routes through the opened castle gate to assist inside',()=>{
  const w=new World(),human=w.join('hero','Knight'),director=new TeammateDirector(w,3);director.step();
  for(const enemy of w.enemies)enemy.alive=false;
  w.gate.open=true;w.gate.remaining=20;w.gate.health=[0,0];w.gate.delay=[20,20];
  human.x=0;human.z=-23;for(const [i,bot] of bots(w).entries()){bot.x=i?1:-1;bot.z=-13;}
  for(let i=0;i<300;i++){director.step();w.step(.05);}
  for(const bot of bots(w))expect(bot.z).toBeLessThan(-20);
 });
 it('keeps companions apart around a human and recovers from overlapping',()=>{
  const w=new World(),human=w.join('hero','Knight'),director=new TeammateDirector(w,3);director.step();
  for(const enemy of w.enemies)enemy.alive=false;
  const [a,b]=bots(w);a.x=human.x;a.z=human.z;b.x=human.x;b.z=human.z;
  for(let i=0;i<120;i++){director.step();w.step(.05);}
  expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeGreaterThan(1);
  expect(Math.hypot(a.x-human.x,a.z-human.z)).toBeGreaterThan(.9);
  expect(Math.hypot(b.x-human.x,b.z-human.z)).toBeGreaterThan(.9);
  human.z=15;
  for(let i=0;i<160;i++){director.step();w.step(.05);expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeGreaterThan(.8);}
  expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeGreaterThan(.8);
 });
 it('sends assault bots to the gate without a human and assigns others to support',()=>{
  const w=new World(),director=new TeammateDirector(w,4);director.step();
  for(const enemy of w.enemies)enemy.alive=false;
  const [a,b,support]=bots(w);expect(support.id).toBe('ai-teammate:2');
  for(let i=0;i<400;i++){director.step();w.step(.05);}
  expect(Math.min(w.gate.health[0],w.gate.health[1])).toBeLessThan(4);
  expect(Math.min(Math.hypot(support.x-a.x,support.z-a.z),Math.hypot(support.x-b.x,support.z-b.z))).toBeLessThan(10);
 });
 it('ramps bot movement rather than instantly switching to full speed',()=>{
  const w=new World(),director=new TeammateDirector(w,3);for(const enemy of w.enemies)enemy.alive=false;
  director.step();const bot=bots(w)[0];expect(Math.hypot(bot.input.x,bot.input.z)).toBeLessThan(.35);
  let previous={...bot.input};
  for(let i=0;i<12;i++){w.step(.05);director.step();expect(Math.hypot(bot.input.x-previous.x,bot.input.z-previous.z)).toBeLessThan(.5);previous={...bot.input};}
 });
 it('keeps waiting camp bots moving while there is no combat or objective',()=>{
  const w=new World(),human=w.join('hero','Knight'),director=new TeammateDirector(w,4);
  for(const enemy of w.enemies)enemy.alive=false;
  w.gate.health=[0,0];w.gate.delay=[1000,1000];human.x=0;human.z=22;director.step();
  const team=bots(w),travel=new Map(team.map(bot=>[bot.id,0]));
  for(let i=0;i<300;i++){
   const positions=new Map(team.map(bot=>[bot.id,{x:bot.x,z:bot.z}]));director.step();w.step(.05);
   for(const bot of team){const previous=positions.get(bot.id)!;travel.set(bot.id,travel.get(bot.id)!+Math.hypot(bot.x-previous.x,bot.z-previous.z));}
  }
  for(const bot of team){expect(travel.get(bot.id)).toBeGreaterThan(1);expect(bot.z).toBeGreaterThan(16);}
 });
 it('caps enemy defeats by bots while allowing humans to finish them',()=>{
  const w=new World(),bot=w.join('ai-teammate:0','Knight');for(const enemy of w.enemies)enemy.alive=false;
  bot.x=0;bot.z=0;bot.invulnerability=100;
  for(let n=0;n<3;n++){
   const enemy=w.enemies[n];Object.assign(enemy,{alive:true,x:0,z:-1,homeX:0,homeZ:-1,hp:1,maxHp:1,attackCooldown:100});
   for(let i=0;i<40&&enemy.alive;i++){w.setInput(bot.id,{x:0,z:0,sprint:false,attack:true});w.step(.05);}
  }
  expect(w.botDefeats).toBe(2);expect(w.enemies[2].alive).toBe(true);
  const human=w.join('hero','Knight');human.x=0;human.z=0;human.yaw=Math.PI;
  for(let i=0;i<20&&w.enemies[2].alive;i++){w.setInput(human.id,{x:0,z:0,sprint:false,attack:true});w.step(.05);}
  expect(w.enemies[2].alive).toBe(false);expect(w.botDefeats).toBe(2);
  w.victoryTimer=.01;w.step(.05);expect(w.botDefeats).toBe(0);
 });
 it('allows the party to advance but leaves the final castle victory to a human',()=>{
  const w=new World(),director=new TeammateDirector(w);let hits=0;
  for(let i=0;i<1200;i++){director.step();w.step(.05);hits=Math.max(hits,w.gate.hitCount[0]+w.gate.hitCount[1]);}
  expect(hits).toBeGreaterThan(0);expect(w.botDefeats).toBeLessThanOrEqual(2);expect(w.coreHealth).toBeGreaterThanOrEqual(2);expect(w.round).toBe(1);expect(w.cleared).toBe(false);
 });
 it('keeps attacking companions separated while helping with the same enemy',()=>{
  const w=new World(),human=w.join('hero','Knight'),director=new TeammateDirector(w,3);director.step();
  for(const enemy of w.enemies)enemy.alive=false;
  const [a,b]=bots(w);human.x=0;human.z=16;a.x=-2;a.z=18;b.x=2;b.z=18;
  const enemy=w.enemies[0];Object.assign(enemy,{alive:true,x:0,z:14,homeX:0,homeZ:14,hp:100,maxHp:100});
  for(let i=0;i<150;i++){director.step();w.step(.05);expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeGreaterThan(.8);}
  expect(enemy.hp).toBeLessThan(100);
 });
 it('attacks a gate lever even when the human stays at camp',()=>{
  const w=new World(),human=w.join('hero','Knight'),director=new TeammateDirector(w,3);director.step();
  for(const enemy of w.enemies)enemy.alive=false;
  const bot=bots(w)[0];bot.x=-9;bot.z=-12.8;
  for(let i=0;i<100;i++){director.step();w.step(.05);}expect(w.gate.health[0]).toBeLessThan(4);
 });
});

import { TeammateAdvisor } from '../server/teammate-advisor';
it('keeps Jev advisory, rate limited, and outside the simulation',async()=>{
 const w=new World();w.join('hero','Knight');new TeammateDirector(w,3).step();
 const requests:RequestInit[]=[];
 const send:typeof fetch=async (_url,init)=>{requests.push(init!);return new Response(JSON.stringify({model:'test',answers:{strategy:{choice:'assist',confidence:.8}}}),{status:200});};
 const advisor=new TeammateAdvisor('test-key',send);advisor.step(w);advisor.step(w);
 expect(requests).toHaveLength(1);expect(JSON.parse(String(requests[0].body)).questions.strategy.type).toBe('choice');
 await new Promise(resolve=>setTimeout(resolve,0));
 expect(bots(w)).toHaveLength(2);advisor.step(w);expect(requests).toHaveLength(1);
});
