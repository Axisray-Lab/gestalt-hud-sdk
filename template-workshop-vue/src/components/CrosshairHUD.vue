<template>
  <div class="crosshair">
    <div class="ring">
      <div class="ring-outline"></div>
      <div class="ring-outline secondary"></div>

      <Transition name="arc-fade">
        <span v-if="showArcTall && !props.isUnsafeMode" class="ring-mode-arc arc-tall" v-html="arcTallRaw" />
      </Transition>
      <span
        v-if="showArcTall && !props.isUnsafeMode && (props.chargingProgress ?? 0) > 0"
        class="ring-mode-arc arc-tall arc-tall-charging"
        :style="{ clipPath: `inset(${100 - (props.chargingProgress ?? 0)}% 0 0 0)` }"
        v-html="arcTallRaw"
      />
      <Transition name="arc-fade">
        <span v-if="props.isUnsafeMode" class="ring-mode-arc arc-unsafe" v-html="arcUnsafeRaw" />
      </Transition>

      <div v-if="props.firingMode !== undefined" class="ring-mode-container">
        <div v-if="props.firingModeIcon" class="ring-mode-label" :style="labelGroupStyle">
          <Transition name="mode-icon-fade" mode="out-in">
            <span :key="props.firingMode" class="ring-mode-label-icon" v-html="props.firingModeIcon" />
          </Transition>
        </div>
        <div class="ring-arcs-column" :style="{ left: `calc(4.3rem + ${ARC_COLUMN_OFFSET_X})`, top: ARC_COLUMN_OFFSET_Y }">
          <span class="ring-arc-item arc-upper" :class="{ 'arc-hidden': !showArcLower }" v-html="arcUpperRaw" />
          <span class="ring-arc-item arc-center" :class="{ 'arc-hidden': !showArcCenter }" v-html="arcCenterRaw" />
          <span class="ring-arc-item arc-lower" :class="{ 'arc-hidden': !showArcUpper }" v-html="arcLowerRaw" />
        </div>
      </div>

      <div class="reticle">
        <span class="tick vertical top" :style="{ top: tickTopPosition }"></span>
        <span class="tick vertical bottom" :style="{ bottom: tickBottomPosition }"></span>
        <span class="tick horizontal left" :style="{ left: tickLeftPosition }"></span>
        <span class="tick horizontal right" :style="{ right: tickRightPosition }"></span>
        <template v-for="hit in activeHitConfirms" :key="hit.id">
          <span class="tick diagonal top-left hit-confirm" :style="{ animationDelay: `${hit.delay}ms` }"></span>
          <span class="tick diagonal top-right hit-confirm" :style="{ animationDelay: `${hit.delay}ms` }"></span>
          <span class="tick diagonal bottom-left hit-confirm" :style="{ animationDelay: `${hit.delay}ms` }"></span>
          <span class="tick diagonal bottom-right hit-confirm" :style="{ animationDelay: `${hit.delay}ms` }"></span>
        </template>
      </div>

      <div class="ammo-bar">
        <svg class="ammo-arc" viewBox="0 0 100 100" aria-hidden="true">
          <path class="ammo-arc-shadow" :d="ammoArcBackgroundD" :stroke-width="arcShadowStrokeWidth" />
          <path v-if="overheatArcPath" class="ammo-arc-overheat-bar" :d="overheatArcPath.d" :stroke-width="arcStrokeWidth" />
          <path v-for="seg in ammoArcSegments" :key="seg.index" class="ammo-arc-seg" :class="{ active: seg.active }" :d="seg.d" :stroke-width="arcStrokeWidth" />
          <path v-if="ammoArcPartial" class="ammo-arc-partial" :d="ammoArcPartial.d" :stroke-width="arcStrokeWidth" />
        </svg>
      </div>

      <div class="info left">
        <div class="panel">
          <div class="value">
            <span class="current" :class="{ danger: ammo === 0 }">{{ ammo }}</span>
            <span class="divider">/</span>
            <span class="max">{{ ammoMaxLabel }}</span>
          </div>
        </div>
        <div class="connector">
          <svg viewBox="0 0 146 16" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M143 3.38477L129.5 11.8848H0" stroke="#DB8B1B" stroke-opacity="0.6" stroke-width="8" />
          </svg>
        </div>
      </div>
      <div class="info right">
        <div class="connector">
          <svg viewBox="0 0 146 16" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M2.13281 3.38477L15.6328 11.8848H145.133" stroke="#DB8B1B" stroke-opacity="0.6" stroke-width="8" />
          </svg>
        </div>
        <div class="panel">
          <div class="value">
            <span class="speed">{{ speedLabel }}</span>
            <span class="unit">m/s</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Crosshair HUD with ring outline, firing-mode arcs, segmented ammo arc,
 * fire-spread animation, and hit-confirm effects.
 *
 * Open-sourced from the game's internal UI.
 */

