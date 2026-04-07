/**
 * Mock attribute data engine for Workshop HUD DevTools.
 *
 * Attribute IDs mirror ERobotBridgeDemoAttributeId from the SDK.
 * All values use the same format the game SPA sends via postMessage:
 *   - Keys are stringified numeric IDs (e.g. "10000003")
 *   - Values are raw numbers (thousandths = 1000 = 100%, tags = 0/1)
 */

var MockData = (function () {
  'use strict';

  // ── Attribute ID constants ──

  var Attr = {
    Health:            '10000003',
    BufferEnergy:      '10000004',
    Experience:        '10000002',
    Ammo17mmCount:     '10000033',
    Ammo42mmCount:     '10000034',
    TeamID:            '10000036',
    TeamNumber:        '10000037',
    FiringHeat1:       '10000011',
    Shield:            '10000013',
    PlayerID:          '10000035',
    Real17mmAmmoCount: '10000031',
    Real42mmAmmoCount: '10000032',

    Defeated:          '50000007',
    Overheated:        '50000003',
    Invincible:        '50000013',
    Reviving:          '50000005',
    LowPower:          '50000009',
    IsMatchStarted:    '50000019',
    OutOfCombat:       '50000001',
    Weakened:          '50000002',
    IsBoost:           '50000022',
    IsCharging:        '50000023',

    Class:             '60000002',
    Level:             '60000003',
    HealthMax:         '60000004',
    BufferEnergyMax:   '60000005',
    AmmoCountMax:      '60000010',
    FiringHeatMax1:    '60000011',
    LevelMax:          '60000018',
    NextLevelExpMax:   '60000020',

    BulletType:        '62000000',

    AttackMultiplierThou:  '61000000',
    DefenseMultiplierThou: '61000001',

    G_MaxGameTime:        '80000001',
    G_CurGameTime:        '80000002',
    G_CurMapId:           '80000003',
    G_CurMatchStatus:     '80000005',
    G_GameStartCountDown: '80000006',

    TM_Coins:             '74000003',

    G_BaseId_0:           '80001000',
    G_BaseId_1:           '80001001',
  };

  // ── Default state ──

  var state = {
    hp: 600,
    hpMax: 600,
    shield: 0,
    bufferEnergy: 60,
    bufferEnergyMax: 60,
    ammo17mm: 300,
    ammo42mm: 0,
    bulletType: 1,
    firingHeat: 0,
    firingHeatMax: 240,
    level: 1,
    levelMax: 3,
    experience: 0,
    expMax: 200,
    teamId: 0,
    teamNumber: 1,
    classId: 1003,
    matchTimeMax: 420000,
    matchTimeCur: 0,
    matchStatus: 1,
    countdown: 0,
    attackMul: 1000,
    defenseMul: 1000,
    coins: 0,
    defeated: 0,
    overheated: 0,
    invincible: 0,
    reviving: 0,
    lowPower: 0,
    isMatchStarted: 1,
    outOfCombat: 0,
    weakened: 0,
    isBoost: 0,
    isCharging: 0,
    baseHp0: 5000,
    baseHpMax0: 5000,
    baseHp1: 5000,
    baseHpMax1: 5000,
  };

  function getState() { return state; }

  function buildAttributeData() {
    var battle = {};
    battle[Attr.Health] = state.hp;
    battle[Attr.HealthMax] = state.hpMax;
    battle[Attr.Shield] = state.shield;
    battle[Attr.BufferEnergy] = state.bufferEnergy;
    battle[Attr.BufferEnergyMax] = state.bufferEnergyMax;
    battle[Attr.Ammo17mmCount] = state.ammo17mm;
    battle[Attr.Ammo42mmCount] = state.ammo42mm;
    battle[Attr.BulletType] = state.bulletType;
    battle[Attr.FiringHeat1] = state.firingHeat;
    battle[Attr.FiringHeatMax1] = state.firingHeatMax;
    battle[Attr.Level] = state.level;
    battle[Attr.LevelMax] = state.levelMax;
    battle[Attr.Experience] = state.experience;
    battle[Attr.NextLevelExpMax] = state.expMax;
    battle[Attr.TeamID] = state.teamId;
    battle[Attr.TeamNumber] = state.teamNumber;
    battle[Attr.Class] = state.classId;
    battle[Attr.PlayerID] = 1;
    battle[Attr.AttackMultiplierThou] = state.attackMul;
    battle[Attr.DefenseMultiplierThou] = state.defenseMul;

    battle[Attr.Defeated] = state.defeated;
    battle[Attr.Overheated] = state.overheated;
    battle[Attr.Invincible] = state.invincible;
    battle[Attr.Reviving] = state.reviving;
    battle[Attr.LowPower] = state.lowPower;
    battle[Attr.IsMatchStarted] = state.isMatchStarted;
    battle[Attr.OutOfCombat] = state.outOfCombat;
    battle[Attr.Weakened] = state.weakened;
    battle[Attr.IsBoost] = state.isBoost;
    battle[Attr.IsCharging] = state.isCharging;

    var global = {};
    global[Attr.G_MaxGameTime] = state.matchTimeMax;
    global[Attr.G_CurGameTime] = state.matchTimeCur;
    global[Attr.G_CurMatchStatus] = state.matchStatus;
    global[Attr.G_GameStartCountDown] = state.countdown;
    global[Attr.G_CurMapId] = 4;
    global[Attr.G_BaseId_0] = 1;
    global[Attr.G_BaseId_1] = 2;
    global[Attr.TM_Coins] = state.coins;

    var base = {
      '1': {},
      '2': {},
    };
    base['1'][Attr.Health] = state.baseHp0;
    base['1'][Attr.HealthMax] = state.baseHpMax0;
    base['2'][Attr.Health] = state.baseHp1;
    base['2'][Attr.HealthMax] = state.baseHpMax1;

    return {
      global: global,
      player: {},
      battle: battle,
      base: base,
      playerBattle: {},
    };
  }

  // ── Presets ──

  var presets = {
    matchStart: {
      label: 'Match Start',
      apply: function () {
        state.hp = state.hpMax;
        state.ammo17mm = 300;
        state.ammo42mm = 100;
        state.matchTimeCur = 0;
        state.matchStatus = 1;
        state.level = 1;
        state.defeated = 0;
        state.overheated = 0;
        state.invincible = 1;
        state.baseHp0 = 5000;
        state.baseHp1 = 5000;
      },
    },
    lowHp: {
      label: 'Low HP (20%)',
      apply: function () {
        state.hp = Math.round(state.hpMax * 0.2);
        state.defeated = 0;
        state.invincible = 0;
      },
    },
    defeated: {
      label: 'Defeated',
      apply: function () {
        state.hp = 0;
        state.defeated = 1;
        state.invincible = 0;
      },
    },
    switchTeam: {
      label: 'Switch Team',
      apply: function () {
        state.teamId = state.teamId === 0 ? 1 : 0;
      },
    },
    midGame: {
      label: 'Mid Game',
      apply: function () {
        state.hp = Math.round(state.hpMax * 0.65);
        state.ammo17mm = 150;
        state.matchTimeCur = 180000;
        state.level = 2;
        state.experience = 120;
        state.defeated = 0;
        state.invincible = 0;
        state.firingHeat = 80;
        state.baseHp0 = 3500;
        state.baseHp1 = 4200;
      },
    },
    overheated: {
      label: 'Overheated',
      apply: function () {
        state.firingHeat = state.firingHeatMax;
        state.overheated = 1;
      },
    },
  };

  return {
    Attr: Attr,
    state: state,
    getState: getState,
    buildAttributeData: buildAttributeData,
    presets: presets,
  };
})();
