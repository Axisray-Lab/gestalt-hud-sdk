/**
 * Vue composable wrapping GestaltHUDBridge (postMessage).
 *
 * Provides reactive refs for all attribute scopes, init context,
 * and bridge lifecycle methods. This is the single entry point
 * for all game data inside a Workshop HUD Vue app.
 */

import { ref, onUnmounted } from 'vue';
import {
  GestaltHUDBridge,
  ERobotBridgeDemoAttributeId,
  type HUDInitMessage,
  type HUDAttributeData,
  type HUDAction,
} from '@axisray-lab/gestalt-hud-sdk/workshop';
import manifest from '../../manifest.json';

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
  const playerAttributes = ref<Record<string, number>>({});
  const baseAttributes = ref<Record<string, Record<string, number>>>({});
  const playerBattleAttributes = ref<Record<number, Record<string, number>>>({});

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
    bridge.sendReady(manifest.name, manifest.version);
  });

  const unsubAttr = bridge.onAttributeUpdate((data: HUDAttributeData) => {
    // The host sends complete snapshots. Replace every scope, including an
    // omitted/empty one, so keys removed by the game cannot remain stale.
    battleAttributes.value = { ...(data.battle ?? {}) };
    globalAttributes.value = { ...(data.global ?? {}) };
    playerAttributes.value = { ...(data.player ?? {}) };
    baseAttributes.value = cloneNested(data.base);
    playerBattleAttributes.value = cloneNested(data.playerBattle) as Record<
      number,
      Record<string, number>
    >;

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

  function cloneNested(
    value: Record<string | number, Record<string, number>> | undefined,
  ): Record<string, Record<string, number>> {
    return Object.fromEntries(
      Object.entries(value ?? {}).map(([key, attributes]) => [
        key,
        { ...attributes },
      ]),
    );
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
    playerAttributes,
    baseAttributes,
    playerBattleAttributes,
    sendAction,
  };
}
