/**
 * Player state attribute composable.
 * Manages health, level, experience, defeated state, etc.
 *
 * Adapted from the game's internal UI — open-sourced as part of the Gestalt HUD SDK.
 */

import { computed, type Ref } from 'vue';
import { ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk/workshop';
import { createNumberGetter, createBooleanGetter } from '@/utils/attributeAccessors';

export function usePlayerAttributes(battleAttributes: Ref<Record<string, number>>) {
  const health = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.Health);
  const healthMax = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.HealthMax);

  const healthPercent = computed(() => {
    const max = healthMax.value;
    if (max <= 0) return 0;
    return Math.min(100, (health.value / max) * 100);
  });

  const level = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.Level);
  const experience = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.Experience);
  const nextLevelExpMax = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.NextLevelExpMax);

  const experiencePercent = computed(() => {
    const max = nextLevelExpMax.value;
    if (max <= 0) return 0;
    return Math.min(100, (experience.value / max) * 100);
  });

  const isDefeated = createBooleanGetter(battleAttributes, ERobotBridgeDemoAttributeId.Defeated);
  const isPrepared = createBooleanGetter(battleAttributes, ERobotBridgeDemoAttributeId.IsPrepared);
  const isInDeploymentArea = createBooleanGetter(battleAttributes, ERobotBridgeDemoAttributeId.IsInDeploymentArea);
  const isInDeploymentMode = createBooleanGetter(battleAttributes, ERobotBridgeDemoAttributeId.IsInDeploymentMode);
  const isBlocked = createBooleanGetter(battleAttributes, ERobotBridgeDemoAttributeId.Blocked);

  const damageAppliedTotal = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.DamageAppliedTotal);
  const damageTakenTotal = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.DamageTakenTotal);

  return {
    health, healthMax, healthPercent,
    level, experience, nextLevelExpMax, experiencePercent,
    isDefeated, isPrepared, isInDeploymentArea, isInDeploymentMode, isBlocked,
    damageAppliedTotal, damageTakenTotal,
  };
}

export type PlayerAttributes = ReturnType<typeof usePlayerAttributes>;
