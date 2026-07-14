/* eslint-disable */
/**
 * AUTO-GENERATED from the public FBS snapshot in schemas/fbs.
 * Do not edit by hand. Run scripts/generate-fbs-protocol.mjs.
 * Upstream gestalt_system commit: cfab7571284ab1ba379f97c0ed196986d792ec8e
 */

/** @source RobotBridgeDemoAttributeDefines.fbs:8 */
export enum ERobotBridgeAreaID {
  None = 0,
  BuffTrigger = 1,
  ControlZone = 2,
}

/** @source RobotBridgeDemoAttributeDefines.fbs:14 */
export enum ERobotBridgeDemoCareerId {
  None = 0,
  Hero = 1001,
  Engineer = 1002,
  Infantry = 1003,
  Sentry = 1004,
  Aerial = 1005,
  Radar = 1006,
  Dart = 1007,
  Building = 2000,
  Base = 2001,
  Outpost = 2002,
}

/** @source RobotBridgeDemoAttributeDefines.fbs:29 */
export enum ERobotBridgeDemoPurchaseID {
  None = 0,
  Ammo17mm = 100001,
  Ammo42mm = 100002,
  RemoteAmmo17mm = 100003,
  RemoteAmmo42mm = 100004,
  RemoteHP = 100005,
  PurchaseRevival = 100006,
  AerialSupportTime = 100007,
  /** CS Bomb Defuse (workshop demo, map_id 0x80000001) */
  CS_BUY_AMMO_REFILL = 100101,
  CS_BUY_HP_TIER1 = 100102,
  CS_BUY_HP_TIER2 = 100103,
  CS_BUY_AMMO_CAP_TIER1 = 100104,
  CS_BUY_AMMO_CAP_TIER2 = 100105,
  CS_BUY_SPEED_TIER1 = 100106,
  CS_BUY_SPEED_TIER2 = 100107,
}

/**
 * 定义属性ID，uint32类型
 * @source RobotBridgeDemoAttributeDefines.fbs:50
 */
