# Guardian recovery release learnings

Published source `932aa7b31c5f6cde0ce8be0d7f28490a98a8aacc`. Existing coordinated bots and defender changes were already in that release lane; unrelated in-progress bot/chat changes in the shared checkout were not shipped. The boss is bounded to the courtyard in this revision.

The isolated candidate passed build, server typecheck, 494 tests, 55 release tests, packaged WebGL 2 desktop and emulated-phone smoke, bundled server and nested Wavedash package checks. The old smoke driver was repaired to exercise the current multiplayer game and its isolated fixture. WebGPU smoke was not run.

Playtest Railway deployment `f06e2f81-d34e-4ab8-9262-3ec781f57228` and production `db1ba6fb-31e0-4c8b-aca6-49afe056868e` were healthy. Playtest Wavedash build `mn7bndjjydkhvkz2y72c342k2d8h5b3k` was joined by the owner. Public build `mn79ak5hyx6fakz2dm5grgmczd8h57g0`, publication `rx75g3q4b2z7jdr31mnm379ecn8h4d4h`, reported the expected build and successfully joined production. Fresh analytics reported a joined session for that build. The hosted boss defeat and next-round cycle and two distinct accounts were not verified in this rollout.

[Prompt](../prompts/2026-10-28-194407-guardian-release-prompts.md) · [Plan](../plans/2026-10-28-194407-guardian-release-plan.md)
