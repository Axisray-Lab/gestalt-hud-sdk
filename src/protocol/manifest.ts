/**
 * Steam Workshop mod manifest schema.
 *
 * Manifest schema version 2 extends the original HUD-only format with map and
 * gamemode capabilities. A v1 manifest remains valid and defaults to a HUD mod.
 * Manifest schema versioning is independent from the HUD postMessage protocol.
 */

export const WORKSHOP_MANIFEST_SCHEMA_VERSION = 2;

export type WorkshopModCapability = 'hud' | 'map' | 'gamemode';

/** Map capability payload. Required when `provides` contains `"map"`. */
export interface WorkshopModMapSection {
  /** Relative path to a cooked `.pak`; omit for loose `Content/` dev assets. */
  asset_pak?: string;
  /** Absolute UE package path, or a path relative to the mod mount root. */
  default_level: string;
  /**
   * @deprecated The current host ignores this value and derives a stable
   * dynamic map ID from the Steam Workshop item ID.
   */
  map_id?: number;
  /** Optional stable UE mount-root name. */
  mount_root?: string;
}

/** Gamemode capability payload. Required when `provides` contains `"gamemode"`. */
export interface WorkshopModGamemodeSection {
  /** Relative path to the compiled IIFE JavaScript bundle. */
  bundle: string;
  /**
   * Optional authoring metadata. Reserved by the schema; the current host does
   * not consume or enforce this JSON Schema at runtime.
   */
  params_schema?: Record<string, unknown>;
  /**
   * Optional authoring metadata reserved for future negotiation. The current
   * host does not consume or enforce these capabilities.
   */
  required_capabilities?: string[];
}

export interface WorkshopModManifest {
  /** Manifest/SDK schema targeted by this mod. Defaults to 1 when omitted. */
  sdk_version?: 1 | 2;
  name: string;
  version: string;
  author: string;
  description: string;
  /** Omit or use `[]` for all maps. */
  compatible_maps?: string[];
  /** Omit to default to `["hud"]` for v1 compatibility. */
  provides?: WorkshopModCapability[];
  /** HUD HTML entry point. Defaults to `index.html`. */
  entry?: string;
  /** Required for v2 map/gamemode content. */
  engine_version?: string;
  map?: WorkshopModMapSection;
  gamemode?: WorkshopModGamemodeSection;
}

/** Backward-compatible name used by HUD-only SDK v0.1 consumers. */
export type WorkshopManifest = WorkshopModManifest;
/** Alias matching the host protocol source. */
export type WorkshopHUDManifest = WorkshopModManifest;

export type NormalizedWorkshopModManifest = Omit<
  WorkshopModManifest,
  'sdk_version' | 'provides' | 'entry'
> & {
  sdk_version: 1 | 2;
  provides: WorkshopModCapability[];
  entry: string;
};

export type WorkshopManifestValidationResult =
  | { valid: true; manifest: NormalizedWorkshopModManifest }
  | { valid: false; errors: string[] };

const VALID_PROVIDES = [
  'hud',
  'map',
  'gamemode',
] as const satisfies readonly WorkshopModCapability[];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasUnsafeRelativePath(path: string): boolean {
  const normalized = path.trim();
  return (
    normalized.startsWith('/') ||
    normalized.startsWith('\\') ||
    /^[A-Za-z]:[\\/]/.test(normalized) ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized) ||
    normalized.split(/[\\/]/).includes('..')
  );
}

/**
 * Validate and normalize an unknown `manifest.json` value.
 *
 * The rules mirror the current game host:
 * - a missing `sdk_version` is v1;
 * - a missing `provides` is `["hud"]`;
 * - map/gamemode capabilities require schema v2 and `engine_version`;
 * - unknown top-level fields are ignored for forward compatibility.
 */
