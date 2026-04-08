/**
 * Global game state attribute composable.
 * Manages match status, countdown, map ID, match time, control zones,
 * base/outpost zone indicators (RMUC2026).
 *
 * Adapted from the game's internal UI — open-sourced as part of the Gestalt HUD SDK.
 */

import { computed, type Ref } from 'vue';
import { ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk/workshop';
import { createNumberGetter, createEnumGetter } from '@/utils/attributeAccessors';

export function useGlobalAttributes(globalAttributes: Ref<Record<string, number>>) {
  /** 0 = preparing, 1 = live, 2 = ended */
  const matchStatus = createEnumGetter(globalAttributes, ERobotBridgeDemoAttributeId.G_CurMatchStatus, 0);

  const gameStartCountDown = computed(() => {
    const key = String(ERobotBridgeDemoAttributeId.G_GameStartCountDown);
    const val = globalAttributes.value?.[key];
    return Number.isFinite(val) ? Math.ceil(Number(val) / 1000) : 0;
  });

  const mapId = createNumberGetter(globalAttributes, ERobotBridgeDemoAttributeId.G_CurMapId);

  /** -1 = neutral, 0 = red, 1 = blue */
  const controlZoneTeamId = createNumberGetter(globalAttributes, ERobotBridgeDemoAttributeId.G_ControlZone_TeamID, -1);
  const controlZone1TeamId = createNumberGetter(globalAttributes, ERobotBridgeDemoAttributeId.G_ControlZone1_TeamID, -1);
  const controlZone2TeamId = createNumberGetter(globalAttributes, ERobotBridgeDemoAttributeId.G_ControlZone2_TeamID, -1);

  const redOutpostZoneTeamId = createNumberGetter(globalAttributes, ERobotBridgeDemoAttributeId.G_RedOutpostZone_TeamID, -2);
  const blueOutpostZoneTeamId = createNumberGetter(globalAttributes, ERobotBridgeDemoAttributeId.G_BlueOutpostZone_TeamID, -2);
  const redBaseCountdown = createNumberGetter(globalAttributes, ERobotBridgeDemoAttributeId.G_RedBaseCountdown, -1);
  const blueBaseCountdown = createNumberGetter(globalAttributes, ERobotBridgeDemoAttributeId.G_BlueBaseCountdown, -1);
  const redOutpostRepairProgress = createNumberGetter(globalAttributes, ERobotBridgeDemoAttributeId.G_RedOutpostRepairProgress, -1);
  const blueOutpostRepairProgress = createNumberGetter(globalAttributes, ERobotBridgeDemoAttributeId.G_BlueOutpostRepairProgress, -1);

  const remainingMatchTimeThou = computed(() => {
    const maxTimeKey = String(ERobotBridgeDemoAttributeId.G_MaxGameTime);
    const curTimeKey = String(ERobotBridgeDemoAttributeId.G_CurGameTime);
    const maxTimeVal = globalAttributes.value?.[maxTimeKey];
    const curTimeVal = globalAttributes.value?.[curTimeKey];
    const remaining = maxTimeVal - curTimeVal;
    return Number.isFinite(remaining) ? Number(remaining) : 0;
  });

  const matchTimeText = computed(() => {
    const totalMs = Math.max(0, remainingMatchTimeThou.value);
    const totalSec = Math.floor(totalMs / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
  });

  const maxGameTime = createNumberGetter(globalAttributes, ERobotBridgeDemoAttributeId.G_MaxGameTime);
  const currentGameTime = createNumberGetter(globalAttributes, ERobotBridgeDemoAttributeId.G_CurGameTime);

  return {
    matchStatus, gameStartCountDown,
    mapId,
    controlZoneTeamId, controlZone1TeamId, controlZone2TeamId,
    redOutpostZoneTeamId, blueOutpostZoneTeamId,
    redBaseCountdown, blueBaseCountdown,
    redOutpostRepairProgress, blueOutpostRepairProgress,
    remainingMatchTimeThou, matchTimeText,
    maxGameTime, currentGameTime,
  };
}

export type GlobalGameAttributes = ReturnType<typeof useGlobalAttributes>;
