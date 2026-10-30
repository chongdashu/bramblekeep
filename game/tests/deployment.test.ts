import { describe, expect, it } from 'vitest';
import { allowedOrigin, validateServerEnvironment } from '../server/config';
import { identify } from '../server/identity';

const production = {
 NODE_ENV:'production', CASTLE_AUTH_MODE:'wavedash', WAVEDASH_GAME_CLOUD_ID:'game-cloud',
 CASTLE_DATA_DIR:'/data', RAILWAY_ENVIRONMENT:'production', RAILWAY_VOLUME_MOUNT_PATH:'/data',
};

describe('public castle deployment',()=>{
 it('fails closed when authentication or the persistent volume is missing',()=>{
  expect(()=>validateServerEnvironment(production)).not.toThrow();
  expect(()=>validateServerEnvironment({...production,CASTLE_DEV_DEBUG:'1'})).toThrow(/debug/);
  expect(()=>validateServerEnvironment({...production,CASTLE_AUTH_MODE:'guest'})).toThrow(/AUTH_MODE/);
  expect(()=>validateServerEnvironment({...production,WAVEDASH_GAME_CLOUD_ID:''})).toThrow(/GAME_CLOUD_ID/);
  expect(()=>validateServerEnvironment({...production,RAILWAY_VOLUME_MOUNT_PATH:''})).toThrow(/volume/);
  expect(()=>validateServerEnvironment({...production,CASTLE_DATA_DIR:'out/multiplayer'})).toThrow(/absolute/);
  expect(()=>validateServerEnvironment({...production,COLYSEUS_LATENCY:'250'})).toThrow(/latency/);
 });
 it('allows Wavedash build origins and explicitly listed hosts only',()=>{
  expect(allowedOrigin('https://abc.builds.wavedashcdn.com',production)).toBe(true);
  expect(allowedOrigin('http://abc.builds.wavedashcdn.com',production)).toBe(false);
  expect(allowedOrigin('https://builds.wavedashcdn.com.evil.test',production)).toBe(false);
  expect(allowedOrigin('https://other.test',production)).toBe(false);
  expect(allowedOrigin('https://other.test',{...production,CASTLE_CLIENT_ORIGINS:'https://other.test'})).toBe(true);
 });
 it('does not permit a guest to bypass Wavedash authentication',async()=>{
  const previous=process.env.CASTLE_AUTH_MODE;
  try {process.env.CASTLE_AUTH_MODE='wavedash';await expect(identify({guestSecret:'a'.repeat(64)})).rejects.toThrow(/Wavedash identity is required/);}
  finally {if(previous===undefined)delete process.env.CASTLE_AUTH_MODE;else process.env.CASTLE_AUTH_MODE=previous;}
 });
});
