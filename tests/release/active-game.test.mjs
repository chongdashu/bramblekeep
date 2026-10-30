// The active-game resolver (scripts/lib/active-game.mjs): which folder every tool builds,
// serves, packages and tests, and the game.json contract it validates. Also checks that each
// game shipped in this checkout (game/ and every add-on present) is a complete game folder.
//   node --test tests/release/
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ROOT, activeGameDir, gameVitePlugins, inlineBootStyle, loadActiveGame, publicIdentity, validateGameManifest, viteGameConfig } from "../../scripts/lib/active-game.mjs";

let tmp;
const put = async (path, content) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, typeof content === "string" ? content : JSON.stringify(content));
};
const ok = { id: "my-game", title: "Untitled Game", storagePrefix: "my-game", version: "0.1.0" };

before(async () => {
  tmp = await mkdtemp(join(tmpdir(), "vgd-active-game-test-"));
});
after(async () => {
  if (tmp?.includes("vgd-active-game-test-")) await rm(tmp, { recursive: true, force: true });
});

describe("activeGameDir", () => {
  it("reads game.config.json gameDir, defaults to game/, and GAME_DIR overrides both", async () => {
    const root = join(tmp, "dirs");
    await put(join(root, "game.config.json"), { gameDir: "addons/thing" });
    assert.equal(activeGameDir(root, {}), "addons/thing");
    assert.equal(activeGameDir(root, { GAME_DIR: "game/" }), "game");
    assert.equal(activeGameDir(join(tmp, "no-config"), {}), "game");
  });

  it("refuses a folder outside the project", () => {
    assert.throws(() => activeGameDir(tmp, { GAME_DIR: "../elsewhere" }), /GAME_DIR must name a folder inside the project/);
    assert.throws(() => activeGameDir(tmp, { GAME_DIR: "." }), /inside the project/);
  });

  it("names the missing game.json and where the folder came from", async () => {
    const root = join(tmp, "missing");
    await mkdir(join(root, "game"), { recursive: true });
    assert.throws(() => loadActiveGame(root, { GAME_DIR: "game" }), /No game at game\/ \(from GAME_DIR\): game\/game\.json is missing/);
  });
});