export enum ERobotBridgeDemoAttributeId {
  /** 玩家属性，以0开头 */
  PlayerID_0 = 0,
  PlayerID_MAX = 100000,
  PlayerBattleAttributeMapID = 1000001,
  PlayerBaseAttributeMapID = 1000002,
  /** 值属性，以1开头 */
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
  POVRotationPitch = 10000038,
  POVRotationYaw = 10000039,
  POVTargetArmLength = 10000040,
  TeamID = 10000036,
  TeamNumber = 10000037,
  /** RMUC2026 哨兵姿态系统属性 */
  SentryMode = 10000044,
  SentryModeLastTime_Move = 10000045,
  SentryModeLastTime_Defense = 10000046,
  SentryModeLastTime_Attack = 10000047,
  SentryModeCooldownRemaining = 10000048,
  /** 枪口散布配置参数 */
  GunMaxEnclosing = 10000049,
  GunMinEnclosing = 10000050,
  GunEnclosingRatio = 10000051,
  GunTargetDistance = 10000052,
  /** 脱战系统参数 */
  OutOfCombatCountdown = 10000053,
  /** 发射模式 0:单发 1:三连发 2:持续连发 3:无保险连发 */
  FiringMode = 10000054,
  /** 远程补给待到达状态 */
  RemoteAmmoPendingCount = 10000055,
  RemoteAmmoCountdownMs = 10000056,
  RemoteRepairPendingCount = 10000057,
  RemoteRepairCountdownMs = 10000058,
  AutoAimLocked = 10000059,
  ConnectionUpdateFlag = 10000060,
  ConnectionLanAddress = 10000061,
  ConnectionPlatformAccountID = 10000062,
  ConnectionRTT = 10000063,
  ConnectionEntityConfigId = 10000064,
  /** 激光反制相关（对应 RMUC2026 规则 5.6.3 空中机器人被瞄准进度 P） */
  ConsecutiveLaserHitCount = 10000065,
  AerialLockCount = 10000066,
  RealDartAmmoCount = 10000067,
  RealLaserAmmoCount = 10000068,
  AmmoDartCount = 10000069,
  AmmoLaserCount = 10000070,
  DartControlTarget = 10000071,
  DartBaseTargetMode = 10000072,
  DartGateReady = 10000073,
  DartRemainingShots = 10000074,
  DartKeyNEnabled = 10000075,
  DartKeyMEnabled = 10000076,
  DartKeyJEnabled = 10000077,
  DartAimYaw = 10000078,
  DartAimPitch = 10000079,
  EngineerCarriedTechCoreCount = 10000080,
  DartGateCountdownMs = 10000081,
  DartGateCountdownDurationMs = 10000082,
  DartInterferenceEffectTrigger = 10000083,
  EngineerInitialCoinBonusIndex = 10000084,
  EngineerInitialCoinBonus = 10000085,
  RadarMarkProgress = 10000086,
  RadarMarkDelta = 10000087,
  RadarMarkLastStatus = 10000088,
  RadarMarkLevel = 10000089,
  RadarDoubleVulnerabilityCharges = 10000090,
  RadarDoubleVulnerabilityChargeProgressMs = 10000091,
  RadarDoubleVulnerabilityChargeProgressMaxMs = 10000092,
  DartAimArmorPlateId = 10000096,
  AerialFreeSupportTimeMs = 10000097,
  RadarDoubleVulnerabilityRemainingMs = 10000093,
  RadarDoubleVulnerabilityUsedCount = 10000094,
  RadarDetectionMode = 10000095,
  RMUC2026_Tech_L1 = 10000098,
  RMUC2026_Tech_L2 = 10000099,
  RMUC2026_Tech_L3 = 10000100,
  RMUC2026_Tech_L4 = 10000101,
  BoostControlMode = 10000102,
  SentryModeEnhancedRemaining_Move = 10000103,
  IsAIControlled = 50000088,
  AIMoveMode = 50000089,
  AITargetMode = 50000090,
  AIFireRateMilliHz = 50000091,
  AIFireMaxErrorMilliDeg = 50000092,
  IsInRuneZone = 50000093,
  AIRequestJump = 50000094,
  AIRequestSpecialAction1 = 50000095,
  AIRequestSpecialAction2 = 50000096,
  /** Generic AI move target: a map marker id (ABTMarker.Id) the Coach sets so the GotoMarker AIMoveMode (mode 60) resolves the marker's live world position and navigates to it. <=0 = no target (mode disables path). Lets new locations be pure data + coach logic without a per-location C++ move mode. */
  AIMoveTargetMarkerId = 50000097,
  SentryModeEnhancedRemaining_Defense = 10000104,
  SentryModeEnhancedRemaining_Attack = 10000105,
  HeroDeploymentModeCooldownRemainingMs = 10000106,
  /** Issue #40 monitor telemetry: per-robot world pose, pushed at 10Hz by URobotEchoBridgeProxy::PushTelemetryToTS via PushAttributeToTypescript and read back through attribute.watchAttributeMaps (same channel as the HUD). Values are RAW native UE units with NO fixed-point scaling (attribute values are double end-to-end on the wire): WorldPosX/Y/Z : world location in UE centimeters (cm). ChassisYaw : chassis yaw in degrees, world frame, wrapped to [-180,180]. TurretYaw/Pitch: gun-muzzle (GunSocket) world rotation in degrees, world-absolute; monitor derives turret-relative-to-chassis. */
  WorldPosX = 10000107,
  WorldPosY = 10000108,
  WorldPosZ = 10000109,
  ChassisYaw = 10000110,
  TurretYaw = 10000111,
  TurretPitch = 10000112,
  /** Per-chassis navigation capability bitmask. Set by the TS spawn layer (which knows the entity type) and read C++-side (EchoBridge -> pawn -> AutoPath) to pick the nav query filter / link actions. Bits: 0x1 = tunnel (low clearance), 0x2 = climb (stairs), 0x4 = flyramp. Independent bits, so one chassis can hold any combination (e.g. tunnel+climb = 0x3). */
  NavCapability = 10000113,
  /** Dynamic navigation route policy bitmask. Unlike NavCapability, this is strategy intent for the current match/tick, not chassis hardware ability. Bits: 0x1 = avoid red-side tunnel, 0x2 = avoid blue-side tunnel. */
  NavRoutePolicy = 10000114,
  /** 标签,以5开头 */
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
  TerrainCrossingStage1_Road = 50000026,
  TerrainCrossingStage1_Ramp_Reverse = 50000027,
  HasTerrainCrossing_Road = 50000028,
  HasTerrainCrossing_Road_Buff = 50000029,
  TerrainCrossingStage1_Highland = 50000030,
  HasTerrainCrossing_Highland = 50000031,
  HasTerrainCrossing_Highland_Buff = 50000032,
  TerrainCrossingStage1_Ramp = 50000033,
  HasTerrainCrossing_Ramp = 50000034,
  HasTerrainCrossing_Ramp_Buff = 50000035,
  HasTerrainCrossingDefenseBuff = 50000036,
  HasTerrainCrossingRefreshBuff = 50000037,
  IsInHighlandGainPoint = 50000038,
  IsInOutpostGainPoint = 50000039,
  IsInFortressGainPoint = 50000040,
  IsInFortressOccupyPoint = 50000041,
  IsInDeploymentArea = 50000042,
  IsInDeploymentMode = 50000043,
  IsDeploymentModeChanging = 50000044,
  CanEnhancedSupply = 50000045,
  HasTeamDefenseBuff = 50000046,
  HasFortressAmmo = 50000047,
  TerrainCrossingStage1_Tunnel = 50000048,
  TerrainCrossingStage2_Tunnel = 50000049,
  HasTerrainCrossing_Tunnel = 50000050,
  HasTerrainCrossing_Tunnel_Buff = 50000051,
  HasTerrainCrossing_Tunnel_ColdBuff = 50000052,
  CanPurchaseRevive = 50000053,
  IsInAssemblyArea = 50000054,
  HasEngineerEarlyDefenseBuff = 50000055,
  EngineerAssemblyInvincibleRemainingMs = 50000056,
  EngineerEarlyDefenseRemainingMs = 50000057,
  EngineerSelectedAssemblyLevel = 50000058,
  HasSmallRuneBuff = 50000059,
  EngineerTeamEnergyUnitStock = 50000060,
  EngineerSupplyTaskState = 50000061,
  EngineerSupplyTaskCountdownMs = 50000062,
  EngineerSupplyTaskDurationMs = 50000063,
  EngineerAssemblyTaskState = 50000064,
  EngineerAssemblyTaskCountdownMs = 50000065,
  EngineerAssemblyTaskDurationMs = 50000066,
  EngineerAssemblyCooldownCountdownMs = 50000067,
  EngineerAssemblyMaxCompletedLevel = 50000068,
  DartBlocked2s = 50000069,
  DartBlocked3s = 50000070,
  DartBlocked5s = 50000071,
  DartBlocked10s = 50000072,
  RadarMarkAccurateTag = 50000073,
  RadarDoubleVulnerabilityActive = 50000074,
  RadarHasVulnerableTarget = 50000075,
  /** 哨兵姿态疲劳标记（低频 0/1，由 SentryModeFatiguedTagBuff 在累计时间 >=180000ms 时一次性置 1，效果 buff 据此切换 normal/weakened，避免直接监听 100ms 计时属性） */
  SentryModeFatigued_Move = 50000076,
  SentryModeFatigued_Defense = 50000077,
  SentryModeFatigued_Attack = 50000078,
  /** 工程倒计时阶段标记（低频 0/1，业务侧在开启倒计时时置 1，归零 ExpireBuff 置 0；效果 buff 据此切换，避免直接监听 100ms 计时属性） */
  EngineerEarlyDefenseActive = 50000079,
  EngineerAssemblyInvincibleActive = 50000080,
  AerialIsSupporting = 50000081,
  BigRuneBuffArmCount = 50000082,
  BigRuneBuffLightCount = 50000083,
  DartCounterBuffSuspended = 50000084,
  DartDetectionWindowClosed = 50000085,
  IsBoostOverdraftAllowed = 50000086,
  SentryModeEnhanced = 50000087,
  /** 常用功能性标签，以51开头 */
  IsActorHidden = 51000001,
  BindActorInstanceId = 51000002,
  HP_Flash = 51000003,
  HP_MainColorSwitch = 51000004,
  HP_SideColorSwitch = 51000005,
  HP_MainColorIntensity = 51000006,
  HP_SideColorIntensity = 51000007,
  HP_Progress = 51000008,
  /** 状态属性,以6开头 基本属性 */
  StateAttributeID_Min = 60000000,
  Class = 60000002,
  Level = 60000003,
  /** 上限属性 */
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
  /** 战斗属性 */
  AttackMultiplierThou = 61000000,
  DefenseMultiplierThou = 61000001,
  DamageMultiplierThou = 61000002,
  RecoverMultiplierThou = 61000003,
  ColdMultiplierThou = 61000004,
  PowerMultiplierThou = 61000005,
  FortressCoolingValue = 61000006,
  /** 哨兵姿态专属战斗属性（按规则手册 §5.6.4 分层组合） 增益类：与同类通用增益取max（防御、易伤、冷却增益） */
  SentryDefenseMultiplierThou = 61000007,
  SentryDamageMultiplierThou = 61000008,
  SentryColdMultiplierThou = 61000011,
  TerrainCrossingColdMultiplierThou = 61000012,
  RadarDamageMultiplierThou = 61000013,
  /** 后置系数类：在基础值计算完成后乘算（冷却衰减、功率变化） */
  SentryColdCoefficientThou = 61000009,
  SentryPowerCoefficientThou = 61000010,
  /** 子弹属性 */
  BulletType = 62000000,
  BulletSpeed = 62000001,
  BulletSize = 62000004,
  BulletOwnerActorID = 62000005,
  BulletInitPacked32 = 62000006,
  ProjectileCountPerShot = 62000007,
  /** 统计属性 */
  DamageAppliedTotal = 63000000,
  DamageTakenTotal = 63000001,
  BulletFiredTotal = 63000002,
  /** Per-vehicle cumulative combat stats, collected in BASE systems (rule-year-agnostic): ArmourCollisionSystem increments BulletHitTotal on the attacker per armor hit; DamageSystem increments KillCount (attacker) + DeathCount (victim) on a lethal blow. Live on the combat map -> persist across revives = per-match cumulative. Hit rate = BulletHitTotal / BulletFiredTotal. */
  BulletHitTotal = 63000003,
  KillCount = 63000004,
  DeathCount = 63000005,
  /** 场景交互，以7开头 能量站传入数据 */
  BS_State = 70000001,
  BS_IsSuccess = 70000002,
  BS_CurOmega = 70000003,
  BS_CurRoll = 70000004,
  BS_SetTargetIndex = 70000005,
  BS_SetTargetRingNum = 70000006,
  BS_SetTargetState = 70000007,
  BS_Target_0 = 70000008,
  BS_Target_1 = 70000009,
  BS_Target_2 = 70000010,
  BS_Target_3 = 70000011,
  BS_Target_4 = 70000012,
  BS_CurA = 70000013,
  BS_CurW = 70000014,
  BS_CurB = 70000015,
  BS_PhaseMode = 70000016,
  BS_RemainingChances = 70000017,
  BS_NextActivatableInMs = 70000018,
  BS_NextActivatableTotalMs = 70000019,
  /** 交换站配置 */
  TP_CheckInterval = 71000001,
  TP_CheckMinTime = 71000002,
  TP_CheckMaxTime = 71000003,
  TP_SuccessChance = 71000004,
  TP_DetectorExtent_X = 71000005,
  TP_DetectorExtent_Y = 71000006,
  TP_DetectorExtent_Z = 71000007,
  /** 前哨站配置 */
  OP_AngularSpeed = 72000001,
  OP_RotationStopRequested = 72000002,
  /** 基地属性 */
  BC_State = 73000001,
  BC_DartDetectionMode = 73000002,
  BC_DartModuleROM = 73000003,
  BC_MoveInterval = 73000004,
  BC_MoveTarget = 73000005,
  /** 團隊屬性 */
  TM_State = 74000001,
  TM_Color = 74000002,
  TM_Coins = 74000003,
  TM_LevelMax = 74000004,
  TM_Ammo17mmMax = 74000005,
  TM_Ammo42mmMax = 74000006,
  /** RMUL2026特有 */
  TM_SupportCoins_70 = 74000007,
  TM_SupportCoins_140 = 74000008,
  G_ControlZone_TeamID = 74000009,
  G_ControlZone1_TeamID = 74000020,
  G_ControlZone2_TeamID = 74000021,
  /** RMUC2026特有 */
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
  TM_FortAmmoCapMax = 74000022,
  TM_DartOutpostHitCount = 74000023,
  TM_DartBaseHitCount = 74000024,
  TM_DartOutpostDamageTotal = 74000025,
  TM_DartBaseDamageTotal = 74000026,
  TM_DartSuppressedHitCount = 74000027,
  /** 区域控制器属性 */
  TB_MarkerId = 75000001,
  TB_BelongTeamID = 75000002,
  TB_ControlSpeed = 75000003,
  TB_ControlProgress = 75000004,
  TB_ControlProgressMax = 75000005,
  TB_ControlLostTime = 75000006,
  TB_ControlLostDelay = 75000007,
  /** 全局变量 */
  G_MaxGameTime = 80000001,
  G_CurGameTime = 80000002,
  G_CurMapId = 80000003,
  G_CurMatchStatus = 80000005,
  G_GameStartCountDown = 80000006,
  G_BaseId_0 = 80001000,
  G_BaseId_MAX = 80001999,
  G_OutpostId_0 = 80002000,
  G_OutpostId_MAX = 80002999,
  /** CS Bomb Defuse (workshop demo, map_id 0x80000001) global vars */
  CS_RoundPhase = 80003001,
  CS_RoundTimerMs = 80003002,
  CS_RoundIndex = 80003003,
  CS_DeployerEntityId = 80003004,
  CS_DefuseProgress = 80003005,
  CS_AttackerRoundsWon = 80003006,
  CS_DefenderRoundsWon = 80003007,
  G_BuffStationId_0 = 80004000,
  G_BuffStationId_MAX = 80004999,
}

