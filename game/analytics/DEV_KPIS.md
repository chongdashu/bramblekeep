# Player KPIs in the development preview

Open `http://127.0.0.1:5173`, press **B** to open Debug, then choose
**Metrics → Player KPIs**. The view reads the private Convex report when it
opens or when Refresh is pressed. Choose production live Wavedash traffic,
development playtests, or all development traffic (including tests), a time
window, and an optional exact build label. The current selection and window
are shown with the result.

The report separates page loads from sessions that joined, pseudonymous joined
identities from registered accounts, completed session length from observed
active play, and gate/clear events from sessions that were already past the
objective when they joined. Incomplete sessions can understate active time.
The report reads up to 10,000 events and warns when its window is truncated.
Raw events retain the existing 30-day policy.

The development-only Vite bridge invokes the existing internal
`analytics:report` function with the local Convex CLI's authenticated account.
It selects the target from `release.json` and never sends an admin key to the
browser. Requests require a loopback connection, a localhost host, a same-origin
browser request and a custom header; LAN previews cannot access the private
report. If the report cannot load, check the CLI login and retry. The bridge is
not included in packaged releases and performs no analytics writes.

Relevant checks, in an isolated checkout with WASM built:

```sh
node --test game/tests/player-kpis-dev.test.mjs
node game/tests/player-kpis-debug-browser.mjs
```
