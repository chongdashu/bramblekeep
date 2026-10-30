# Scout Arrows Learnings

Related records: `prompts/2026-10-28-080302-scout-arrows-prompts.md` and `plans/2026-10-28-080302-scout-arrows-plan.md`.

Shots originate from the rendered hand socket, and the nocked arrow disappears at release. Arrows persist for four seconds, follow a living target, and stop following when it disappears; the visual pool is capped at twelve. The scout sees dotted aim marks and a snap marker, with target selection blocked by walls. Unit tests cover selection, wall blocking, sticking, moving targets, expiration and the pool limit; a real browser run verified targeting, impact and expiry. The initial cream marker blended into the path; a cyan treatment improved contrast.

The hand position uses the previous rendered pose and falls back to the player centre before the first pose. A marker is a ground-space guide rather than a ballistic prediction, and the small embedded arrow still needs visual review at phone size. The runtime screenshots have no matched-camera concept reference; the look review remains open.
