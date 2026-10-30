import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorldStorage } from '../server/storage';
import { World } from '../server/world';

describe('multiplayer local storage',()=>{
 it('persists patrol state and results and rejects malformed checkpoints',()=>{
  const directory=mkdtempSync(join(tmpdir(),'castle-storage-'));
  try{
   const storage=new WorldStorage(directory),world=new World(result=>storage.record(result));
   world.join('hero','Knight').kills=2;world.leave('hero');world.step(.05);storage.save(world.snapshot());
   const restored=new World();restored.restore(new WorldStorage(directory).load()!);
   expect(restored.enemies[0].x).toBe(world.enemies[0].x);
   expect(JSON.parse(readFileSync(join(directory,'results.jsonl'),'utf8').trim())).toMatchObject({id:'hero',kills:2,won:false});
   writeFileSync(join(directory,'world.json'),'{broken');expect(storage.load()).toBeNull();
  }finally{rmSync(directory,{recursive:true,force:true});}
 });
 it('preserves interrupted session contributions and never duplicates a completed result',()=>{
  const directory=mkdtempSync(join(tmpdir(),'castle-storage-'));
  try{
   const storage=new WorldStorage(directory),world=new World(r=>storage.record(r));
   const a=world.join('one','Knight'),b=world.join('two','Scout');a.kills=3;b.kills=1;
   storage.record({round:1,id:'one',classId:'Knight',kills:3,won:true,finishedAt:'now'});
   storage.save(world.snapshot());
   const reopened=new WorldStorage(directory);new World(r=>reopened.record(r)).restore(reopened.load()!);
   const rows=readFileSync(join(directory,'results.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
   expect(rows).toHaveLength(2);expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({id:'one',won:true,kills:3}),expect.objectContaining({id:'two',won:false,kills:1})]));
  }finally{rmSync(directory,{recursive:true,force:true});}
 });

 it('upgrades a departed player result to a victory once',()=>{
  const directory=mkdtempSync(join(tmpdir(),'castle-storage-'));
  try{const store=new WorldStorage(directory),result={round:1,id:'hero',classId:'Knight' as const,kills:2,won:false,finishedAt:'now'};store.record(result);store.record({...result,won:true});new WorldStorage(directory).record({...result,won:false});const rows=readFileSync(join(directory,'results.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));expect(rows.map(row=>row.won)).toEqual([false,true]);}
  finally{rmSync(directory,{recursive:true,force:true});}
 });

 it('serializes asynchronous checkpoint writes and keeps the latest state',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'castle-storage-'));
  try{const storage=new WorldStorage(directory),world=new World();const first=storage.saveAsync(world.snapshot());world.round=2;const last=storage.saveAsync(world.snapshot());await Promise.all([first,last]);expect(storage.load()?.round).toBe(2);}
  finally{rmSync(directory,{recursive:true,force:true});}
 });

});
