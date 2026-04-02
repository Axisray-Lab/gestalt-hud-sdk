/**
 * Attribute ID enum — vendored from RobotBridgeDemoAttributeDefines.fbs
 *
 * These numeric IDs are the keys used inside the attribute-map updates
 * received over WebSocket. Convert to string with `String(id)` when
 * indexing into the `Record<string, number>` attribute objects.
 *
 * Ranges:
 *   0x        — Player slot IDs (global attribute map value → player attribute map ID)
 *   01xxxxxx  — Player-to-battle-map pointers
 *   1xxxxxxx  — Value attributes (HP, ammo, heat, …)
 *   5xxxxxxx  — Tag attributes (booleans: defeated, overheated, …)
 *   51xxxxxx  — Functional tags (actor visibility, HP bar, …)
 *   6xxxxxxx  — State attributes (class, level, max values, combat multipliers, …)
 *   62xxxxxx  — Bullet attributes
 *   63xxxxxx  — Combat statistics
 *   7xxxxxxx  — Scene interaction (buff stations, outposts, bases, …)
 *   74xxxxxx  — Team attributes
 *   75xxxxxx  — Zone controller attributes
 *   8xxxxxxx  — Global variables (game time, map, match status, …)
 */
export enum ERobotBridgeDemoAttributeId {
  // ── Player slot range ──
  PlayerID_0 = 0,
  PlayerID_MAX = 100000,

  PlayerBattleAttributeMapID = 1000001,
  PlayerBaseAttributeMapID = 1000002,

  // ── Value attributes (1xxxxxxx) ──
  ValueAttributeID_Min = 10000000,
  EntityId = 10000001,
  Experience = 10000002,
  Health = 10000003,
  BufferEnergy = 10000004,
  CapacityEnergy = 10000005,
  ChassisEnergy = 10000006,
  ChassisPower = 10000007,
  ChassisRealPower = 10000008,
  ReviveCount = 10000009,
  PurchaseReviveCount = 10000010,
  FiringHeat1 = 10000011,
  FiringHeat2 = 10000012,
  Shield = 10000013,
  ChargingPower = 10000014,
  FiringHeatCoolingRate1 = 10000017,
  FiringHeatCoolingRate2 = 10000018,
  IsForceSpin = 10000019,
  ForcedSpinSpeed = 10000020,
  WirelessChargingPower = 10000021,
  ReviveProgress = 10000022,
  ReviveSpeed = 10000023,
  SpawnIndex = 10000024,
  ChassisMode = 10000025,
  ShooterMode = 10000026,
  HeroCombatMode = 10000027,
  ShooterSpreadPara = 10000028,
  ShooterSpeedSpreadPara = 10000029,
  ShooterRealSpeed = 10000030,
  Real17mmAmmoCount = 10000031,
  Real42mmAmmoCount = 10000032,
  Ammo17mmCount = 10000033,
  Ammo42mmCount = 10000034,
  PlayerID = 10000035,
  TeamID = 10000036,
  TeamNumber = 10000037,
  POVRotationPitch = 10000038,
  POVRotationYaw = 10000039,
  POVTargetArmLength = 10000040,

  SentryMode = 10000044,
  SentryModeLastTime_Move = 10000045,
  SentryModeLastTime_Defense = 10000046,
  SentryModeLastTime_Attack = 10000047,
  SentryModeCooldownRemaining = 10000048,
  GunMaxEnclosing = 10000049,
  GunMinEnclosing = 10000050,
  GunEnclosingRatio = 10000051,
  GunTargetDistance = 10000052,
  OutOfCombatCountdown = 10000053,
  FiringMode = 10000054,
  RemoteAmmoPendingCount = 10000055,
  RemoteAmmoCountdownMs = 10000056,
  RemoteRepairPendingCount = 10000057,
  RemoteRepairCountdownMs = 10000058,
  ConnectionUpdateFlag = 10000060,
  ConnectionLanAddress = 10000061,
  ConnectionSteamID = 10000062,
  ConnectionRTT = 10000063,

  // ── Tag attributes (5xxxxxxx) ──
  TagAttributeID_Min = 50000000,
  OutOfCombat = 50000001,
  Weakened = 50000002,
  Overheated = 50000003,
  Blocked = 50000004,
  Reviving = 50000005,
  FiringLocked = 50000006,
  Defeated = 50000007,
  PermanentFiringLocked = 50000008,
  LowPower = 50000009,
  CanSupply = 50000010,
  CanRevive = 50000011,
  CanOccupy = 50000012,
  Invincible = 50000013,
  IsChassisOnline = 50000014,
  HasGun = 50000016,
  IsInSupplyArea = 50000017,
  IsPrepared = 50000018,
  IsMatchStarted = 50000019,
  RFIDDisabled = 50000020,
  CanOperate = 50000021,
  IsBoost = 50000022,
  IsCharging = 50000023,
  IsInBaseGainPoint = 50000024,
  IsInRampGainPoint = 50000025,
  IsInDeploymentArea = 50000042,
  IsInDeploymentMode = 50000043,
  IsDeploymentModeChanging = 50000044,
  CanEnhancedSupply = 50000045,
  HasTeamDefenseBuff = 50000046,
  HasFortressAmmo = 50000047,

