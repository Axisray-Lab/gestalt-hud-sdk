# Changelog

All notable changes to the Gestalt HUD SDK are documented here.

## [0.2.1] - 2026-07-15

- Added optional sequence and send-time metadata to Workshop attribute snapshots without breaking protocol v1 hosts.
- Filtered duplicate and backward sequenced snapshots and exposed read-only transport diagnostics and callback metadata.
- Added a latency-aware interpolated countdown clock and refreshed the example HUD to avoid redundant DOM writes.
- Expanded runtime and packed-consumer coverage for legacy messages, ordering, latency metadata, and countdown interpolation.

## [0.2.0] - 2026-07-14

- Vendored the complete public FBS protocol source and added deterministic TypeScript, JSON, and Markdown generation.
- Expanded the public attribute and protocol surface to the current local game/UI contract.
- Updated Workshop HUD manifest validation to schema v2 while retaining v1 HUD compatibility.
- Hardened the `postMessage` bridge and aligned the trusted, experimental direct-WebSocket client with current RPC methods and lifecycle behavior.
- Refreshed static and Vue Workshop templates, CSP defaults, diagnostics, package validation, and Steam upload tooling.
- Added runtime, strict packed-consumer, Workshop asset, template build, and CI coverage.

[0.2.1]: https://github.com/Axisray-Lab/gestalt-hud-sdk/releases/tag/v0.2.1
[0.2.0]: https://github.com/Axisray-Lab/gestalt-hud-sdk/releases/tag/v0.2.0
