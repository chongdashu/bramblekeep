import { describe, expect, it, vi } from 'vitest';
import { GateCinematic } from '../src/gate-cinematic';
import type { GameRuntime } from '@engine/runtime';

describe('non-blocking gate breach',()=>{
 it('animates the door and announces without taking over the camera',()=>{
  const trauma=vi.fn(),spawn=vi.fn(),batches=Array.from({length:5},()=>({push:vi.fn()}));
  const camera={shot:null,shotBlend:0,addTrauma:trauma};
  const rt={camera,particles:{random:()=>.5,spawn},batches} as unknown as GameRuntime;
  const event=new GateCinematic();event.start(rt);expect(event.active).toBe(true);expect(event.progress).toBe(0);
  event.step(.6,rt);event.draw(rt);expect(event.progress).toBeCloseTo(.5);expect(batches[0].push).toHaveBeenCalled();expect(camera.shot).toBeNull();
  event.step(.7,rt);expect(event.progress).toBe(1);expect(trauma).toHaveBeenCalledTimes(2);expect(spawn.mock.calls.length).toBeGreaterThan(30);
  event.step(4,rt);expect(event.active).toBe(false);expect(camera.shot).toBeNull();event.draw(rt);expect(batches[0].push).toHaveBeenCalled();
 });
});
