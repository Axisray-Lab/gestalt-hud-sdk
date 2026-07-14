/**
 * RMUC2026 Workshop HUD — pure HTML/CSS/JS.
 *
 * Global from gestalt-hud-sdk.workshop.umd.js:
 *   GestaltHUD.GestaltHUDBridge
 *   GestaltHUD.ERobotBridgeDemoAttributeId
 */

(function () {
  'use strict';

  var bridge = new GestaltHUD.GestaltHUDBridge();
  var Attr = GestaltHUD.ERobotBridgeDemoAttributeId;
  var Career = GestaltHUD.ERobotBridgeDemoCareerId;

  var manifest = window.GESTALT_HUD_MANIFEST || {
    name: 'RMUC2026 Competition HUD',
    version: '0.0.0',
  };
  var readySent = false;
  var badge = document.getElementById('version-badge');
  if (badge) badge.textContent = manifest.name + ' v' + manifest.version;

  var elTimer = document.getElementById('match-timer');
  var elMatchStatus = document.getElementById('match-status');
  var elTeamTag = document.getElementById('team-tag');
  var elLevel = document.getElementById('level');
  var elCareer = document.getElementById('career-name');
  var elHealthFill = document.getElementById('health-bar-fill');
  var elHealthText = document.getElementById('health-text');
  var elBufferFill = document.getElementById('buffer-bar-fill');
  var elBufferText = document.getElementById('buffer-text');
  var elHeatFill = document.getElementById('heat-bar-fill');
  var elHeatText = document.getElementById('heat-text');
  var elAmmoPanel = document.getElementById('ammo-panel-count');
  var elAmmoTypeLabel = document.getElementById('ammo-type-label');
  var elAmmoTitle = document.getElementById('ammo-type-title');
  var elAmmo = document.getElementById('ammo-count');
  var elTmCoins = document.getElementById('tm-coins');
  var elRedBase = document.getElementById('red-base-hp');
  var elBlueBase = document.getElementById('blue-base-hp');
  var elBlueOutpostZone = document.getElementById('blue-outpost-zone');
  var elRedOutpostZone = document.getElementById('red-outpost-zone');
  var elBlueOutpostRepair = document.getElementById('blue-outpost-repair');
  var elRedOutpostRepair = document.getElementById('red-outpost-repair');
  var elControlZoneIndicator = document.getElementById('control-zone-indicator');
  var elControlZoneText = document.getElementById('control-zone-text');
  var elRemotePanel = document.getElementById('remote-supply-panel');
  var elRemoteAmmoBlock = document.getElementById('remote-ammo-block');
  var elRemoteRepairBlock = document.getElementById('remote-repair-block');
  var elRemoteAmmoCount = document.getElementById('remote-ammo-count');
  var elRemoteAmmoCd = document.getElementById('remote-ammo-cd');
  var elRemoteRepairCount = document.getElementById('remote-repair-count');
  var elRemoteRepairCd = document.getElementById('remote-repair-cd');
  var elOverlayDefeated = document.getElementById('overlay-defeated');
  var elOverlayOverheated = document.getElementById('overlay-overheated');
  var elOverlayJammed = document.getElementById('overlay-jammed');

  var teamId = -1;

  var CAREER = {};
  CAREER[Career.Hero] = 'Hero';
  CAREER[Career.Engineer] = 'Engineer';
  CAREER[Career.Infantry] = 'Infantry';
  CAREER[Career.Sentry] = 'Sentry';
  CAREER[Career.Aerial] = 'Aerial';
  CAREER[Career.Radar] = 'Radar';
  CAREER[Career.Dart] = 'Dart';

  bridge.onInit(function (msg) {
    teamId = msg.teamId;
    updateTeamDisplay();
    if (!readySent) {
      readySent = true;
      bridge.sendReady(manifest.name, manifest.version);
    }
  });

  bridge.onAttributeUpdate(function (data) {
    var battle = data.battle || {};
    var global = data.global || {};

    // Health
    var hp = num(battle[Attr.Health]);
    var hpMax = num(battle[Attr.HealthMax]);
    if (hpMax > 0) {
      var hpPct = Math.min(100, (hp / hpMax) * 100);
      elHealthFill.style.width = hpPct + '%';
      elHealthFill.style.background = healthGradient(hpPct);
      elHealthText.textContent = Math.round(hp) + ' / ' + Math.round(hpMax);
    }

    // Buffer energy
    var buf = num(battle[Attr.BufferEnergy]);
    var bufMax = num(battle[Attr.BufferEnergyMax]);
    if (bufMax > 0) {
      var bufPct = Math.min(100, (buf / bufMax) * 100);
      elBufferFill.style.width = bufPct + '%';
      elBufferText.textContent = Math.round(buf) + ' / ' + Math.round(bufMax);
    }

    // Firing heat
    var heat = num(battle[Attr.FiringHeat1]);
    var heatMax = num(battle[Attr.FiringHeatMax1]);
    if (heatMax > 0) {
      var heatPct = Math.min(100, (heat / heatMax) * 100);
      elHeatFill.style.width = heatPct + '%';
      elHeatText.textContent = Math.round(heat) + ' / ' + Math.round(heatMax);
    }

    // Level & career
    var lv = num(battle[Attr.Level]);
    if (lv > 0) elLevel.textContent = 'Lv.' + lv;

    var cls = num(battle[Attr.Class]);
    elCareer.textContent = careerName(cls);

    // Team
    var newTeam = battle[Attr.TeamID];
    if (newTeam !== undefined && newTeam !== teamId) {
      teamId = newTeam;
      updateTeamDisplay();
    }

    // Ammo follows ERobotBridgeDemoBulletType: 42mm, 17mm, dart, laser.
    var bulletType = num(battle[Attr.BulletType]);
    var ammoInfo = ammoForBulletType(battle, bulletType);
    var ammo = ammoInfo.count;
    elAmmo.textContent = String(ammo);
    elAmmoPanel.textContent = String(ammo);
    elAmmoTypeLabel.textContent = ammoInfo.label;
    elAmmoTitle.textContent = ammoInfo.label;

    // Team coins (battle or global)
    var coinsRaw = battle[Attr.TM_Coins];
    if (coinsRaw === undefined) coinsRaw = global[Attr.TM_Coins];
    elTmCoins.textContent = String(num(coinsRaw));

    // Match timer & status
    updateMatchHud(global);

    // Tags
    toggleOverlay(elOverlayDefeated, tagOn(battle[Attr.Defeated]));
    toggleOverlay(elOverlayOverheated, tagOn(battle[Attr.Overheated]));
    toggleOverlay(elOverlayJammed, tagOn(battle[Attr.Blocked]));

    // Global: control zone
    updateControlZone(global);

    // Remote supply
    updateRemoteSupply(battle);

    // Base + outposts
    updateBaseStatus(data);
    updateOutposts(global);
  });

  function num(v) {
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  function ammoForBulletType(battle, bulletType) {
    switch (bulletType) {
      case 0: return { count: num(battle[Attr.Ammo42mmCount]), label: '42mm' };
      case 1: return { count: num(battle[Attr.Ammo17mmCount]), label: '17mm' };
      case 2: return { count: num(battle[Attr.AmmoDartCount]), label: 'DART' };
      case 3: return { count: num(battle[Attr.AmmoLaserCount]), label: 'LASER' };
      default: return { count: 0, label: '—' };
    }
  }

  function tagOn(v) {
    return num(v) !== 0;
  }

  function careerName(id) {
    return CAREER[id] || ('Class ' + id);
  }

  function healthGradient(pct) {
    if (pct > 60) return 'linear-gradient(90deg, #27ae60, #2ecc71)';
    if (pct > 30) return 'linear-gradient(90deg, #d68910, #f39c12)';
    return 'linear-gradient(90deg, #c0392b, #e74c3c)';
  }

  function updateTeamDisplay() {
    var label;
    var color;
    switch (teamId) {
      case 0:
        label = 'RED';
        color = '#ff6b6b';
        break;
      case 1:
        label = 'BLUE';
        color = '#74b9ff';
        break;
      default:
        label = 'SPEC';
        color = '#b2bec3';
        break;
    }
    elTeamTag.textContent = label;
    elTeamTag.style.color = color;
  }

  /** G_CurMatchStatus: 0 wait, 1 live, 2 ended */
  function updateMatchHud(global) {
    var maxTime = num(global[Attr.G_MaxGameTime]);
    var curTime = num(global[Attr.G_CurGameTime]);
    var status = num(global[Attr.G_CurMatchStatus]);
    var startCd = num(global[Attr.G_GameStartCountDown]);

    if (status === 0 && startCd > 0) {
      elMatchStatus.textContent = 'STARTING';
      var s0 = Math.max(0, Math.ceil(startCd / 1000));
      elTimer.textContent = formatMmSsFromSeconds(s0);
    } else if (status === 2) {
      elMatchStatus.textContent = 'ENDED';
      elTimer.textContent = '00:00';
    } else if (status === 1 && maxTime > 0) {
      elMatchStatus.textContent = 'LIVE';
      var remaining = Math.max(0, maxTime - curTime);
      var totalSec = Math.floor(remaining / 1000);
      elTimer.textContent = formatMmSsFromSeconds(totalSec);
    } else {
      elMatchStatus.textContent = 'WAITING';
      if (maxTime > 0) {
        var rem = Math.max(0, maxTime - curTime);
        var ts = Math.floor(rem / 1000);
        elTimer.textContent = formatMmSsFromSeconds(ts);
      }
    }
  }

  function formatMmSsFromSeconds(totalSec) {
    var m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    var s = String(totalSec % 60).padStart(2, '0');
    return m + ':' + s;
  }

  function teamLabelFromZoneId(id) {
    if (id === 0) return { text: 'RED', cls: 'red' };
    if (id === 1) return { text: 'BLUE', cls: 'blue' };
    return { text: 'NEUTRAL', cls: 'neutral' };
  }

  function updateControlZone(global) {
    var tid = num(global[Attr.G_ControlZone_TeamID]);
    var info = teamLabelFromZoneId(tid);
    elControlZoneText.textContent = info.text;
    elControlZoneIndicator.classList.remove('neutral', 'red', 'blue');
    elControlZoneIndicator.classList.add(info.cls);
  }

  function updateRemoteSupply(battle) {
    var aCount = num(battle[Attr.RemoteAmmoPendingCount]);
    var aCd = num(battle[Attr.RemoteAmmoCountdownMs]);
    var rCount = num(battle[Attr.RemoteRepairPendingCount]);
    var rCd = num(battle[Attr.RemoteRepairCountdownMs]);

    var showAmmo = aCount > 0;
    var showRepair = rCount > 0;
    var showPanel = showAmmo || showRepair;

    elRemoteAmmoBlock.classList.toggle('hidden', !showAmmo);
    elRemoteRepairBlock.classList.toggle('hidden', !showRepair);
    elRemotePanel.classList.toggle('hidden', !showPanel);

    if (showAmmo) {
      elRemoteAmmoCount.textContent = String(aCount);
      elRemoteAmmoCd.textContent = formatCountdownMs(aCd);
    }
    if (showRepair) {
      elRemoteRepairCount.textContent = String(rCount);
      elRemoteRepairCd.textContent = formatCountdownMs(rCd);
    }

    var pulse = showPanel && (aCd > 0 || rCd > 0);
    elRemotePanel.classList.toggle('pulse-active', pulse);
  }

  function formatCountdownMs(ms) {
    if (ms <= 0) return '—';
    var sec = Math.ceil(ms / 1000);
    if (sec < 60) return sec + 's';
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function updateOutposts(global) {
    var bz = num(global[Attr.G_BlueOutpostZone_TeamID]);
    var rz = num(global[Attr.G_RedOutpostZone_TeamID]);
    setZonePill(elBlueOutpostZone, bz);
    setZonePill(elRedOutpostZone, rz);

    var brp = num(global[Attr.G_BlueOutpostRepairProgress]);
    var rrp = num(global[Attr.G_RedOutpostRepairProgress]);
    elBlueOutpostRepair.style.width = thousandthsToPct(brp) + '%';
    elRedOutpostRepair.style.width = thousandthsToPct(rrp) + '%';
  }

  function setZonePill(el, zoneTeamId) {
    var info = teamLabelFromZoneId(zoneTeamId);
    el.textContent = info.text;
    el.classList.remove('neutral', 'red', 'blue');
    el.classList.add(info.cls);
  }

  /** Thousandths: 1000 = 100% */
  function thousandthsToPct(v) {
    if (v <= 0) return 0;
    if (v <= 1000) return Math.min(100, v / 10);
    return Math.min(100, v);
  }

  function updateBaseStatus(data) {
    var base = data.base || {};
    var red = base[String(Attr.G_BaseId_0)] || {};
    var blue = base[String(Attr.G_BaseId_0 + 1)] || {};
    var redHp = num(red[Attr.Health]);
    var redMax = num(red[Attr.HealthMax]);
    var blueHp = num(blue[Attr.Health]);
    var blueMax = num(blue[Attr.HealthMax]);
    elRedBase.style.width = redMax > 0 ? Math.min(100, (redHp / redMax) * 100) + '%' : '0%';
    elBlueBase.style.width = blueMax > 0 ? Math.min(100, (blueHp / blueMax) * 100) + '%' : '0%';
  }

  function toggleOverlay(el, on) {
    el.classList.toggle('hidden', !on);
  }
})();
