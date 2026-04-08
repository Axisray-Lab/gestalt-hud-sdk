<template>
  <div class="hit-screen-effect">
    <div class="hit-screen-border" :class="{ active: isHit }"></div>

    <Transition name="death-fade">
      <div v-if="isDefeated" class="death-screen-effect">
        <div class="death-crt-filter"></div>
        <div class="death-crt-vignette"></div>

        <div class="death-glitch-layer">
          <div class="glitch-block glitch-block-1"></div>
          <div class="glitch-block glitch-block-2"></div>
          <div class="glitch-block glitch-block-3"></div>
          <div class="glitch-block glitch-block-4"></div>
          <div class="glitch-block glitch-block-5"></div>
        </div>

        <div class="death-scanlines"></div>

        <div class="death-text-overlay">
          <div class="death-text-title">
            {{ (showReviveActions && canFreeRevive) ? 'SYSTEM READY' : 'SYSTEM FAILURE' }}
          </div>
          <div class="death-subtext">
            {{ (showReviveActions && canFreeRevive) ? '' : 'CONNECTION LOST' }}
          </div>

          <div v-if="reviveRemainingTime > 0" class="death-revive-timer">
            <div class="revive-label">REBOOTING IN</div>
            <div class="revive-time">{{ formattedReviveTime }}</div>
          </div>

          <div v-if="showReviveActions" class="revive-actions">
            <button
              v-if="canFreeRevive"
              class="revive-btn revive-btn--free"
              @click="emit('freeRevive')"
            >
              <span class="revive-btn__key">[J]</span>
              <span class="revive-btn__label">FREE REVIVE</span>
            </button>

            <button
              class="revive-btn revive-btn--purchase"
              :class="{ 'revive-btn--disabled': !canAffordPurchaseRevive }"
              :disabled="!canAffordPurchaseRevive"
              @click="emit('purchaseRevive')"
            >
              <span class="revive-btn__key">[K]</span>
              <span class="revive-btn__label">PURCHASE REVIVE</span>
              <span class="revive-btn__cost">Cost: {{ purchaseReviveCost }}</span>
              <span v-if="!canAffordPurchaseRevive" class="revive-btn__insufficient">
                Insufficient coins
              </span>
            </button>
          </div>

          <div class="death-terminal-cursor">_</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/**
 * Hit flash + CRT death screen effect.
 * Shows a red border pulse on hit and an amber CRT-style death overlay.
 *
 * Open-sourced from the game's internal UI.
 */

import { ref, watch, computed } from 'vue';

const props = withDefaults(
  defineProps<{
    hitTrigger?: number;
    isDefeated?: boolean;
    reviveRemainingTime?: number;
    showReviveActions?: boolean;
    canFreeRevive?: boolean;
    purchaseReviveCost?: number;
    canAffordPurchaseRevive?: boolean;
  }>(),
  {
    hitTrigger: 0,
    isDefeated: false,
    reviveRemainingTime: 0,
    showReviveActions: false,
    canFreeRevive: false,
    purchaseReviveCost: 0,
    canAffordPurchaseRevive: false,
  },
);

const emit = defineEmits<{
  freeRevive: [];
  purchaseRevive: [];
}>();

const isHit = ref(false);
let hitTimer: number | null = null;
const HIT_EFFECT_DURATION = 300;

