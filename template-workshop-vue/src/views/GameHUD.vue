<template>
  <div class="game-hud" @click.right.prevent>
    <!-- ==================== Top: Base/Outpost HP + Match Timer ==================== -->
    <div class="hud-top">
      <BaseCoreStatus
        :status="matchStatusLabel"
        :left="leftBase"
        :right="rightBase"
        :left-team-id="leftTeamId"
        :right-team-id="rightTeamId"
        :left-outpost="leftOutpost"
        :right-outpost="rightOutpost"
        :time-text="attrs.global.matchTimeText.value"
        :left-outpost-repair-progress="attrs.global.redOutpostRepairProgress.value"
        :right-outpost-repair-progress="attrs.global.blueOutpostRepairProgress.value"
      />

      <GameStatusBanner
        :visible="bannerVisible"
        :type="bannerType"
        :title="bannerTitle"
        :subtitle="bannerSubtitle"
        :auto-hide-delay="bannerAutoHide"
        @hide="bannerVisible = false"
      />
    </div>

    <!-- ==================== Center: Crosshair ==================== -->
    <CrosshairHUD
      :ammo="attrs.weapon.ammoCount.value"
      :ammo-max="attrs.weapon.ammoMax.value"
      :ammo-arc-current="attrs.weapon.ammoSlotsAvailable.value"
      :ammo-arc-total="attrs.weapon.ammoSlotsTotal.value"
      :ammo-arc-progress="attrs.weapon.reloadProgressPercent.value"
      :is-overheated="attrs.weapon.isOverheated.value"
      :overheat-bar-percent="attrs.weapon.overheatBarPercent.value"
      :speed="attrs.weapon.speed.value"
      :firing-mode="attrs.weapon.firingMode.value"
      :firing-mode-icon="firingModeIcon"
      :fire-trigger="attrs.weapon.bulletFiredTotal.value"
      :is-unsafe-mode="attrs.weapon.firingMode.value === 3"
    />

    <!-- ==================== Bottom-Left: Player Badge ==================== -->
    <div class="hud-bottom-left">
      <PlayerBadge :battle-attributes="battleAttributes" />
      <EnergyBars
        v-if="attrs.energy.shouldShowEnergyBars.value"
        :battle-attributes="battleAttributes"
        class="energy-bars-slot"
      />
    </div>

    <!-- ==================== Bottom-Right: Team Info ==================== -->
    <div class="hud-bottom-right">
      <div class="team-tag" :style="{ color: teamColor }">
        {{ attrs.team.careerName.value }}
      </div>
      <div class="ammo-display">
        <div class="ammo-label">{{ ammoTypeLabel }}</div>
        <div class="ammo-count">{{ attrs.weapon.ammoCount.value }}</div>
      </div>
    </div>

    <!-- ==================== Hit / Death Overlay ==================== -->
    <HitScreenEffect
      :hit-trigger="attrs.player.damageTakenTotal.value"
      :is-defeated="attrs.player.isDefeated.value"
      :revive-remaining-time="attrs.revive.reviveRemainingTime.value"
      :show-revive-actions="false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Main HUD layout — composes all extracted game components.
 *
 * This is the "GameHUD" equivalent from the game, refactored into
 * a clean ~200-line layout for the Workshop HUD template.
 *
 * Open-sourced from the game's internal UI.
 */

