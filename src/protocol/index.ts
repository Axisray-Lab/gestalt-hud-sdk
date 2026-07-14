// Complete public FBS surface (generated from schemas/fbs).
export * from './generated/fbs-enums';
export * from './generated/fbs-types';

export {
  ERobotBridgeDemoAttributeId,
  ERobotBridgeDemoCareerId,
  ERobotBridgeDemoPurchaseID,
} from './attribute-id';

export {
  SyncType,
  MatchStatus,
  JSONRPCType,
  HUDFeature,
  TeamDisplayMode,
} from './types';

export type {
  AttributeMapUpdate,
  WatchAttributeMapsResult,
  GameGlobalVars,
  GameContext,
  JSONRPCRequest,
  JSONRPCResponse,
  HUDFeatureConfig,
} from './types';

// Workshop HUD protocol
export {
  ERobotBridgeDemoMapType,
  WorkshopMapType,
  MAP_ID_TO_NAME,
} from './map-type';
export type { CompetitionMapName, MapName } from './map-type';

export {
  WORKSHOP_HUD_PROTOCOL_VERSION,
  WORKSHOP_HUD_ACTION_WHITELIST,
  isHUDAttributeData,
  isHUDInitMessage,
  isHUDAttributeUpdateMessage,
  isHUDGameEventMessage,
  isSPAToHUDMessage,
} from './workshop-types';
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
} from './workshop-types';

export {
  WORKSHOP_MANIFEST_SCHEMA_VERSION,
  CAPABILITY_BIT_HUD,
  CAPABILITY_BIT_MAP,
  CAPABILITY_BIT_GAMEMODE,
  checkRequiredMods,
  validateManifest,
} from './manifest';
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
} from './manifest';
