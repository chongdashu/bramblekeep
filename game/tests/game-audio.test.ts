import { describe, expect, it, vi } from "vitest";
import { GameAudio, environmentFootSurface, combatFootSurface } from "../src/game-audio";
import type { AudioBus } from "@engine/audio";

describe("game audio", () => {
  it("loads menu sounds first and prepares world sounds when the menu opens", () => {
    const fetches = vi.fn(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }));
    vi.stubGlobal("document", { baseURI: "http://localhost/" });
    vi.stubGlobal("fetch", fetches);
    try {
      const bus = { ctx: { decodeAudioData: () => Promise.resolve({}) }, ui: {}, playMusic: vi.fn(), music: { playing: null } } as unknown as AudioBus;
      const audio = new GameAudio(bus);
      audio.prepare();
      audio.frame("title", 0, 0, 0, false);
      expect(fetches).toHaveBeenCalledTimes(4);
      audio.frame("menu", 0, 0, 0, false);
      const count = fetches.mock.calls.length;
      expect(count).toBeGreaterThan(4);
      audio.frame("menu", 0, 0, 0, false);
      expect(fetches).toHaveBeenCalledTimes(count);
    } finally { vi.unstubAllGlobals(); }
  });
  it("allows a scene to play without music while keeping ambience available", () => {
    const bus = {playMusic:vi.fn(),ctx:null,sfxIn:null,now:0,silent:false,unlocked:true,music:{playing:null}} as unknown as AudioBus;
    const audio = new GameAudio(bus,null);
    audio.frame("playing",.1,0,0,false,"grass",true);
    expect(bus.playMusic).toHaveBeenCalledWith(null);
    expect(audio.status().music).toBeNull();
  });
  it("selects grass, gravel and bridge wood from their visible locations", () => {
    expect(environmentFootSurface(5, 18)).toBe("grass");
    expect(environmentFootSurface(0, 18)).toBe("gravel");
    expect(environmentFootSurface(0, 8)).toBe("wood");
    expect(environmentFootSurface(7.2, 7.3)).toBe("wood");
    expect(environmentFootSurface(-7.2, 8.7)).toBe("wood");
    expect(environmentFootSurface(6.5, -1)).toBe("gravel");
    expect(environmentFootSurface(0, 0)).toBe("gravel");
    expect(combatFootSurface(0, 0)).toBe("gravel");
    expect(combatFootSurface(4, 0)).toBe("grass");
  });
  it("keeps gravel footsteps quiet and rolls off their sharp transient", () => {
    const node = () => ({ connect:vi.fn().mockReturnThis(), disconnect:vi.fn() });
    const filter = {...node(), type:"", frequency:{value:0}, Q:{value:1}};
    const gain = {...node(), gain:{value:0, setValueAtTime:vi.fn(), linearRampToValueAtTime:vi.fn()}};
    const ctx = {currentTime:2, createBufferSource:() => ({...node(),buffer:null,start:vi.fn(),onended:null}), createGain:()=>gain, createBiquadFilter:()=>filter};
    const bus = {ctx,sfxIn:{},now:2,silent:false,unlocked:true,music:{playing:null},playMusic:vi.fn()} as unknown as AudioBus;
    const audio = new GameAudio(bus);
    (audio as unknown as {buffers:Map<string,unknown>}).buffers.set("gravel",{});
    audio.frame("playing",.1,0,0,false,"gravel");
    audio.frame("playing",.1,.8,0,false,"gravel");
    expect(filter.frequency.value).toBe(700);
    expect(filter.Q.value).toBeCloseTo(.55);
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(.75,2.035);
  });
  it("softens and plays the combat impact through a low-pass and short fade", () => {
    const node = () => ({connect:vi.fn().mockReturnThis(),disconnect:vi.fn()});
    const filter={...node(),type:"",frequency:{value:0},Q:{value:1}};
    const gain={...node(),gain:{value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()}};
    const ctx={currentTime:2,createBufferSource:()=>({...node(),buffer:null,start:vi.fn(),onended:null}),createGain:()=>gain,createBiquadFilter:()=>filter};
    const bus={ctx,sfxIn:{},now:2,silent:false} as unknown as AudioBus;
    const audio=new GameAudio(bus);(audio as unknown as {buffers:Map<string,unknown>}).buffers.set("hit",{});audio.impact();
    expect(filter.frequency.value).toBe(1200);expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1,2.012);expect(audio.status().counts.hit).toBe(1);
  });
  it("follows play state and triggers surface footsteps only for real movement", () => {
    const source = () => ({ buffer:null, connect:vi.fn().mockReturnThis(), start:vi.fn(), disconnect:vi.fn(), onended:null });
    const node = () => ({ connect:vi.fn().mockReturnThis(), disconnect:vi.fn() });
    const ctx = { currentTime:0, createBufferSource:source, createGain:() => ({...node(), gain:{value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()}}), createBiquadFilter:() => ({...node(),type:"",frequency:{value:0},Q:{value:1}}) };
    const bus = {ctx, sfxIn:{}, now:0, silent:false, unlocked:true, music:{playing:null}, playMusic:vi.fn()} as unknown as AudioBus;
    const audio = new GameAudio(bus);
    const buffers = (audio as unknown as {buffers:Map<string,unknown>}).buffers;
    buffers.set("grass",{}); buffers.set("wood",{}); buffers.set("gravel",{});
    audio.frame("playing",.1,0,0,false);
    audio.frame("playing",.1,.8,0,false);
    audio.frame("playing",.1,1.6,0,false,"wood");
    audio.frame("playing",.1,2.4,0,false,"gravel");
    expect(audio.status().counts).toMatchObject({grass:1,wood:1,gravel:1});
    audio.frame("playing",.1,10,0,false); // teleport does not play a step
    audio.frame("paused",0,10,0,false);
    audio.frame("playing",.1,10,0,false); // resume starts a fresh stride
    expect(audio.status().counts).toMatchObject({grass:1,wood:1,gravel:1});
    expect(bus.playMusic).toHaveBeenCalledTimes(3);
    expect(vi.mocked(bus.playMusic).mock.calls.map(([track])=>track)).toEqual(["exploration",null,"exploration"]);
  });
  it("plays event cues and keeps ambience positional without stacking loops", () => {
    const node = () => ({connect:vi.fn().mockReturnThis(),disconnect:vi.fn()});
    const sources: Array<{start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>}> = [];
    const gains: Array<{gain:{value:number;setTargetAtTime:ReturnType<typeof vi.fn>}}> = [];
    const ctx = {currentTime:1, createBufferSource:()=>{const source={...node(),buffer:null,loop:false,start:vi.fn(),stop:vi.fn(),onended:null};sources.push(source);return source;}, createGain:()=>{const gain={...node(),gain:{value:0,setTargetAtTime:vi.fn()}};gains.push(gain);return gain;}};
    const bus = {ctx,sfxIn:{},now:1,silent:false,unlocked:true,music:{playing:null},playMusic:vi.fn()} as unknown as AudioBus;
    const audio = new GameAudio(bus);
    const buffers=(audio as unknown as {buffers:Map<string,unknown>}).buffers;
    for(const name of ["stream","fire","gateBreach"]) buffers.set(name,{});
    audio.frame("playing",.1,3.5,20,false,"grass",true);
    expect(audio.status().ambience).toEqual(["stream","fire"]);
    expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0,1,.35);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(1,1,.35);
    audio.frame("playing",.1,0,8,false,"wood",true);
    expect(sources).toHaveLength(2);
    expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(.24,1,.35);
    audio.cue("gateBreach"); expect(audio.status().counts.gateBreach).toBe(1);
    audio.frame("paused",0,0,8,false,"wood",true);
    expect(audio.status().ambience).toEqual([]);
    expect(sources[0].stop).toHaveBeenCalledOnce(); expect(sources[1].stop).toHaveBeenCalledOnce();
    audio.frame("playing",.1,0,8,false,"wood",true);
    expect(audio.status().ambience).toHaveLength(2);
    expect(sources).toHaveLength(5);
    (bus as unknown as {silent:boolean}).silent=true;
    audio.cue("gateBreach"); expect(audio.status().counts.gateBreach).toBe(1);
  });

  it("uses the scene's selected music across pause and resume", () => {
    const bus = {playMusic:vi.fn(),music:{playing:null},ctx:null} as unknown as AudioBus;
    const audio = new GameAudio(bus, "castleAction");
    audio.frame("playing",.1,0,0,false); audio.frame("paused",0,0,0,false); audio.frame("playing",.1,0,0,false);
    expect(vi.mocked(bus.playMusic).mock.calls.map(([track])=>track)).toEqual(["castleAction",null,"castleAction"]);
  });

  it("attenuates nearby combat sounds and drops events outside hearing range", () => {
    const node=()=>({connect:vi.fn().mockReturnThis(),disconnect:vi.fn()});
    const gains:Array<{gain:{linearRampToValueAtTime:ReturnType<typeof vi.fn>}}>=[];
    const ctx={currentTime:1,createBufferSource:()=>({...node(),buffer:null,start:vi.fn(),onended:null}),createBiquadFilter:()=>({...node(),type:'',frequency:{value:0},Q:{value:1}}),createGain:()=>{const gain={...node(),gain:{value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()}};gains.push(gain);return gain;}};
    const bus={ctx,sfxIn:{},now:1,silent:false} as unknown as AudioBus;
    const audio=new GameAudio(bus);
    (audio as unknown as {buffers:Map<string,unknown>}).buffers.set('enemyAttack',{});
    audio.cueAt('enemyAttack',0,0,0,0);ctx.currentTime=1.2;audio.cueAt('enemyAttack',12,0,0,0);audio.cueAt('enemyAttack',21,0,0,0);
    expect(gains).toHaveLength(2);expect(gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(.32,1.02);expect(gains[1].gain.linearRampToValueAtTime).toHaveBeenCalledWith(.16,1.22);
    expect(audio.status().counts.enemyAttack).toBe(2);
  });
  it('softens attacks and avoids stacking identical simultaneous impacts', () => {
    const node=()=>({connect:vi.fn().mockReturnThis(),disconnect:vi.fn()});
    const filters:Array<{frequency:{value:number}}>=[];
    const ramps:Array<ReturnType<typeof vi.fn>>=[];
    const ctx={currentTime:1,createBufferSource:()=>({...node(),buffer:null,start:vi.fn(),onended:null}),createBiquadFilter:()=>{const f={...node(),type:'',frequency:{value:0},Q:{value:1}};filters.push(f);return f;},createGain:()=>{const ramp=vi.fn();ramps.push(ramp);return {...node(),gain:{value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:ramp}};}};
    const bus={ctx,sfxIn:{},now:1,silent:false} as unknown as AudioBus;
    const audio=new GameAudio(bus),buffers=(audio as unknown as {buffers:Map<string,unknown>}).buffers;
    buffers.set('sword',{});buffers.set('hit',{});
    audio.attack(0);audio.combat([{cue:'hit',x:8,z:0},{cue:'hit',x:0,z:0}],0,0);
    expect(filters.map(f=>f.frequency.value)).toEqual([1700,1200]);
    expect(ramps[0]).toHaveBeenCalledWith(.18,1.02);
    expect(ramps[1]).toHaveBeenCalledWith(1,1.012); // closest hit wins
    expect(audio.status().counts.hit).toBe(1);
    ctx.currentTime=1.2;audio.impact();expect(audio.status().counts.hit).toBe(2);
  });

});
