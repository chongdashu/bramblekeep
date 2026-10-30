import { afterEach, describe, expect, it, vi } from "vitest";
import { Weapons } from "../src/weapons";
import config from "../src/equipment-config.json";
import type { ModelRenderer } from "@engine/gpu/model";
import { defaultSocketSettings, readSocketSettings, saveSocketSettings, SOCKET_KEY } from "../src/socket-adjustments";

describe("equipment socket settings", () => {
  it("uses the shared configuration as the default adjustments", () => {
    expect(defaultSocketSettings()).toEqual(config.adjustments);
    const settings=defaultSocketSettings(); settings.arrow.pitch=42;
    expect(config.adjustments.arrow.pitch).not.toBe(42);
  });
  afterEach(() => vi.unstubAllGlobals());
  it("uses safe defaults when storage is unavailable or malformed", () => {
    vi.stubGlobal("localStorage", { getItem: () => "not json", setItem: () => { throw new Error("unavailable"); } });
    expect(readSocketSettings()).toEqual(defaultSocketSettings());
    expect(saveSocketSettings(defaultSocketSettings())).toBe(false);
  });
  it("restores bounded adjustments for each attachment independently", () => {
    const storage=new Map<string,string>();
    vi.stubGlobal("localStorage", {getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)});
    const settings=defaultSocketSettings(); settings.arrow.pitch=37; settings.staff.x=0.1;
    expect(saveSocketSettings(settings)).toBe(true);
    expect(readSocketSettings()).toEqual(settings);
    const freshScene=new Weapons({} as ModelRenderer);
    expect(freshScene.socket("arrow").pitch).toBe(37);
    expect(freshScene.socket("staff").x).toBe(0.1);
    freshScene.resetSocket("arrow");
    expect(freshScene.socket("arrow")).toEqual(defaultSocketSettings().arrow);
    expect(readSocketSettings().staff.x).toBe(0.1);
    storage.set(SOCKET_KEY, JSON.stringify({arrow:{pitch:999,x:-10,y:"bad"}}));
    const restored=readSocketSettings();
    expect(restored.arrow.pitch).toBe(180);expect(restored.arrow.x).toBe(-0.5);expect(restored.arrow.y).toBe(0);
    expect(restored.bow).toEqual(defaultSocketSettings().bow);
  });
});
