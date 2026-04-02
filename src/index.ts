// Bridge
export { HUDBridge } from './bridge/hud-bridge';
export type { HUDBridgeOptions, RequestHandler, ConnectionListener } from './bridge/hud-bridge';

export { AttributeStore } from './bridge/attribute-store';
export type { AttributeChangeListener, GameContextChangeListener } from './bridge/attribute-store';

// Protocol (re-export for convenience)
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
