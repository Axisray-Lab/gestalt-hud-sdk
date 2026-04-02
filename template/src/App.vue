<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  HUDBridge,
  AttributeStore,
  ERobotBridgeDemoAttributeId,
} from '@axisray-lab/gestalt-hud-sdk';
import ExampleHUD from './components/ExampleHUD.vue';

const WS_PORT = 18820;

const bridge = new HUDBridge({ port: WS_PORT });
const store = new AttributeStore(bridge);

const connected = ref(false);
const health = ref(0);
const healthMax = ref(0);
const level = ref(0);
const ammo = ref(0);
const matchTime = ref('00:00');
const teamId = ref(-1);

bridge.onConnectionChange((isConnected) => {
  connected.value = isConnected;
});

store.onChange(() => {
  health.value = store.getBattleAttribute(ERobotBridgeDemoAttributeId.Health);
  healthMax.value = store.getBattleAttribute(ERobotBridgeDemoAttributeId.HealthMax);
  level.value = store.getBattleAttribute(ERobotBridgeDemoAttributeId.Level);

  const bulletType = store.getBattleAttribute(ERobotBridgeDemoAttributeId.BulletType);
  ammo.value = store.getBattleAttribute(
    bulletType === 0
      ? ERobotBridgeDemoAttributeId.Ammo42mmCount
      : ERobotBridgeDemoAttributeId.Ammo17mmCount,
  );

  const maxTime = store.getGlobalAttribute(ERobotBridgeDemoAttributeId.G_MaxGameTime);
  const curTime = store.getGlobalAttribute(ERobotBridgeDemoAttributeId.G_CurGameTime);
  const remaining = Math.max(0, maxTime - curTime);
  const totalSec = Math.floor(remaining / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  matchTime.value = `${m}:${s}`;
});

store.onContextChange((ctx) => {
  teamId.value = ctx.teamId;
});

onMounted(async () => {
  try {
    await bridge.connect();
    store.start();
  } catch (err) {
    console.warn('Failed to connect to game:', err);
  }
});

onUnmounted(() => {
  store.stop();
  bridge.disconnect();
});
</script>

<template>
  <ExampleHUD
    :connected="connected"
    :health="health"
    :health-max="healthMax"
    :level="level"
    :ammo="ammo"
    :match-time="matchTime"
    :team-id="teamId"
  />
</template>