/**
 * entity类型
 * @source RobotBridgeDemoEntityDefine.fbs:11
 */
export enum ERobotBridgeDemoEntityType {
  None = 0,
  Buildings = 1,
  Bullet = 2,
  Vehicle = 3,
}

/**
 * entity ID，一共7位，以6开头 建筑物类型，以61开头
 * @source RobotBridgeDemoEntityDefine.fbs:21
 */
export enum ERobotBridgeDemoBuildingsType {
  None = 6100000,
  DartSystem = 6100001,
  RadarSystem = 6100002,
  Outpost = 6100003,
  MainBase = 6100004,
}

/**
 * 弹丸伤害类型，与 BulletType 属性值保持一致
 * @source RobotBridgeDemoEntityDefine.fbs:30
 */
export enum ERobotBridgeDemoBulletType {
  Projectile42mm = 0,
  Projectile17mm = 1,
  Dart = 2,
  Laser = 3,
}

/**
 * 载具类型，以63开头
 * @source RobotBridgeDemoEntityDefine.fbs:38
 */
export enum ERobotBridgeDemoVehicleType {
  None = 6300000,
  HeroRobot = 6300001,
  InfantryRobot = 6300002,
  SentryRobot = 6300003,
  EngineerRobot = 6300004,
  AerialRobot = 6300005,
  RadarRobot = 6300006,
  DartRobot = 6300007,
}

