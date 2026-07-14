# Public FBS protocol schemas

This directory contains the public Robot Bridge Demo FlatBuffers schema surface
used by the Gestalt HUD SDK. The seven files under `fbs/` are vendored from
`gestalt_system/TypeScript/RobotBridgeDemo/FBS` at the exact upstream commit
recorded in `source.json`.

The protocol declarations and numeric identifiers are public SDK material. They
are distributed under this repository's `LICENSE`; copyright remains with
AXISRAY Lab Inc. The SDK copies normalize line endings to LF, replace legacy
internal-only header wording, and repair Latin-1/UTF-8 mojibake in comments only.
Enum names and numeric value tokens remain unchanged. `source.json` records both
the untouched upstream Git-blob SHA-256 and the normalized/public vendored
SHA-256 for every file. Git blob bytes are used so the upstream hash is
independent of checkout line-ending conversion.

Do not edit generated TypeScript, JSON, or Markdown outputs. To change the public
protocol snapshot:

1. Replace all seven files in `schemas/fbs/` from one committed upstream
   `gestalt_system` revision.
2. Update `schemas/source.json` with that revision and both sets of SHA-256
   values.
3. Run `node scripts/generate-fbs-protocol.mjs`.
4. Run `node scripts/generate-fbs-protocol.mjs --verify` in CI.

Generated outputs:

- `src/protocol/generated/fbs-enums.ts` — public TypeScript enums.
- `src/protocol/generated/fbs-types.ts` — metadata/index types and source info.
- `protocol/protocol-reference.json` — machine-readable complete enum index.
- `docs/generated/fbs-reference.md` — human-readable protocol reference.

The schema files define numeric protocol contracts only. Their presence does not
grant a Workshop HUD access to privileged game APIs; runtime capabilities remain
subject to the Workshop bridge and host policy.
