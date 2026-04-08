<template>
  <div class="player-badge" :class="`team-${teamTone}`">
    <div class="badge-hex" :class="{ 'is-dead': isDead }">
      <svg
        class="badge-hex-svg"
        viewBox="0 0 150 150"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g clip-path="url(#clip0_badge)">
          <path
            class="badge-hex-shape"
            d="M73.75 3.6084C74.5235 3.16183 75.4765 3.16183 76.25 3.6084L136.202 38.2217C136.976 38.6683 137.452 39.4936 137.452 40.3867V109.613C137.452 110.506 136.976 111.332 136.202 111.778L76.25 146.392C75.4765 146.838 74.5235 146.838 73.75 146.392L13.7979 111.778C13.0245 111.332 12.5479 110.506 12.5479 109.613V40.3867C12.5479 39.4936 13.0245 38.6683 13.7979 38.2217L73.75 3.6084Z"
            stroke-width="5"
          />
        </g>
        <defs>
          <clipPath id="clip0_badge">
            <rect width="150" height="150" fill="white" />
          </clipPath>
        </defs>
      </svg>
      <div class="badge-hex-inner">{{ teamLetter }}{{ playerNumberLabel }}</div>
    </div>
    <div class="badge-stats">
      <div class="stat ap-stat">
        <div class="stat-row ap-row">
          <span class="stat-label ap-label">{{ isDead ? 'Revive in' : 'AP' }}</span>
          <div class="ap-value">
            <template v-if="isDead">
              <span class="value-strong">{{ reviveRemainingTimeText }}</span>
              <span class="value-max">s</span>
            </template>
            <template v-else>
              <span class="value-strong">{{ apCurrentText }}</span>
              <span class="value-slash">/</span>
              <span class="value-max">{{ apMaxText }}</span>
            </template>
          </div>
        </div>
        <div class="stat-bar ap-bar">
          <span class="bar-cap left" />
          <div class="bar-track">
            <div
              class="bar-fill"
              :class="isDead ? 'revive-fill' : 'ap-fill'"
              :style="{ width: `${isDead ? reviveSpeedPercent : apPercent}%` }"
            />
          </div>
          <span class="bar-cap right" />
        </div>
      </div>
      <div class="stat level-stat">
        <div class="level-level-box">
          <div class="level-box">{{ levelLabel }}</div>
        </div>
        <div class="level-stat-content">
          <div class="level-row">
            <div class="xp-value">
              <span class="value-strong">{{ xpCurrentText }}</span>
              <span class="value-slash">/</span>
              <span class="value-max">{{ xpMaxText }}</span>
            </div>
          </div>
          <div class="stat-bar xp-bar">
            <span class="bar-cap left" />
            <div class="bar-track xp-track">
              <div class="bar-fill xp-fill" :style="{ width: `${xpPercent}%` }" />
            </div>
            <span class="bar-cap right" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Hexagonal player badge with AP bar + level/XP bar.
 * Open-sourced from the game's internal UI.
 */

