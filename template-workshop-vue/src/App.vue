<template>
  <div class="app">
    <GameHUD
      v-if="initialized"
      :battle-attributes="battleAttributes"
      :global-attributes="globalAttributes"
      :base-attributes="baseAttributes"
      :context="context"
    />

    <div v-else class="waiting-overlay">
      <div class="waiting-box">
        <div class="waiting-title">RMUC2026 Vue HUD</div>
        <div class="waiting-subtitle">Waiting for game connection...</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Root component — initializes the Workshop bridge and renders the HUD.
 *
 * The bridge composable handles:
 * - postMessage listener registration
 * - Manifest loading and sendReady()
 * - Reactive attribute state updates
 */

import { toRefs } from 'vue';
import { useBridge } from '@/composables/useBridge';
import GameHUD from '@/views/GameHUD.vue';

const {
  initialized,
  context,
  battleAttributes,
  globalAttributes,
  baseAttributes,
} = useBridge();

// toRefs not needed — these are already refs/reactive from useBridge
void toRefs;
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

html {
  font-size: clamp(7px, min(calc(100vw / 192), calc(100vh / 108)), 12px);
}

@media (min-aspect-ratio: 21/9) {
  html {
    font-size: clamp(7px, calc(100vh / 108), 12px);
  }
}

@media (max-aspect-ratio: 4/3) {
  html {
    font-size: clamp(6px, calc(100vw / 144), 11px);
  }
}

@media (max-width: 1366px) {
  html {
    font-size: clamp(6px, min(calc(100vw / 192), calc(100vh / 108)), 8px);
  }
}

@media (min-width: 2560px) {
  html {
    font-size: clamp(9px, min(calc(100vw / 192), calc(100vh / 108)), 14px);
  }
}

#app {
  width: 100%;
  height: 100%;
}
</style>

<style scoped>
.app {
  width: 100%;
  height: 100%;
  position: relative;
}

.waiting-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
}

.waiting-box {
  text-align: center;
  font-family: 'Courier New', monospace;
}

.waiting-title {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-bottom: 1rem;
  color: #e2fffb;
}

.waiting-subtitle {
  font-size: 1.1rem;
  opacity: 0.6;
  animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.2; }
}
</style>
