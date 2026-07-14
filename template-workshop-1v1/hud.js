/**
 * 1v1 Duel Workshop HUD — minimal player-focused overlay.
 *
 * UMD global `GestaltHUD`: GestaltHUDBridge, ERobotBridgeDemoAttributeId (Attr).
 */

(function () {
  'use strict';

  var bridge = new GestaltHUD.GestaltHUDBridge();
  var Attr = GestaltHUD.ERobotBridgeDemoAttributeId;

  var manifest = window.GESTALT_HUD_MANIFEST || {
    name: '1v1 Duel HUD',
    version: '0.0.0',
  };
  var readySent = false;
  var badge = document.getElementById('version-badge');
  if (badge) {
    badge.textContent = 'Workshop: ' + manifest.name + ' v' + manifest.version;
  }

  var elTimer = document.getElementById('match-timer');
  var elMatchStatus = document.getElementById('match-status');
  var elHealthFill = document.getElementById('health-bar-fill');
  var elHealthText = document.getElementById('health-text');
  var elAmmo = document.getElementById('ammo-count');
  var elHeatFill = document.getElementById('heat-bar-fill');
  var elDefeated = document.getElementById('defeated-overlay');
  var elOverheated = document.getElementById('overheated-warning');

  bridge.onInit(function () {
    if (readySent) return;
    readySent = true;
    bridge.sendReady(manifest.name, manifest.version);
  });

  bridge.onAttributeUpdate(function (data) {
    var battle = data.battle || {};
    var global = data.global || {};

    var hp = num(battle[Attr.Health]);
    var hpMax = num(battle[Attr.HealthMax]);
    if (hpMax > 0) {
      var pct = Math.min(100, (hp / hpMax) * 100);
      elHealthFill.style.width = pct + '%';
      elHealthFill.style.backgroundColor = healthColor(pct);
      elHealthText.textContent = hp + ' / ' + hpMax;
    }

    var bulletType = num(battle[Attr.BulletType]);
    var ammo = ammoForBulletType(battle, bulletType);
    elAmmo.textContent = String(ammo);

    var heat = num(battle[Attr.FiringHeat1]);
    var heatMax = num(battle[Attr.FiringHeatMax1]);
    if (heatMax > 0) {
      elHeatFill.style.width = Math.min(100, (heat / heatMax) * 100) + '%';
    } else {
      elHeatFill.style.width = '0%';
    }

    var maxTime = num(global[Attr.G_MaxGameTime]);
    var curTime = num(global[Attr.G_CurGameTime]);
    var matchStatus = num(global[Attr.G_CurMatchStatus]);
    var startCountdown = num(global[Attr.G_GameStartCountDown]);

    if (matchStatus === 0) {
      elMatchStatus.textContent = 'COUNTDOWN';
      var cdSec = Math.max(0, Math.ceil(startCountdown / 1000));
      elTimer.textContent = formatClockSeconds(cdSec);
    } else if (matchStatus === 1) {
      elMatchStatus.textContent = 'IN PROGRESS';
      if (maxTime > 0) {
        var remaining = Math.max(0, maxTime - curTime);
        elTimer.textContent = formatMsClock(remaining);
      }
    } else if (matchStatus === 2) {
      elMatchStatus.textContent = 'FINISHED';
      if (maxTime > 0) {
        elTimer.textContent = formatMsClock(Math.min(maxTime, curTime));
      } else {
        elTimer.textContent = '00:00';
      }
    } else {
      elMatchStatus.textContent = '—';
      if (maxTime > 0) {
        elTimer.textContent = formatMsClock(Math.max(0, maxTime - curTime));
      }
    }

    var defeated = num(battle[Attr.Defeated]) === 1;
    elDefeated.hidden = !defeated;

    var overheated = num(battle[Attr.Overheated]) === 1;
    elOverheated.hidden = !overheated;
  });

  function num(v) {
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  function ammoForBulletType(battle, bulletType) {
    switch (bulletType) {
      case 0: return num(battle[Attr.Ammo42mmCount]);
      case 1: return num(battle[Attr.Ammo17mmCount]);
      case 2: return num(battle[Attr.AmmoDartCount]);
      case 3: return num(battle[Attr.AmmoLaserCount]);
      default: return 0;
    }
  }

  function healthColor(pct) {
    if (pct > 60) return '#2ecc71';
    if (pct > 30) return '#f39c12';
    return '#e74c3c';
  }

  function formatMsClock(ms) {
    var totalSec = Math.floor(ms / 1000);
    var m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    var s = String(totalSec % 60).padStart(2, '0');
    return m + ':' + s;
  }

  function formatClockSeconds(totalSec) {
    var m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    var s = String(totalSec % 60).padStart(2, '0');
    return m + ':' + s;
  }
})();
