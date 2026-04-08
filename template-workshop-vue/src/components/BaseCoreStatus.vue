<template>
  <div class="progress-bar-panel">
    <transition name="team-slide-left" mode="out-in">
      <div class="team-section left-section" :key="`left-${props.leftTeamId}`">
        <div class="main-bar" :class="[leftTeamClass, { 'badge-visible': isLeftOutpostDestroyed }]" :style="{ background: leftBarBg }">
          <template v-if="!isLeftOutpostDestroyed">
            <div class="bar-fill clip-point-right" :class="`fill-${leftTeamClass}`" :style="{ right: '10rem', width: `calc(${leftMainPercent / 100} * (100% - 10rem))` }" />
            <div class="bar-fill clip-concave-left" :class="`fill-${leftTeamClass}`" :style="{ right: '5.2rem', width: `calc(${leftBasePercent / 100} * (11.3rem - 5.2rem))` }" />
          </template>
          <div v-else class="bar-fill" :class="`fill-${leftTeamClass}`" :style="{ right: '5.2rem', width: `calc(${leftBasePercent / 100} * (100% - 5.2rem))` }" />
          <div class="bar-content bar-content-left">
            <div class="logo-box" :class="`logo-${leftTeamClass}`">
              <div class="logo-placeholder">{{ leftTeamId === 0 ? 'R' : 'B' }}</div>
            </div>
            <div class="bar-icon" :class="leftBcState === 1 ? `base-expanded-${leftTeamClass}` : `base-locked-${leftTeamClass}`">
              <span class="hud-icon" v-html="leftBcState === 1 ? castleRuinsSvg : castleSvg" />
            </div>
            <div v-if="!isLeftOutpostDestroyed" class="chevron" :class="leftTeamClass === 'red-team' ? 'chevron-r-red' : 'chevron-r-blue'">
              <svg class="chevron-svg" viewBox="0 0 10 20" preserveAspectRatio="none" fill="none"><polyline points="1,0.5 9.5,10 1,19.5" stroke="currentColor" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square" vector-effect="non-scaling-stroke" /></svg>
            </div>
            <div v-if="!isLeftOutpostDestroyed" class="bar-icon" :class="`outpost-icon-${leftTeamClass}`">
              <span class="hud-icon" v-html="whiteTowerSvg" />
            </div>
            <span class="hp-num hp-num-left thin-font">{{ leftDisplayHp }}</span>
          </div>
        </div>
        <div v-if="isLeftOutpostDestroyed" class="outpost-badge" :class="[leftTeamClass, isLeftOutpostRepairing ? 'badge-repairing' : 'badge-dead']">
          <span class="hud-icon" v-html="isLeftOutpostRepairing ? whiteTowerSvg : towerFallSvg" />
        </div>
      </div>
    </transition>

    <div class="time-box">
      <div class="time-label thin-font">
        <transition name="status-fade" mode="out-in">
          <div v-if="props.status === 'ready'" class="time-content" key="not">PREPARED <span class="key-badge key-badge-active">{{ prepareKeyLabel }}</span></div>
          <div v-else-if="props.status === 'not-ready'" class="time-content" key="ready"><span class="key-badge">{{ prepareKeyLabel }}</span> PREPARE</div>
          <div v-else-if="props.status === 'in-game'" class="time-content time-ingame" key="ingame">{{ props.timeText }}</div>
        </transition>
      </div>
    </div>

    <transition name="team-slide-right" mode="out-in">
      <div class="team-section right-section" :key="`right-${props.rightTeamId}`">
        <div class="main-bar" :class="[rightTeamClass, { 'badge-visible': isRightOutpostDestroyed }]" :style="{ background: rightBarBg }">
          <template v-if="!isRightOutpostDestroyed">
            <div class="bar-fill clip-concave-right" :class="`fill-${rightTeamClass}`" :style="{ left: '5.2rem', width: `calc(${rightBasePercent / 100} * (11.3rem - 5.2rem))` }" />
          </template>
          <div v-else class="bar-fill" :class="`fill-${rightTeamClass}`" :style="{ left: '5.2rem', width: `calc(${rightBasePercent / 100} * (100% - 5.2rem))` }" />
          <div class="bar-content bar-content-right">
            <div class="logo-box" :class="`logo-${rightTeamClass}`">
              <div class="logo-placeholder">{{ rightTeamId === 0 ? 'R' : 'B' }}</div>
            </div>
            <div class="bar-icon" :class="rightBcState === 1 ? `base-expanded-${rightTeamClass}` : `base-locked-${rightTeamClass}`">
              <span class="hud-icon" v-html="rightBcState === 1 ? castleRuinsSvg : castleSvg" />
            </div>
            <div v-if="!isRightOutpostDestroyed" class="chevron" :class="rightTeamClass === 'red-team' ? 'chevron-l-red' : 'chevron-l-blue'">
              <svg class="chevron-svg" viewBox="0 0 10 20" preserveAspectRatio="none" fill="none"><polyline points="9,0.5 0.5,10 9,19.5" stroke="currentColor" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square" vector-effect="non-scaling-stroke" /></svg>
            </div>
            <div v-if="!isRightOutpostDestroyed" class="bar-icon" :class="`outpost-icon-${rightTeamClass}`">
              <span class="hud-icon" v-html="whiteTowerSvg" />
            </div>
            <span class="hp-num hp-num-right thin-font">{{ rightDisplayHp }}</span>
          </div>
          <div v-if="!isRightOutpostDestroyed" class="bar-fill clip-point-left" :class="`fill-${rightTeamClass}`" :style="{ left: '10rem', width: `calc(${rightMainPercent / 100} * (100% - 10rem))` }" />
        </div>
        <div v-if="isRightOutpostDestroyed" class="outpost-badge" :class="[rightTeamClass, isRightOutpostRepairing ? 'badge-repairing' : 'badge-dead']">
          <span class="hud-icon" v-html="isRightOutpostRepairing ? whiteTowerSvg : towerFallSvg" />
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
/**
 * Base/outpost HP status bar with team coloring, chevron separators,
 * and center match timer. Open-sourced from the game's internal UI.
 */

