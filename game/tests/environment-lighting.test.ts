import { describe, expect, it } from 'vitest';
import { environmentLights } from '../src/scenes/environment-lighting';

const has=(lights:ReturnType<typeof environmentLights>,x:number,z:number)=>lights.some(l=>Math.abs(l.at[0]-x)<.01 && Math.abs(l.at[2]-z)<.01);
describe('environment lighting',()=>{
  it('keeps local lights bounded and makes the camp and castle frontage visible',()=>{
    const camp=environmentLights(0,19,0,1,.9,1);
    const approach=environmentLights(0,-13,0,1,.9,1);
    expect(camp).toHaveLength(8);
    expect(has(camp,3.5,20)).toBe(true);
    expect(has(camp,-9.2,-16.9)).toBe(true);
    expect(has(camp,9.2,-16.9)).toBe(true);
    expect(has(approach,-9.2,-16.9)).toBe(true);
    expect(has(approach,9.2,-16.9)).toBe(true);
    expect(approach.every(l=>l.intensity>=0 && l.intensity<2)).toBe(true);
  });
  it('lights the courtyard and outer lanes without flicker changing which lamps are selected',()=>{
    const side=environmentLights(17,-30,0,1,.9,1);
    expect(has(side,15.4,-23.3)).toBe(true);
    expect(has(side,15.6,-36.4)).toBe(true);
    const interior=environmentLights(0,-30,0,1,.9,1);
    expect(has(interior,-6.65,-28.7)).toBe(true);
    expect(has(interior,6.65,-28.7)).toBe(true);
    const later=environmentLights(0,-30,1,1,.9,1);
    expect(later.map(l=>l.at)).toEqual(interior.map(l=>l.at));
    expect(later[0].intensity).not.toBe(interior[0].intensity);
  });
  it('scales the light controls and softens pools in daylight',()=>{
    const night=environmentLights(0,19,0,1,.9,1), day=environmentLights(0,19,0,1,.9,0);
    expect(day[0].intensity).toBeLessThan(night[0].intensity);
    expect(environmentLights(0,19,0,0,0,1).every(l=>l.intensity===0)).toBe(true);
  });
});