  // ── Functional tags (51xxxxxx) ──
  IsActorHidden = 51000001,
  BindActorInstanceId = 51000002,
  HP_Flash = 51000003,
  HP_MainColorSwitch = 51000004,
  HP_SideColorSwitch = 51000005,
  HP_MainColorIntensity = 51000006,
  HP_SideColorIntensity = 51000007,
  HP_Progress = 51000008,

  // ── State attributes (6xxxxxxx) ──
  StateAttributeID_Min = 60000000,
  Class = 60000002,
  Level = 60000003,
  HealthMax = 60000004,
  BufferEnergyMax = 60000005,
  CapacityEnergyMax = 60000006,
  ChassisEnergyMax = 60000007,
  ChassisPowerMax = 60000008,
  ChassisOperatePower = 60000009,
  AmmoCountMax = 60000010,
  FiringHeatMax1 = 60000011,
  FiringHeatExceedMax1 = 60000012,
  FiringHeatMax2 = 60000013,
  FiringHeatExceedMax2 = 60000014,
  AirSupportTimeMax = 60000015,
  WirelessChargingPowerMax = 60000016,
  ReviveProgressMax = 60000017,
  LevelMax = 60000018,
  ExperienceMax = 60000019,
  NextLevelExpMax = 60000020,
  CapacityEnergyPowerMax = 60000021,
  CapacityEnergyChargePowerMax = 60000022,

  // Combat multipliers
  AttackMultiplierThou = 61000000,
  DefenseMultiplierThou = 61000001,
  DamageMultiplierThou = 61000002,
  RecoverMultiplierThou = 61000003,
  ColdMultiplierThou = 61000004,
  PowerMultiplierThou = 61000005,
  FortressCoolingValue = 61000006,
  SentryDefenseMultiplierThou = 61000007,
  SentryDamageMultiplierThou = 61000008,
  SentryColdMultiplierThou = 61000011,
  TerrainCrossingColdMultiplierThou = 61000012,
  SentryColdCoefficientThou = 61000009,
  SentryPowerCoefficientThou = 61000010,

  // Bullet attributes
  BulletType = 62000000,
  BulletSpeed = 62000001,
  BulletElasticity = 62000002,
  BulletOwnerEntityID = 62000003,
  BulletRadius = 62000004,
  BulletOwnerActorID = 62000005,

  // Combat statistics
  DamageAppliedTotal = 63000000,
  DamageTakenTotal = 63000001,
  BulletFiredTotal = 63000002,

  // ── Team attributes (74xxxxxx) ──
  TM_State = 74000001,
  TM_Color = 74000002,
  TM_Coins = 74000003,
  TM_LevelMax = 74000004,
  TM_Ammo17mmMax = 74000005,
  TM_Ammo42mmMax = 74000006,
  TM_SupportCoins_70 = 74000007,
  TM_SupportCoins_140 = 74000008,
  G_ControlZone_TeamID = 74000009,
  TM_BaseDamageCount = 74000010,
  TM_OutPostRebuildCount = 74000011,
  TM_SentrySupplyAmmo = 74000012,
  TM_FortAmmo = 74000013,
  G_BlueOutpostZone_TeamID = 74000014,
  G_RedOutpostZone_TeamID = 74000015,
  G_BlueBaseCountdown = 74000016,
  G_RedBaseCountdown = 74000017,
  G_BlueOutpostRepairProgress = 74000018,
  G_RedOutpostRepairProgress = 74000019,
  G_ControlZone1_TeamID = 74000020,
  G_ControlZone2_TeamID = 74000021,
  TM_FortAmmoCapMax = 74000022,

  // ── Zone controller (75xxxxxx) ──
  TB_MarkerId = 75000001,
  TB_BelongTeamID = 75000002,
  TB_ControlSpeed = 75000003,
  TB_ControlProgress = 75000004,
  TB_ControlProgressMax = 75000005,
  TB_ControlLostTime = 75000006,
  TB_ControlLostDelay = 75000007,

  // ── Global variables (8xxxxxxx) ──
  G_MaxGameTime = 80000001,
  G_CurGameTime = 80000002,
  G_CurMapId = 80000003,
  G_CurMatchStatus = 80000005,
  G_GameStartCountDown = 80000006,

  G_BaseId_0 = 80001000,
  G_BaseId_MAX = 80001999,
  G_OutpostId_0 = 80002000,
  G_OutpostId_MAX = 80002999,
}

// ── Convenience enums ──

export enum ERobotBridgeDemoCareerId {
  None = 0,
  Hero = 1001,
  Engineer = 1002,
  Infantry = 1003,
  Sentry = 1004,
  Aerial = 1005,
  Radar = 1006,
  Dart = 1007,
  InfantrySecondary = 1008,
  Building = 2000,
  Base = 2001,
  Outpost = 2002,
}

export enum ERobotBridgeDemoPurchaseID {
  None = 0,
  Ammo17mm = 100001,
  Ammo42mm = 100002,
  RemoteAmmo17mm = 100003,
  RemoteAmmo42mm = 100004,
  RemoteHP = 100005,
  PurchaseRevival = 100006,
}