/**
 * VehicleInputData index enum (synced across C++ and TS via FlatBuffer codegen). When adding a new
 * input action: add an entry here, then run generate-protol.ps1.
 * @source RobotBridgeDemoInputDefine.fbs:10
 */
export enum EVehicleInputIndex {
  MoveX = 0,
  MoveY = 1,
  LookX = 2,
  LookY = 3,
  ViewModeToggle = 4,
  Boost = 5,
  SpinToggle = 6,
  ReadyOrResetPosition = 7,
  RespawnHero = 8,
  RespawnInfantry = 9,
  RespawnAsSentry = 10,
  RespawnAsObserver = 11,
  AltMode = 12,
  Skill1 = 13,
  Skill2 = 14,
  RespawnDrone = 15,
  Mode1 = 16,
  Mode2 = 17,
  Mode3 = 18,
  Handbrake = 19,
  FireModeCycle = 20,
  Skill3 = 21,
  RespawnSecondaryInfantry = 22,
  PreferredHero = 23,
  PreferredInfantry = 24,
  PreferredSentry = 25,
  AutoAim = 26,
  MoveZ = 27,
  PreferredAerial = 28,
  RespawnEngineer = 29,
  EnterRadar = 30,
  EnterDart = 31,
  Skill4 = 32,
  RespawnTertiaryInfantry = 33,
  Jump = 34,
  VID_MAX = 35,
}

