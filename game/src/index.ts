import "./style.css";
import "./menu-polish.css";
import type { Game, GameModule } from "@engine/game";
import { StarterGame } from "./game";
import { CastleGame } from "./castle-game";
import { MultiplayerGame } from "./multiplayer-game";
import { CharacterLab } from "./scenes/character";
import { EquipmentPreview } from "./scenes/equipment";
import { EnvironmentScene } from "./scenes/environment";
import { HUD_OVERLAY, HUD_TOP } from "./hud";
import { ABI, PARAMS } from "./sim-abi";
import { SCENE_LINKS } from "./scene-menu";
import { analytics } from "./analytics";

// Direct scene links opt into the engine's ordinary autostart flow before it reads the URL.
const scene = import.meta.env.DEV && typeof window !== "undefined" ? new URL(location.href).searchParams.get("scene") : null;
if (typeof window !== "undefined") {
  document.body.dataset.scene = scene ?? "gym";
  const url = new URL(location.href);
  if (import.meta.env.DEV && !url.searchParams.has("menu") && ["gym", "greybox", "character", "equipment", "environment", "multiplayer", "solo"].includes(url.searchParams.get("scene") ?? "")) { url.searchParams.set("autostart", ""); history.replaceState(null, "", url); }
  if (import.meta.env.DEV && url.searchParams.get("scene") === "viewer") location.replace("./preview.html");
}

function createGame(): Game {
  analytics.platformReady();
  const play: Game = scene === "character" ? new CharacterLab() : scene === "equipment" ? new EquipmentPreview() : scene === "environment" ? new EnvironmentScene() : (scene === "greybox" || scene === "gym") ? new StarterGame() : scene === "solo" ? new CastleGame() : new MultiplayerGame();
  if (import.meta.env.DEV) {
    const actions = play.debugActions?.bind(play);
    play.debugActions = () => [...(actions?.() ?? []), {
      group: "Metrics", label: "Player KPIs", title: "Read the private Convex player analytics report",
      run: () => { void import("./dev/player-kpis").then(({ openPlayerKpis }) => openPlayerKpis()); },
    }];
  }
  return play;
}

const game: GameModule = {
  abi: ABI, create: createGame,
  startTransition: "cut",
  tagline: "Storm the castle that grows back",
  hud: { top: HUD_TOP, overlay: HUD_OVERLAY }, help: false, params: PARAMS,
  audio: { tracks: {
    menuTheme: { url:"assets/audio/siege_approach.mp3", loopStart:1, loopEnd:24, gain:0.30 },
    exploration: { url:"assets/audio/exploration.mp3", loopStart:1, loopEnd:42, gain:0.42, preload:false },
    castleCamp: { url:"assets/audio/siege_camp.mp3", loopStart:1, loopEnd:42, gain:0.32 },
    castleAction: { url:"assets/audio/siege_approach.mp3", loopStart:1, loopEnd:24, gain:0.30, preload:false },
    castleCombat: { url:"assets/audio/siege_combat.mp3", loopStart:1, loopEnd:24, gain:0.25, preload:false },
    castleClimax: { url:"assets/audio/siege_breach.mp3", loopStart:1, loopEnd:24, gain:0.25, preload:false },
    castleCore: { url:"assets/audio/siege_core.mp3", loopStart:1, loopEnd:24, gain:0.25, preload:false },
    castleCritical: { url:"assets/audio/siege_critical.mp3", loopStart:1, loopEnd:24, gain:0.25, preload:false },
    castleVictory: { url:"assets/audio/siege_victory.mp3", loopStart:1, loopEnd:16, gain:0.25, preload:false },
  }, volumes: { music:0.55, sfx:0.8 } },
  actions: { attack: ["Space", "Mouse:0", "Pad:0"], sprint: ["ShiftLeft", "ShiftRight", "Pad:4"], jump: ["KeyJ"], allies: ["KeyN"], class: ["KeyQ"], reset: ["KeyR"], bounds: ["KeyC"] },
  buttons: [{ action: "sprint", label: "Run", title: "Hold to run" }, { action: "attack", label: "Attack", size: "large" }],
  rig: { yaw: Math.PI, pitch: 23 * Math.PI / 180, fovY: 65 * Math.PI / 180, portraitWidth: 10, landscapeHeight: 10 },
  // The shell creates these entries; the game replaces them with direct links on load.
  menu: { extra: import.meta.env.DEV ? SCENE_LINKS.map(({ id, label }) => ({ id, label, body: "" })) : [] },
};
export default game;
