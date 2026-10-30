import {afterEach,describe,expect,it,vi} from 'vitest';
import {ConnectionMonitor,connectionText,type ConnectionView} from '../src/connection-status';
afterEach(()=>vi.useRealTimers());
describe('connection status',()=>{
 it('measures ping, counts connected players and clears stale results on disconnect',()=>{
  vi.useFakeTimers();const updates:ConnectionView[]=[];const monitor=new ConnectionMonitor(v=>updates.push(v));let reply:(n:number)=>void=()=>{};const room={ping:vi.fn((cb:(n:number)=>void)=>{reply=cb;})};
  monitor.setPhase('connecting');expect(connectionText(updates.at(-1)!)).toBe('Connecting…');
  monitor.start(room);monitor.setPlayers(2);reply(37.4);expect(connectionText(updates.at(-1)!)).toBe('Connected · 2 players · 37 ms');
  vi.advanceTimersByTime(3000);expect(room.ping).toHaveBeenCalledTimes(2);monitor.setPhase('reconnecting');reply(70);expect(connectionText(updates.at(-1)!)).toBe('Reconnecting…');
  vi.advanceTimersByTime(10000);expect(room.ping).toHaveBeenCalledTimes(2);
  monitor.start(room);monitor.setPlayers(1);reply(14);expect(connectionText(updates.at(-1)!)).toBe('Connected · 1 player · 14 ms');
 });
 it('shows an unknown ping after timeout and retries without overlapping requests',()=>{
  vi.useFakeTimers();const updates:ConnectionView[]=[];const monitor=new ConnectionMonitor(v=>updates.push(v));let reply:(n:number)=>void=()=>{};const room={ping:vi.fn((cb:(n:number)=>void)=>{reply=cb;})};
  monitor.start(room);monitor.setPlayers(1);vi.advanceTimersByTime(5000);expect(connectionText(updates.at(-1)!)).toBe('Connected · 1 player · — ms');
  reply(99);expect(updates.at(-1)?.ping).toBeNull();vi.advanceTimersByTime(3000);expect(room.ping).toHaveBeenCalledTimes(2);
 });
});
