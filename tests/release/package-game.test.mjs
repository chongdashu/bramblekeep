// The packager's checks against a tiny fixture build (no Vite, no network, no deploys): each
// check must pass a clean package and fail the specific mistake it exists for.
//   node --test tests/release/
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { assemblePackage, globRegex, resolveEnv, runSteps, sourceIdentity, stalePackage, stalePackageEnv, verifyPackage } from "../../scripts/lib/package-game.mjs";
import { loadReleaseConfig } from "../../scripts/lib/release-config.mjs";

const JS = "assets/main-AbCd1234.js";
const CSS = "assets/main-XyZ98765.css";
let tmp;
let n = 0;

const put = async (path, content) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
};

/** A fresh fixture: a compiled build (Vite-shaped) plus a public/ tree, with optional tweaks. */
async function fixture({ html, js, css, extraCompiled = {}, extraPublic = {} } = {}) {
  const base = join(tmp, `case-${++n}`);
  const compiledDir = join(base, "dist");
  const publicDir = join(base, "public");
  const outDir = join(base, "release");
  const viteManifest = { "index.html": { file: JS, isEntry: true, css: [CSS] } };
  await put(join(compiledDir, ".vite/manifest.json"), JSON.stringify(viteManifest));
  await put(join(compiledDir, "index.html"), html ?? `<!doctype html><link rel="stylesheet" href="./${CSS}"><script type="module" src="./${JS}"></script>`);
  await put(join(compiledDir, JS), js ?? `const wasm = new URL("wasm/game.wasm", document.baseURI); fetch(wasm);`);
  await put(join(compiledDir, CSS), css ?? `body{margin:0}`);
  for (const [p, c] of Object.entries(extraCompiled)) await put(join(compiledDir, p), c);
  await put(join(publicDir, "wasm/game.wasm"), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
  await put(join(publicDir, "assets/props/thing.glb"), Buffer.from("glTF fixture"));
  await put(join(publicDir, "review/notes.md"), "not for release");
  for (const [p, c] of Object.entries(extraPublic)) await put(join(publicDir, p), c);
  return { target: "web", compiledDir, publicDir, outDir, assets: ["wasm/*.wasm", "assets/props/**"], meta: { buildId: "fixture-000000000000" } };
}

const rejects = (promise, pattern) => assert.rejects(promise, (e) => (assert.match(e.message, pattern), true));

before(async () => {
  tmp = await mkdtemp(join(tmpdir(), "vgd-release-test-"));
});
after(async () => {
  if (tmp?.includes("vgd-release-test-")) await rm(tmp, { recursive: true, force: true });
});

describe("assemblePackage", () => {
  it("packages a clean build: allowlisted assets only, sha256 manifest outside the upload, verifiable", async () => {
    const f = await fixture();
    const report = await assemblePackage({ ...f, vercel: true });
    const paths = report.files.map((x) => x.path);
    assert.deepEqual(paths.toSorted(), ["assets/props/thing.glb", JS, CSS, "index.html", "wasm/game.wasm"].toSorted());
    assert.ok(!paths.some((p) => p.startsWith("review/")), "non-allowlisted public files stay out");
    const manifest = JSON.parse(await readFile(join(f.outDir, "web-manifest.json"), "utf8"));
    assert.equal(manifest.releaseId, report.releaseId);
    const wasm = await readFile(join(f.outDir, "web/wasm/game.wasm"));
    assert.equal(manifest.files.find((x) => x.path === "wasm/game.wasm").sha256, createHash("sha256").update(wasm).digest("hex"));
    await assert.rejects(stat(join(f.outDir, "web/web-manifest.json")), "the manifest is not inside the upload");
    await verifyPackage(join(f.outDir, "web"), join(f.outDir, "web-manifest.json"));
  });

  it("marks only Vite-fingerprinted files immutable in vercel.json", async () => {
    const f = await fixture({ extraPublic: { "assets/props/keyart-landscape.png": "png" } });
    await assemblePackage({ ...f, vercel: true });
    const config = JSON.parse(await readFile(join(f.outDir, "web/vercel.json"), "utf8"));
    const immutable = config.headers.filter((h) => h.headers.some((x) => x.value.includes("immutable"))).map((h) => h.source);
    assert.deepEqual(immutable.toSorted(), [`/${CSS}`, `/${JS}`].toSorted());
  });

  it("fails on a root-absolute HTML reference", async () => {
    const f = await fixture({ html: `<script type="module" src="/${JS}"></script><link rel="stylesheet" href="./${CSS}">` });
    await rejects(assemblePackage(f), /root-absolute reference \/assets\/main-AbCd1234\.js/);
  });

  it("fails on an HTML reference to a file that is not in the package", async () => {
    const f = await fixture({ html: `<script type="module" src="./${JS}"></script><link rel="icon" href="./icon.png">` });
    await rejects(assemblePackage(f), /references icon\.png, which is not in the package/);
  });

  it("fails on a root-absolute runtime path in a bundle", async () => {
    const f = await fixture({ js: `fetch("/wasm/game.wasm")` });
    await rejects(assemblePackage(f), /root-absolute runtime path \/wasm\//);
    const g = await fixture({ css: `@font-face{src:url(/fonts/x.woff2)}` });
    await rejects(assemblePackage(g), /main-XyZ98765\.css: root-absolute runtime path \/fonts\//);
  });

  it("fails when an allowlist glob matches nothing", async () => {
    const f = await fixture();
    await rejects(assemblePackage({ ...f, assets: [...f.assets, "assets/music/*.ogg"] }), /match nothing.*assets\/music\/\*\.ogg/);
  });

  it("fails when any output file carries the dev-only marker", async () => {
    const f = await fixture({ js: `/* vgd:dev-only */ export const tuningPanel = 1;` });
    await rejects(assemblePackage(f), /main-AbCd1234\.js: contains "vgd:dev-only"/);
  });

  it("fails on a string forbidden for this target", async () => {
    const f = await fixture({ js: `document.documentElement.requestFullscreen()` });
    await rejects(assemblePackage({ ...f, target: "crazygames", forbidden: ["requestFullscreen"] }), /contains "requestFullscreen" \(forbidden for this target\)/);
  });

  it("fails on a file over the per-file size cap", async () => {
    const f = await fixture({ extraPublic: { "assets/props/big.glb": Buffer.alloc(4096) } });
    await rejects(assemblePackage({ ...f, maxFileBytes: 1024 }), /assets\/props\/big\.glb is .* over the .* per-file limit/);
  });

  it("fails on an allowlisted file that is not a runtime type, or a symlink", async () => {
    const f = await fixture({ extraPublic: { "assets/props/source.blend": "blend" } });
    await rejects(assemblePackage(f), /Not a runtime file type.*source\.blend/);
    const g = await fixture();
    await symlink(join(g.publicDir, "wasm/game.wasm"), join(g.publicDir, "wasm/linked.wasm"));
    await rejects(assemblePackage(g), /Unsafe publishing source.*linked\.wasm/);
  });

  it("leaves the previous package untouched when a check fails (staged swap)", async () => {
    const f = await fixture();
    const good = await assemblePackage(f);
    await writeFile(join(f.compiledDir, JS), `/* vgd:dev-only */`);
    await rejects(assemblePackage(f), /vgd:dev-only/);
    const kept = await verifyPackage(join(f.outDir, "web"), join(f.outDir, "web-manifest.json"));
    assert.equal(kept.releaseId, good.releaseId);
  });
});

describe("verifyPackage", () => {
  let f;
  beforeEach(async () => {
    f = await fixture();
    await assemblePackage(f);
  });
  const verify = () => verifyPackage(join(f.outDir, "web"), join(f.outDir, "web-manifest.json"));

  it("fails when a packaged file changed after packaging", async () => {
    await writeFile(join(f.outDir, "web", JS), "tampered");
    await rejects(verify(), new RegExp(`changed ${JS}`));
  });

  it("fails on an unexpected or missing file", async () => {
    await writeFile(join(f.outDir, "web/extra.js"), "x");
    await rm(join(f.outDir, "web/wasm/game.wasm"));
    await rejects(verify(), /unexpected extra\.js[\s\S]*missing wasm\/game\.wasm/);
  });

  it("fails without a manifest", async () => {
    await rejects(verifyPackage(join(f.outDir, "web"), join(f.outDir, "nope.json")), /No package manifest/);
  });
});

describe("sourceIdentity", () => {
  it("names the commit, and adds a hash of the uncommitted bytes when the source is dirty", async () => {
    const repo = join(tmp, "repo");
    await put(join(repo, "src/main.ts"), "export {};\n");
    await put(join(repo, "public/a.glb"), Buffer.from([1, 2, 3]));
    const git = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
    git("init", "-q");
    git("add", ".");
    git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", "fixture");
    const commit = git("rev-parse", "HEAD").stdout.trim();
    const clean = await sourceIdentity(repo, "game", ["src", "public"]);
    assert.deepEqual(clean, { commit, dirty: false, buildId: `game-${commit.slice(0, 12)}` });

    await writeFile(join(repo, "public/a.glb"), Buffer.from([9, 9, 9])); // a binary asset changed
    const dirty1 = await sourceIdentity(repo, "game", ["src", "public"]);
    assert.match(dirty1.buildId, new RegExp(`^game-${commit.slice(0, 12)}-d[0-9a-f]{8}$`));
    await writeFile(join(repo, "public/a.glb"), Buffer.from([7, 7, 7])); // changed again: a different id
    const dirty2 = await sourceIdentity(repo, "game", ["src", "public"]);
    assert.notEqual(dirty2.buildId, dirty1.buildId);
    await put(join(repo, "notes/todo.md"), "outside the source paths");
    assert.equal((await sourceIdentity(repo, "game", ["src", "public"])).buildId, dirty2.buildId);
  });
});

describe("preflight and config", () => {
  it("runs preflight steps and stops on the first failure, naming it and why it exists", () => {
    runSteps([{ name: "ok", run: ["node", "-e", "process.exit(0)"] }], { target: "web", stdio: "ignore" });
    assert.throws(
      () => runSteps([{ name: "analytics-backend-first", why: "the backend must accept this client's events", run: ["node", "-e", "process.exit(3)"] }], { target: "web", stdio: "ignore" }),
      /preflight "analytics-backend-first" failed \(exit 3\); nothing was packaged\.\n  Why this gate exists: the backend/,
    );
    // Target-scoped steps are skipped for other targets.
    runSteps([{ name: "cg-only", targets: ["crazygames"], run: ["node", "-e", "process.exit(1)"] }], { target: "web", stdio: "ignore" });
  });

  it("resolves per-target env from literals or the shell, refusing non-VITE keys and missing required values", () => {
    process.env.VGD_TEST_KEY = "abc";
    assert.deepEqual(resolveEnv({ VITE_PLATFORM: "web", VITE_KEY: { fromEnv: "VGD_TEST_KEY" }, VITE_OPT: { fromEnv: "VGD_UNSET_KEY", optional: true } }), { VITE_PLATFORM: "web", VITE_KEY: "abc", VITE_OPT: "" });
    assert.throws(() => resolveEnv({ VITE_KEY: { fromEnv: "VGD_UNSET_KEY" } }), /needs VGD_UNSET_KEY/);
    assert.throws(() => resolveEnv({ SECRET: "x" }), /VITE_\* names/);
    delete process.env.VGD_TEST_KEY;
  });

  it("matches globs within and across path segments", () => {
    assert.ok(globRegex("wasm/*.wasm").test("wasm/game.wasm"));
    assert.ok(!globRegex("wasm/*.wasm").test("wasm/sub/game.wasm"));
    assert.ok(globRegex("assets/props/**").test("assets/props/a/b.glb"));
    assert.ok(!globRegex("assets/props/**").test("assets/propsX/b.glb"));
  });

  it("keeps the asset allowlist and web root out of deploy/release.json (they belong to the game)", async () => {
    const root = join(tmp, "moved-keys");
    await put(join(root, "deploy/release.json"), JSON.stringify({ assets: ["x/**"], targets: {} }));
    await rejects(loadReleaseConfig(root), /"assets" belongs to the game now: set "release.assets" in <gameDir>\/game.json/);
  });

  it("names the allowlist's source when a glob matches nothing", async () => {
    const f = await fixture();
    await rejects(assemblePackage({ ...f, assets: ["assets/music/*.ogg"], assetsFrom: 'game/game.json "release.assets"' }), /^game\/game\.json "release\.assets": entries match nothing/);
  });

  it("the shipped deploy/release.json is valid and pins an adapter per target", async () => {
    const cfg = await loadReleaseConfig();
    for (const name of ["web", "wavedash", "crazygames"]) assert.equal(cfg.targets[name].env.VITE_PLATFORM, name);
    assert.ok(cfg.targets.crazygames.forbidden.includes("requestFullscreen"), "CrazyGames prohibits custom fullscreen buttons");
    assert.equal(cfg.devMarker, "vgd:dev-only");
  });
});

describe("stalePackage", () => {
  it("detects a changed build-time endpoint even when the source commit is unchanged", () => {
    const report = { target: "wavedash", env: { VITE_COLYSEUS_URL: "https://staging.example" } };
    assert.equal(stalePackageEnv(report, { VITE_COLYSEUS_URL: "https://staging.example" }), null);
    assert.match(stalePackageEnv(report, { VITE_COLYSEUS_URL: "https://production.example" }), /different VITE_COLYSEUS_URL/);
    assert.match(stalePackageEnv(report, { VITE_COLYSEUS_URL: "" }), /package:wavedash/);
  });
  const report = { target: "wavedash", buildId: "game-aaaaaaaaaaaa" };
  it("accepts a package made from the current source", () => {
    assert.equal(stalePackage(report, { commit: "a".repeat(40), buildId: "game-aaaaaaaaaaaa" }), null);
  });
  it("refuses a package from an earlier commit or from different uncommitted changes", () => {
    assert.match(stalePackage(report, { commit: "b".repeat(40), buildId: "game-bbbbbbbbbbbb" }), /package:wavedash/);
    assert.match(stalePackage(report, { commit: "a".repeat(40), buildId: "game-aaaaaaaaaaaa-d1234abcd" }), /allow-stale/);
  });
  it("has nothing to compare without git", () => {
    assert.equal(stalePackage(report, { commit: null, buildId: "game-nogit-dxyz" }), null);
  });
});
