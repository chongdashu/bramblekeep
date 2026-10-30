import { describe, expect, it, vi } from 'vitest';
import type { AudioBus } from '@engine/audio';
import { CastleMusic, campDistance } from '../src/castle-music';
import { GameAudio } from '../src/game-audio';
import { CAMP_SPAWNS } from '../server/spawn';

describe('castle music', () => {
  it('builds urgency near patrols, holds it briefly, and prioritizes the breached keep', () => {
    const music = new CastleMusic();
    const state = { cleared:false, gateOpen:false, danger:false, coreHealth:6, coreMaxHealth:6, nearCore:false, campDistance:10 };
    expect(music.update(1,state)).toBe('castleAction');
    expect(music.update(.1,{...state,danger:true})).toBe('castleCombat');
    expect(music.update(3,state)).toBe('castleCombat');
    expect(music.update(1,state)).toBe('castleAction');
    expect(music.update(.1,{...state,gateOpen:true})).toBe('castleClimax');
    expect(music.update(.1,{...state,gateOpen:true,cleared:true,danger:true})).toBe('castleVictory');
    music.update(.1,{...state,danger:true}); music.reset();
    expect(music.update(.1,state)).toBe('castleAction');
  });
  it('responds to actual core damage, critical health, and a gate closing with a player inside', () => {
    const music = new CastleMusic();
    const state = {cleared:false,gateOpen:true,danger:false,coreHealth:6,coreMaxHealth:6,nearCore:false,campDistance:10,round:1};
    expect(music.update(.1,state)).toBe('castleClimax');
    expect(music.update(.1,{...state,coreHealth:5})).toBe('castleCore');
    expect(music.update(3,{...state,coreHealth:5,gateOpen:false,nearCore:true})).toBe('castleCore');
    expect(music.update(4,{...state,coreHealth:5,gateOpen:false,nearCore:true})).toBe('castleCore');
    expect(music.update(.1,{...state,coreHealth:5,gateOpen:false,nearCore:true})).toBe('castleClimax');
    expect(music.update(.1,{...state,coreHealth:2,gateOpen:false,nearCore:true})).toBe('castleCritical');
    expect(music.update(.1,{...state,coreHealth:0,cleared:true})).toBe('castleVictory');
    expect(music.update(.1,{...state,round:2,gateOpen:false})).toBe('castleAction');
  });
  it('handles joining a damaged core and does not infer an attack from an initial snapshot', () => {
    const music = new CastleMusic();
    const state = {cleared:false,gateOpen:true,danger:false,coreHealth:4,coreMaxHealth:6,nearCore:false,campDistance:10,round:7};
    expect(music.update(.1,state)).toBe('castleClimax');
    expect(music.update(.1,{...state,coreHealth:2})).toBe('castleCritical');
    expect(music.update(7,{...state,coreHealth:2,gateOpen:false})).toBe('castleCritical');
    expect(music.update(.1,{...state,coreHealth:2,gateOpen:false})).toBe('castleAction');
    music.reset();
    expect(music.update(.1,{...state,coreHealth:2})).toBe('castleCritical');
  });
  it('uses a distinct camp cue, with a stable boundary and combat taking priority', () => {
    const music = new CastleMusic();
    const state = {cleared:false,gateOpen:false,danger:false,coreHealth:6,coreMaxHealth:6,nearCore:false,campDistance:campDistance(0,22)};
    expect(music.update(.1,state)).toBe('castleCamp');
    expect(CAMP_SPAWNS.every(p => campDistance(p.x,p.z) < 6)).toBe(true);
    expect(music.update(.1,{...state,campDistance:7})).toBe('castleCamp');
    expect(music.update(.1,{...state,campDistance:8})).toBe('castleAction');
    expect(music.update(.1,{...state,campDistance:7})).toBe('castleAction');
    expect(music.update(.1,{...state,campDistance:5.9})).toBe('castleCamp');
    expect(music.update(.1,{...state,danger:true})).toBe('castleCombat');
    expect(music.update(4,state)).toBe('castleCamp');
    expect(music.update(.1,{...state,gateOpen:true})).toBe('castleClimax');
    music.reset();
    expect(music.update(.1,state)).toBe('castleCamp');
  });
  it('switches once and resumes the current selection after pause', () => {
    const bus = {playMusic:vi.fn(),music:{playing:null},ctx:null} as unknown as AudioBus;
    const audio = new GameAudio(bus,'castleAction');
    audio.frame('playing',.1,0,0,false);
    audio.setTrack('castleCombat'); audio.setTrack('castleCombat');
    audio.frame('paused',0,0,0,false);
    audio.setTrack('castleClimax');
    audio.frame('playing',.1,0,0,false);
    expect(vi.mocked(bus.playMusic).mock.calls.map(([track])=>track)).toEqual(['castleAction','castleCombat',null,'castleClimax']);
  });
  it('plays the menu theme on entry and return, and hands off to gameplay', () => {
    const bus = {playMusic:vi.fn(),music:{playing:null},ctx:null} as unknown as AudioBus;
    const audio = new GameAudio(bus,'castleAction');
    audio.frame('title',0,0,0,false);
    audio.frame('menu',.1,0,0,false); audio.frame('menu',.1,0,0,false);
    audio.frame('playing',.1,0,0,false);
    audio.frame('paused',0,0,0,false);
    audio.frame('menu',.1,0,0,false);
    expect(vi.mocked(bus.playMusic).mock.calls.map(([track])=>track)).toEqual([null,'menuTheme','castleAction',null,'menuTheme']);
  });
});