export function validateManifest(
  raw: unknown,
): WorkshopManifestValidationResult {
  const errors: string[] = [];

  if (!isObject(raw)) {
    return { valid: false, errors: ['Manifest must be a JSON object'] };
  }
  const obj = raw;

  let sdkVersion: 1 | 2 = 1;
  if ('sdk_version' in obj) {
    if (typeof obj.sdk_version !== 'number' || !Number.isInteger(obj.sdk_version)) {
      errors.push('sdk_version must be an integer');
    } else if (obj.sdk_version !== 1 && obj.sdk_version !== 2) {
      errors.push(`sdk_version must be 1 or 2 (got ${obj.sdk_version})`);
    } else {
      sdkVersion = obj.sdk_version;
    }
  }

  for (const field of ['name', 'version', 'author', 'description'] as const) {
    if (!isNonEmptyString(obj[field])) {
      errors.push(`${field} must be a non-empty string`);
    }
  }

  if ('compatible_maps' in obj) {
    if (!Array.isArray(obj.compatible_maps)) {
      errors.push('compatible_maps must be an array of non-empty strings');
    } else if (
      obj.compatible_maps.some((value) => !isNonEmptyString(value))
    ) {
      errors.push('compatible_maps must contain only non-empty strings');
    }
  }

  if ('entry' in obj) {
    if (!isNonEmptyString(obj.entry)) {
      errors.push('entry must be a non-empty relative path');
    } else if (hasUnsafeRelativePath(obj.entry)) {
      errors.push('entry must be a relative path and must not contain ".."');
    }
  }

  let provides: WorkshopModCapability[] | undefined;
  if ('provides' in obj) {
    if (!Array.isArray(obj.provides)) {
      errors.push('provides must be an array of strings');
    } else {
      const invalid = obj.provides.filter(
        (value) =>
          typeof value !== 'string' ||
          !(VALID_PROVIDES as readonly string[]).includes(value),
      );
      if (invalid.length > 0) {
        errors.push(
          `provides contains unknown values: ${invalid.join(', ')}. ` +
            `Allowed: ${VALID_PROVIDES.join(', ')}`,
        );
      } else {
        provides = [...obj.provides] as WorkshopModCapability[];
      }
    }
  }

  // Native loading treats both a missing and an empty capability list as the
  // legacy HUD default. Normalize here even though older SPA validation kept
  // an explicit empty array unchanged.
  const effectiveProvides: WorkshopModCapability[] =
    provides && provides.length > 0 ? provides : ['hud'];
  const needsMap = effectiveProvides.includes('map');
  const needsGamemode = effectiveProvides.includes('gamemode');

  if (needsMap || needsGamemode) {
    if (sdkVersion < 2) {
      errors.push(
        'sdk_version must be >= 2 when provides includes "map" or "gamemode"',
      );
    }
    if (!isNonEmptyString(obj.engine_version)) {
      errors.push(
        'engine_version must be a non-empty string when provides includes "map" or "gamemode"',
      );
    }
  }

  if (needsMap) {
    if (!isObject(obj.map)) {
      errors.push('map section is required when provides includes "map"');
    } else {
      const map = obj.map;
      if (map.asset_pak !== undefined) {
        if (!isNonEmptyString(map.asset_pak)) {
          errors.push('map.asset_pak, if present, must be a non-empty string');
        } else {
          if (map.asset_pak.includes('..')) {
            errors.push(
              'map.asset_pak must not contain ".." (path traversal not allowed)',
            );
          }
          if (!map.asset_pak.endsWith('.pak')) {
            errors.push('map.asset_pak must end with ".pak"');
          }
        }
      }

      if (!isNonEmptyString(map.default_level)) {
        errors.push('map.default_level must be a non-empty string');
      } else if (map.default_level.includes('..')) {
        errors.push(
          'map.default_level must not contain ".." (path traversal not allowed)',
        );
      }

      if (map.mount_root !== undefined) {
        if (typeof map.mount_root !== 'string') {
          errors.push('map.mount_root, if present, must be a string');
        } else if (map.mount_root.length < 2 || map.mount_root.length > 63) {
          errors.push('map.mount_root must be 2-63 characters');
        } else if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(map.mount_root)) {
          errors.push(
            'map.mount_root must start with a letter and contain only [A-Za-z0-9_]',
          );
        } else if (
          ['Game', 'Engine', 'Script', 'Temp', 'Paper2D'].includes(map.mount_root)
        ) {
          errors.push(`map.mount_root "${map.mount_root}" is reserved`);
        }
      }
    }
  }

  if (needsGamemode) {
    if (!isObject(obj.gamemode)) {
      errors.push(
        'gamemode section is required when provides includes "gamemode"',
      );
    } else {
      const gamemode = obj.gamemode;
      if (!isNonEmptyString(gamemode.bundle)) {
        errors.push('gamemode.bundle must be a non-empty string');
      } else {
        if (gamemode.bundle.includes('..')) {
          errors.push(
            'gamemode.bundle must not contain ".." (path traversal not allowed)',
          );
        }
        if (!gamemode.bundle.endsWith('.js')) {
          errors.push('gamemode.bundle must end with ".js"');
        }
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  const manifest: NormalizedWorkshopModManifest = {
    sdk_version: sdkVersion,
    name: (obj.name as string).trim(),
    version: (obj.version as string).trim(),
    author: (obj.author as string).trim(),
    description: (obj.description as string).trim(),
    provides: effectiveProvides,
    entry: isNonEmptyString(obj.entry) ? obj.entry.trim() : 'index.html',
  };

  if (Array.isArray(obj.compatible_maps)) {
    manifest.compatible_maps = obj.compatible_maps.map((value) =>
      (value as string).trim(),
    );
  }
  if (typeof obj.engine_version === 'string') {
    manifest.engine_version = obj.engine_version;
  }

  if (needsMap && isObject(obj.map)) {
    manifest.map = { default_level: obj.map.default_level as string };
    if (isNonEmptyString(obj.map.asset_pak)) {
      manifest.map.asset_pak = obj.map.asset_pak;
    }
    if (typeof obj.map.map_id === 'number') {
      manifest.map.map_id = obj.map.map_id;
    }
    if (isNonEmptyString(obj.map.mount_root)) {
      manifest.map.mount_root = obj.map.mount_root;
    }
  }

  if (needsGamemode && isObject(obj.gamemode)) {
    manifest.gamemode = { bundle: obj.gamemode.bundle as string };
    if (isObject(obj.gamemode.params_schema)) {
      manifest.gamemode.params_schema = obj.gamemode.params_schema;
    }
    if (Array.isArray(obj.gamemode.required_capabilities)) {
      manifest.gamemode.required_capabilities =
        obj.gamemode.required_capabilities.filter(
          (value): value is string => typeof value === 'string',
        );
    }
  }

  return { valid: true, manifest };
}

/** Capability bits used by the host's multiplayer Mod fingerprint. */
export const CAPABILITY_BIT_HUD = 1 << 0;
export const CAPABILITY_BIT_MAP = 1 << 1;
export const CAPABILITY_BIT_GAMEMODE = 1 << 2;

/** A Mod and content hash required by a multiplayer server. */
export interface RequiredModDescriptor {
  workshopItemId: string | number;
  contentHash: string;
  displayName: string;
  capabilities: number;
}

/** Locally installed state used to satisfy a server Mod requirement. */
export interface LocalSubscribedMod {
  workshopItemId: string | number;
  isInstalled: boolean;
  contentHash?: string;
}

export type ModCompatibilityReason =
  | 'ok'
  | 'schema_too_old'
  | 'missing_mod'
  | 'content_mismatch';

export interface ModCompatibilityResult {
  ok: boolean;
  reason: ModCompatibilityReason;
  missingModNames: string[];
}

/**
 * Check the local Workshop set against a server's required Mod fingerprint.
 * This mirrors the current UI/C++ compatibility algorithm.
 */
export function checkRequiredMods(
  serverSchemaVersion: number,
  serverRequiredMods: readonly RequiredModDescriptor[],
  localSchemaVersion: number,
  localSubscribedMods: readonly LocalSubscribedMod[],
): ModCompatibilityResult {
  if (serverSchemaVersion === 0) {
    return { ok: true, reason: 'ok', missingModNames: [] };
  }
  if (serverSchemaVersion > localSchemaVersion) {
    return { ok: false, reason: 'schema_too_old', missingModNames: [] };
  }
  if (serverRequiredMods.length === 0) {
    return { ok: true, reason: 'ok', missingModNames: [] };
  }

  const missingModNames: string[] = [];
  let anyMissing = false;
  let anyMismatch = false;

  for (const required of serverRequiredMods) {
    const local = localSubscribedMods.find(
      (candidate) =>
        String(candidate.workshopItemId) === String(required.workshopItemId),
    );
    const displayName =
      required.displayName ||
      `Workshop item ${String(required.workshopItemId)}`;

    if (!local?.isInstalled) {
      anyMissing = true;
      missingModNames.push(displayName);
      continue;
    }

    if (
      required.contentHash &&
      (local.contentHash ?? '').toLowerCase() !==
        required.contentHash.toLowerCase()
    ) {
      anyMismatch = true;
      missingModNames.push(`${displayName} (content mismatch)`);
    }
  }

  if (anyMissing) {
    return { ok: false, reason: 'missing_mod', missingModNames };
  }
  if (anyMismatch) {
    return { ok: false, reason: 'content_mismatch', missingModNames };
  }
  return { ok: true, reason: 'ok', missingModNames: [] };
}