const formattedReviveTime = computed(() => {
  const time = props.reviveRemainingTime;
  if (time <= 0) return '0.0s';
  if (time >= 60) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${time.toFixed(1)}s`;
});

watch(
  () => props.hitTrigger,
  (newVal, oldVal) => {
    if (newVal !== oldVal && newVal > 0) {
      if (hitTimer) clearTimeout(hitTimer);
      isHit.value = true;
      hitTimer = window.setTimeout(() => { isHit.value = false; }, HIT_EFFECT_DURATION);
    }
  },
);
</script>

<style scoped>
.hit-screen-effect {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
}

.hit-screen-border {
  position: absolute;
  inset: 0;
  border: 0 solid rgba(255, 56, 56, 0);
  box-shadow: inset 0 0 0 rgba(255, 56, 56, 0);
  transition: all 0.1s ease;
}
.hit-screen-border.active {
  border-width: 1.5rem;
  border-color: rgba(255, 56, 56, 0.6);
  box-shadow: inset 0 0 8rem rgba(255, 56, 56, 0.4);
  animation: screen-hit-pulse 0.3s ease;
}
@keyframes screen-hit-pulse {
  0% { border-color: rgba(255,56,56,0); box-shadow: inset 0 0 0 rgba(255,56,56,0); }
  30% { border-color: rgba(255,56,56,0.8); box-shadow: inset 0 0 10rem rgba(255,56,56,0.6); }
  100% { border-color: rgba(255,56,56,0); box-shadow: inset 0 0 0 rgba(255,56,56,0); }
}

.death-screen-effect {
  position: absolute;
  inset: 0;
  z-index: 10000;
  background: radial-gradient(ellipse at center, rgba(20,15,10,0.85) 0%, rgba(10,8,5,0.95) 100%);
}
.death-crt-filter {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255,176,0,0.15) 0%, rgba(255,140,0,0.25) 50%, rgba(255,176,0,0.15) 100%);
  backdrop-filter: grayscale(100%) sepia(100%) hue-rotate(10deg) saturate(300%) brightness(0.7) contrast(1.2);
}
.death-crt-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.7) 100%);
}
.death-glitch-layer { position: absolute; inset: 0; overflow: hidden; }
.glitch-block { position: absolute; left: 0; right: 0; height: 8%; mix-blend-mode: lighten; opacity: 0.5; }
.glitch-block-1 { top: 15%; background: linear-gradient(90deg, transparent, rgba(255,180,0,0.6), rgba(255,140,0,0.4), transparent); transform: translateX(-3px); }
.glitch-block-2 { top: 35%; background: linear-gradient(90deg, transparent, rgba(255,160,0,0.5), rgba(255,120,0,0.3), transparent); transform: translateX(5px); height: 5%; }
.glitch-block-3 { top: 58%; background: linear-gradient(90deg, transparent, rgba(255,200,0,0.4), rgba(255,160,0,0.5), transparent); transform: translateX(-2px); height: 3%; }
.glitch-block-4 { top: 72%; background: linear-gradient(90deg, transparent, rgba(255,150,0,0.45), rgba(255,130,0,0.35), transparent); transform: translateX(4px); height: 6%; }
.glitch-block-5 { top: 88%; background: linear-gradient(90deg, transparent, rgba(255,170,0,0.4), rgba(255,140,0,0.3), transparent); transform: translateX(-4px); height: 4%; }

.death-scanlines {
  position: absolute; inset: 0;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,0.25), rgba(0,0,0,0.25) 1px, transparent 1px, transparent 3px);
  pointer-events: none; opacity: 0.6;
}
.death-text-overlay {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  text-align: center; font-family: 'Courier New','Consolas',monospace; color: #ffb000;
  text-shadow: 0 0 20px rgba(255,180,0,0.9), 0 0 40px rgba(255,160,0,0.6), 0 0 60px rgba(255,140,0,0.4);
}
.death-text-title { font-size: 6rem; font-weight: 700; letter-spacing: 0.8rem; margin-bottom: 2rem; text-transform: uppercase; }
.death-subtext { font-size: 2.5rem; font-weight: 500; letter-spacing: 0.4rem; opacity: 0.85; margin-bottom: 1rem; }

.death-revive-timer { margin-top: 3rem; margin-bottom: 2rem; padding: 1.5rem 3rem; border: 2px solid rgba(255,180,0,0.4); border-radius: 0.5rem; background: rgba(255,160,0,0.05); display: inline-block; }
.revive-label { font-size: 1.8rem; font-weight: 500; letter-spacing: 0.3rem; color: #ffb000; opacity: 0.7; margin-bottom: 0.8rem; text-transform: uppercase; }
.revive-time { font-size: 5rem; font-weight: 900; letter-spacing: 0.2rem; color: #ffc000; text-shadow: 0 0 30px rgba(255,200,0,1), 0 0 50px rgba(255,180,0,0.8); font-family: 'Courier New','Consolas',monospace; }

.revive-actions { margin-top: 2.5rem; display: flex; gap: 2rem; justify-content: center; pointer-events: auto; }
.revive-btn { display: flex; flex-direction: column; align-items: center; padding: 1.2rem 2.5rem; border: 2px solid rgba(255,180,0,0.5); border-radius: 0.5rem; background: rgba(255,160,0,0.08); cursor: pointer; font-family: 'Courier New','Consolas',monospace; color: #ffb000; transition: all 0.15s ease; min-width: 14rem; }
.revive-btn:hover:not(:disabled) { background: rgba(255,160,0,0.18); border-color: rgba(255,200,0,0.8); transform: scale(1.03); }
.revive-btn--disabled { opacity: 0.3; cursor: not-allowed; color: #806000; }
.revive-btn__key { font-size: 1.6rem; font-weight: 700; letter-spacing: 0.2rem; opacity: 0.8; margin-bottom: 0.4rem; }
.revive-btn__label { font-size: 1.4rem; font-weight: 600; letter-spacing: 0.15rem; text-transform: uppercase; }
.revive-btn__cost { font-size: 1.2rem; font-weight: 500; margin-top: 0.4rem; opacity: 0.7; }
.revive-btn__insufficient { display: block; font-size: 1.1rem; font-weight: 600; color: #ff5030; margin-top: 0.3rem; }
.death-terminal-cursor { display: inline-block; font-size: 2.5rem; font-weight: 700; color: #ffb000; opacity: 0.9; }

.death-fade-enter-active { transition: opacity 0.3s ease-out; }
.death-fade-enter-from { opacity: 0; }
.death-fade-leave-active { transition: opacity 0.3s ease-in; }
.death-fade-leave-to { opacity: 0; }
</style>
