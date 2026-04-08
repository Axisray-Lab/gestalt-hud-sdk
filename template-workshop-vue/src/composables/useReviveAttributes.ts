/**
 * Revive-related attribute composable.
 * Manages revive speed, progress, remaining time.
 *
 * Adapted from the game's internal UI — open-sourced as part of the Gestalt HUD SDK.
 */

import { computed, type Ref } from 'vue';
import { ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk/workshop';
import { createNumberGetter } from '@/utils/attributeAccessors';

export function useReviveAttributes(battleAttributes: Ref<Record<string, number>>) {
  const reviveSpeed = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.ReviveSpeed);
  const reviveProgress = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.ReviveProgress);
  const reviveProgressMax = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.ReviveProgressMax);

  const reviveRemainingTime = computed(() => {
    const remainingProgress = reviveProgressMax.value - reviveProgress.value;
    const speed = reviveSpeed.value;
    if (speed <= 0) return 0;
    return Math.max(0, remainingProgress / speed);
  });

  const reviveProgressPercent = computed(() => {
    const max = reviveProgressMax.value;
    if (max <= 0) return 0;
    return Math.min(100, (reviveProgress.value / max) * 100);
  });

  const canFreeRevive = computed(() => {
    const max = reviveProgressMax.value;
    return max > 0 && reviveProgress.value >= max;
  });

  return {
    reviveSpeed, reviveProgress, reviveProgressMax,
    reviveRemainingTime, reviveProgressPercent, canFreeRevive,
  };
}

export type ReviveAttributes = ReturnType<typeof useReviveAttributes>;
