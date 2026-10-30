import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Identity } from './identity';

const adjectives=['Brave','Bright','Swift','Merry','Clever','Golden','Gentle','Daring','Lucky','Nimble','Sunny','Valiant'];
const animals=['Badger','Fox','Otter','Robin','Hare','Finch','Wolf','Panda','Bear','Heron','Wren','Lynx'];
function generatedPlayerName(id:string):string {
 const n=parseInt(id.slice(0,8),16);
 return `${adjectives[n%adjectives.length]} ${animals[Math.floor(n/adjectives.length)%animals.length]} ${id.slice(8,10).toUpperCase()}`;
}
export function cleanPlayerName(value:unknown):string {
 return typeof value==='string'?value.replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,24).trim():'';
}
export class ProfileStore {
 private directory:string;
 constructor(directory:string){this.directory=join(directory,'profiles');mkdirSync(this.directory,{recursive:true});}
 private path(id:string){if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Invalid player identity');return join(this.directory,`${id}.json`);}
 get(identity:Identity,wavedashName?:unknown):string {
  const suggested=cleanPlayerName(wavedashName),path=this.path(identity.id);
  try{const saved=JSON.parse(readFileSync(path,'utf8'));const name=cleanPlayerName(saved.name);if(name){const generated=saved.source==='generated'||(saved.source===undefined&&name===generatedPlayerName(identity.id));if(generated&&suggested){this.write(identity,suggested,'wavedash');return suggested;}return name;}}catch{}
  if(suggested){this.write(identity,suggested,'wavedash');return suggested;}
  const name=generatedPlayerName(identity.id);
  this.write(identity,name,'generated');return name;
 }
 set(identity:Identity,value:unknown):string {const name=cleanPlayerName(value);if(!name)throw new Error('Enter a name');this.write(identity,name,'custom');return name;}
 private write(identity:Identity,name:string,source:'generated'|'wavedash'|'custom'){const path=this.path(identity.id),tmp=path+'.tmp';writeFileSync(tmp,JSON.stringify({name,source}));renameSync(tmp,path);}
}
export const profiles=new ProfileStore(process.env.CASTLE_DATA_DIR ?? 'out/multiplayer');