import { computed, ref, watch } from 'vue';
import arcTallRaw from '@/assets/img/hud/arc-tall-grey.svg?raw';
import arcUnsafeRaw from '@/assets/img/hud/uninsured.svg?raw';
import arcUpperRaw from '@/assets/img/hud/arc-short-upper.svg?raw';
import arcCenterRaw from '@/assets/img/hud/arc-short-center.svg?raw';
import arcLowerRaw from '@/assets/img/hud/arc-short-lower.svg?raw';

const props = withDefaults(
  defineProps<{
    ammo?: number;
    ammoMax?: number;
    ammoArcCurrent?: number;
    ammoArcTotal?: number;
    ammoArcProgress?: number;
    isOverheated?: boolean;
    overheatBarPercent?: number;
    speed?: number;
    segments?: number;
    arcStartDeg?: number;
    arcEndDeg?: number;
    arcGapDeg?: number;
    arcRadius?: number;
    arcStrokeWidth?: number;
    arcBgRadiusOffset?: number;
    arcShadowStrokeWidth?: number;
    fillFromArcEnd?: boolean;
    firingMode?: number;
    firingModeIcon?: string;
    fireTrigger?: number;
    hitConfirmTrigger?: number;
    chargingProgress?: number;
    isUnsafeMode?: boolean;
  }>(),
  {
    ammo: 0, ammoMax: 0, speed: 0, segments: 10,
    arcStartDeg: 30, arcEndDeg: 150, arcGapDeg: 2, arcRadius: 52,
    arcStrokeWidth: 2, arcBgRadiusOffset: 0, arcShadowStrokeWidth: 2,
    fillFromArcEnd: true, ammoArcProgress: 0, isOverheated: false,
    overheatBarPercent: 0, firingMode: 0, fireTrigger: 0,
    hitConfirmTrigger: 0, chargingProgress: 0, isUnsafeMode: false,
  },
);

const showArcTall = computed(() => [0, 1, 2].includes(props.firingMode ?? 0));
const LABEL_HIDE_DURATION = 150;
const delayedFiringMode = ref(props.firingMode ?? 0);
let arcDelayTimer: number | null = null;

watch(() => props.firingMode, newMode => {
  if (arcDelayTimer) clearTimeout(arcDelayTimer);
  arcDelayTimer = window.setTimeout(() => { delayedFiringMode.value = newMode ?? 0; }, LABEL_HIDE_DURATION);
});

const showArcUpper = computed(() => [0, 1, 3].includes(delayedFiringMode.value));
const showArcCenter = computed(() => [0, 2, 3].includes(delayedFiringMode.value));
const showArcLower = computed(() => [1, 2, 3].includes(delayedFiringMode.value));

const fireSpreadPercent = ref(0);
let fireRecoveryTimer: number | null = null;

interface HitConfirmInstance { id: number; delay: number; }
const activeHitConfirms = ref<HitConfirmInstance[]>([]);
let hitConfirmIdCounter = 0;

const FIRE_SPREAD_INCREMENT = 25;
const FIRE_SPREAD_MAX = 100;
const FIRE_RECOVERY_DELAY = 100;
const FIRE_RECOVERY_SPEED = 2.5;
const HIT_CONFIRM_DURATION = 400;

