import {describe,it,expect,vi} from 'vitest';
import type {GameRuntime} from '@engine/runtime';
import {VictoryFinale} from '../src/victory-finale';
import {motion} from '@engine/ui/tween';
function setup(){const original={target:[1,2,3],pitch:.4,yaw:.2,distance:12};const camera={shot:original,shotBlend:.2,addTrauma:vi.fn()};const spawn=vi.fn();const rt={camera,canvas:{clientWidth:1280,clientHeight:720},particles:{random:()=>.5,spawn}} as unknown as GameRuntime;return {rt,camera,spawn,original};}
describe('victory finale',()=>{
 it('stages particles and the guardian camera, then restores the previous camera',()=>{
  const {rt,camera,spawn,original}=setup(),v=new VictoryFinale();v.start(rt,4,-25);expect(v.active).toBe(true);expect(spawn).toHaveBeenCalledTimes(14);
  expect(camera.shot?.target).toEqual([4,1.45,-25]);expect(camera.shot?.yaw).toBe(Math.PI);expect(camera.shotBlend).toBe(1);
  v.step(.8,rt);expect(camera.shot?.target).toEqual([4,1.45,-25]);expect(camera.shotBlend).toBeGreaterThan(0);expect(spawn.mock.calls.length).toBeGreaterThan(14);
  v.step(.8,rt);expect(spawn.mock.calls.length).toBeGreaterThan(32);v.step(3,rt);expect(v.active).toBe(false);expect(camera.shot).toBe(original);expect(camera.shotBlend).toBe(.2);
 });
 it('can skip and does not overwrite a camera taken over by another system',()=>{
  const {rt,camera}=setup(),v=new VictoryFinale();v.start(rt,0,-26);v.step(.1,rt);const newer={target:[0,0,0],pitch:.2,yaw:0,distance:5};camera.shot=newer;v.skip();expect(v.active).toBe(false);expect(camera.shot).toBe(newer);
 });
 it('goes straight to results with reduced motion',()=>{
  const {rt,spawn}=setup(),v=new VictoryFinale();const reduced=vi.spyOn(motion,'reduced','get').mockReturnValue(true);try{v.start(rt,0,-26);expect(v.active).toBe(false);expect(spawn).not.toHaveBeenCalled();}finally{reduced.mockRestore();}
 });
});
