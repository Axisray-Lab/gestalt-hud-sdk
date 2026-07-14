/**
 * Map types generated from the public FBS protocol snapshot.
 *
 * Used in HUD init messages and Workshop manifest compatibility declarations.
 */
import { ERobotBridgeDemoMapType } from './generated/fbs-enums';

export { ERobotBridgeDemoMapType };
/** Alias used by the host Workshop protocol source. */
export { ERobotBridgeDemoMapType as WorkshopMapType };

/** Map names that represent playable competition/training maps. */
export type CompetitionMapName =
  | 'L_Traning'
  | 'L_Map2026'
  | 'L_MapRMUL2026'
  | 'L_MapRMUL2026_IF'
  | 'L_Map20261V1'
  | 'L_Map2026_IF';

/** All member names, including internal levels and the terminal sentinel. */
export type MapName = keyof typeof ERobotBridgeDemoMapType;

/** Reverse lookup used by the host when constructing `hud:init`. */
export const MAP_ID_TO_NAME: Readonly<Record<number, MapName>> = {
  [ERobotBridgeDemoMapType.BlankLevel]: 'BlankLevel',
  [ERobotBridgeDemoMapType.GameStartLevel]: 'GameStartLevel',
  [ERobotBridgeDemoMapType.L_Traning]: 'L_Traning',
  [ERobotBridgeDemoMapType.L_Map2024]: 'L_Map2024',
  [ERobotBridgeDemoMapType.L_Map2026]: 'L_Map2026',
  [ERobotBridgeDemoMapType.L_MapRMUL2026]: 'L_MapRMUL2026',
  [ERobotBridgeDemoMapType.L_MapRMUL2026_IF]: 'L_MapRMUL2026_IF',
  [ERobotBridgeDemoMapType.L_Map20261V1]: 'L_Map20261V1',
  [ERobotBridgeDemoMapType.L_Map2026_IF]: 'L_Map2026_IF',
};