import { computed } from 'vue';
import castleSvg from '@/assets/img/hud/castle.svg?raw';
import castleRuinsSvg from '@/assets/img/hud/castle-ruins.svg?raw';
import whiteTowerSvg from '@/assets/img/hud/white-tower.svg?raw';
import towerFallSvg from '@/assets/img/hud/tower-fall.svg?raw';

type BaseSide = { hp: number | string; hpMax?: number | string; bcState?: number; };

const props = withDefaults(
  defineProps<{
    status: 'not-ready' | 'ready' | 'in-game';
    left: BaseSide;
    right: BaseSide;
    leftTeamId: number;
    rightTeamId: number;
    leftOutpost?: BaseSide;
    rightOutpost?: BaseSide;
    timeText?: string;
    isGamepadMode?: boolean;
    leftOutpostRepairProgress?: number;
    rightOutpostRepairProgress?: number;
  }>(),
  { isGamepadMode: false, leftOutpostRepairProgress: 0, rightOutpostRepairProgress: 0 },
);

const leftTeamClass = computed(() => props.leftTeamId === 0 ? 'red-team' : 'blue-team');
const rightTeamClass = computed(() => props.rightTeamId === 0 ? 'red-team' : 'blue-team');

const TEAM_BG: Record<string, string> = { 'red-team': 'rgba(124,99,102,0.5)', 'blue-team': 'rgba(94,116,133,0.5)' };
const leftBarBg = computed(() => {
  const c = TEAM_BG[leftTeamClass.value];
  if (!isLeftOutpostDestroyed.value && props.leftOutpost) return `linear-gradient(to right,${c} 0,${c} calc(100% - 11.5rem),transparent calc(100% - 10.8rem),${c} calc(100% - 9.5rem),${c} calc(100% - 5.2rem),transparent calc(100% - 5.2rem))`;
  return `linear-gradient(to right,${c} 0,${c} calc(100% - 5.2rem),transparent calc(100% - 5.2rem))`;
});
const rightBarBg = computed(() => {
  const c = TEAM_BG[rightTeamClass.value];
  if (!isRightOutpostDestroyed.value && props.rightOutpost) return `linear-gradient(to left,${c} 0,${c} calc(100% - 11.5rem),transparent calc(100% - 10.8rem),${c} calc(100% - 9.5rem),${c} calc(100% - 5.2rem),transparent calc(100% - 5.2rem))`;
  return `linear-gradient(to left,${c} 0,${c} calc(100% - 5.2rem),transparent calc(100% - 5.2rem))`;
});