watch(() => props.fireTrigger, (nv, ov) => {
  if (nv !== ov && nv > 0) {
    fireSpreadPercent.value = Math.min(FIRE_SPREAD_MAX, fireSpreadPercent.value + FIRE_SPREAD_INCREMENT);
    if (fireRecoveryTimer) clearTimeout(fireRecoveryTimer);
    fireRecoveryTimer = window.setTimeout(() => {
      const recover = () => { if (fireSpreadPercent.value > 0) { fireSpreadPercent.value = Math.max(0, fireSpreadPercent.value - FIRE_RECOVERY_SPEED); requestAnimationFrame(recover); } };
      recover();
    }, FIRE_RECOVERY_DELAY);
  }
});

watch(() => props.hitConfirmTrigger, (nv, ov) => {
  if (nv !== ov && nv > 0) {
    if (activeHitConfirms.value.length >= 50) activeHitConfirms.value.shift();
    const newHit: HitConfirmInstance = { id: hitConfirmIdCounter++, delay: 0 };
    activeHitConfirms.value.push(newHit);
    window.setTimeout(() => { const idx = activeHitConfirms.value.findIndex(h => h.id === newHit.id); if (idx !== -1) activeHitConfirms.value.splice(idx, 1); }, HIT_CONFIRM_DURATION);
  }
});

const ammo = computed(() => Math.max(0, Math.round(props.ammo ?? 0)));
const ammoMax = computed(() => Math.max(0, Math.round(props.ammoMax ?? 0)));
const ammoMaxLabel = computed(() => ammoMax.value > 0 ? String(ammoMax.value) : '---');
const speedLabel = computed(() => { const v = Number.isFinite(props.speed) ? Number(props.speed) : 0; return v.toFixed(1); });

const ammoArcCurrent = computed(() => Math.max(0, Math.round(props.ammoArcCurrent ?? props.ammo ?? 0)));
const ammoArcTotal = computed(() => { const c = props.ammoArcTotal ?? props.segments ?? props.ammoMax ?? 0; return Math.max(1, Math.round(c as number)); });
const ammoArcProgress = computed(() => { const raw = Number(props.ammoArcProgress ?? 0); return Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0; });
const arcStrokeWidth = computed(() => { const v = Number(props.arcStrokeWidth); return Number.isFinite(v) ? Math.max(0.5, v) : 3.2; });
const arcShadowStrokeWidth = computed(() => { const v = Number(props.arcShadowStrokeWidth); return Number.isFinite(v) ? Math.max(0.5, v) : 26; });

type ArcSeg = { index: number; active: boolean; d: string };
const toRad = (deg: number) => (deg * Math.PI) / 180;
const polarToCartesian = (cx: number, cy: number, r: number, deg: number) => {
  const rad = toRad(deg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};
const describeArc = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
};

const ammoArcSegments = computed<ArcSeg[]>(() => {
  const count = Math.max(1, Math.floor(ammoArcTotal.value));
  const startDeg = props.arcStartDeg ?? 25; const endDeg = props.arcEndDeg ?? 155;
  const gapDeg = Math.max(0, props.arcGapDeg ?? 2.5); const r = Math.max(1, props.arcRadius ?? 52);
  const span = endDeg - startDeg; const step = span / count;
  const filled = Math.min(count, Math.max(0, Math.round(ammoArcCurrent.value)));
  const fillFromEnd = !!props.fillFromArcEnd;
  return Array.from({ length: count }, (_, i) => {
    const segStart = startDeg + i * step + gapDeg / 2;
    const segEnd = startDeg + (i + 1) * step - gapDeg / 2;
    const safeEnd = segEnd <= segStart ? segStart + 0.001 : segEnd;
    return { index: i, active: fillFromEnd ? i >= count - filled : i < filled, d: describeArc(50, 50, r, segStart, safeEnd) };
  });
});

