<template>
  <div class="energy-wrapper">
    <div v-if="isShowChassisBar" class="bar-container chassis-container">
      <div class="bar-label left-label">
        {{ chassisEnergyText }}
        <span class="bar-label-unit">J</span>
      </div>
      <div class="bar-shell chassis-bar" :class="{ 'is-depleted': chassisDepleted }">
        <div
          class="bar-fill chassis-fill"
          :class="{ 'is-depleted': chassisDepleted }"
          :style="chassisBarStyle"
        />
      </div>
      <div
        class="bar-label right-label chassis-max-label"
        :class="{ 'has-power-buff': hasPowerBuff }"
      >
        {{ chassisMaxText }}
        <span class="bar-label-unit">W</span>
      </div>
    </div>

    <div class="bar-container capacity-container">
      <div class="bar-label left-label">
        {{ capacityEnergyText }}
        <span class="bar-label-unit">J</span>
      </div>
      <div class="bar-shell capacity-bar" :class="{ 'inner-flash': showInnerEnergy, 'is-boost': isBoost }">
        <div v-if="!showInnerEnergy" class="bar-fill capacity-fill" :style="{ width: `${capacityFillPercent}%` }" />
        <div v-else class="bar-fill buffer-fill" :class="{ 'is-depleted': bufferDepleted }" :style="{ width: `${bufferFillPercent}%` }" />
        <div v-if="showInnerEnergy" class="flash-overlay" />
      </div>
      <div class="bar-label right-label" :class="{ 'is-boost': isBoost }">
        {{ ChassisPowerText }}
        <span class="bar-label-unit">W</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Chassis energy + capacity energy bars.
 * Open-sourced from the game's internal UI.
 */

