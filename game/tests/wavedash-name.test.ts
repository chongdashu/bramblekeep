import {describe,expect,it} from 'vitest';
import {wavedashDisplayName} from '../src/wavedash-name';
describe('Wavedash display name',()=>{
 it('uses the current user name, or the SDK username fallback',async()=>{
  expect(await wavedashDisplayName({getUser:()=>({username:'  Sky Ranger  '}),getUsername:()=> 'Other'})).toBe('Sky Ranger');
  expect(await wavedashDisplayName(Promise.resolve({getUser:()=>null,getUsername:()=> 'Moon'}))).toBe('Moon');
  expect(await wavedashDisplayName({getUser:()=>{throw Error('unavailable')},getUsername:()=> 'Star'})).toBe('Star');
 });
 it('returns no suggestion when the host cannot provide a name',async()=>{
  expect(await wavedashDisplayName(null)).toBeUndefined();expect(await wavedashDisplayName({getUser:()=>({username:'   '})})).toBeUndefined();expect(await wavedashDisplayName(Promise.reject(Error('unavailable')))).toBeUndefined();
 });
});
