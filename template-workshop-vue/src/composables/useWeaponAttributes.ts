/**
 * Weapon system attribute composable.
 * Manages ammo, heat, overheat, firing mode, speed, etc.
 *
 * Adapted from the game's internal UI — open-sourced as part of the Gestalt HUD SDK.
 */

import { computed, type Ref } from 'vue';
import {
  ERobotBridgeDemoAttributeId,
  ERobotBridgeDemoBulletType,
} from '@axisray-lab/gestalt-hud-sdk/workshop';
import { createNumberGetter, createEnumGetter } from '@/utils/attributeAccessors';

export function useWeaponAttributes(battleAttributes: Ref<Record<string, number>>) {
  /** 0 = 42mm, 1 = 17mm, 2 = dart, 3 = laser */
  const bulletType = createEnumGetter(
    battleAttributes,
    ERobotBridgeDemoAttributeId.BulletType,
    ERobotBridgeDemoBulletType.Projectile42mm,
  );
  const firingHeat1 = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.FiringHeat1);
  const firingHeatMax1 = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.FiringHeatMax1);
  const bulletFiredTotal = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.BulletFiredTotal);

  const ammoCount = computed(() => {
    let attributeId: ERobotBridgeDemoAttributeId;
    switch (bulletType.value) {
      case ERobotBridgeDemoBulletType.Projectile42mm:
        attributeId = ERobotBridgeDemoAttributeId.Ammo42mmCount;
        break;
      case ERobotBridgeDemoBulletType.Projectile17mm:
        attributeId = ERobotBridgeDemoAttributeId.Ammo17mmCount;
        break;
      case ERobotBridgeDemoBulletType.Dart:
        attributeId = ERobotBridgeDemoAttributeId.AmmoDartCount;
        break;
      case ERobotBridgeDemoBulletType.Laser:
        attributeId = ERobotBridgeDemoAttributeId.AmmoLaserCount;
        break;
      default:
        return 0;
    }
    return battleAttributes.value?.[String(attributeId)] ?? 0;
  });

  const ammoMax = computed(() => {
    let attributeId: ERobotBridgeDemoAttributeId;
    switch (bulletType.value) {
      case ERobotBridgeDemoBulletType.Projectile42mm:
        attributeId = ERobotBridgeDemoAttributeId.Real42mmAmmoCount;
        break;
      case ERobotBridgeDemoBulletType.Projectile17mm:
        attributeId = ERobotBridgeDemoAttributeId.Real17mmAmmoCount;
        break;
      case ERobotBridgeDemoBulletType.Dart:
        attributeId = ERobotBridgeDemoAttributeId.RealDartAmmoCount;
        break;
      case ERobotBridgeDemoBulletType.Laser:
        attributeId = ERobotBridgeDemoAttributeId.RealLaserAmmoCount;
        break;
      default:
        return 0;
    }
    return battleAttributes.value?.[String(attributeId)] ?? 0;
  });

  /** 42mm → 100 heat per shot, 17mm → 10 heat per shot */
  const heatDivisor = computed(() => {
    if (bulletType.value === ERobotBridgeDemoBulletType.Projectile42mm) return 100;
    if (bulletType.value === ERobotBridgeDemoBulletType.Projectile17mm) return 10;
    return 1;
  });

  const ammoSlotsTotal = computed(() => {
    const divisor = Math.max(1, heatDivisor.value);
    const slots = Math.ceil(Math.max(0, firingHeatMax1.value) / divisor);
    return Math.max(1, slots);
  });

  const ammoSlotsAvailable = computed(() => {
    const divisor = Math.max(1, heatDivisor.value);
    const remaining = Math.max(0, firingHeatMax1.value - firingHeat1.value);
    return Math.floor(remaining / divisor);
  });

  const reloadProgressPercent = computed(() => {
    const divisor = Math.max(1, heatDivisor.value);
    const remaining = Math.max(0, firingHeatMax1.value - firingHeat1.value);
    const progress = ((remaining % divisor) / divisor) * 100;
    if (!Number.isFinite(progress)) return 0;
    return Math.min(100, Math.max(0, progress));
  });

  const isOverheated = computed(() => firingHeat1.value > firingHeatMax1.value);

  const overheatBarPercent = computed(() => {
    if (!isOverheated.value) return 0;
    const currentHeat = firingHeat1.value;
    const maxHeat = firingHeatMax1.value;
    if (maxHeat <= 0) return 0;
    const overheat = currentHeat - maxHeat;
    const percent = (overheat / maxHeat) * 100;
    return Math.min(100, Math.max(0, percent));
  });

  const ammoSlotsOverheat = computed(() => {
    if (!isOverheated.value) return 0;
    const divisor = Math.max(1, heatDivisor.value);
    const overheat = firingHeat1.value - firingHeatMax1.value;
    return Math.ceil(overheat / divisor);
  });

  const overheatProgressPercent = computed(() => {
    if (!isOverheated.value) return 0;
    const divisor = Math.max(1, heatDivisor.value);
    const overheat = firingHeat1.value - firingHeatMax1.value;
    const progress = ((overheat % divisor) / divisor) * 100;
    return Math.min(100, Math.max(0, progress));
  });

  /** 0=single, 1=burst-3, 2=auto, 3=unsafe */
  const firingMode = createEnumGetter(battleAttributes, ERobotBridgeDemoAttributeId.FiringMode, 0);
  const firingHeatCoolingRate1 = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.FiringHeatCoolingRate1);
  const coldMultiplierThou = createNumberGetter(battleAttributes, ERobotBridgeDemoAttributeId.ColdMultiplierThou);

  const speed = computed(() => {
    const key = String(ERobotBridgeDemoAttributeId.ShooterRealSpeed);
    const val = battleAttributes.value?.[key];
    if (Number.isFinite(val)) {
      return Number((Number(val) / 100).toFixed(1));
    }
    return 0;
  });

  return {
    bulletType, firingHeat1, firingHeatMax1, bulletFiredTotal, ammoCount, ammoMax,
    heatDivisor, ammoSlotsTotal, ammoSlotsAvailable, reloadProgressPercent,
    isOverheated, overheatBarPercent, ammoSlotsOverheat, overheatProgressPercent,
    firingMode, firingHeatCoolingRate1, coldMultiplierThou,
    speed,
  };
}

export type WeaponAttributes = ReturnType<typeof useWeaponAttributes>;
