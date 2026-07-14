// Bridge
export {
  HUDBridge,
  TRUSTED_WEBSOCKET_API_NOTICE,
  TrustedWebSocketMethod,
  TrustedWebSocketEvent,
} from './bridge/hud-bridge';
export type {
  HUDBridgeOptions,
  RequestHandler,
  ConnectionListener,
} from './bridge/hud-bridge';

export { AttributeStore } from './bridge/attribute-store';
export type {
  AttributeStoreOptions,
  AttributeChangeListener,
  GameContextChangeListener,
} from './bridge/attribute-store';

// Protocol (re-export for convenience)
export * from './protocol/generated/fbs-enums';
export * from './protocol/generated/fbs-types';

export {
  ERobotBridgeDemoAttributeId,
  ERobotBridgeDemoCareerId,
  ERobotBridgeDemoPurchaseID,
} from './protocol/attribute-id';

export {
  SyncType,
  MatchStatus,
  JSONRPCType,
  HUDFeature,
  TeamDisplayMode,
} from './protocol/types';

export type {
  AttributeMapUpdate,
  WatchAttributeMapsResult,
  GameGlobalVars,
  GameContext,
  JSONRPCRequest,
  JSONRPCResponse,
  HUDFeatureConfig,
} from './protocol/types';