import { computed } from 'vue';
import { ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk/workshop';

type AttrMap = Record<string, number | string> | null | undefined;

const props = withDefaults(
  defineProps<{
    battleAttributes: AttrMap;
    isShowChassisBar?: boolean;
  }>(),
  { isShowChassisBar: true },
);

const getAttr = (id: ERobotBridgeDemoAttributeId) => {
  const raw = props.battleAttributes?.[String(id)];
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
};

const clampPercent = (value: number, max: number) => {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
};

const chassisEnergyMax = computed(() => Math.max(0, getAttr(ERobotBridgeDemoAttributeId.ChassisEnergyMax)));
const chassisEnergy = computed(() => Math.max(0, getAttr(ERobotBridgeDemoAttributeId.ChassisEnergy)));
const chassisFillPercent = computed(() => clampPercent(chassisEnergy.value, chassisEnergyMax.value || 1));
const chassisDepleted = computed(() => chassisEnergy.value <= 0.1);
const hasPowerBuff = computed(() => getAttr(ERobotBridgeDemoAttributeId.PowerMultiplierThou) > 0);

const getEnergyColor = (percent: number, hasBuff: boolean) => {
  if (hasBuff) return '#00ff88';
  if (percent > 50) {
    const ratio = (percent - 50) / 50;
    return `rgb(${226 + (255 - 226) * (1 - ratio)}, 255, ${251 + (255 - 251) * (1 - ratio)})`;
  } else if (percent > 20) {
    const ratio = (percent - 20) / 30;
    return `rgb(255, ${255 - (255 - 180) * (1 - ratio)}, ${255 * ratio})`;
  } else if (percent > 0) {
    const ratio = percent / 20;
    return `rgb(${180 + (255 - 180) * ratio}, ${80 * ratio}, 0)`;
  }
  return '#b45000';
};

const chassisBarStyle = computed(() => ({
  width: `${chassisFillPercent.value}%`,
  background: getEnergyColor(chassisFillPercent.value, hasPowerBuff.value),
}));

const capacityEnergyMax = computed(() => Math.max(0, getAttr(ERobotBridgeDemoAttributeId.CapacityEnergyMax)));
const capacityEnergy = computed(() => Math.max(0, Math.floor(getAttr(ERobotBridgeDemoAttributeId.CapacityEnergy))));
const bufferEnergyMax = computed(() => Math.max(0, getAttr(ERobotBridgeDemoAttributeId.BufferEnergyMax)));
const bufferEnergy = computed(() => Math.max(0, Number(getAttr(ERobotBridgeDemoAttributeId.BufferEnergy).toFixed(1))));

const capacityFillPercent = computed(() => clampPercent(capacityEnergy.value, capacityEnergyMax.value || 1));
const bufferFillPercent = computed(() => clampPercent(bufferEnergy.value, bufferEnergyMax.value || 1));
const bufferDepleted = computed(() => bufferEnergy.value <= 0.1);
const showInnerEnergy = computed(() => capacityEnergy.value <= 0.1 && bufferEnergyMax.value > 0);

const capacityEnergyText = computed(() => Math.floor(capacityEnergy.value).toString());
const ChassisPower = computed(() => Math.max(0, getAttr(ERobotBridgeDemoAttributeId.ChassisPower)));
const ChassisPowerText = computed(() => Math.floor(ChassisPower.value).toString());
const isBoost = computed(() => { const v = getAttr(ERobotBridgeDemoAttributeId.IsBoost); return v === 1 || v > 0; });

const chassisEnergyText = computed(() => Math.floor(chassisEnergy.value).toString());
const chassisPowerMax = computed(() => Math.max(0, getAttr(ERobotBridgeDemoAttributeId.ChassisPowerMax)));
const powerMultiplierThou = computed(() => Math.max(0, getAttr(ERobotBridgeDemoAttributeId.PowerMultiplierThou)));
const chassisMaxValue = computed(() => chassisPowerMax.value * (1 + powerMultiplierThou.value / 1000));
const chassisMaxText = computed(() => Math.floor(chassisMaxValue.value).toString());
</script>

<style scoped>
.energy-wrapper { display: flex; flex-direction: column; gap: 1.8rem; width: 100%; align-items: center; }
.bar-container { display: flex; align-items: center; gap: 0.5rem; width: 100%; justify-content: center; }

.bar-label {
  font-size: 1.4rem; font-weight: 900; letter-spacing: 0.05em; color: #fff;
  min-width: 6rem; text-align: center; font-family: 'Courier New', monospace;
}
.bar-label-unit { font-size: 1rem; font-weight: 400; color: #fff; }

.left-label, .right-label {
  text-align: center; position: relative; padding: 0.1rem 1.2rem;
  background: rgba(0,0,0,0.7); border-radius: 0.2rem;
  display: flex; align-items: center; justify-content: center; gap: 0.2rem;
}
.left-label::before { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 0.4rem; background: #e2fffb; }
.right-label::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 0.4rem; background: #e2fffb; transition: background 0.3s ease; }

.right-label.is-boost { color: #ff6e48; animation: boost-pulse 0.8s ease-in-out infinite alternate; }
.right-label.is-boost::before { background: #ff6e48; animation: boost-bar-pulse 0.8s ease-in-out infinite alternate; }
@keyframes boost-pulse { 0% { color: #ff6e48; } 100% { color: #ff4e28; } }
@keyframes boost-bar-pulse { 0% { background: #ff6e48; } 100% { background: #ff4e28; } }

.chassis-max-label.has-power-buff { color: #00ff88; animation: power-buff-pulse 1.2s ease-in-out infinite alternate; }
.chassis-max-label.has-power-buff::before { background: #00ff88; }
@keyframes power-buff-pulse { 0% { color: #00ff88; } 100% { color: #00dd77; } }

.bar-shell { position: relative; height: 1.5rem; background: rgba(0,0,0,0.5); width: 100%; }
.chassis-bar { flex: 1; height: 1.2rem; }
.capacity-bar { flex: 1; height: 1.5rem; }

.bar-fill { position: absolute; inset: 0; width: 0; transition: width 0.2s ease-out; }
.chassis-fill { box-shadow: inset 0 0 0 2px #0f0f0f; }
.chassis-fill.is-depleted { animation: flash-red-depleted 0.7s ease-in-out infinite alternate; }
.capacity-fill { background: #e2fffb; }
.buffer-fill { background: repeating-linear-gradient(45deg, #f04a2d, #f04a2d 10px, #ff6b55 10px, #ff6b55 20px), #f04a2d; }
.buffer-fill.is-depleted { animation: flash-red-depleted 0.7s ease-in-out infinite alternate; }

.capacity-bar.inner-flash { animation: flash-red 0.9s ease-in-out infinite; }
.flash-overlay { position: absolute; inset: -2px; background: rgba(240,74,45,0.2); border-radius: 2px; pointer-events: none; animation: flash-overlay 0.9s ease-in-out infinite; }

@keyframes flash-red-depleted {
  0% { background: #ff1a1a; box-shadow: inset 0 0 0 2px #0f0f0f, 0 0 8px rgba(255,26,26,0.6); }
  100% { background: #990000; box-shadow: inset 0 0 0 2px #0f0f0f, 0 0 16px rgba(255,26,26,0.9); }
}
@keyframes flash-red { 0% { box-shadow: 0 0 0 0 rgba(240,74,45,0.5); } 50% { box-shadow: 0 0 12px 4px rgba(255,59,48,0.35); } 100% { box-shadow: 0 0 0 0 rgba(240,74,45,0.1); } }
@keyframes flash-overlay { 0% { opacity: 0.1; } 50% { opacity: 0.45; } 100% { opacity: 0.15; } }
</style>
