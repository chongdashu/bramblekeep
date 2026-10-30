import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { writeFile, rename } from 'node:fs/promises';
import type { Result } from './world';
import type { SocialSnapshot } from './social';
import type { PatrolEnemy } from '../src/castle-patrol';

export interface Checkpoint { version:1; round:number; night:boolean; time:number; enemies:PatrolEnemy[]; activeBattle:boolean; activeSessions?:Array<{id:string; classId:Result['classId']; kills:number}>;social?:SocialSnapshot }
/** Single-process local storage. Deployments must put this directory on durable storage. */
export class WorldStorage {
 private checkpoint:string;
 private results:string;
 private recorded=new Map<string,boolean>();
 private winCounts=new Map<string,number>();
 private winClasses=new Map<string,Result['classId']>();
 private pending:Checkpoint|null=null;
 private writer:Promise<void>|null=null;
 constructor(directory:string){this.checkpoint=join(directory,'world.json');this.results=join(directory,'results.jsonl');mkdirSync(dirname(this.checkpoint),{recursive:true});try{for(const line of readFileSync(this.results,'utf8').split('\n')){try{const r=JSON.parse(line) as Result;if(typeof r.id!=='string'||!Number.isSafeInteger(r.round))continue;const key=`${r.round}:${r.id}`,prior=this.recorded.get(key);if(r.won===true&&prior!==true){this.winCounts.set(r.id,(this.winCounts.get(r.id)??0)+1);this.winClasses.set(r.id,r.classId);}if(prior!==true)this.recorded.set(key,r.won===true);}catch{}}}catch{}}
 load():Checkpoint|null {try {const value=JSON.parse(readFileSync(this.checkpoint,'utf8')) as Checkpoint;if(value.version!==1||!Number.isSafeInteger(value.round)||value.round<1||typeof value.night!=='boolean'||!Number.isFinite(value.time)||!Array.isArray(value.enemies))return null;return value;}catch{return null;}}
 save(value:Checkpoint){const tmp=this.checkpoint+'.tmp';writeFileSync(tmp,JSON.stringify(value));renameSync(tmp,this.checkpoint);}
 /** Keep disk I/O off the simulation tick; coalesce obsolete pending snapshots. */
 saveAsync(value:Checkpoint):Promise<void>{
  this.pending=value;
  if(!this.writer)this.writer=this.drain();
  return this.writer;
 }
 private async drain(){try{while(this.pending){const value=this.pending;this.pending=null;const tmp=this.checkpoint+'.tmp';await writeFile(tmp,JSON.stringify(value));await rename(tmp,this.checkpoint);}}finally{this.writer=null;}}
 record(result:Result){const key=`${result.round}:${result.id}`;const prior=this.recorded.get(key);if(prior===true || (prior===false && !result.won))return;appendFileSync(this.results,JSON.stringify(result)+'\n');this.recorded.set(key,result.won);if(result.won){this.winCounts.set(result.id,(this.winCounts.get(result.id)??0)+1);this.winClasses.set(result.id,result.classId);}}
 wins(id:string){return this.winCounts.get(id)??0;}
 leaderboard(){return [...this.winCounts].map(([id,wins])=>({id,wins,classId:this.winClasses.get(id)??'Knight'})).sort((a,b)=>b.wins-a.wins||a.id.localeCompare(b.id));}
}
