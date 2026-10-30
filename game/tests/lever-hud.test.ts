import { describe, expect, it } from 'vitest';
import { gateCuePosition, gateGuidanceOpacity, gateLinkGeometry, shouldShowGateLock } from '../src/lever-hud';

describe('gate lock marker', () => {
  it('connects level endpoints with diagonal segments and keeps the label near the lever', () => {
    const result = gateLinkGeometry([400,200], [100,200]);
    expect(result.bend[1]).toBeGreaterThan(200);
    expect(Math.abs(result.label[0] - 100)).toBeLessThan(Math.abs(result.label[0] - 400));
  });
  it('reveals guidance gradually only near the gate', () => {
    expect(gateGuidanceOpacity(25)).toBe(0);
    expect(gateGuidanceOpacity(20)).toBe(0);
    expect(gateGuidanceOpacity(17.5)).toBe(.5);
    expect(gateGuidanceOpacity(15)).toBe(1);
  });
  it('keeps off-screen lever cues on the correct edge', () => {
    expect(gateCuePosition([-70, 300], 390, 844)).toEqual({point:[28,300],edge:'left'});
    expect(gateCuePosition([470, 300], 390, 844)).toEqual({point:[362,300],edge:'right'});
    expect(gateCuePosition([195, 300], 390, 844)).toEqual({point:[195,300],edge:''});
    expect(gateCuePosition(null, 390, 844)).toEqual({point:null,edge:''});
  });
  it('shows a nearby in-frame lock while protecting the player and HUD', () => {
    const show = (p: [number, number] | null, distance = 12, player: Array<[number, number] | null> = []) => shouldShowGateLock(p, distance, 390, 844, player);
    expect(show([180, 250])).toBe(true);
    expect(show(null)).toBe(false);
    expect(show([180, 250], 46)).toBe(false);
    expect(show([180, 60])).toBe(false);
    expect(show([390, 250])).toBe(false);
    expect(show([180, 250], 12, [[180, 260]])).toBe(false);
  });
});
