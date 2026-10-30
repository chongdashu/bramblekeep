import { describe,expect,it } from 'vitest';
import { generateKeyPair,exportJWK,SignJWT,createLocalJWKSet } from 'jose';
import { identify,verifyWavedashToken } from '../server/identity';
import { Social } from '../server/social';
import { clockLabel,nightAmount,worldHour,DAY_SECONDS } from '../src/world-clock';

describe('persistent identities and social state',()=>{
 it('keeps guest identity stable without exposing its secret',async()=>{
  const secret='a'.repeat(64),a=await identify({guestSecret:secret}),b=await identify({guestSecret:secret});expect(a).toEqual(b);expect(a.id).not.toContain(secret);expect((await identify({guestSecret:'b'.repeat(64)})).id).not.toBe(a.id);await expect(identify({guestSecret:'bad'})).rejects.toThrow();
 });
 it('verifies signed Wavedash tokens and rejects wrong game, scope and expiry',async()=>{
  const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='test';const keys=createLocalJWKSet({keys:[jwk]});
  const token=async(scope:string,gcid:string,expires:string)=>new SignJWT({scope,gcid}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://auth.wavedash.com').setAudience('gameplay.wavedash.com').setSubject('user-1').setExpirationTime(expires).sign(privateKey);
  expect(await verifyWavedashToken(await token('gameplay','game-a','1h'),'game-a',keys)).toBe('user-1');
  await expect(verifyWavedashToken(await token('gameplay','game-b','1h'),'game-a',keys)).rejects.toThrow();
  await expect(verifyWavedashToken(await token('other','game-a','1h'),'game-a',keys)).rejects.toThrow();
  await expect(verifyWavedashToken(await token('gameplay','game-a','-1s'),'game-a',keys)).rejects.toThrow();
 });
 it('keeps contributions and recent chat when a player leaves and returns',()=>{
  const social=new Social(),identity={id:'hero',name:'Adventurer'};social.join(identity,'Knight').kills=4;social.add('chat','Adventurer','hello');social.leave('hero');const saved=social.snapshot();expect(saved.activity.find(e=>e.kind==='chat')?.sentAt).toBeGreaterThan(0);const restored=new Social();restored.restore(saved,1);expect(restored.join(identity,'Scout').kills).toBe(4);expect(restored.activity.some(e=>e.kind==='chat'&&e.text==='hello'&&e.sentAt>0)).toBe(true);restored.reset(2);expect(restored.roster.get('hero')?.kills).toBe(0);
 });
 it('advances a shared 20-minute clock smoothly from day through night',()=>{
  expect(clockLabel(0)).toBe('09:00');expect(worldHour(DAY_SECONDS)).toBe(9);expect(nightAmount(12)).toBe(0);expect(nightAmount(0)).toBe(1);expect(nightAmount(6)).toBeGreaterThan(0);
 });
});