const ammoArcPartial = computed(() => {
  const partialRatio = ammoArcProgress.value / 100;
  if (partialRatio <= 0) return null;
  const count = Math.max(1, Math.floor(ammoArcTotal.value));
  const startDeg = props.arcStartDeg ?? 25; const endDeg = props.arcEndDeg ?? 155;
  const gapDeg = Math.max(0, props.arcGapDeg ?? 2.5); const r = Math.max(1, props.arcRadius ?? 52);
  const span = endDeg - startDeg; const step = span / count;
  const filled = Math.min(count, Math.max(0, Math.round(ammoArcCurrent.value)));
  const fillFromEnd = !!props.fillFromArcEnd;
  const targetIndex = fillFromEnd ? count - filled - 1 : filled;
  if (targetIndex < 0 || targetIndex >= count) return null;
  const segStart = startDeg + targetIndex * step + gapDeg / 2;
  const segEnd = startDeg + (targetIndex + 1) * step - gapDeg / 2;
  const safeEnd = segEnd <= segStart ? segStart + 0.001 : segEnd;
  const segSpan = safeEnd - segStart;
  const partialStart = fillFromEnd ? Math.max(segStart, safeEnd - segSpan * partialRatio) : segStart;
  const partialEnd = fillFromEnd ? safeEnd : Math.min(safeEnd, segStart + segSpan * partialRatio);
  if (partialEnd <= partialStart) return null;
  return { d: describeArc(50, 50, r, partialStart, partialEnd) };
});

const ammoArcBackgroundD = computed(() => {
  const startDeg = props.arcStartDeg ?? 25; const endDeg = props.arcEndDeg ?? 155;
  const r = Math.max(1, props.arcRadius ?? 52); const offset = props.arcBgRadiusOffset ?? 1.8;
  return describeArc(50, 50, r + offset, startDeg, endDeg);
});

const overheatArcPath = computed(() => {
  if (!props.isOverheated) return null;
  const percent = Math.min(100, Math.max(0, props.overheatBarPercent ?? 0));
  if (percent <= 0) return null;
  const startDeg = props.arcStartDeg ?? 25; const endDeg = props.arcEndDeg ?? 155;
  const r = Math.max(1, props.arcRadius ?? 52); const span = endDeg - startDeg;
  const overheatAngle = (percent / 100) * span;
  const overheatEnd = endDeg - overheatAngle;
  if (overheatEnd >= endDeg) return null;
  return { d: describeArc(50, 50, r, overheatEnd, endDeg) };
});

const BASE_TICK_DISTANCE = 1;
const MAX_TICK_DISTANCE = 2.8;
const TICK_SPREAD_RANGE = MAX_TICK_DISTANCE - BASE_TICK_DISTANCE;
const tickTopPosition = computed(() => `-${(BASE_TICK_DISTANCE + (fireSpreadPercent.value / 100) * TICK_SPREAD_RANGE).toFixed(3)}rem`);
const tickBottomPosition = computed(() => `-${(BASE_TICK_DISTANCE + (fireSpreadPercent.value / 100) * TICK_SPREAD_RANGE).toFixed(3)}rem`);
const tickLeftPosition = computed(() => `-${(BASE_TICK_DISTANCE + (fireSpreadPercent.value / 100) * TICK_SPREAD_RANGE).toFixed(3)}rem`);
const tickRightPosition = computed(() => `-${(BASE_TICK_DISTANCE + (fireSpreadPercent.value / 100) * TICK_SPREAD_RANGE).toFixed(3)}rem`);

const ARC_SHORT_TOP: Record<string, number> = { upper: 37.2, center: 46.0, lower: 55.0 };
const ARC_SHORT_H = 7.6;
const ARC_COLUMN_OFFSET_X = '-0.5rem';
const ARC_COLUMN_OFFSET_Y = '0rem';
const CONTAINER_TOP_PCT = ARC_SHORT_TOP.upper;
const CONTAINER_H_PCT = ARC_SHORT_TOP.lower + ARC_SHORT_H - CONTAINER_TOP_PCT;

const LABEL_OFFSETS: Record<number, { x: string; y: string }> = {
  0: { x: '1.2rem', y: '-2.6rem' }, 1: { x: '0.8rem', y: '0.5rem' },
  2: { x: '1.2rem', y: '3.351rem' }, 3: { x: '0rem', y: '0rem' },
};

