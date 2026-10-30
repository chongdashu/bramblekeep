import {describe,expect,it} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ProfileStore,cleanPlayerName} from '../server/profiles';
import {identify,verifyWavedashToken} from '../server/identity';
import {createLocalJWKSet,exportJWK,generateKeyPair,SignJWT} from 'jose';

describe('player names',()=>{
 it('generates and persists a name independently for each verified identity',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'castle-profiles-'));
  try{const a=await identify({guestSecret:'a'.repeat(64)}),b=await identify({guestSecret:'b'.repeat(64)}),store=new ProfileStore(dir),initial=store.get(a);expect(initial).toBeTruthy();expect(store.get(a)).toBe(initial);store.set(a,'  Brave <Hero>  ');expect(new ProfileStore(dir).get(a)).toBe('Brave Hero');expect(store.get(b)).not.toBe('Brave Hero');expect(()=>store.set(a,'  ')).toThrow();expect(cleanPlayerName('A'.repeat(30))).toHaveLength(24);}
  finally{rmSync(dir,{recursive:true,force:true});}
 });
});

describe('Wavedash names',()=>{
 it('seeds verified profiles once and never replaces a chosen name',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'castle-wavedash-profile-'));
  try{
   // A Wavedash ID is the server's hash of the verified token subject.
   const {createHash}=await import('node:crypto');const a={id:createHash('sha256').update('wavedash:player-a').digest('hex'),name:''},b={id:createHash('sha256').update('wavedash:player-b').digest('hex'),name:''};
   const store=new ProfileStore(dir);expect(store.get(a,'  Sky <Knight>  ')).toBe('Sky Knight');expect(store.get(a,'Other device name')).toBe('Sky Knight');
   store.set(a,'My own name');expect(new ProfileStore(dir).get(a,'Sky Knight')).toBe('My own name');
   const generated=store.get(b);expect(generated).toBeTruthy();expect(new ProfileStore(dir).get(b)).toBe(generated);expect(store.get(b,'Late Wavedash name')).toBe('Late Wavedash name');
   store.set(b,'Chosen');expect(store.get(b,'Late Wavedash name')).toBe('Chosen');
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
 it('maps signed Wavedash subjects to their own persisted profile',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'castle-signed-profile-')),previous=process.env.WAVEDASH_GAME_CLOUD_ID;
  try{process.env.WAVEDASH_GAME_CLOUD_ID='test-game';const keys=await generateKeyPair('RS256'),publicJwk=await exportJWK(keys.publicKey);publicJwk.kid='test';const jwks=createLocalJWKSet({keys:[publicJwk]});const verify=(token:string,game:string)=>verifyWavedashToken(token,game,jwks);const token=(sub:string)=>new SignJWT({scope:'gameplay',gcid:'test-game'}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://auth.wavedash.com').setAudience('gameplay.wavedash.com').setSubject(sub).setExpirationTime('1h').sign(keys.privateKey);const a=await identify({wavedashToken:await token('player-a')},verify),again=await identify({wavedashToken:await token('player-a')},verify),b=await identify({wavedashToken:await token('player-b')},verify),store=new ProfileStore(dir);expect(a.id).toBe(again.id);expect(a.id).not.toBe(b.id);expect(store.get(a,'Wavedash Hero')).toBe('Wavedash Hero');store.set(a,'My Hero');expect(store.get(again,'New Wavedash Name')).toBe('My Hero');expect(store.get(b,'Second Hero')).toBe('Second Hero');}
  finally{if(previous===undefined)delete process.env.WAVEDASH_GAME_CLOUD_ID;else process.env.WAVEDASH_GAME_CLOUD_ID=previous;rmSync(dir,{recursive:true,force:true});}
 });
 it('keeps older profiles when a Wavedash name becomes available',async()=>{
  const {mkdirSync,writeFileSync}=await import('node:fs');const dir=mkdtempSync(join(tmpdir(),'castle-old-profile-'));try{const id='c'.repeat(64);mkdirSync(join(dir,'profiles'));writeFileSync(join(dir,'profiles',`${id}.json`),JSON.stringify({name:'Existing hero'}));expect(new ProfileStore(dir).get({id,name:''},'Wavedash name')).toBe('Existing hero');}finally{rmSync(dir,{recursive:true,force:true});}
 });
 it('upgrades a legacy generated name when the Wavedash name arrives',async()=>{
  const {readFileSync,writeFileSync}=await import('node:fs');const dir=mkdtempSync(join(tmpdir(),'castle-legacy-generated-'));
  try{
   const identity={id:'d'.repeat(64),name:''},store=new ProfileStore(dir),generated=store.get(identity),file=join(dir,'profiles',`${identity.id}.json`);
   // Profiles made before names had a source marker contain only the name.
   writeFileSync(file,JSON.stringify({name:generated}));
   expect(store.get(identity)).toBe(generated);
   expect(store.get(identity,'Wavedash Hero')).toBe('Wavedash Hero');
   expect(JSON.parse(readFileSync(file,'utf8'))).toEqual({name:'Wavedash Hero',source:'wavedash'});
   store.set(identity,generated);
   expect(store.get(identity,'Wavedash Hero')).toBe(generated);
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
});
