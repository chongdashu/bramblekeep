# Tree LOD and castle depth learnings

Related records:
- `plans/2026-10-27-230416-tree-lod-castle-depth-plan.md`
- `prompts/2026-10-27-230416-tree-lod-castle-depth-prompts.md`

## Outcome

Four Blender comparisons showed strong foliage damage at aggressive ratios; 40% retained a more recognizable silhouette. The existing textured tree went from 10,370 to 4,148 declared triangles and the LOD GLB is 2,378,800 bytes. The renderer shares the LOD geometry and textures across 125 placements, including a dedicated boundary row behind camp. It still submits separate model draws: this is not hardware instancing. The distant LOD still looks jagged from close up.

The castle has roughly 20 × 20 metres of enclosed courtyard footprint, with collision on side and rear walls, rear towers and a second keep. The gate remains closed and the courtyard is a visual blockout; the interior and combat are not playable. The visible courtyard area is reduced by the rear keep and has not been tested with 20–30 networked players.

At revision `75aef0b`, the isolated build and 266 game tests passed. Browser checks passed on WebGPU and WebGL2 at desktop, emulated portrait and short landscape, including the bridge route, forest counts and rear boundary. A 3-second WebGPU requestAnimationFrame sample on this desktop at 1280 × 720 reported 60 fps; it is not a GPU benchmark or physical-mobile measurement. The earlier test of `0805af8` initially failed because a parallel river crossing asset was absent from that revision; `0186f17` subsequently tracked it and checks passed at `75aef0b`. No paid generation was used.

The original concept cameras are unknown, so reference comparison remains approximate. Tree placement still repeats a single source tree; the courtyard, walls, ground and water need further art work. Tree LODs do not sway. The previously seen bright shape at an orbited night camera remains unresolved.
