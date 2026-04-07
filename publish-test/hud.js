/**
 * Minimal Workshop HUD — pure JS, no framework dependencies.
 *
 * Uses the UMD build of @axisray-lab/gestalt-hud-sdk/workshop loaded
 * via <script> tag. The global `GestaltHUD` namespace provides:
 *   - GestaltHUDBridge
 *   - ERobotBridgeDemoAttributeId (Attr)
 *   - ERobotBridgeDemoMapType
 */

(function () {
  'use strict';

  var bridge = new GestaltHUD.GestaltHUDBridge();
  var Attr = GestaltHUD.ERobotBridgeDemoAttributeId;

  // Load manifest — the promise is awaited before sending hud:ready
  var manifestReady = fetch('./manifest.json')
    .then(function (r) { return r.json(); })
    .then(function (m) {
      document.getElementById('version-badge').textContent =
        'Workshop: ' + m.name + ' v' + m.version;
      return m;
    })
    .catch(function () {
      console.warn('[Workshop HUD] Could not load manifest.json');
      return { name: 'Workshop HUD', version: '0.0.0' };
    });

  // DOM references
  var elTimer = document.getElementById('match-timer');
  var elTeamTag = document.getElementById('team-tag');
  var elLevel = document.getElementById('level');
  var elHealthFill = document.getElementById('health-bar-fill');
  var elHealthText = document.getElementById('health-text');
  var elAmmo = document.getElementById('ammo-count');
  var elRedBase = document.getElementById('red-base-hp');
  var elBlueBase = document.getElementById('blue-base-hp');
  var elBadge = document.getElementById('version-badge');

  // State
  var teamId = -1;
  var updateCount = 0;

  // Debug diagnostic element (visible counter when debug mode is on)
  var diagEl = null;
  if (location.search.indexOf('gestalt-debug') !== -1) {
    diagEl = document.createElement('div');
    diagEl.style.cssText = 'position:fixed;bottom:4px;left:50%;transform:translateX(-50%);'
      + 'font-size:10px;color:#0f0;background:rgba(0,0,0,0.6);padding:2px 8px;'
      + 'border-radius:3px;z-index:9999;font-family:monospace;';
    diagEl.textContent = 'waiting for data...';
    document.body.appendChild(diagEl);
  }

  // ── Init ──

  bridge.onInit(function (msg) {
    teamId = msg.teamId;
    updateTeamDisplay();
    if (diagEl) diagEl.textContent = 'init received, team=' + msg.teamId;
    manifestReady.then(function (m) {
      bridge.sendReady(m.name, m.version);
    });
  });

  // ── Attribute updates ──

  bridge.onAttributeUpdate(function (data) {
    updateCount++;
    var battle = data.battle || {};
    var global = data.global || {};
    if (diagEl) {
      var hp = battle[Attr.Health];
      var hpMax = battle[Attr.HealthMax];
      diagEl.textContent = '#' + updateCount + ' HP=' + hp + '/' + hpMax
        + ' keys=' + Object.keys(battle).length;
    }

    // Health
    var hp = num(battle[Attr.Health]);
    var hpMax = num(battle[Attr.HealthMax]);
    if (hpMax > 0) {
      var pct = Math.min(100, (hp / hpMax) * 100);
      elHealthFill.style.width = pct + '%';
      elHealthFill.style.backgroundColor = healthColor(pct);
      elHealthText.textContent = hp + ' / ' + hpMax;
    }

    // Level
    var lv = num(battle[Attr.Level]);
    if (lv > 0) elLevel.textContent = 'Lv.' + lv;

    // Team
    var newTeam = battle[Attr.TeamID];
    if (newTeam !== undefined && newTeam !== teamId) {
      teamId = newTeam;
      updateTeamDisplay();
    }

    // Ammo (pick 42mm or 17mm based on BulletType)
    var bulletType = num(battle[Attr.BulletType]);
    var ammo = bulletType === 0
      ? num(battle[Attr.Ammo42mmCount])
      : num(battle[Attr.Ammo17mmCount]);
    elAmmo.textContent = String(ammo);

    // Match timer
    var maxTime = num(global[Attr.G_MaxGameTime]);
    var curTime = num(global[Attr.G_CurGameTime]);
    if (maxTime > 0) {
      var remaining = Math.max(0, maxTime - curTime);
      var totalSec = Math.floor(remaining / 1000);
      var m = String(Math.floor(totalSec / 60)).padStart(2, '0');
      var s = String(totalSec % 60).padStart(2, '0');
      elTimer.textContent = m + ':' + s;
    }

    // Base status (from base sub-maps if available)
    updateBaseStatus(data);
  });

  // ── Helpers ──

  function num(v) {
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  function healthColor(pct) {
    if (pct > 60) return '#2ecc71';
    if (pct > 30) return '#f39c12';
    return '#e74c3c';
  }

  function updateTeamDisplay() {
    var label, color;
    switch (teamId) {
      case 0:  label = 'RED';  color = '#e74c3c'; break;
      case 1:  label = 'BLUE'; color = '#3498db'; break;
      default: label = 'SPEC'; color = '#95a5a6'; break;
    }
    elTeamTag.textContent = label;
    elTeamTag.style.color = color;
  }

  function updateBaseStatus(data) {
    var base = data.base || {};
    var baseKeys = Object.keys(base);

    // Simple heuristic: first two base maps → red & blue
    if (baseKeys.length >= 2) {
      var b0 = base[baseKeys[0]] || {};
      var b1 = base[baseKeys[1]] || {};
      var hp0 = num(b0[Attr.Health]);
      var hpMax0 = num(b0[Attr.HealthMax]);
      var hp1 = num(b1[Attr.Health]);
      var hpMax1 = num(b1[Attr.HealthMax]);

      if (hpMax0 > 0) elRedBase.style.width = Math.min(100, (hp0 / hpMax0) * 100) + '%';
      if (hpMax1 > 0) elBlueBase.style.width = Math.min(100, (hp1 / hpMax1) * 100) + '%';
    }
  }
})();
