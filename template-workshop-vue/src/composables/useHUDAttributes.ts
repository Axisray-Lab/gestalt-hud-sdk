/**
 * HUD attribute aggregator composable.
 * Unifies all attribute domains into a single access point.
 *
 * Adapted from the game's internal useBattleAttributes — open-sourced
 * as part of the Gestalt HUD SDK.
 */

import type { Ref } from 'vue';
import { usePlayerAttributes } from './usePlayerAttributes';
import { useWeaponAttributes } from './useWeaponAttributes';
import { useEnergyAttributes } from './useEnergyAttributes';
import { useTeamAttributes } from './useTeamAttributes';
import { useModeAttributes } from './useModeAttributes';
import { useReviveAttributes } from './useReviveAttributes';
import { useGlobalAttributes } from './useGlobalAttributes';

export function useHUDAttributes(
  battleAttributes: Ref<Record<string, number>>,
  globalAttributes: Ref<Record<string, number>>,
) {
  return {
    player: usePlayerAttributes(battleAttributes),
    weapon: useWeaponAttributes(battleAttributes),
    energy: useEnergyAttributes(battleAttributes),
    team: useTeamAttributes(battleAttributes),
    mode: useModeAttributes(battleAttributes),
    revive: useReviveAttributes(battleAttributes),
    global: useGlobalAttributes(globalAttributes),
  };
}

export type HUDAttributes = ReturnType<typeof useHUDAttributes>;

export type { PlayerAttributes } from './usePlayerAttributes';
export type { WeaponAttributes } from './useWeaponAttributes';
export type { EnergyAttributes } from './useEnergyAttributes';
export type { TeamAttributes } from './useTeamAttributes';
export type { ModeAttributes } from './useModeAttributes';
export type { ReviveAttributes } from './useReviveAttributes';
export type { GlobalGameAttributes } from './useGlobalAttributes';
