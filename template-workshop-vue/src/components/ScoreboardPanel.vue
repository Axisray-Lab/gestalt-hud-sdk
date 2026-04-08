<template>
  <Transition name="scoreboard-fade">
    <div v-if="visible" class="scoreboard-overlay">
      <div class="scoreboard-panel">
        <div class="scoreboard-header">
          <span class="scoreboard-title">SCOREBOARD</span>
          <span class="scoreboard-hint">Hold TAB</span>
        </div>

        <div class="team-section blue">
          <div class="team-label blue-label">BLUE TEAM</div>
          <div class="player-list-header">
            <span class="col-number">#</span>
            <span class="col-name">Name</span>
            <span class="col-hp">HP</span>
            <span class="col-level">Level</span>
            <span class="col-status">Status</span>
            <span class="col-ping">Ping</span>
          </div>
          <div
            v-for="player in blueTeamPlayers"
            :key="`blue-${player.playerId}`"
            class="player-row"
            :class="{ 'is-self': player.isSelf, 'is-defeated': player.isDefeated }"
          >
            <span class="col-number">{{ player.teamNumber }}</span>
            <span class="col-name">
              {{ player.displayName }}
              <span v-if="player.isSelf" class="self-tag">YOU</span>
            </span>
            <span class="col-hp" :class="{ 'hp-zero': player.hp <= 0 }">{{ player.hp }} / {{ player.hpMax }}</span>
            <span class="col-level">Lv.{{ player.level }}</span>
            <span class="col-status" :class="player.isDefeated ? 'status-defeated' : 'status-alive'">
              {{ player.isDefeated ? 'Defeated' : 'Alive' }}
            </span>
            <span class="col-ping" :class="pingClass(player.ping)">{{ player.ping >= 0 ? player.ping + 'ms' : '--' }}</span>
          </div>
          <div v-if="blueTeamPlayers.length === 0" class="no-players">--</div>
        </div>

        <div class="team-section red">
          <div class="team-label red-label">RED TEAM</div>
          <div class="player-list-header">
            <span class="col-number">#</span>
            <span class="col-name">Name</span>
            <span class="col-hp">HP</span>
            <span class="col-level">Level</span>
            <span class="col-status">Status</span>
            <span class="col-ping">Ping</span>
          </div>
          <div
            v-for="player in redTeamPlayers"
            :key="`red-${player.playerId}`"
            class="player-row"
            :class="{ 'is-self': player.isSelf, 'is-defeated': player.isDefeated }"
          >
            <span class="col-number">{{ player.teamNumber }}</span>
            <span class="col-name">
              {{ player.displayName }}
              <span v-if="player.isSelf" class="self-tag">YOU</span>
            </span>
            <span class="col-hp" :class="{ 'hp-zero': player.hp <= 0 }">{{ player.hp }} / {{ player.hpMax }}</span>
            <span class="col-level">Lv.{{ player.level }}</span>
            <span class="col-status" :class="player.isDefeated ? 'status-defeated' : 'status-alive'">
              {{ player.isDefeated ? 'Defeated' : 'Alive' }}
            </span>
            <span class="col-ping" :class="pingClass(player.ping)">{{ player.ping >= 0 ? player.ping + 'ms' : '--' }}</span>
          </div>
          <div v-if="redTeamPlayers.length === 0" class="no-players">--</div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * Scoreboard overlay with player lists per team.
 * Open-sourced from the game's internal UI (i18n removed, hardcoded English).
 */

