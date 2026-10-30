// Repository hygiene: nothing tracked may also be ignored. A generated file force-added once (a game's sim.wasm, say) stays tracked
// despite .gitignore, so every rebuild shows as a change and stale builds ship from clean checkouts.
// Skipped outside a Git checkout (a clean export) or without git.
//   node --test tests/release/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { ROOT } from "../../scripts/lib/active-game.mjs";

const git = (...args) => spawnSync("git", ["-C", ROOT, ...args], { encoding: "utf8" });
const inside = git("rev-parse", "--is-inside-work-tree");
const checkout = !inside.error && inside.status === 0 && inside.stdout.trim() === "true";

describe("repository hygiene", () => {
  it("tracks no file that .gitignore ignores", { skip: checkout ? false : "not a Git checkout" }, () => {
    const r = git("ls-files", "-ci", "--exclude-standard");
    assert.equal(r.status, 0, r.stderr);
    const files = r.stdout.split("\n").filter(Boolean);
    assert.deepEqual(files, [], `tracked but ignored (untrack with \`git rm --cached -- <path>\`, or stop ignoring them): ${files.join(", ")}`);
  });
});
