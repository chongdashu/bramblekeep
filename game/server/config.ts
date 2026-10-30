import { isAbsolute, resolve } from 'node:path';

type Environment = NodeJS.ProcessEnv;

/** Refuse a public server that would silently accept guests or lose its world. */
export function validateServerEnvironment(env:Environment):void {
 if(env.CASTLE_AUTH_MODE && !['guest','wavedash'].includes(env.CASTLE_AUTH_MODE))throw new Error('CASTLE_AUTH_MODE must be guest or wavedash');
 if(env.NODE_ENV!=='production')return;
 if(env.CASTLE_DEV_DEBUG==='1')throw new Error('Development debug must be disabled in production');
 if(env.CASTLE_AUTH_MODE!=='wavedash')throw new Error('Production requires CASTLE_AUTH_MODE=wavedash');
 if(!env.WAVEDASH_GAME_CLOUD_ID?.trim())throw new Error('Production requires WAVEDASH_GAME_CLOUD_ID');
 if(!env.CASTLE_DATA_DIR || !isAbsolute(env.CASTLE_DATA_DIR))throw new Error('Production requires an absolute CASTLE_DATA_DIR on persistent storage');
 if(env.RAILWAY_ENVIRONMENT && (!env.RAILWAY_VOLUME_MOUNT_PATH || resolve(env.RAILWAY_VOLUME_MOUNT_PATH)!==resolve(env.CASTLE_DATA_DIR)))throw new Error('CASTLE_DATA_DIR must match the attached Railway volume mount');
 if(Number(env.CASTLE_TEST_LATENCY_MS ?? 0)>0 || Number(env.COLYSEUS_LATENCY ?? 0)>0)throw new Error('Simulated latency must be disabled in production');
}

/** Browser CORS is an additional boundary; room joins still require a verified JWT. */
export function allowedOrigin(origin:string|null,env:Environment):boolean {
 if(!origin || env.NODE_ENV!=='production')return true;
 try {
  const url=new URL(origin);
  if(url.origin!==origin)return false;
  if(url.protocol==='https:' && url.hostname.endsWith('.builds.wavedashcdn.com'))return true;
  return (env.CASTLE_CLIENT_ORIGINS??'').split(',').map(value=>value.trim()).filter(Boolean).includes(origin);
 } catch { return false; }
}