/**
 * entity类型
 * @source RobotBridgeDemoMapDefine.fbs:11
 */
export enum ERobotBridgeDemoMapType {
  BlankLevel = 0,
  GameStartLevel = 1,
  L_Traning = 2,
  L_Map2024 = 3,
  L_Map2026 = 4,
  L_MapRMUL2026 = 5,
  L_MapRMUL2026_IF = 6,
  L_Map20261V1 = 7,
  L_Map2026_IF = 8,
  EchoRobotBridgeDemoMapType_END = 9,
}

/**
 * 资源ID, 一共9位 建筑物资源ID
 * @source RobotBridgeDemoResourceIdDefine.fbs:13
 */
export enum ERobotBridgeDemoBuildingsResourceId {
  Start = 100000000,
  BuffStation = 100000001,
  TradePost = 100000002,
  Outpost2026 = 100000003,
  BaseCore = 100000004,
  EchoActor = 100000005,
  GlobalVarsWatcher = 100000006,
  EchoRobotBridgeDemoBuildingsResourceId_END = 100000007,
}

/**
 * 子弹资源ID
 * @source RobotBridgeDemoResourceIdDefine.fbs:25
 */
export enum ERobotBridgeDemoBulletResourceId {
  Start = 200000000,
  BulletSmall = 200000001,
  ProjectileSmall = 200000002,
  ProjectileBig = 200000003,
  ProjectileLaser = 200000004,
  ProjectileDart = 200000005,
  EchoRobotBridgeDemoBulletResourceId_END = 200000006,
}

