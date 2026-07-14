/**
 * Workshop HUD DevTools — main controller.
 *
 * Simulates the game SPA role: sends hud:init and hud:attribute_update
 * to a HUD loaded in an iframe, logs all postMessage traffic.
 */

(function () {
  'use strict';

  // ── DOM refs ──

  var urlInput      = document.getElementById('hud-url');
  var btnLoad       = document.getElementById('btn-load');
  var btnRefresh    = document.getElementById('btn-refresh');
  var hudIframe     = document.getElementById('hud-iframe');
  var iframeOverlay = document.getElementById('iframe-overlay');

  var btnSendInit   = document.getElementById('btn-send-init');
  var btnSendData   = document.getElementById('btn-send-data');
  var btnAutoToggle = document.getElementById('btn-auto-toggle');
  var chkBypass     = document.getElementById('chk-bypass');

  var logBody       = document.getElementById('log-body');
  var btnClearLog   = document.getElementById('btn-clear-log');

  var statusText    = document.getElementById('status-text');
  var statusDot     = document.getElementById('status-dot');
  var statMsgCount  = document.getElementById('stat-msg-count');

  // Init config fields
  var selMap        = document.getElementById('init-map');
  var selTeam       = document.getElementById('init-team');
  var inpPlayer     = document.getElementById('init-player');
  var selMode       = document.getElementById('init-gamemode');

  // ── State ──

  var hudReady = false;
  var autoInterval = null;
  var totalMsgCount = 0;
  var hudLoaded = false;
  var hudOrigin = '*';

  // ── Load HUD ──

  btnLoad.addEventListener('click', loadHUD);
  urlInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') loadHUD();
  });

  function loadHUD() {
    var url = urlInput.value.trim();
    if (!url) return;
    var parsedUrl;
    try {
      parsedUrl = new URL(url, location.href);
    } catch (error) {
      addLog('system', null, 'Invalid HUD URL: ' + error.message, 'error');
      return;
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      addLog('system', null, 'HUD URL must use http:// or https://.', 'error');
      return;
    }
    if (parsedUrl.origin === location.origin) {
      addLog(
        'system',
        null,
        'HUD must use a different origin from DevTools. Open DevTools on localhost and use 127.0.0.1 for the HUD URL.',
        'error'
      );
      return;
    }
    hudOrigin = parsedUrl.origin;
    hudReady = false;
    hudLoaded = false;
    updateStatus('waiting', 'Loading HUD...');
    iframeOverlay.classList.add('hidden');

    var separator = url.indexOf('?') === -1 ? '?' : '&';
    var cacheBust = '_t=' + Date.now();
    var fullUrl = url + separator + 'gestalt-debug=1&' + cacheBust;
    hudIframe.onload = function () {
      hudLoaded = true;
      addLog('system', null, 'HUD iframe loaded and ready');
      updateStatus('waiting', 'HUD loaded — click Send Init');
    };
    hudIframe.onerror = function () {
      addLog('system', null, 'HUD iframe failed to load!', 'error');
    };
    hudIframe.src = fullUrl;

    addLog('system', null, 'Loading HUD: ' + fullUrl);
  }

  btnRefresh.addEventListener('click', function () {
    if (hudIframe.src && hudIframe.src !== 'about:blank') {
      hudReady = false;
      hudLoaded = false;
      updateStatus('waiting', 'Refreshing...');
      hudIframe.src = hudIframe.src;
      addLog('system', null, 'HUD refreshed');
    }
  });

  // ── Listen for messages from HUD ──

  window.addEventListener('message', function (event) {
    if (event.source !== hudIframe.contentWindow || event.origin !== hudOrigin) return;
    var msg = event.data;
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
    if (msg.type.indexOf('hud:') !== 0) return;

    switch (msg.type) {
      case 'hud:ready':
        hudReady = true;
        updateStatus('ready', 'HUD Ready: ' + (msg.name || '?') + ' v' + (msg.version || '?'));
        addLog('hud-to-spa', msg.type, JSON.stringify(msg, null, 2), 'ok');
        break;
      case 'hud:action':
        var valid = ['open_settings', 'exit_game', 'resume_game', 'exit_menu'];
        var isValid = valid.indexOf(msg.action) !== -1;
        addLog(
          'hud-to-spa', msg.type,
          'action: ' + msg.action + (msg.payload ? '\npayload: ' + JSON.stringify(msg.payload) : ''),
          isValid ? 'ok' : 'error'
        );
        if (!isValid) {
          addLog('system', null, 'Invalid action "' + msg.action + '" — not in whitelist', 'error');
        }
        break;
      case 'hud:debug_log':
        addLog('hud-to-spa', 'debug', msg.message || '');
        return;
      default:
        addLog('hud-to-spa', msg.type, JSON.stringify(msg, null, 2));
    }
  });

  // ── Send Init ──

  btnSendInit.addEventListener('click', sendInit);

  function sendInit() {
    if (!hudLoaded) { addLog('system', null, 'Load a HUD first', 'warn'); return; }

    var mapNames = {
      '2': 'L_Traning', '4': 'L_Map2026', '5': 'L_MapRMUL2026',
      '6': 'L_MapRMUL2026_IF', '7': 'L_Map20261V1', '8': 'L_Map2026_IF',
    };
    var mapId = parseInt(selMap.value, 10);
    var msg = {
      type: 'hud:init',
      version: 1,
      mapId: mapId,
      mapName: mapNames[String(mapId)] || 'Unknown',
      playerId: parseInt(inpPlayer.value, 10) || 1,
      teamId: parseInt(selTeam.value, 10),
      gameMode: selMode.value,
    };

    postToHUD(msg);
    addLog('spa-to-hud', 'hud:init', JSON.stringify(msg, null, 2));

    if (chkBypass.checked) {
      hudReady = true;
      updateStatus('ready', 'HUD Ready (bypass)');
      sendAttributeUpdate();
    }
  }

  // ── Send Attribute Update ──

  btnSendData.addEventListener('click', sendAttributeUpdate);

  function sendAttributeUpdate() {
    if (!hudLoaded) {
      addLog('system', null, 'Cannot send: HUD not loaded yet', 'warn');
      return;
    }
    if (!hudReady && !chkBypass.checked) {
      addLog('system', null, 'Waiting for hud:ready (or enable Bypass)', 'warn');
      return;
    }

    var data = MockData.buildAttributeData();
    var msg = {
      type: 'hud:attribute_update',
      mapId: parseInt(selMap.value, 10),
      data: data,
    };

    postToHUD(msg);
    totalMsgCount++;
    statMsgCount.textContent = totalMsgCount;

    // Log a summary (not every frame for auto mode)
    if (!autoInterval || totalMsgCount % 30 === 1) {
      var bKeys = data.battle ? Object.keys(data.battle).length : 0;
      var gKeys = data.global ? Object.keys(data.global).length : 0;
      addLog('spa-to-hud', 'hud:attribute_update',
        'battle(' + bKeys + ' keys), global(' + gKeys + ' keys)\n' +
        'HP=' + (data.battle || {})['10000003'] + '/' + (data.battle || {})['60000004'] +
        ' Ammo17=' + (data.battle || {})['10000033'] +
        ' Team=' + (data.battle || {})['10000036'] +
        ' Time=' + (data.global || {})['80000002']
      );
    }
  }

  // ── Auto push ──

  btnAutoToggle.addEventListener('click', function () {
    if (autoInterval) {
      clearInterval(autoInterval);
      autoInterval = null;
      btnAutoToggle.textContent = 'Auto: OFF';
      btnAutoToggle.style.borderColor = '';
      addLog('system', null, 'Auto push stopped');
    } else {
      autoInterval = setInterval(function () {
        syncSlidersToState();
        sendAttributeUpdate();
      }, 100);
      btnAutoToggle.textContent = 'Auto: ON';
      btnAutoToggle.style.borderColor = 'var(--green)';
      addLog('system', null, 'Auto push started (100ms interval)');
    }
  });

  // ── Presets ──

  document.getElementById('preset-container').addEventListener('click', function (e) {
    var key = e.target.dataset.preset;
    if (key && MockData.presets[key]) {
      MockData.presets[key].apply();
      syncStateToSliders();
      if (autoInterval || chkBypass.checked) sendAttributeUpdate();
      addLog('system', null, 'Preset applied: ' + MockData.presets[key].label);
    }
  });

  // ── Sliders ──

  var sliderMap = [
    { id: 'sl-bullet-type', key: 'bulletType',   max: null },
    { id: 'sl-hp',          key: 'hp',           max: 'hpMax' },
    { id: 'sl-hp-max',      key: 'hpMax',        max: null },
    { id: 'sl-shield',      key: 'shield',       max: null },
    { id: 'sl-ammo17',      key: 'ammo17mm',     max: null },
    { id: 'sl-ammo42',      key: 'ammo42mm',     max: null },
    { id: 'sl-ammo-dart',   key: 'ammoDart',     max: null },
    { id: 'sl-ammo-laser',  key: 'ammoLaser',    max: null },
    { id: 'sl-heat',        key: 'firingHeat',   max: 'firingHeatMax' },
    { id: 'sl-level',       key: 'level',        max: null },
    { id: 'sl-team',        key: 'teamId',       max: null },
    { id: 'sl-time',        key: 'matchTimeCur', max: 'matchTimeMax' },
    { id: 'sl-base0',       key: 'baseHp0',      max: 'baseHpMax0' },
    { id: 'sl-base1',       key: 'baseHp1',      max: 'baseHpMax1' },
  ];

  sliderMap.forEach(function (s) {
    var el = document.getElementById(s.id);
    if (!el) return;
    var valEl = document.getElementById(s.id + '-val');

    el.addEventListener('input', function () {
      var v = parseFloat(el.value);
      MockData.state[s.key] = v;
      if (valEl) {
        if (s.key === 'matchTimeCur') {
          var sec = Math.floor(v / 1000);
          valEl.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
        } else if (s.key === 'teamId') {
          valEl.textContent = v === 0 ? 'RED' : v === 1 ? 'BLUE' : 'SPEC';
        } else if (s.key === 'bulletType') {
          valEl.textContent = ['42mm', '17mm', 'DART', 'LASER'][v] || '?';
        } else {
          valEl.textContent = v;
        }
      }
    });
  });

  function syncSlidersToState() {
    sliderMap.forEach(function (s) {
      var el = document.getElementById(s.id);
      if (el) MockData.state[s.key] = parseFloat(el.value);
    });
  }

  function syncStateToSliders() {
    sliderMap.forEach(function (s) {
      var el = document.getElementById(s.id);
      var valEl = document.getElementById(s.id + '-val');
      if (!el) return;
      el.value = MockData.state[s.key];
      if (valEl) {
        if (s.key === 'matchTimeCur') {
          var sec = Math.floor(MockData.state[s.key] / 1000);
          valEl.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
        } else if (s.key === 'teamId') {
          valEl.textContent = MockData.state[s.key] === 0 ? 'RED' : MockData.state[s.key] === 1 ? 'BLUE' : 'SPEC';
        } else if (s.key === 'bulletType') {
          valEl.textContent = ['42mm', '17mm', 'DART', 'LASER'][MockData.state[s.key]] || '?';
        } else {
          valEl.textContent = MockData.state[s.key];
        }
      }
    });
  }

  // ── Tag toggles ──

  var toggleMap = [
    { id: 'tg-defeated',    key: 'defeated' },
    { id: 'tg-overheated',  key: 'overheated' },
    { id: 'tg-invincible',  key: 'invincible' },
    { id: 'tg-reviving',    key: 'reviving' },
    { id: 'tg-lowpower',    key: 'lowPower' },
    { id: 'tg-outofcombat', key: 'outOfCombat' },
    { id: 'tg-weakened',    key: 'weakened' },
    { id: 'tg-boost',       key: 'isBoost' },
    { id: 'tg-charging',    key: 'isCharging' },
  ];

  toggleMap.forEach(function (t) {
    var el = document.getElementById(t.id);
    if (!el) return;
    el.addEventListener('change', function () {
      MockData.state[t.key] = el.checked ? 1 : 0;
    });
  });

  // ── Log ──

  function addLog(direction, type, detail, level) {
    var entry = document.createElement('div');
    entry.className = 'log-entry' + (level ? ' ' + level : '');

    var now = new Date();
    var timeStr = String(now.getHours()).padStart(2, '0') + ':' +
                  String(now.getMinutes()).padStart(2, '0') + ':' +
                  String(now.getSeconds()).padStart(2, '0') + '.' +
                  String(now.getMilliseconds()).padStart(3, '0');

    var dirLabel = '';
    var dirClass = '';
    if (direction === 'spa-to-hud') { dirLabel = 'SPA\u2192HUD'; dirClass = 'spa-to-hud'; }
    else if (direction === 'hud-to-spa') { dirLabel = 'HUD\u2192SPA'; dirClass = 'hud-to-spa'; }
    else { dirLabel = 'SYS'; dirClass = ''; }

    var summary = '<span class="log-time">' + timeStr + '</span>' +
                  '<span class="log-dir ' + dirClass + '">' + dirLabel + '</span> ' +
                  (type ? '<span class="log-type">' + type + '</span>' : '');

    entry.innerHTML = summary + '<div class="log-detail">' + escapeHtml(detail || '') + '</div>';

    entry.addEventListener('click', function () {
      entry.classList.toggle('expanded');
    });

    logBody.appendChild(entry);
    logBody.scrollTop = logBody.scrollHeight;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  btnClearLog.addEventListener('click', function () {
    logBody.innerHTML = '';
    totalMsgCount = 0;
    statMsgCount.textContent = '0';
  });

  // ── Status ──

  function updateStatus(state, text) {
    statusDot.className = 'status-dot ' + state;
    statusText.textContent = text;
  }

  // ── Helpers ──

  function postToHUD(msg) {
    if (hudIframe.contentWindow) {
      hudIframe.contentWindow.postMessage(msg, hudOrigin);
    }
  }

  // ── Init ──

  syncStateToSliders();
  updateStatus('disconnected', 'No HUD loaded');

  // Load from URL hash if present (e.g. #url=http://localhost:3000)
  if (location.hash.indexOf('#url=') === 0) {
    urlInput.value = decodeURIComponent(location.hash.substring(5));
    loadHUD();
  }
})();
