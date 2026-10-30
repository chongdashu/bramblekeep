# Achievements and battle wins

The castle server records each player's Bloom, Bramble, Mushroom and Stump
defeats, and unlocks milestones at 5, 10, 50 and 100 of each. Winning the
castle awards milestones at 1, 5, 10, 50 and 100 victories. The player who
lands the final guardian hit also earns **The finishing blow**. AI teammates
do not earn player achievements.

Progress is keyed by the authenticated player identity and stored on the
server's persistent volume. The game can show it even when Wavedash services
are unavailable. Historic battle wins are recovered from `results.jsonl`;
enemy types and final hits were not recorded previously, so those counters
start when this feature is deployed. A departed participant still receives a
win when the shared round is completed, once per player and round.

The Wavedash achievements use the identifiers and descriptions in
`src/achievements.ts`. The visible `battle_wins` leaderboard ranks higher
lifetime win totals first. On profile refresh the client mirrors earned
achievements and the server's win count to Wavedash; unsuccessful platform
requests are retried on a later refresh. The in-game leaderboard is built from
server results. Wavedash's leaderboard accepts SDK submissions from clients,
so it is not an independently verified anti-cheat leaderboard.

An embedded signed-out visitor can receive a Wavedash guest identity, but a
valid gameplay token does not prove an account is registered. Wavedash does
not document a way to merge a guest identity into a later account, and browser
privacy settings can produce a different identity in another embed. Do not
promise that guest achievements will transfer after sign-in. Playtest and
production use separate Wavedash identities and separate server storage.