/**
 * 载具资源ID
 * @source RobotBridgeDemoResourceIdDefine.fbs:36
 */
export enum ERobotBridgeDemoVehicleResourceId {
  Start = 300000000,
  HeroRobot = 300000002,
  InfantryRobot = 300000003,
  LiftHeroRobot = 300000004,
  Observer = 300000005,
  SentryRobot = 300000006,
  AssaultInfantryRobot = 300000007,
  FourWheelInfantryRobot = 300000008,
  EngineerRobot = 300000010,
  RadarRobot = 300000011,
  DartRobot = 300000012,
  AssaultHeroRobot = 300000013,
  EchoRobotBridgeDemoVehicleResourceId_END = 300000014,
}

/**
 * 组件资源ID
 * @source RobotBridgeDemoResourceIdDefine.fbs:53
 */
export enum ERobotBridgeDemoComponentResourceId {
  Start = 400000000,
  /** 装甲组件 */
  LargeArmour = 400000001,
  BuffStationTargetComponent = 400000002,
  CollisionProxy = 400000003,
  SmallArmour = 400000004,
  PowerCallback = 400000005,
  BulletCallback = 400000006,
  BuffTrigger = 400000007,
  TriangleArmour = 400000008,
  DroneLaserArmour = 400000009,
  EchoRobotBridgeDemoComponentResourceId_END = 400000010,
}

/**
 * 定义TransformId, 以97开头，并且一共7位
 * @source RobotBridgeDemoTransformIdDefine.fbs:10
 */
