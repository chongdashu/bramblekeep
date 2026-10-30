import { describe, expect, it } from 'vitest';
import { LocalPrediction, predictStep, quantize, smoothAngle, smoothPosition } from '../src/multiplayer-motion';

describe('multiplayer motion',()=>{
 it('smooths updates and snaps teleports without overshooting',()=>{
  let point={x:0,z:0};const target={x:1,z:0};for(let i=0;i<20;i++){const next=smoothPosition(point,target,1/60);expect(next.x).toBeGreaterThan(point.x);expect(next.x).toBeLessThanOrEqual(1);point=next;}
  expect(point.x).toBeGreaterThan(.98);expect(smoothPosition(point,{x:8,z:4},1/60)).toEqual({x:8,z:4});
  expect(Math.abs(smoothAngle(Math.PI-.1,-Math.PI+.1,.5)-Math.PI)).toBeLessThan(.001);
 });
 it('replays only inputs not yet acknowledged by the server',()=>{
  const prediction=new LocalPrediction(),walk={x:0,z:-1,sprint:false};prediction.reset({x:0,z:22});
  prediction.advance(1,walk,.05,false);prediction.advance(2,walk,.05,false);
  const server=predictStep({x:0,z:22},walk,.05,false),result=prediction.reconcile(server,1,false),expected=predictStep(server,walk,.05,false);
  expect(result.x).toBeCloseTo(expected.x);expect(result.z).toBeCloseTo(expected.z);
  const settled=prediction.reconcile(expected,2,false);expect(settled.z).toBeCloseTo(expected.z);
 });
 it('uses the same map collisions when predicting movement',()=>{
  const prediction=new LocalPrediction();prediction.reset({x:3,z:10});
  for(let i=0;i<100;i++)prediction.advance(i,{x:0,z:-1,sprint:true},.05,false);
  const predicted=prediction.reconcile({x:3,z:10},-1,false);expect(predicted.z).toBeGreaterThan(9.4);
 });
 it('avoids sending repeated tiny position changes while bounding error',()=>{
  const positions=Array.from({length:101},(_,i)=>i*.0275),encoded=positions.map(v=>quantize(v,.05));
  expect(new Set(encoded).size).toBeLessThan(positions.length*.65);
  for(let i=0;i<positions.length;i++)expect(Math.abs(encoded[i]-positions[i])).toBeLessThanOrEqual(.025001);
 });
});
