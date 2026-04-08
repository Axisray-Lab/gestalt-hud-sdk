/**
 * Vue composable wrapping GestaltHUDBridge (postMessage).
 *
 * Provides reactive refs for all attribute scopes, init context,
 * and bridge lifecycle methods. This is the single entry point
 * for all game data inside a Workshop HUD Vue app.
 */

import { ref, reactive, onUnmounted } from 'vue';
import {
  GestaltHUDBridge,
  ERobotBridgeDemoAttributeId,
  type HUDInitMessage,
  type HUDAttributeData,
  type HUDAction,
} from '@axisray-lab/gestalt-hud-sdk/workshop';

export interface BridgeContext {
  teamId: number;
  playerId: number;
  mapId: number;
  mapName: string;
  gameMode: string;
  protocolVersion: number;
}

export function useBridge() {
  const bridge = new GestaltHUDBridge();

  const initialized = ref(false);
  const context = ref<BridgeContext>({
    teamId: -1,
    playerId: -1,
    mapId: 0,
    mapName: '',
    gameMode: '',
    protocolVersion: 0,
  });

  const battleAttributes = ref<Record<string, number>>({});
  const globalAttributes = ref<Record<string, number>>({});
  const baseAttributes = reactive<Record<string, Record<string, number>>>({});
  const playerBattleAttributes = reactive<Record<number, Record<string, number>>>({});

  let manifestName = 'Workshop HUD';
  let manifestVersion = '0.0.0';

  fetch('./manifest.json')
    .then((r) => r.json())
    .then((m) => {
      manifestName = m.name ?? manifestName;
      manifestVersion = m.version ?? manifestVersion;
    })
    .catch(() => {
      console.warn('[Vue HUD] Could not load manifest.json');
    });

  const unsubInit = bridge.onInit((msg: HUDInitMessage) => {
    context.value = {
      teamId: msg.teamId,
      playerId: msg.playerId,
      mapId: msg.mapId,
      mapName: msg.mapName ?? '',
      gameMode: msg.gameMode ?? '',
      protocolVersion: msg.version,
    };
    initialized.value = true;
    bridge.sendReady(manifestName, manifestVersion);
  });

  const unsubAttr = bridge.onAttributeUpdate((data: HUDAttributeData) => {
    if (data.battle) battleAttributes.value = data.battle;
    if (data.global) globalAttributes.value = data.global;

    if (data.base) {
      for (const [key, val] of Object.entries(data.base)) {
        baseAttributes[key] = val as Record<string, number>;
      }
    }

    if (data.playerBattle) {
      for (const [key, val] of Object.entries(data.playerBattle)) {
        playerBattleAttributes[Number(key)] = val as Record<string, number>;
      }
    }

    // Update teamId from battle attributes if changed
    const teamKey = String(ERobotBridgeDemoAttributeId.TeamID);
    const teamVal = data.battle?.[teamKey];
    if (teamVal !== undefined && Number.isFinite(teamVal) && teamVal !== context.value.teamId) {
      context.value = { ...context.value, teamId: teamVal };
    }
  });

  function sendAction(action: HUDAction, payload?: unknown) {
    bridge.sendAction(action, payload);
  }

  onUnmounted(() => {
    unsubInit();
    unsubAttr();
    bridge.destroy();
  });

  return {
    initialized,
    context,
    battleAttributes,
    globalAttributes,
    baseAttributes,
    playerBattleAttributes,
    sendAction,
  };
}
