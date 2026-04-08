/**
 * Mode switch attribute composable.
 * Manages chassis mode, shooter mode, hero combat mode.
 *
 * Adapted from the game's internal UI — open-sourced as part of the Gestalt HUD SDK.
 */

import { type Ref } from 'vue';
import { ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk/workshop';
import { createEnumGetter } from '@/utils/attributeAccessors';

export function useModeAttributes(battleAttributes: Ref<Record<string, number>>) {
  /** 0 = power mode, 1 = HP mode */
  const chassisMode = createEnumGetter(battleAttributes, ERobotBridgeDemoAttributeId.ChassisMode, 0);
  /** 0 = burst mode, 1 = cooling mode */
  const shooterMode = createEnumGetter(battleAttributes, ERobotBridgeDemoAttributeId.ShooterMode, 0);
  /** 0 = melee mode, 1 = ranged mode */
  const heroCombatMode = createEnumGetter(battleAttributes, ERobotBridgeDemoAttributeId.HeroCombatMode, 0);

  return { chassisMode, shooterMode, heroCombatMode };
}

export type ModeAttributes = ReturnType<typeof useModeAttributes>;