export enum ERobotBridgeDemoTransformId {
  Start = 9700000,
  RobotStartPositionFirst = 9700001,
  RobotArmourPositionFirst = 9700002,
  RobotBulletStartPosition = 9700003,
  RobotBuffStationPosition = 9700004,
  RobotBuffStationTargetPosition = 9700005,
  NPCStartPositionFirst = 9700006,
  BulletCollisionProxy = 9700007,
  RobotBuffStationPositionTest = 9700008,
  RobotStartPositionTest = 9700009,
  NPCStartPositionTest = 9700010,
  TradePostPositionTest = 9700011,
  TradePostCollisionProxy = 9700012,
  PlayerStart = 9700013,
  Outpost2026_0 = 9700014,
  Outpost2026_1 = 9700015,
  BaseCore2026_0 = 9700016,
  BaseCore2026_1 = 9700017,
  BaseCoreTraining_0 = 9700018,
  BaseCoreTraining_1 = 9700019,
  OutpostTraining_0 = 9700020,
  OutpostTraining_1 = 9700021,
  BuffStationTraining_0 = 9700022,
  BaseCore2024_0 = 9700023,
  BaseCore2024_1 = 9700024,
  Outpost2024_0 = 9700025,
  Outpost2024_1 = 9700026,
  BuffStation2024_0 = 9700027,
  BuffStation2024_1 = 9700028,
  BaseCoreRMUL2026_0 = 9700029,
  BaseCoreRMUL2026_1 = 9700030,
  Radar2026_0 = 9700031,
  Radar2026_1 = 9700032,
  Dart2026_0 = 9700033,
  Dart2026_1 = 9700034,
  RobotEngineerArmourOffset = 9700035,
  EchoRobotBridgeDemoTransformId_END = 9700036,
}

/**
 * 定义TransformBaseId, 以93开头，并且一共7位
 * @source RobotBridgeDemoTransformIdDefine.fbs:51
 */
export enum ERobotBridgeDemoTransformBaseId {
  Start = 9300000,
  RobotStartPositionBaseFirst = 9300001,
  RobotBuffStationTargetBase = 9300002,
  RobotBulletStartPositionBase = 9300003,
  RobotBulletCollisionProxyBase = 9300004,
  RobotTradeStationCollisionProxyBase = 9300005,
  EchoRobotBridgeDemoTransformBaseId_END = 9300006,
}

/** @source RobotBridgeDemoTransformIdDefine.fbs:61 */
export enum ERobotBridgeDemoComponentTransformId {
  Start = 8700000,
  TestComponentTransform = 8700001,
  Armour0 = 8700002,
  Armour1 = 8700003,
  Armour2 = 8700004,
  Armour3 = 8700005,
  Armour4 = 8700006,
  Armour5 = 8700007,
  Armour6 = 8700008,
  Armour7 = 8700009,
  ERobotBridgeDemoComponentTransformId_END = 8700010,
}

/**
 * Project-level TS→C++ universal events. The numeric value of every entry MUST be strictly greater
 * than Echo's EEchoUniversalEventType::GameProjectUniversalEvent (9900000);
 * FEchoUniversalEventManager routes any incoming universal_event_type above that sentinel to
 * FRobotBridgeUniversalEventManager via OnProjectUniversalEventDelegate.
 * @source RobotBridgeDemoUniversalEventDefine.fbs:13
 */
export enum ERobotBridgeUniversalEventType {
  /** Set local player preferred vehicle (TS→C++) */
  SetPreferredVehicle = 9900001,
  /** RBStressTest dev/stress harness (TS→C++) */
  RBStressPushInput = 9900002,
  RBStressSetFakeConnPreset = 9900003,
  RBStressLogDiagnostic = 9900004,
  RBStressDumpReport = 9900005,
  /** Start/stop the engine CsvProfiler during a stress run (TS→C++). */
  RBStressCsvProfiler = 9900006,
  /** Apply RGB camera parameter settings (fire-and-forget; payload carries the settings JSON). TS→C++; replaces the old direct ApplyRGBCameraSettingsJson UFUNCTION call from the TS web bridge. */
  RGBCameraApplySettings = 9900007,
  /** Request the installed Workshop gamemode index + bundle sources (TS→C++). C++ replies via the WorkshopGamemodesResult TypescriptCycleEvent. Replaces the old synchronous GetWorkshopGamemodeIndexJson/LoadWorkshopModBundleSource UFUNCTION calls from the TS workshop bridge. */
  WorkshopGetGamemodes = 9900008,
  /** Execute a native UE console command (TS→C++, fire-and-forget). Payload: { "command": string }. Dispatched by the TS `UEExec` console command so a headless WS client (console.exec "UEExec r.TpsAim.ForceTps 1") can flip UE cvars at runtime. The C++ listener refuses it in Shipping builds. */
  UEConsoleExec = 9900009,
  RobotBridgeUniversalEventType_END = 9900010,
}
