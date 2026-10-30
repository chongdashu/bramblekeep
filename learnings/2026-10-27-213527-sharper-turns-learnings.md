# Sharper turns learnings

Related records:
- `plans/2026-10-27-213527-sharper-turns-plan.md`
- `prompts/2026-10-27-213527-sharper-turns-prompts.md`

## Context

The user still experienced wide turns and asked about the expanded map.

## What happened

The integrated character's visual turn response increased from 12 to 36, still using shortest-arc smoothing. The character test scene now redirects movement immediately on input change while preserving speed acceleration; its default turn response was also increased. The character-lab settings key was versioned so old saved defaults do not mask the new response. Real-input checks exercise a reversal and a perpendicular turn, including a guard against continuing along the old direction.

The game is still the compact approximately 15 × 20 m camp-to-castle slice. The larger world concepts were not built, following the user's feedback that they were too large; networking and population scaling also remain future work.

## Verification

At `25b9c81` an isolated build, Rust workspace, 258 game tests and skill sync check passed. Desktop real-input turn and character-lab tests passed, along with menu layout on emulated portrait and short landscape. Packaged WebGPU/WebGL2 desktop and emulated-phone smoke passed against the same revision. Two Rust documentation examples are ignored; physical-device and subjective feel review remain open. The updated build is served on `http://localhost:5173/`.