const labelGroupStyle = computed(() => {
  const mode = props.firingMode ?? 0;
  const visibleShortArcs: Record<number, string[]> = {
    0: ['upper', 'center'], 1: ['upper', 'lower'], 2: ['center', 'lower'], 3: ['upper', 'center', 'lower'],
  };
  const arcNames = visibleShortArcs[mode] ?? visibleShortArcs[0];
  const centers = arcNames.map(n => ARC_SHORT_TOP[n] + ARC_SHORT_H / 2);
  const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
  const containerPct = ((avgCenter - CONTAINER_TOP_PCT) / CONTAINER_H_PCT) * 100;
  const offset = LABEL_OFFSETS[mode] ?? { x: '0rem', y: '0rem' };
  return { top: `calc(${containerPct}% + ${offset.y})`, left: offset.x, transform: 'translateY(-50%)' };
});
</script>

<style scoped>
.arc-fade-enter-active { transition: opacity 0.4s ease; }
.arc-fade-leave-active { transition: opacity 0.3s ease; }
.arc-fade-enter-from, .arc-fade-leave-to { opacity: 0; }

.crosshair { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; color: #f5f5f5; }
.ring { position: relative; width: 50rem; aspect-ratio: 1; }

.ring-mode-arc { position: absolute; pointer-events: none; }
.ring-mode-arc :deep(svg) { width: 100%; height: 100%; display: block; overflow: visible; }
.ring-mode-arc.arc-tall { top: 38.7%; left: 4%; width: 2.6%; height: 22.5%; }
.ring-mode-arc.arc-unsafe { top: 38.7%; left: 3%; }
.ring-mode-arc.arc-unsafe :deep(svg) { display: block; overflow: visible; width: 2rem; height: 11.25rem; }
.ring-mode-arc.arc-tall-charging { transition: clip-path 0.016s linear; }
.ring-mode-arc.arc-tall-charging :deep(svg) { --stroke-0: #ff6565; }

.ring-mode-container { position: absolute; left: -5rem; top: 37.2%; height: 25.4%; width: 5.5rem; z-index: 3; pointer-events: none; }
.ring-mode-label { position: absolute; left: 1rem; width: 4rem; height: 4.5rem; transition: top 0.15s ease 0.15s, left 0.15s ease 0.15s; }
.ring-mode-label-icon { display: block; width: 100%; height: 100%; clip-path: circle(25rem at calc(100% + 20rem) 50%); }
.mode-icon-fade-enter-active { transition: clip-path 0.1s ease-out 0.15s; }
.mode-icon-fade-leave-active { transition: clip-path 0.15s ease-in; }
.mode-icon-fade-enter-from, .mode-icon-fade-leave-to { clip-path: circle(20rem at calc(100% + 20rem) 50%); }
.ring-mode-label-icon :deep(svg) { width: 100%; height: 100%; display: block; --fill-0: #dafaf5; --stroke-0: transparent; opacity: 1; }

.ring-arcs-column { position: absolute; display: flex; flex-direction: column; align-items: flex-start; gap: 1rem; }
.ring-arc-item { flex-shrink: 0; height: 3.8rem; transition: opacity 0.15s ease; }
.ring-arc-item.arc-upper, .ring-arc-item.arc-lower { width: 1.2rem; }
.ring-arc-item.arc-center { width: 0.6rem; margin-left: -0.2rem; }
.ring-arc-item :deep(svg) { width: 100%; height: 100%; display: block; overflow: visible; --stroke-0: #dafaf5; }
.ring-arc-item.arc-hidden { opacity: 0; }

.ring-outline, .ring-outline.secondary { position: absolute; inset: 0; border-radius: 50%; border: 0.27rem solid rgba(138,166,166,0.2); }
.ring-outline.secondary { inset: 1.5%; border-color: rgba(138,166,166,0.3); }

.reticle { position: absolute; inset: 46%; }
.tick { position: absolute; background: rgba(245,245,245,0.85); border-radius: 0.125rem; }
.tick.vertical { width: 0.27rem; height: 1.56rem; left: 50%; transform: translateX(-50%); }
.tick.horizontal { height: 0.27rem; width: 1.56rem; top: 50%; transform: translateY(-50%); }
.tick.diagonal { width: 0.27rem; height: 1.56rem; background: rgba(255,56,56,0.95); border-radius: 0.125rem; position: absolute; box-shadow: 0 0 8px rgba(255,56,56,0.6); }
.tick.diagonal.hit-confirm { animation: hit-confirm-spread 0.2s ease-out forwards; }
.tick.diagonal.top-left, .tick.diagonal.top-right, .tick.diagonal.bottom-left, .tick.diagonal.bottom-right { top: 50%; left: 50%; transform-origin: center; }
.tick.diagonal.top-left.hit-confirm { animation: hit-confirm-spread-top-left 0.2s ease-out forwards; }
.tick.diagonal.top-right.hit-confirm { animation: hit-confirm-spread-top-right 0.2s ease-out forwards; }
.tick.diagonal.bottom-left.hit-confirm { animation: hit-confirm-spread-bottom-left 0.2s ease-out forwards; }
.tick.diagonal.bottom-right.hit-confirm { animation: hit-confirm-spread-bottom-right 0.2s ease-out forwards; }

@keyframes hit-confirm-spread-top-left { 0% { opacity:1; transform:translate(-50%,-50%) rotate(-45deg) translate(0,-1.8rem) scale(1); } 100% { opacity:0; transform:translate(-50%,-50%) rotate(-45deg) translate(0,-2rem) scale(1.2); } }
@keyframes hit-confirm-spread-top-right { 0% { opacity:1; transform:translate(-50%,-50%) rotate(45deg) translate(0,-1.8rem) scale(1); } 100% { opacity:0; transform:translate(-50%,-50%) rotate(45deg) translate(0,-2rem) scale(1.2); } }
@keyframes hit-confirm-spread-bottom-left { 0% { opacity:1; transform:translate(-50%,-50%) rotate(45deg) translate(0,1.8rem) scale(1); } 100% { opacity:0; transform:translate(-50%,-50%) rotate(45deg) translate(0,2rem) scale(1.2); } }
@keyframes hit-confirm-spread-bottom-right { 0% { opacity:1; transform:translate(-50%,-50%) rotate(-45deg) translate(0,1.8rem) scale(1); } 100% { opacity:0; transform:translate(-50%,-50%) rotate(-45deg) translate(0,2rem) scale(1.2); } }

.ammo-bar { position: absolute; inset: 0; pointer-events: none; }
.ammo-arc { width: 100%; height: 100%; overflow: visible; }
.ammo-arc-shadow { fill: none; stroke: rgba(40,40,40,0.8); opacity: 0.6; }
.ammo-arc-seg { fill: none; stroke: rgba(120,120,120,0.3); opacity: 0; }
.ammo-arc-seg.active { stroke: #e89528; opacity: 1; }
.ammo-arc-partial { fill: none; stroke: #e89528; opacity: 0.8; transition: stroke 0.03s ease, opacity 0.03s ease; will-change: opacity; }
.ammo-arc-overheat-bar { fill: none; stroke: rgba(130,55,42,0.8); opacity: 1; stroke-linecap: butt; }

.info { position: absolute; bottom: 6%; display: flex; flex-direction: row; align-items: stretch; gap: 0; color: #f5f5f5; }
.info.left { left: -20%; bottom: 24%; }
.info.right { right: -20%; bottom: 24%; }
.connector { position: relative; width: 13rem; height: 1.5rem; }
.connector svg { width: 100%; height: 100%; display: block; }
.panel { position: absolute; top: 1.5rem; padding: 0.7rem 1.4rem 0.7rem 1.5rem; background: rgba(11,11,11,0.6); }
.info.right .panel { right: 0.1rem; }
.value { display: flex; align-items: baseline; gap: 0.1rem; font-weight: 700; line-height: 1; white-space: nowrap; }
.current { font-size: 1.8rem; color: #ffffff; font-weight: 700; }
.current.danger { color: #ff3838; }
.divider { font-size: 1.5rem; color: rgba(255,255,255,0.8); }
.max { font-size: 1.5rem; color: rgba(255,255,255,0.9); }
.speed { font-size: 1.5rem; color: #ffffff; font-weight: 700; }
.unit { font-size: 1.5rem; color: rgba(255,255,255,0.8); }
</style>
