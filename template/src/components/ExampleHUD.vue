<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  connected: boolean;
  health: number;
  healthMax: number;
  level: number;
  ammo: number;
  matchTime: string;
  teamId: number;
}>();

const healthPercent = computed(() => {
  if (props.healthMax <= 0) return 0;
  return Math.min(100, (props.health / props.healthMax) * 100);
});

const teamLabel = computed(() => {
  switch (props.teamId) {
    case 0: return 'RED';
    case 1: return 'BLUE';
    default: return 'SPECTATOR';
  }
});

const teamColor = computed(() => {
  switch (props.teamId) {
    case 0: return '#e74c3c';
    case 1: return '#3498db';
    default: return '#95a5a6';
  }
});

const healthBarColor = computed(() => {
  if (healthPercent.value > 60) return '#2ecc71';
  if (healthPercent.value > 30) return '#f39c12';
  return '#e74c3c';
});
</script>

<template>
  <div class="hud-overlay">
    <!-- Connection indicator -->
    <div class="connection-badge" :class="{ online: connected }">
      {{ connected ? 'CONNECTED' : 'DISCONNECTED' }}
    </div>

    <!-- Match timer -->
    <div class="match-timer">{{ matchTime }}</div>

    <!-- Player badge (bottom-left) -->
    <div class="player-badge">
      <div class="badge-header">
        <span class="team-tag" :style="{ color: teamColor }">{{ teamLabel }}</span>
        <span class="level">Lv.{{ level }}</span>
      </div>
      <div class="health-bar-container">
        <div
          class="health-bar-fill"
          :style="{ width: healthPercent + '%', backgroundColor: healthBarColor }"
        />
        <span class="health-text">{{ health }} / {{ healthMax }}</span>
      </div>
    </div>

    <!-- Ammo display (bottom-right) -->
    <div class="ammo-display">
      <div class="ammo-label">AMMO</div>
      <div class="ammo-count">{{ ammo }}</div>
    </div>
  </div>
</template>

<style scoped>
.hud-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  color: #fff;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  z-index: 1000;
}

.connection-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: rgba(231, 76, 60, 0.85);
}
.connection-badge.online {
  background: rgba(46, 204, 113, 0.85);
}

.match-timer {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 2px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

.player-badge {
  position: absolute;
  bottom: 24px;
  left: 24px;
  min-width: 220px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  padding: 12px 16px;
  backdrop-filter: blur(8px);
}
.badge-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.team-tag {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 1px;
}
.level {
  font-size: 13px;
  opacity: 0.8;
}
.health-bar-container {
  position: relative;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}
.health-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease, background-color 0.3s ease;
}
.health-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.ammo-display {
  position: absolute;
  bottom: 24px;
  right: 24px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  padding: 12px 20px;
  text-align: center;
  backdrop-filter: blur(8px);
}
.ammo-label {
  font-size: 11px;
  letter-spacing: 1px;
  opacity: 0.7;
  margin-bottom: 4px;
}
.ammo-count {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
}
</style>
