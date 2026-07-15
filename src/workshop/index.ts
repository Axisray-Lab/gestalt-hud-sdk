// Workshop HUD bridge
export { GestaltHUDBridge } from './workshop-bridge';
export type {
  GestaltHUDBridgeOptions,
  GestaltHUDBridgeDiagnostics,
  HUDAttributeUpdateMetadata,
  AttributeUpdateHandler,
} from './workshop-bridge';

export { HUDCountdownClock } from './countdown-clock';
export type { HUDCountdownReanchorOptions } from './countdown-clock';

// Protocol types (re-exported for convenience — Workshop HUD authors
// only need to import from '@axisray-lab/gestalt-hud-sdk/workshop')
export * from '../protocol/generated/fbs-enums';
export * from '../protocol/generated/fbs-types';

export {
  ERobotBridgeDemoMapType,
  WorkshopMapType,
  MAP_ID_TO_NAME,
} from '../protocol/map-type';
export type { CompetitionMapName, MapName } from '../protocol/map-type';

export { MatchStatus } from '../protocol/types';

export {
  WORKSHOP_HUD_PROTOCOL_VERSION,
  WORKSHOP_HUD_ACTION_WHITELIST,
  isHUDAttributeData,
  isHUDInitMessage,
  isHUDAttributeUpdateMessage,
  isHUDGameEventMessage,
  isSPAToHUDMessage,
} from '../protocol/workshop-types';
export type {
  HUDGameMode,
  HUDInitMessage,
  HUDAttributeUpdateMessage,
  HUDAttributeData,
  HUDGameEventMessage,
  HUDEventMessage,
  HUDReadyMessage,
  HUDActionMessage,
  HUDDebugLogMessage,
  HUDAction,
  SPAToHUDMessage,
  ParentToHUDMessage,
  HUDToSPAMessage,
  HUDToParentMessage,
  WorkshopHUDMessage,
} from '../protocol/workshop-types';

export {
  WORKSHOP_MANIFEST_SCHEMA_VERSION,
  CAPABILITY_BIT_HUD,
  CAPABILITY_BIT_MAP,
  CAPABILITY_BIT_GAMEMODE,
  checkRequiredMods,
  validateManifest,
} from '../protocol/manifest';
export type {
  WorkshopManifest,
  WorkshopHUDManifest,
  WorkshopModManifest,
  NormalizedWorkshopModManifest,
  WorkshopModCapability,
  WorkshopModMapSection,
  WorkshopModGamemodeSection,
  WorkshopManifestValidationResult,
  RequiredModDescriptor,
  LocalSubscribedMod,
  ModCompatibilityReason,
  ModCompatibilityResult,
} from '../protocol/manifest';

// Attribute IDs (re-export the full enum so HUD authors can reference attributes)
export { ERobotBridgeDemoAttributeId } from '../protocol/attribute-id';
