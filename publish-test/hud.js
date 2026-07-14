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

  var diagnosticsState = {
    name: '',
    version: '',
    initReceived: false,
    readySent: false,
    updateCount: 0,
    lastUpdateAt: 0,
    lastMapId: null,
    scopeCounts: {
      battle: 0,
      global: 0,
      player: 0,
      base: 0,
      playerBattle: 0,
    },
    keySignals: {
      health: null,
      healthMax: null,
      bulletType: null,
      ammo17: null,
      ammo42: null,
      ammoDart: null,
      ammoLaser: null,
      gameTime: null,
      matchStatus: null,
      teamId: null,
    },
    errors: [],
  };

  function recordError(value) {
    var message = value instanceof Error ? value.message : String(value || 'Unknown error');
    diagnosticsState.errors.push(message.slice(0, 256));
    if (diagnosticsState.errors.length > 20) diagnosticsState.errors.shift();
  }

  var publicDiagnostics = {};
  [
    'name',
    'version',
    'initReceived',
    'readySent',
    'updateCount',
    'lastUpdateAt',
    'lastMapId',
  ].forEach(function (key) {
    Object.defineProperty(publicDiagnostics, key, {
      enumerable: true,
      get: function () { return diagnosticsState[key]; },
    });
  });
  Object.defineProperty(publicDiagnostics, 'scopeCounts', {
    enumerable: true,
    get: function () { return Object.freeze(Object.assign({}, diagnosticsState.scopeCounts)); },
  });
  Object.defineProperty(publicDiagnostics, 'keySignals', {
    enumerable: true,
    get: function () { return Object.freeze(Object.assign({}, diagnosticsState.keySignals)); },
  });
  Object.defineProperty(publicDiagnostics, 'errors', {
    enumerable: true,
    get: function () { return Object.freeze(diagnosticsState.errors.slice()); },
  });
  Object.freeze(publicDiagnostics);
  Object.defineProperty(window, '__GESTALT_HUD_DIAGNOSTICS__', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: publicDiagnostics,
  });

  window.addEventListener('error', function (event) {
    recordError(event.error || event.message);
  });
  window.addEventListener('unhandledrejection', function (event) {
    recordError(event.reason);
  });

  var bridge = new GestaltHUD.GestaltHUDBridge();
  var Attr = GestaltHUD.ERobotBridgeDemoAttributeId;

  // Local metadata keeps the production CSP at connect-src 'none'.
  var manifest = window.GESTALT_HUD_MANIFEST || {
    name: 'Workshop HUD',
    version: '0.0.0',
  };
  diagnosticsState.name = manifest.name;
  diagnosticsState.version = manifest.version;
  document.getElementById('version-badge').textContent =
    'Workshop: ' + manifest.name + ' v' + manifest.version;

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
  var lastTelemetryAt = -Infinity;

  // Shipping builds intentionally do not expose CEF remote debugging. Emit a
  // bounded, read-only diagnostic snapshot through the public debug-log
  // channel so the real Steam build can still be verified from its host log.
  function emitTelemetry(eventName) {
    bridge.sendDebugLog('GESTALT_HUD_E2E ' + JSON.stringify({
      event: eventName,
      name: diagnosticsState.name,
      version: diagnosticsState.version,
      initReceived: diagnosticsState.initReceived,
      readySent: diagnosticsState.readySent,
      updateCount: diagnosticsState.updateCount,
      lastUpdateAt: diagnosticsState.lastUpdateAt,
      lastMapId: diagnosticsState.lastMapId,
      scopeCounts: diagnosticsState.scopeCounts,
      keySignals: diagnosticsState.keySignals,
      errors: diagnosticsState.errors,
    }));
  }

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
    diagnosticsState.initReceived = true;
    diagnosticsState.lastMapId = Number.isFinite(msg.mapId) ? msg.mapId : null;
    teamId = msg.teamId;
    updateTeamDisplay();
    if (diagEl) diagEl.textContent = 'init received, team=' + msg.teamId;
    bridge.sendReady(manifest.name, manifest.version);
    diagnosticsState.readySent = true;
    emitTelemetry('init');
  });

  // ── Attribute updates ──

  bridge.onAttributeUpdate(function (data) {
    updateCount++;
    diagnosticsState.updateCount = updateCount;
    diagnosticsState.lastUpdateAt = Math.max(
      diagnosticsState.lastUpdateAt + 0.001,
      performance.now()
    );
    diagnosticsState.scopeCounts = {
      battle: Object.keys(data.battle || {}).length,
      global: Object.keys(data.global || {}).length,
      player: Object.keys(data.player || {}).length,
      base: Object.keys(data.base || {}).length,
      playerBattle: Object.keys(data.playerBattle || {}).length,
    };
    var battle = data.battle || {};
    var global = data.global || {};
    diagnosticsState.keySignals = {
      health: signal(battle, Attr.Health),
      healthMax: signal(battle, Attr.HealthMax),
      bulletType: signal(battle, Attr.BulletType),
      ammo17: signal(battle, Attr.Ammo17mmCount),
      ammo42: signal(battle, Attr.Ammo42mmCount),
      ammoDart: signal(battle, Attr.AmmoDartCount),
      ammoLaser: signal(battle, Attr.AmmoLaserCount),
      gameTime: signal(global, Attr.G_CurGameTime),
      matchStatus: signal(global, Attr.G_CurMatchStatus),
      teamId: signal(battle, Attr.TeamID),
    };
    if (diagEl) {
      diagEl.textContent = '#' + updateCount
        + ' battleKeys=' + diagnosticsState.scopeCounts.battle;
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

    // Ammo follows ERobotBridgeDemoBulletType: 42mm, 17mm, dart, laser.
    var bulletType = num(battle[Attr.BulletType]);
    var ammo = ammoForBulletType(battle, bulletType);
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

    // Main bases are keyed by G_BaseId_0 + teamId.
    updateBaseStatus(data);

    var telemetryNow = performance.now();
    if (updateCount === 1 || telemetryNow - lastTelemetryAt >= 5000) {
      lastTelemetryAt = telemetryNow;
      emitTelemetry('diagnostics');
    }
  });

  // ── Helpers ──

  function num(v) {
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  function signal(scope, id) {
    var value = scope[id];
    return typeof value === 'number' && isFinite(value) ? value : null;
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
    var red = base[String(Attr.G_BaseId_0)] || {};
    var blue = base[String(Attr.G_BaseId_0 + 1)] || {};
    var redHp = num(red[Attr.Health]);
    var redMax = num(red[Attr.HealthMax]);
    var blueHp = num(blue[Attr.Health]);
    var blueMax = num(blue[Attr.HealthMax]);

    elRedBase.style.width = redMax > 0
      ? Math.min(100, (redHp / redMax) * 100) + '%'
      : '0%';
    elBlueBase.style.width = blueMax > 0
      ? Math.min(100, (blueHp / blueMax) * 100) + '%'
      : '0%';
  }
})();
