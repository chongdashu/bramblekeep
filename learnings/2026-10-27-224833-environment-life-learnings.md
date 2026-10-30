# Environment life learnings

Related records:
- `plans/2026-10-27-224833-environment-life-plan.md`
- `prompts/2026-10-27-224833-environment-life-prompts.md`

## Outcome

The Knight, Spellcaster and Scout idle in the environment. A selector and Release/Possess button choose the controlled character; free movement pans the camera when released. Positions are retained when switching. Day-to-night blends sky and light, campfire and bridge lanterns have adjustable local lights, wind rocks the trees, chips simulate drifting leaves, and extra cloud puffs move with wind. Speed is adjustable. Existing controls cover sun direction and elevation, camera orbit and pitch, haze, global shading and post-processing. Settings are saved locally.

The work is a prototype rather than finished look development. Tree wind moves whole trees, leaves are simple chips, the fixed sky clouds are not controlled by the extra-cloud slider, and there are no separate editable grass or tree shaders. Night still has bright fixed clouds, and a large white shape appeared at one orbited night camera angle; removing the old cloud geometry did not resolve it. The terrain, water and materials remain simpler than the concept; no precise concept-camera match is available. Main-game combat remains separate.

Revision `1770862` passed build and 261 game tests. Both WebGPU and WebGL2 browser tests passed at `9d0588f` on desktop, emulated portrait and short landscape, including movement, camera, switching and stored lighting; the later removal and restoration of clouds result in the same runtime as `9d0588f`. Physical devices have not been checked.