const isLeftOutpostDestroyed = computed(() => !!props.leftOutpost && Number(props.leftOutpost.hp) <= 0);
const isRightOutpostDestroyed = computed(() => !!props.rightOutpost && Number(props.rightOutpost.hp) <= 0);
const isLeftOutpostRepairing = computed(() => isLeftOutpostDestroyed.value && props.leftOutpostRepairProgress > 0);
const isRightOutpostRepairing = computed(() => isRightOutpostDestroyed.value && props.rightOutpostRepairProgress > 0);

const leftBcState = computed(() => props.left.bcState ?? 0);
const rightBcState = computed(() => props.right.bcState ?? 0);

const leftDisplayHp = computed(() => { if (props.leftOutpost && !isLeftOutpostDestroyed.value) return props.leftOutpost.hp; return props.left.hp; });
const leftMainPercent = computed(() => {
  if (props.leftOutpost && !isLeftOutpostDestroyed.value) { const hp = Number(props.leftOutpost.hp); const max = Number(props.leftOutpost.hpMax) || 1; return Math.max(0, Math.min(100, (hp / max) * 100)); }
  return Math.max(0, Math.min(100, (Number(props.left.hp) / (Number(props.left.hpMax) || 1)) * 100));
});
const rightDisplayHp = computed(() => { if (props.rightOutpost && !isRightOutpostDestroyed.value) return props.rightOutpost.hp; return props.right.hp; });
const rightMainPercent = computed(() => {
  if (props.rightOutpost && !isRightOutpostDestroyed.value) { const hp = Number(props.rightOutpost.hp); const max = Number(props.rightOutpost.hpMax) || 1; return Math.max(0, Math.min(100, (hp / max) * 100)); }
  return Math.max(0, Math.min(100, (Number(props.right.hp) / (Number(props.right.hpMax) || 1)) * 100));
});

const leftBasePercent = computed(() => Math.max(0, Math.min(100, (Number(props.left.hp) / (Number(props.left.hpMax) || 1)) * 100)));
const rightBasePercent = computed(() => Math.max(0, Math.min(100, (Number(props.right.hp) / (Number(props.right.hpMax) || 1)) * 100)));

const prepareKeyLabel = computed(() => props.isGamepadMode ? 'RB' : 'P');
</script>

