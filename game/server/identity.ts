import {createHash,randomBytes} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';
const keys=createRemoteJWKSet(new URL('https://auth.wavedash.com/.well-known/jwks.json'));
export type Identity={id:string;name:string};
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function verifyWavedashToken(token:string,gameId:string,jwks:JWTVerifyGetKey=keys):Promise<string>{
 const {payload}=await jwtVerify(token,jwks,{issuer:'https://auth.wavedash.com',audience:'gameplay.wavedash.com',algorithms:['RS256'],requiredClaims:['exp','sub','gcid','scope']});
 if(payload.scope!=='gameplay'||payload.gcid!==gameId||typeof payload.sub!=='string'||!payload.sub)throw new Error('Wavedash identity does not match this game');
 return payload.sub;
}
/** Names are presentation only; identity always comes from a secret or verified subject. */
export async function identify(options:{guestSecret?:unknown;wavedashToken?:unknown;displayName?:unknown},verify:typeof verifyWavedashToken=verifyWavedashToken):Promise<Identity>{
 let id:string;
 if(options.wavedashToken!==undefined){
  if(typeof options.wavedashToken!=='string'||options.wavedashToken.length>8192)throw new Error('Invalid Wavedash identity');
  const gameId=process.env.WAVEDASH_GAME_CLOUD_ID;if(!gameId)throw new Error('Wavedash identity is not configured on this server');
  const subject=await verify(options.wavedashToken,gameId);
  id=digest(`wavedash:${subject}`);
 }else{
  if(process.env.CASTLE_AUTH_MODE==='wavedash')throw new Error('Wavedash identity is required');
  const secret=options.guestSecret;if(secret!==undefined&&(typeof secret!=='string'||!/^([a-f0-9]{64})$/.test(secret)))throw new Error('Invalid guest identity');
  id=digest(`guest:${secret??randomBytes(32).toString('hex')}`);
 }
 const supplied=typeof options.displayName==='string'?options.displayName.replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,24):'';
 return {id,name:supplied||`Adventurer ${id.slice(0,4).toUpperCase()}`};
}
