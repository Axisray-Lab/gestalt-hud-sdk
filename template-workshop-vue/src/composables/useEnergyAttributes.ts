/**
 * Energy system attribute composable.
 * Manages chassis energy, capacity energy, buffer energy, boost state.
 *
 * Adapted from the game's internal UI — open-sourced as part of the Gestalt HUD SDK.
 */

import { computed, type Ref } from 'vue';
import { ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk/workshop';
import { createNumberGetter, createBooleanGetter } from '@/utils/attributeAccessors';

export function useEnergyAttributes(battleAttributes: Ref<Record<string, number>>) {
  const chassisEnergy = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.ChassisEnergy);
  const chassisEnergyMax = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.ChassisEnergyMax);

  /** Chassis bar is inverted: less energy remaining → higher bar fill */
  const chassisEnergyPercent = computed(() => {
    const max = chassisEnergyMax.value;
    if (max <= 0) return 0;
    const remaining = max - chassisEnergy.value;
    return Math.min(100, (remaining / max) * 100);
  });

  const capacityEnergy = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.CapacityEnergy);
  const capacityEnergyMax = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.CapacityEnergyMax);

  const capacityEnergyPercent = computed(() => {
    const max = capacityEnergyMax.value;
    if (max <= 0) return 0;
    return Math.min(100, (capacityEnergy.value / max) * 100);
  });

  const bufferEnergy = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.BufferEnergy);
  const bufferEnergyMax = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.BufferEnergyMax);

  const bufferEnergyPercent = computed(() => {
    const max = bufferEnergyMax.value;
    if (max <= 0) return 0;
    return Math.min(100, (bufferEnergy.value / max) * 100);
  });

  const isBoost = createBooleanGetter(battleAttributes, ERobotBridgeDemoAttributeId.IsBoost);
  const isCharging = createBooleanGetter(battleAttributes, ERobotBridgeDemoAttributeId.IsCharging);

  const shouldShowEnergyBars = computed(() => chassisEnergyMax.value > 0);
  const isCapacityDepleted = computed(() => capacityEnergy.value <= 0 && capacityEnergyMax.value > 0);

  return {
    chassisEnergy, chassisEnergyMax, chassisEnergyPercent,
    capacityEnergy, capacityEnergyMax, capacityEnergyPercent,
    bufferEnergy, bufferEnergyMax, bufferEnergyPercent,
    isBoost, isCharging,
    shouldShowEnergyBars, isCapacityDepleted,
  };
}

export type EnergyAttributes = ReturnType<typeof useEnergyAttributes>;