import { computed } from 'vue';
import { ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk/workshop';

type AttrMap = Record<string, number | string> | null | undefined;

const props = defineProps<{
  battleAttributes: AttrMap;
}>();

const getAttrNumber = (id: ERobotBridgeDemoAttributeId) => {
  const raw = props.battleAttributes?.[String(id)];
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
};

const clampPercent = (value: number, max: number) => {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
};

const teamId = computed(() => getAttrNumber(ERobotBridgeDemoAttributeId.TeamID));
const teamTone = computed(() => {
  if (teamId.value === 0) return 'red';
  if (teamId.value === 1) return 'blue';
  return 'neutral';
});
const teamLetter = computed(() => {
  if (teamTone.value === 'red') return 'R';
  if (teamTone.value === 'blue') return 'B';
  return 'N';
});

const playerId = computed(() => Math.max(0, getAttrNumber(ERobotBridgeDemoAttributeId.TeamNumber)));
const playerNumberLabel = computed(() => playerId.value > 0 ? playerId.value.toFixed(0) : '0');

const apCurrent = computed(() => Math.max(0, getAttrNumber(ERobotBridgeDemoAttributeId.Health)));
const apMax = computed(() => Math.max(apCurrent.value, getAttrNumber(ERobotBridgeDemoAttributeId.HealthMax)));
const apPercent = computed(() => clampPercent(apCurrent.value, apMax.value || 1));
const apCurrentText = computed(() => apCurrent.value.toFixed(0));
const apMaxText = computed(() => apMax.value.toFixed(0));

const isDead = computed(() => getAttrNumber(ERobotBridgeDemoAttributeId.Defeated) === 1);

const reviveProgress = computed(() => getAttrNumber(ERobotBridgeDemoAttributeId.ReviveProgress));
const reviveProgressMax = computed(() => getAttrNumber(ERobotBridgeDemoAttributeId.ReviveProgressMax));
const reviveSpeed = computed(() => getAttrNumber(ERobotBridgeDemoAttributeId.ReviveSpeed));
const reviveSpeedPercent = computed(() => clampPercent(reviveProgress.value, reviveProgressMax.value || 1));
const reviveRemainingTime = computed(() => Math.max(0, (reviveProgressMax.value - reviveProgress.value) / reviveSpeed.value));
const reviveRemainingTimeText = computed(() => reviveRemainingTime.value > 0 ? reviveRemainingTime.value.toFixed(0) : '—');

const level = computed(() => Math.max(0, getAttrNumber(ERobotBridgeDemoAttributeId.Level)));
const levelLabel = computed(() => level.value > 0 ? level.value.toFixed(0) : '--');

const experience = computed(() => Math.max(0, getAttrNumber(ERobotBridgeDemoAttributeId.Experience)));
const nextLevelExperienceMax = computed(() => Math.max(experience.value, getAttrNumber(ERobotBridgeDemoAttributeId.NextLevelExpMax)));
const xpPercent = computed(() => clampPercent(experience.value, nextLevelExperienceMax.value || 1));
const xpCurrentText = computed(() => experience.value.toFixed(0));
const xpMaxText = computed(() => nextLevelExperienceMax.value > 0 ? nextLevelExperienceMax.value.toFixed(0) : '—');
</script>

<style scoped>
.player-badge { display: flex; align-items: center; padding: 0.4rem 0.6rem; min-width: 40rem; color: #f7f9fb; pointer-events: none; }
.badge-hex { position: relative; width: 10rem; height: 10rem; display: grid; place-items: center; margin-right: 0.8rem; }
.badge-hex-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.badge-hex-shape { fill: rgba(217,217,217,0.6); stroke: #f94d4d; stroke-width: 3; vector-effect: non-scaling-stroke; }
.badge-hex-inner { font-size: 4.7rem; font-weight: 800; letter-spacing: 0.03em; color: #f5f5f5; position: absolute; z-index: 2; }

.badge-stats { flex: 1; display: flex; flex-direction: column; gap: 0.5rem; }
.stat-row, .level-row { display: flex; align-items: baseline; gap: 0.8rem; }
.level-stat { display: flex; align-items: center; }
.level-stat-content { flex: 1; padding-left: 0.8rem; display: flex; flex-direction: column; justify-content: flex-end; }
.stat-row { justify-content: space-between; }
.stat-label { font-size: 2rem; font-weight: 800; letter-spacing: 0.08em; color: #f4f7f8; opacity: 0.9; }
.ap-row { align-items: flex-end; }
.ap-label { margin-right: 0.6rem; }
.ap-value { display: flex; align-items: baseline; gap: 0.4rem; margin-left: auto; }

.value-strong { font-size: 4rem; font-weight: 900; line-height: 1; letter-spacing: 0.02em; color: #f6f7f8; }
.value-slash { font-size: 3rem; font-weight: 900; color: #f6f7f8; line-height: 1; }
.value-max { font-size: 3rem; font-weight: 900; color: #b5b5b5; line-height: 1; }

.level-box {
  min-width: 3.7rem; height: 3.7rem; display: grid; place-items: center;
  padding: 0 0.8rem; color: #e1fbff; font-size: 2rem; font-weight: 800;
  letter-spacing: 0.05em; background: rgba(50, 130, 200, 0.6);
  clip-path: polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%);
}

.xp-value { margin-left: auto; display: flex; align-items: baseline; gap: 0.25rem; }
.xp-value .value-strong { font-size: 2rem; }
.xp-value .value-max { font-size: 1.7rem; color: #b5b5b5; }
.xp-value .value-slash { font-size: 2rem; }

.stat-bar { position: relative; width: 100%; height: 1.4rem; display: flex; align-items: center; gap: 0.65rem; }
.bar-track { height: 0.8rem; background: rgba(255,255,255,0.28); overflow: hidden; flex: 1; position: relative; }
.xp-track { height: 0.4rem; }
.xp-bar .bar-cap { height: 0.8rem; width: 0.4rem; }
.bar-fill { position: absolute; inset: 0; width: 0; transition: width 0.25s ease-out; z-index: 1; }
.bar-cap { display: inline-block; width: 0.5rem; height: 1.4rem; background: #d9d9d9; position: relative; z-index: 2; }

.ap-fill { background: #c7f1f2; }
.revive-fill { background: #4ade80; }
.xp-fill { background: #fec636; }

.team-red .badge-hex-shape { stroke: #f04a4a; }
.team-blue .badge-hex-shape { stroke: #4ac2ff; }
.team-neutral .badge-hex-shape { stroke: #b9b9b9; }
.badge-hex.is-dead .badge-hex-shape { opacity: 0.2; }
</style>
