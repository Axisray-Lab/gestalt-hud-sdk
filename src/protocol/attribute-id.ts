/**
 * Backward-compatible exports for the attribute-related public FBS enums.
 *
 * The source of truth is `schemas/fbs/RobotBridgeDemoAttributeDefines.fbs`.
 * Run `node scripts/generate-fbs-protocol.mjs` after updating the snapshot.
 */
export {
  ERobotBridgeAreaID,
  ERobotBridgeDemoAttributeId,
  ERobotBridgeDemoCareerId,
  ERobotBridgeDemoPurchaseID,
} from './generated/fbs-enums';