describe("validateGameManifest", () => {
  it("fills defaults for the optional sections", () => {
    const m = validateGameManifest(ok);
    assert.deepEqual([m.release, m.preview, m.commands], [{ assets: [] }, { models: [] }, {}]);
    assert.deepEqual(m.platform, { wavedash: { paidContent: false, p2p: false } }, "host services are off unless the game opts in");
  });

  it("reads the host services a game opts into", () => {
    const on = (wavedash) => validateGameManifest({ ...ok, platform: { wavedash } }).platform.wavedash;
    assert.deepEqual(on({ paidContent: true, p2p: true }), { paidContent: true, p2p: true });
    assert.deepEqual(on({ p2p: { messageSize: 8192, maxIncomingMessages: 256 } }), { paidContent: false, p2p: { messageSize: 8192, maxIncomingMessages: 256 } });
    assert.deepEqual(on({ p2p: { unreliable: false } }), { paidContent: false, p2p: { unreliable: false } });
    assert.deepEqual(validateGameManifest({ ...ok, platform: {} }).platform, { wavedash: { paidContent: false, p2p: false } });
  });

  it("refuses host-service settings the host would not take, and typos that would leave a service off", () => {
    const bad = (platform) => () => validateGameManifest({ ...ok, platform }, "x/game.json");
    assert.throws(bad([]), /x\/game\.json "platform" must be an object/);
    assert.throws(bad({ wavedsh: {} }), /"platform" has an unknown key "wavedsh"/);
    assert.throws(bad({ wavedash: { p2P: true } }), /"platform\.wavedash" has an unknown key "p2P"/);
    assert.throws(bad({ wavedash: { paidContent: "yes" } }), /"platform\.wavedash\.paidContent" must be true or false/);
    assert.throws(bad({ wavedash: { p2p: "on" } }), /"platform\.wavedash\.p2p" must be an object/);
    assert.throws(bad({ wavedash: { p2p: { size: 4096 } } }), /"platform\.wavedash\.p2p" has an unknown key "size"/);
    assert.throws(bad({ wavedash: { p2p: { messageSize: 44 } } }), /"platform\.wavedash\.p2p\.messageSize" must be a whole number from 45 to 65536 \(got 44\)/);
    assert.throws(bad({ wavedash: { p2p: { messageSize: 70000 } } }), /messageSize" must be a whole number/);
    assert.throws(bad({ wavedash: { p2p: { maxIncomingMessages: 0.5 } } }), /maxIncomingMessages" must be a whole number from 1/);
    assert.throws(bad({ wavedash: { p2p: { reliable: 1 } } }), /"platform\.wavedash\.p2p\.reliable" must be true or false/);
    assert.throws(bad({ wavedash: { p2p: { reliable: false, unreliable: false } } }), /turns off both channel kinds/);
  });

  it("names the bad field", () => {
    const bad = (patch) => () => validateGameManifest({ ...ok, ...patch }, "x/game.json");
    assert.throws(bad({ id: "My Game" }), /x\/game\.json "id" must match/);
    assert.throws(bad({ title: " " }), /needs a "title"/);
    assert.throws(bad({ storagePrefix: "a b" }), /"storagePrefix" must match/);
    assert.throws(bad({ version: 1 }), /needs a "version"/);
    assert.throws(bad({ release: { assets: "assets/**" } }), /"release\.assets" must be a list of globs/);
    assert.throws(bad({ preview: { models: [{ url: "a.glb" }] } }), /"preview\.models" must be a list of \{ "label", "url" \}/);
    assert.throws(bad({ commands: { assets: "blender" } }), /command "assets" must be a non-empty list/);
    assert.throws(bad({ smoke: 3 }), /"smoke" must be a path/);
    for (const vite of [3, "", "../vite.mjs", "tools/../../x.mjs", "/abs/vite.mjs"]) assert.throws(bad({ vite }), /"vite" must be a path inside the game folder/, JSON.stringify(vite));
    assert.equal(validateGameManifest({ ...ok, vite: "tools/vite.mjs" }).vite, "tools/vite.mjs");
    for (const bootStyle of [3, "", "boot.scss", "../boot.css", "src/../../boot.css", "/abs/boot.css"]) assert.throws(bad({ bootStyle }), /"bootStyle" must be a path inside the game folder to a \.css file/, JSON.stringify(bootStyle));
    assert.equal(validateGameManifest({ ...ok, bootStyle: "src/boot.css" }).bootStyle, "src/boot.css");
    assert.throws(() => validateGameManifest([], "y"), /y must be a JSON object/);
  });
});

describe("viteGameConfig", () => {
  it("aliases @game to the game's entry and @engine to src/, and bundles only the public identity", () => {
    const game = loadActiveGame(ROOT, { GAME_DIR: "game" });
    const g = viteGameConfig(game);
    const alias = (spec) => g.resolve.alias.find((a) => a.find.test(spec));
    assert.equal(alias("@game").replacement, join(ROOT, "game/src/index.ts"));
    assert.equal(alias("@engine/wasm").replacement, `${join(ROOT, "src")}/`);
    assert.equal(alias("@game/other"), undefined, "only the entry module is reachable");
    assert.equal(g.publicDir, join(ROOT, "game/public"));
    const identity = JSON.parse(g.define.__GAME__);
    assert.deepEqual(identity, publicIdentity(game.manifest));
    assert.deepEqual(Object.keys(identity).sort(), ["id", "platform", "preview", "storagePrefix", "title", "version"]);
    assert.deepEqual(identity.platform, { wavedash: { paidContent: false, p2p: false } });
  });
});

describe('game.json "bootStyle"', () => {
  const INDEX = readFileSync(join(ROOT, "index.html"), "utf8");
  const CSS = "html #boot { background: #fbf2da; }\n";
  const game = async (name, css = CSS) => {
    const root = join(tmp, name);
    await put(join(root, "game/game.json"), { ...ok, bootStyle: "src/boot.css" });
    if (css !== null) await put(join(root, "game/src/boot.css"), css);
    return loadActiveGame(root, { GAME_DIR: "game" });
  };
  const transform = (game, html = INDEX) => viteGameConfig(game).plugins.find((p) => p.name === "vgd-active-game-html").transformIndexHtml.handler(html);
  const criticalStyle = (html) => html.match(/<head[\s>][\s\S]*?<style>([\s\S]*?)<\/style>/)[1];

  it("index.html has one <style> block, in its <head>: the critical boot styles the game's are added to", () => {
    assert.equal(INDEX.match(/<style[\s>]/g).length, 1);
    assert.match(criticalStyle(INDEX), /Critical boot styles/);
  });

  it("is added at the end of the critical styles (after the engine's #boot rules), with the title still filled in", async () => {
    const g = await game("boot-style");
    assert.equal(g.bootStylePath, join(tmp, "boot-style/game/src/boot.css"));
    const html = transform(g);
    const style = criticalStyle(html);
    assert.ok(style.indexOf("html #boot { background: #fbf2da; }") > style.indexOf("#boot { position: fixed"), "after the engine's rules");
    assert.equal(html.match(/<style[\s>]/g).length, 1, "no second block");
    assert.match(html, /<title>Untitled Game<\/title>/);
    const plainRoot = join(tmp, "plain-boot-style");
    await put(join(plainRoot, "game/game.json"), ok);
    assert.equal(transform(loadActiveGame(plainRoot, { GAME_DIR: "game" })), INDEX.replaceAll("%GAME_TITLE%", "Untitled Game"), "without bootStyle the page is unchanged");
  });

  it("leaves the separate model preview page alone", async () => {
    const preview = readFileSync(join(ROOT, "preview.html"), "utf8");
    assert.equal(transform(await game("boot-preview"), preview), preview);
  });

  it("is read on every request, so the dev server picks up edits", async () => {
    const g = await game("boot-style-edit");
    assert.match(transform(g), /#fbf2da/);
    await put(join(tmp, "boot-style-edit/game/src/boot.css"), "html #boot { background: #123456; }");
    assert.match(transform(g), /#123456/);
  });

  it("refuses CSS that would close the block, a missing file, and a page with nowhere to put it", async () => {
    const closing = await game("boot-style-close", "a{}</style><script>x()</script>"), missing = await game("boot-style-missing", null);
    assert.throws(() => transform(closing), /"bootStyle" .*must not contain "<\/style"/);
    assert.throws(() => transform(missing), /game\/game\.json "bootStyle" \(game\/src\/boot\.css\) could not be read: not found/);
    assert.throws(() => inlineBootStyle("<html><head><title>x</title></head><body><style>a{}</style></body></html>", CSS), /no <style> block in its <head>/);
  });

  it("reaches the dev server's index.html (vite.config.ts, a throwaway game under the ignored out/)", async () => {
    const dir = "out/test-games/boot-style";
    const abs = join(ROOT, dir);
    await rm(abs, { recursive: true, force: true });
    await put(join(abs, "game.json"), { ...ok, bootStyle: "boot.css" });
    await put(join(abs, "boot.css"), "html #boot { outline: 3px solid #0f0; }");
    const { createServer } = await import("vite");
    const saved = process.env.GAME_DIR;
    process.env.GAME_DIR = dir;
    let server;
    try {
      server = await createServer({ configFile: join(ROOT, "vite.config.ts"), logLevel: "silent", server: { middlewareMode: true, ws: false }, appType: "custom" });
      const html = await server.transformIndexHtml("/", INDEX);
      assert.match(criticalStyle(html), /html #boot \{ outline: 3px solid #0f0; \}/);
    } finally {
      await server?.close();
      if (saved === undefined) delete process.env.GAME_DIR;
      else process.env.GAME_DIR = saved;
      await rm(abs, { recursive: true, force: true });
    }
  });

  it("survives a production build of the page (Vite minifies the block but keeps the game's rules)", async () => {
    const g = await game("boot-style-build", "html #boot { background: url(assets/splash.webp) center / cover; color: #214f44; }");
    const root = join(tmp, "boot-style-build-page");
    // The real page's head, without the engine's module script: this checks Vite's HTML and CSS handling, not the game bundle.
    await put(join(root, "index.html"), INDEX.replace(/<script type="module"[\s\S]*?<\/script>/, ""));
    const { build } = await import("vite");
    const out = await build({ root, configFile: false, logLevel: "silent", base: "./", plugins: viteGameConfig(g).plugins, build: { write: false, rollupOptions: { input: join(root, "index.html") } } });
    const page = [out].flat().flatMap((o) => o.output).find((f) => f.fileName === "index.html").source;
    const style = criticalStyle(page);
    assert.match(style, /#1b2033/, "the engine's critical rules");
    assert.match(style, /html #boot\s*\{[^}]*url\(assets\/splash\.webp\)/, "the game's rules, with a page-relative url() left for the browser");
  });
});

describe("gameVitePlugins (game.json \"vite\")", () => {
  const game = async (name, vite, source) => {
    const root = join(tmp, name);
    await put(join(root, "game/game.json"), { ...ok, ...(vite ? { vite } : {}) });
    if (source) await put(join(root, "game", vite), source);
    return loadActiveGame(root, { GAME_DIR: "game" });
  };

  it("is empty when the game declares none", async () => {
    assert.deepEqual(await gameVitePlugins(await game("vite-none")), []);
  });

  it("takes a default-exported list, flattened, falsy entries dropped", async () => {
    const g = await game("vite-list", "vite.mjs", `export default [{ name: "a" }, false, [{ name: "b" }]];`);
    assert.deepEqual((await gameVitePlugins(g)).map((p) => p.name), ["a", "b"]);
  });

  it("calls a default-exported function with Vite's env and the game", async () => {
    const g = await game("vite-fn", "tools/vite.mjs", `export default async (env) => [{ name: env.command + ":" + env.mode + ":" + env.game.manifest.id }];`);
    assert.deepEqual((await gameVitePlugins(g, { command: "serve", mode: "development" })).map((p) => p.name), ["serve:development:my-game"]);
    assert.deepEqual((await gameVitePlugins(g)).map((p) => p.name), ["build:production:my-game"], "defaults to a production build");
  });

  it("reach vite.config.ts for dev and build (a throwaway game under the ignored out/)", async () => {
    const dir = "out/test-games/vite-plugins";
    const abs = join(ROOT, dir);
    await rm(abs, { recursive: true, force: true });
    await put(join(abs, "game.json"), { ...ok, vite: "vite.mjs" });
    await put(join(abs, "vite.mjs"), `export default ({ command }) => [{ name: "game-own-" + command }];`);
    const { resolveConfig } = await import("vite");
    const saved = process.env.GAME_DIR;
    process.env.GAME_DIR = dir;
    try {
      for (const command of ["serve", "build"]) {
        const cfg = await resolveConfig({ configFile: join(ROOT, "vite.config.ts"), logLevel: "silent" }, command);
        assert.ok(cfg.plugins.some((p) => p.name === `game-own-${command}`), `${command}: the game's plugin is applied`);
        assert.ok(cfg.plugins.some((p) => p.name === "vgd-active-game-html"), `${command}: the engine's own plugin stays`);
      }
    } finally {
      if (saved === undefined) delete process.env.GAME_DIR;
      else process.env.GAME_DIR = saved;
      await rm(abs, { recursive: true, force: true });
    }
  });

  it("names the file when it is missing or exports something else", async () => {
    await assert.rejects(gameVitePlugins(await game("vite-missing", "vite.mjs")), /game\/game\.json "vite" \(game\/vite\.mjs\) not found/);
    await assert.rejects(gameVitePlugins(await game("vite-bad", "vite.mjs", `export default { name: "one" };`)), /must default-export a list of Vite plugins/);
  });
});

describe("the games in this checkout", () => {
  const dirs = ["game", ...(existsSync(join(ROOT, "addons")) ? readdirSync(join(ROOT, "addons"), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(ROOT, "addons", d.name, "game.json"))).map((d) => `addons/${d.name}`) : [])];
  for (const dir of dirs) {
    it(`${dir}/ is a complete game folder with a valid game.json`, () => {
      const game = loadActiveGame(ROOT, { GAME_DIR: dir });
      for (const path of [game.entry, join(game.crateDir, "Cargo.toml"), game.publicDir]) assert.ok(existsSync(path), `${path} exists`);
      if (game.manifest.smoke) assert.ok(existsSync(join(game.abs, game.manifest.smoke)), `${dir}/${game.manifest.smoke} exists`);
      if (game.manifest.vite) assert.ok(existsSync(join(game.abs, game.manifest.vite)), `${dir}/${game.manifest.vite} exists`);
      if (game.manifest.bootStyle) assert.ok(existsSync(game.bootStylePath), `${dir}/${game.manifest.bootStyle} exists`);
      for (const m of game.manifest.preview.models) assert.ok(existsSync(join(game.publicDir, m.url)), `preview model ${m.url} exists in ${dir}/public`);
    });
  }
  it("have distinct ids and storage prefixes (games on one origin never share saves)", () => {
    const ms = dirs.map((dir) => loadActiveGame(ROOT, { GAME_DIR: dir }).manifest);
    assert.equal(new Set(ms.map((m) => m.id)).size, ms.length);
    assert.equal(new Set(ms.map((m) => m.storagePrefix)).size, ms.length);
  });
});
