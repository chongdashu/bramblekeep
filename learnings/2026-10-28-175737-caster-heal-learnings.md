# Spellcaster healing learnings

The caster selects Attack or Heal with on-screen buttons or desktop keys 1 and 2. Heal restores one health to each nearby living connected ally, including the caster, has a six-second cooldown, cannot pass through walls or revive, and produces green effects. The server owns eligibility, health and cooldown; solo heals the player. Rapid attack taps are buffered until the next multiplayer input send.

The isolated build, server typecheck and 480 tests passed. A committed-client browser fixture used actual touch input to select and cast, checked caster and ally health, cooldown and switching, and checked keyboard selection. Portrait 390×844 and short landscape 844×390 were exercised at DPR 1. The fixture intentionally sets health; it is not a complete playthrough or physical-device test. No matched visual reference exists for the controls, and balance remains open to human playtesting.

[Prompt](../prompts/2026-10-28-175737-caster-heal-prompts.md) · [Plan](../plans/2026-10-28-175737-caster-heal-plan.md)