import { computed } from 'vue';
import { ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk/workshop';

const props = defineProps<{
  visible: boolean;
  blueTeamMates: Array<{ number: number; playerId: number; attributes: Record<string, unknown> }>;
  redTeamMates: Array<{ number: number; playerId: number; attributes: Record<string, unknown> }>;
  localPlayerId: number | null;
}>();

interface ScoreboardPlayer { playerId: number; teamNumber: number; displayName: string; hp: number; hpMax: number; level: number; ping: number; isSelf: boolean; isDefeated: boolean; }

const A = ERobotBridgeDemoAttributeId;

const toPlayer = (tm: { number: number; playerId: number; attributes: Record<string, unknown> }): ScoreboardPlayer => {
  const attrs = tm.attributes || {};
  const isEmpty = (attrs as Record<string, unknown>)._isEmpty;
  return {
    playerId: tm.playerId,
    teamNumber: tm.number,
    displayName: isEmpty ? '--' : `Player ${tm.playerId}`,
    hp: Number(attrs[A.Health] ?? 0),
    hpMax: Number(attrs[A.HealthMax] ?? 200),
    level: Number(attrs[A.Level] ?? 0),
    ping: -1,
    isSelf: tm.playerId === props.localPlayerId && tm.playerId > 0,
    isDefeated: Number(attrs[A.Defeated] ?? 0) > 0,
  };
};

const blueTeamPlayers = computed<ScoreboardPlayer[]>(() =>
  props.blueTeamMates.filter(tm => tm.playerId > 0 || !(tm.attributes as Record<string, unknown>)?._isEmpty).map(toPlayer),
);
const redTeamPlayers = computed<ScoreboardPlayer[]>(() =>
  props.redTeamMates.filter(tm => tm.playerId > 0 || !(tm.attributes as Record<string, unknown>)?._isEmpty).map(toPlayer),
);

const pingClass = (ping: number) => { if (ping < 0) return ''; if (ping < 50) return 'ping-good'; if (ping < 100) return 'ping-ok'; return 'ping-bad'; };
</script>

<style scoped>
.scoreboard-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.55); z-index: 80; pointer-events: none; }
.scoreboard-panel { width: min(90vw, 900px); background: rgba(10,14,22,0.92); border: 1px solid rgba(255,255,255,0.1); padding: 1.5rem 2rem; pointer-events: auto; }
.scoreboard-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1.2rem; padding-bottom: 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
.scoreboard-title { font-size: 1.4rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #fff; }
.scoreboard-hint { font-size: 0.75rem; color: rgba(255,255,255,0.3); }
.team-section { margin-bottom: 1rem; }
.team-label { font-size: 0.9rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.4rem 0.8rem; margin-bottom: 0.3rem; }
.blue-label { color: #4ac2ff; border-left: 3px solid #4ac2ff; background: rgba(74,194,255,0.06); }
.red-label { color: #f04a4a; border-left: 3px solid #f04a4a; background: rgba(240,74,74,0.06); }
.player-list-header { display: grid; grid-template-columns: 0.4fr 2fr 1.2fr 0.7fr 0.8fr 0.8fr; padding: 0.35rem 0.8rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.35); border-bottom: 1px solid rgba(255,255,255,0.06); }
.player-row { display: grid; grid-template-columns: 0.4fr 2fr 1.2fr 0.7fr 0.8fr 0.8fr; padding: 0.45rem 0.8rem; font-size: 0.85rem; color: rgba(255,255,255,0.8); border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.15s; }
.player-row.is-self { background: rgba(255,255,255,0.06); }
.player-row.is-defeated { opacity: 0.45; }
.self-tag { display: inline-block; margin-left: 0.4rem; padding: 0 0.35rem; font-size: 0.65rem; font-weight: 700; color: #ffd740; border: 1px solid rgba(255,215,64,0.4); border-radius: 2px; vertical-align: middle; }
.hp-zero { color: rgba(240,74,74,0.7); }
.status-alive { color: #6fd89a; }
.status-defeated { color: rgba(240,74,74,0.7); }
.ping-good { color: #6fd89a; }
.ping-ok { color: #ffd740; }
.ping-bad { color: #f04a4a; }
.no-players { padding: 0.6rem 0.8rem; color: rgba(255,255,255,0.2); font-size: 0.85rem; }
.scoreboard-fade-enter-active, .scoreboard-fade-leave-active { transition: opacity 0.15s ease; }
.scoreboard-fade-enter-from, .scoreboard-fade-leave-to { opacity: 0; }
</style>
