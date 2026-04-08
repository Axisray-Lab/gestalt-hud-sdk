/**
 * Team and identity attribute composable.
 * Manages team ID, team number, class type, spectator mode, supply state.
 *
 * Adapted from the game's internal UI — open-sourced as part of the Gestalt HUD SDK.
 */

import { computed, type Ref } from 'vue';
import { ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk/workshop';
import { createNumberGetter, createBooleanGetter } from '@/utils/attributeAccessors';

export const CAREER_NAMES: Record<number, string> = {
  1001: 'Hero',
  1002: 'Engineer',
  1003: 'Infantry',
  1004: 'Sentry',
  1005: 'Aerial',
  1008: 'Balance Infantry',
};

export function useTeamAttributes(battleAttributes: Ref<Record<string, number>>) {
  /** 0 = Red, 1 = Blue, -1 = no team / spectator */
  const teamID = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.TeamID, -1);
  const teamNumber = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.TeamNumber);

  /** Class type: 0 = spectator, 1001 = Hero, 1003 = Infantry, etc. */
  const classType = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.Class);
  const isSpectatorMode = computed(() => classType.value === 0);

  const canOperate = createBooleanGetter(battleAttributes, ERobotBridgeDemoAttributeId.CanOperate);
  const canSupply = createBooleanGetter(battleAttributes, ERobotBridgeDemoAttributeId.CanSupply);
  const isOutOfCombat = createBooleanGetter(battleAttributes, ERobotBridgeDemoAttributeId.OutOfCombat);

  const shouldShowAmmunition = computed(() => {
    const type = classType.value;
    return !isSpectatorMode.value && (type === 1001 || type === 1003 || type === 1004);
  });

  const careerName = computed(() => CAREER_NAMES[classType.value] ?? `Class ${classType.value}`);

  return {
    teamID, teamNumber, classType,
    isSpectatorMode,
    canOperate, canSupply, isOutOfCombat,
    shouldShowAmmunition,
    careerName,
  };
}

export type TeamAttributes = ReturnType<typeof useTeamAttributes>;
