// Workshop HUD bridge
export { GestaltHUDBridge } from './workshop-bridge';
export type { GestaltHUDBridgeOptions } from './workshop-bridge';

// Protocol types (re-exported for convenience — Workshop HUD authors
// only need to import from '@axisray-lab/gestalt-hud-sdk/workshop')
export { ERobotBridgeDemoMapType } from '../protocol/map-type';
export type { CompetitionMapName, MapName } from '../protocol/map-type';

export { WORKSHOP_HUD_PROTOCOL_VERSION } from '../protocol/workshop-types';
export type {
  HUDInitMessage,
  HUDAttributeUpdateMessage,
  HUDAttributeData,
  HUDEventMessage,
  HUDReadyMessage,
  HUDActionMessage,
  HUDAction,
  ParentToHUDMessage,
  HUDToParentMessage,
  WorkshopHUDMessage,
} from '../protocol/workshop-types';

export type { WorkshopManifest } from '../protocol/manifest';

// Attribute IDs (re-export the full enum so HUD authors can reference attributes)
export { ERobotBridgeDemoAttributeId } from '../protocol/attribute-id';
