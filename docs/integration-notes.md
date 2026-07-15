# Integration and E2E Notes

## Version matrix

| Surface | Current SDK target |
| --- | ---: |
| npm package | `0.2.1` |
| Workshop `postMessage` protocol | `1` |
| Workshop manifest schema | `2` |
| JavaScript build target | ES2020 |
| Steam App ID | `4007690` |

Do not use one version number as a substitute for another. A schema v2 HUD still receives protocol v1 messages.

## Parent/child origin model

The game parent and Workshop HUD are served from distinct loopback hostnames. The development equivalent is:

- DevTools parent: `http://localhost:8080/devtools/index.html`
- Static HUD child: `http://127.0.0.1:8080/template-workshop/index.html`

The DevTools iframe uses `sandbox="allow-scripts allow-same-origin"`, rejects a same-origin child URL, checks `event.source`/origin, and targets messages to the loaded HUD origin.

The official HUD templates add production CSP with `connect-src 'none'`. Static manifest metadata is therefore a local `manifest.js`; Vue imports `manifest.json` at build time. No official release HUD fetches metadata at runtime.

## Snapshot semantics

`hud:attribute_update.data` always exposes these scopes:

```ts
{
  global: Record<string, number>;
  player: Record<string, number>;
  battle: Record<string, number>;
  base: Record<string, Record<string, number>>;
  playerBattle: Record<number, Record<string, number>>;
}
```

Updates are complete snapshots. Framework stores must replace all five scopes, not merge only keys present in the previous state.

The `base` scope is not a general entity collection. It currently contains the two main bases keyed by `G_BaseId_0 + teamId`; no outpost, buff-station, or zone maps are appended.

## Protocol provenance

Public FBS files and generated products are linked by [`../schemas/source.json`](../schemas/source.json). The canonical release checks are:

```powershell
npm run protocol:verify
npm run typecheck
npm run build
npm run test:runtime
npm run test:consumer
```

Generated artifacts:

- [`../schemas/fbs/`](../schemas/fbs/) — raw source
- [`../src/protocol/generated/`](../src/protocol/generated/) — TypeScript
- [`../protocol/protocol-reference.json`](../protocol/protocol-reference.json) — machine index
- [`generated/fbs-reference.md`](generated/fbs-reference.md) — human reference

## Static asset synchronization

Static templates vendor the UMD bundle so a copied or uploaded directory is self-contained:

```powershell
npm run workshop:sync
npm run workshop:check
```

The check compares SHA-256 of every vendored UMD with `dist/workshop.umd.js` and verifies `manifest.js` against `manifest.json`.

## Release validation

```powershell
pwsh -NoProfile -File .\scripts\validate-workshop-hud.ps1 `
  -ContentFolder .\publish-test
```

The validation scope is intentionally HUD-only. It rejects map/gamemode capabilities, external resources, inline scripts, unsafe entries, missing assets, and release HTML without `connect-src 'none'`.

## Conformance HUD diagnostics

`publish-test` exposes a read-only `window.__GESTALT_HUD_DIAGNOSTICS__` object for Steam E2E. It contains:

- manifest `name` and `version`;
- `initReceived`, `readySent`, `updateCount`, `lastUpdateAt`, `lastMapId`;
- counts for the five snapshot scopes;
- local core signals for health, max health, four ammo families, game time, match status, and team;
- transport counters/timing under `transport`, plus the stable E2E aliases
  `lastSequence` and `lastTransportLatencyMs`;
- a bounded list of runtime error messages.

The object is local to the HUD window and is never transmitted over the network. `updateCount` increases per snapshot and `lastUpdateAt` uses the monotonic `performance.now()` clock. The conformance HUD also sends the same bounded snapshot to its parent through the public `hud:debug_log` postMessage channel every five seconds. Hosts may choose to relay those records, but the current Shipping host does not write them to the UE log, so release acceptance must not depend on `GESTALT_HUD_E2E` log records.

CEF remote debugging is intentionally unavailable in Shipping builds. The Shipping acceptance harness therefore combines three independent observations: Workshop selection evidence from the new game-log window, a trusted local `HUDBridge`/`AttributeStore` probe against the dynamically announced loopback WebSocket port, and a screenshot of the real game window. The trusted probe lives in SDK test tooling only and is never included in uploaded Workshop content.

This triangulation does not claim to intercept the Shipping iframe's `hud:attribute_update` message. Browser contract tests directly exercise the Workshop `postMessage` v1 path; the Shipping probe independently reconstructs the same match's source attribute chain while the log and screenshot prove that the selected Workshop HUD was loaded and rendered.

The full built-in map matrix can force a real Infantry combat payload instead of accepting observer defaults:

```powershell
pwsh -NoProfile -File .\scripts\run-steam-workshop-e2e.ps1 `
  -MapIds @(2,3,4,5,6,7,8) -Mode Log `
  -CareerId 1003 -EntityId 66000002 `
  -StabilitySeconds 60 -TimeoutSeconds 180 `
  -InterMapDelaySeconds 15 -ForceStopExisting
```

With the paired career/entity arguments, the runner explicitly respawns standalone player `0` into a validated team slot before requiring Health, HealthMax, BulletType, and active-ammo keys. Leaving both arguments at zero exercises the observer path, where an entirely absent combat payload is valid but a partially present one is not.

## Steam acceptance sequence

1. Dry-run and inspect staged content/VDF.
2. Upload as Private to an explicit Item ID.
3. Confirm Steam client subscription/download for the signed-in account.
4. Compare installed Workshop content with staging hashes.
5. Launch App `4007690` through Steam.
6. Enter the test map and inspect the HUD iframe via CDP in a development build. For Shipping, capture the game window and run the trusted local WebSocket probe while checking Workshop state, manifest, and selected-path evidence from the same launch's log window.
7. Assert the requested map, increasing protocol updates, non-empty expected scopes, finite core signals, no RPC errors, the expected Workshop release, and a rendered HUD screenshot.
8. Exercise map/load/restart and built-in HUD fallback behavior.
9. Promote visibility only after the private build passes.

The existing official candidate ID is `3698375578`, but every update command must name it explicitly.

## Known public boundary

The root WebSocket bridge is a trusted-tool API and should not appear in a Workshop bundle. Steam HUD conformance tests should fail a release containing WebSocket/HTTP endpoints or lacking `connect-src 'none'`.