<style scoped>
.progress-bar-panel { display: flex; align-items: stretch; height: 5rem; color: #fff; margin-top: 1vh; }
.team-section { display: flex; align-items: stretch; }
.left-section { flex-direction: row-reverse; }
.right-section { flex-direction: row; }
.main-bar { position: relative; width: 36rem; height: 100%; overflow: hidden; transition: width 0.3s ease; }
.main-bar.badge-visible { width: 30.4rem; }
.bar-fill { position: absolute; top: 0; height: 100%; z-index: 1; transition: width 0.3s ease-out; }
.clip-point-right { clip-path: polygon(0% 0%, calc(100% - 1.8rem) 0%, 100% 50%, calc(100% - 1.8rem) 100%, 0% 100%); }
.clip-point-left { clip-path: polygon(1.8rem 0%, 100% 0%, 100% 100%, 1.8rem 100%, 0% 50%); }
.clip-concave-left { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 1.8rem 50%); }
.clip-concave-right { clip-path: polygon(0% 0%, 100% 0%, calc(100% - 1.8rem) 50%, 100% 100%, 0% 100%); }
.fill-red-team { background: #ca343e; }
.fill-blue-team { background: #3281cb; }

.bar-content { position: relative; z-index: 2; display: flex; align-items: center; width: 100%; height: 100%; gap: 0.5rem; }
.bar-content-left { flex-direction: row-reverse; }
.bar-content-right { flex-direction: row; }
.hp-num { font-size: 3.6rem; letter-spacing: 0.1em; white-space: nowrap; padding: 0 1rem; flex-shrink: 0; font-weight: 400; }
.hp-num-left { text-align: right; flex: 1; }
.hp-num-right { text-align: left; flex: 1; }

.bar-icon { width: 4.7rem; height: 4.7rem; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.hud-icon { display: inline-flex; align-items: center; justify-content: center; width: 3.6rem; height: 3.6rem; flex-shrink: 0; }
.hud-icon :deep(svg) { max-width: 100%; max-height: 100%; width: auto; height: auto; --fill-0: rgba(255,255,255,0.9); --stroke-0: transparent; }

.logo-box { width: 4.9rem; height: 5rem; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #fff; box-sizing: border-box; padding: 0.2rem; }
.logo-placeholder { font-size: 2.5rem; font-weight: 900; color: #333; }
.logo-red-team { border: 3px solid #ca343e; }
.logo-blue-team { border: 3px solid #3281cb; }

.chevron { flex-shrink: 0; width: 0; align-self: stretch; position: relative; z-index: 3; }
.chevron-svg { position: absolute; left: -0.75rem; top: 0; width: 1.5rem; height: 100%; overflow: visible; }
.chevron-r-red, .chevron-r-blue, .chevron-l-red, .chevron-l-blue { color: transparent; }

.outpost-badge { width: 5rem; height: 5rem; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin: 0 0.3rem; }
.badge-dead.red-team { background: rgba(124,99,102,0.5); }
.badge-dead.blue-team { background: rgba(94,116,133,0.5); }
.badge-repairing { background: #2a3a2e; }

.time-box { background: rgba(255,255,255,0.1); padding: 0 2rem; font-size: 2.3rem; display: flex; align-items: center; font-weight: 100; width: 14rem; text-align: center; justify-content: center; flex-shrink: 0; }
.time-label { width: 100%; text-align: center; }
.time-content { display: flex; align-items: center; justify-content: center; font-weight: 300; }
.time-ingame { font-size: 4rem; font-weight: 300; line-height: 0.5; letter-spacing: 0.1em; }
.key-badge { background: #8a8a8a; color: #fff; border-radius: 20%; padding: 0.3rem; font-size: 1.5rem; display: flex; height: 2rem; width: 2rem; font-weight: 500; align-items: center; justify-content: center; margin: 0 0.5rem; }
.key-badge-active { background: #39bf18; }

.status-fade-enter-active, .status-fade-leave-active { transition: opacity 0.05s ease, transform 0.05s ease; }
.status-fade-enter-from, .status-fade-leave-to { opacity: 0; transform: translateY(-6%); }
.team-slide-left-enter-active { transition: opacity 0.4s cubic-bezier(0.4,0,0.2,1), transform 0.4s cubic-bezier(0.4,0,0.2,1); }
.team-slide-left-leave-active { transition: opacity 0.25s ease-in, transform 0.25s ease-in; }
.team-slide-left-enter-from { opacity: 0; transform: translateX(-30px); }
.team-slide-left-leave-to { opacity: 0; transform: translateX(-20px); }
.team-slide-right-enter-active { transition: opacity 0.4s cubic-bezier(0.4,0,0.2,1), transform 0.4s cubic-bezier(0.4,0,0.2,1); }
.team-slide-right-leave-active { transition: opacity 0.25s ease-in, transform 0.25s ease-in; }
.team-slide-right-enter-from { opacity: 0; transform: translateX(30px); }
.team-slide-right-leave-to { opacity: 0; transform: translateX(20px); }
</style>
