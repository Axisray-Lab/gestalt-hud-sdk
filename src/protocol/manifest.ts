/**
 * Workshop HUD manifest.json schema.
 *
 * Every Workshop HUD must include a `manifest.json` at its root.
 * The game engine reads this file to determine compatibility, display
 * info, and the HTML entry point to load inside the iframe.
 */

import type { CompetitionMapName } from './map-type';

export interface WorkshopManifest {
  /** SDK protocol version this HUD targets (currently 1). */
  sdk_version: number;
  /** Display name of the HUD. */
  name: string;
  /** Semver version string (e.g. "1.0.0"). */
  version: string;
  /** Author/creator name. */
  author: string;
  /** Short description of the HUD. */
  description: string;
  /**
   * List of compatible map names (enum string form).
   * The game only loads this HUD on maps present in this list.
   *
   * @example ["L_MapRMUL2026", "L_MapRMUL2026_IF", "L_Map20261V1"]
   */
  compatible_maps: CompetitionMapName[];
  /** Relative path to the HTML entry point (typically "index.html"). */
  entry: string;
}