import { computed, ref, watch, toRef } from 'vue';
import { ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk/workshop';

import { useHUDAttributes } from '@/composables/useHUDAttributes';
import type { BridgeContext } from '@/composables/useBridge';

import CrosshairHUD from '@/components/CrosshairHUD.vue';
import BaseCoreStatus from '@/components/BaseCoreStatus.vue';
import PlayerBadge from '@/components/PlayerBadge.vue';
import EnergyBars from '@/components/EnergyBars.vue';
import GameStatusBanner from '@/components/GameStatusBanner.vue';
import HitScreenEffect from '@/components/HitScreenEffect.vue';
import type { GameStatusType } from '@/components/GameStatusBanner.vue';

import firingModeSingleRaw from '@/assets/img/hud/firing-mode-single.svg?raw';
import firingModeBurst3Raw from '@/assets/img/hud/firing-mode-burst3.svg?raw';
import firingModeAutoRaw from '@/assets/img/hud/firing-mode-auto.svg?raw';
import firingModeUnsafeRaw from '@/assets/img/hud/firing-mode-unsafe.svg?raw';

const props = defineProps<{
  battleAttributes: Record<string, number>;
  globalAttributes: Record<string, number>;
  baseAttributes: Record<string, Record<string, number>>;
  context: BridgeContext;
}>();

const battleRef = toRef(props, 'battleAttributes');
const globalRef = toRef(props, 'globalAttributes');
const attrs = useHUDAttributes(battleRef, globalRef);

const battleAttributes = computed(() => props.battleAttributes);

// ==================== Firing mode icon ==================== //
const FIRING_MODE_ICONS: Record<number, string> = {
  0: firingModeSingleRaw,
  1: firingModeBurst3Raw,
  2: firingModeAutoRaw,
  3: firingModeUnsafeRaw,
};
const firingModeIcon = computed(() => FIRING_MODE_ICONS[attrs.weapon.firingMode.value] ?? '');

// ==================== Team display ==================== //
const teamColor = computed(() => {
  const tid = attrs.team.teamID.value;
  if (tid === 0) return '#f04a4a';
  if (tid === 1) return '#4ac2ff';
  return '#b9b9b9';
});
const ammoTypeLabel = computed(() => attrs.weapon.bulletType.value === 0 ? '42mm' : '17mm');

// ==================== Base / Outpost data ==================== //
const baseKeys = computed(() => Object.keys(props.baseAttributes));
const A = ERobotBridgeDemoAttributeId;

function extractBase(attrs: Record<string, number> | undefined) {
  if (!attrs) return { hp: 0, hpMax: 200, bcState: 0 };
  return {
    hp: Math.round(Number(attrs[A.Health]) || 0),
    hpMax: Math.round(Number(attrs[A.HealthMax]) || 200),
    bcState: Number(attrs[A.BC_State]) || 0,
  };
}

const leftTeamId = computed(() => {
  const tid = props.context.teamId;
  return tid === 1 ? 1 : 0;
});
const rightTeamId = computed(() => leftTeamId.value === 0 ? 1 : 0);

const leftBase = computed(() => {
  const k = baseKeys.value[leftTeamId.value] ?? baseKeys.value[0];
  return extractBase(props.baseAttributes[k]);
});
const rightBase = computed(() => {
  const k = baseKeys.value[rightTeamId.value] ?? baseKeys.value[1];
  return extractBase(props.baseAttributes[k]);
});

const leftOutpost = computed(() => {
  const k = baseKeys.value[leftTeamId.value + 2];
  if (!k) return undefined;
  return extractBase(props.baseAttributes[k]);
});
const rightOutpost = computed(() => {
  const k = baseKeys.value[rightTeamId.value + 2];
  if (!k) return undefined;
  return extractBase(props.baseAttributes[k]);
});

// ==================== Status Banner ==================== //
const bannerVisible = ref(false);
const bannerType = ref<GameStatusType>('standby');
const bannerTitle = ref('');
const bannerSubtitle = ref('');
const bannerAutoHide = ref(0);

watch(
  () => attrs.global.matchStatus.value,
  (status, prev) => {
    if (status === prev) return;
    if (status === 0 && attrs.global.gameStartCountDown.value > 0) {
      bannerType.value = 'standby';
      bannerTitle.value = '';
      bannerSubtitle.value = 'Stand by';
      bannerAutoHide.value = 3000;
      bannerVisible.value = true;
    } else if (status === 1) {
      bannerType.value = 'engage';
      bannerTitle.value = 'ENGAGE';
      bannerSubtitle.value = '';
      bannerAutoHide.value = 2000;
      bannerVisible.value = true;
    } else if (status === 2) {
      bannerType.value = 'custom';
      bannerTitle.value = 'Match Ended';
      bannerSubtitle.value = '';
      bannerAutoHide.value = 0;
      bannerVisible.value = true;
    }
  },
);

const matchStatusLabel = computed<'not-ready' | 'ready' | 'in-game'>(() => {
  const st = attrs.global.matchStatus.value;
  if (st === 1 || st === 2) return 'in-game';
  if (attrs.player.isPrepared.value) return 'ready';
  return 'not-ready';
});
</script>

<style scoped>
.game-hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  color: #fff;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  z-index: 10;
  overflow: hidden;
}

.hud-top {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hud-bottom-left {
  position: absolute;
  bottom: 2rem;
  left: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 42rem;
}

.energy-bars-slot {
  width: 40rem;
  padding-left: 10.8rem;
}

.hud-bottom-right {
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.team-tag {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ammo-display {
  background: rgba(0, 0, 0, 0.6);
  border-radius: 0.5rem;
  padding: 0.8rem 1.5rem;
  text-align: center;
  backdrop-filter: blur(8px);
}

.ammo-label {
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  opacity: 0.7;
  margin-bottom: 0.3rem;
}

.ammo-count {
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
}
</style>
