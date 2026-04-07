/**
 * Map type enum — mirrors the game engine's ERobotBridgeDemoMapType.
 *
 * Used in {@link HUDInitMessage.mapId} and {@link WorkshopManifest.compatible_maps}.
 * HUD developers typically care about the active competition maps:
 *   - L_Map2026 (RMUC2026)
 *   - L_MapRMUL2026 (RMUL2026)
 *   - L_MapRMUL2026_IF (RMUL2026 International)
 *   - L_Map20261V1 (1v1)
 *   - L_Traning (Training)
 */
export enum ERobotBridgeDemoMapType {
  BlankLevel = 0,
  GameStartLevel = 1,
  L_Traning = 2,
  L_Map2024 = 3,
  L_Map2026 = 4,
  L_MapRMUL2026 = 5,
  L_MapRMUL2026_IF = 6,
  L_Map20261V1 = 7,
  EchoRobotBridgeDemoMapType_END = 8,
}

/** Map names that represent playable competition/training maps. */
export type CompetitionMapName =
  | 'L_Traning'
  | 'L_Map2026'
  | 'L_MapRMUL2026'
  | 'L_MapRMUL2026_IF'
  | 'L_Map20261V1';

/** All valid map enum member names (string keys of ERobotBridgeDemoMapType). */
export type MapName = keyof typeof ERobotBridgeDemoMapType;
