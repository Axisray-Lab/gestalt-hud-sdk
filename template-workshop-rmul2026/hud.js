/**
 * RMUL2026 3v3 Workshop HUD — pure HTML/CSS/JS (UMD SDK).
 *
 * Globals from gestalt-hud-sdk.workshop.umd.js:
 *   GestaltHUD.GestaltHUDBridge
 *   GestaltHUD.ERobotBridgeDemoAttributeId
 */

(function () {
  'use strict';

  var bridge = new GestaltHUD.GestaltHUDBridge();
  var Attr = GestaltHUD.ERobotBridgeDemoAttributeId;

  var manifest = { name: 'RMUL2026 Competition HUD', version: '1.0.0' };

  fetch('./manifest.json')
    .then(function (r) {
      return r.json();
    })
    .then(function (m) {
      manifest = m;
      var el = document.getElementById('version-badge');
      if (el) {
        el.textContent = 'Workshop: ' + m.name + ' v' + m.version;
      }
    })
    .catch(function () {
      console.warn('[RMUL2026 HUD] Could not load manifest.json');
    });

  var teamId = -1;
  var playerId = -1;

  var elTimer = document.getElementById('match-timer');
  var elMatchStatus = document.getElementById('match-status');
  var elScoreRed = document.getElementById('score-red');
  var elScoreBlue = document.getElementById('score-blue');
  var elTeamTag = document.getElementById('team-tag');
  var elClassName = document.getElementById('class-name');
  var elLevel = document.getElementById('level');
  var elHealthFill = document.getElementById('health-bar-fill');
  var elHealthText = document.getElementById('health-text');
  var elBufferFill = document.getElementById('buffer-bar-fill');
  var elHeatFill = document.getElementById('heat-bar-fill');
  var elAmmo = document.getElementById('ammo-count');
  var elRedBase = document.getElementById('red-base-hp');
  var elBlueBase = document.getElementById('blue-base-hp');
  var elOutRedOwner = document.getElementById('outpost-red-owner');
  var elOutBlueOwner = document.getElementById('outpost-blue-owner');
  var elTeammateList = document.getElementById('teammate-list');
  var elOvDef = document.getElementById('overlay-defeated');
  var elOvHot = document.getElementById('overlay-overheated');
  var elOvBlock = document.getElementById('overlay-blocked');

  bridge.onInit(function (msg) {
    teamId = msg.teamId;
    playerId = msg.playerId;
    updateTeamTag();
    bridge.sendReady(manifest.name, manifest.version);
  });

  bridge.onAttributeUpdate(function (data) {
    var battle = data.battle || {};
    var global = data.global || {};
    var base = data.base || {};
    var playerBattle = data.playerBattle || {};

    updateMatchTimer(global);
    updateMatchStatus(global);
    updateTeamScores(playerBattle, battle);
    updatePlayerPanel(battle);
    updateBaseStatus(base);
    updateOutposts(global);
    renderTeammates(playerBattle);
    updateTagOverlays(battle);
  });

  function num(v) {
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  function hasAttr(b, id) {
    var v = b[id];
    return typeof v === 'number' && isFinite(v);
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatMs(ms) {
    var t = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(t / 60);
    var s = t % 60;
    return pad2(m) + ':' + pad2(s);
  }

  function careerName(classId) {
    switch (classId) {
      case 1001:
        return 'Hero';
      case 1002:
        return 'Engineer';
      case 1003:
        return 'Infantry';
      case 1004:
        return 'Sentry';
      case 1005:
        return 'Aerial';
      case 1008:
        return 'BalanceInfantry';
      default:
        return '—';
    }
  }

  function healthColor(pct) {
    if (pct > 60) return '#2ecc71';
    if (pct > 30) return '#f39c12';
    return '#e74c3c';
  }

  function heatFillStyle(t) {
    t = Math.min(1, Math.max(0, t));
    var r = Math.round(243 + (231 - 243) * t);
    var g = Math.round(156 + (76 - 156) * t);
    var b = Math.round(18 + (60 - 18) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function updateTeamTag() {
    var label;
    var color;
    switch (teamId) {
      case 0:
        label = 'RED';
        color = '#e74c3c';
        break;
      case 1:
        label = 'BLUE';
        color = '#3498db';
        break;
      default:
        label = 'SPEC';
        color = '#95a5a6';
        break;
    }
    elTeamTag.textContent = label;
    elTeamTag.style.color = color;
  }

  function updateMatchTimer(global) {
    var maxTime = num(global[Attr.G_MaxGameTime]);
    var curTime = num(global[Attr.G_CurGameTime]);
    if (maxTime > 0) {
      var remaining = Math.max(0, maxTime - curTime);
      elTimer.textContent = formatMs(remaining);
    }
  }

  function updateMatchStatus(global) {
    var st = num(global[Attr.G_CurMatchStatus]);
    var cd = num(global[Attr.G_GameStartCountDown]);
    var label;
    if (st === 0) label = 'PREPARING';
    else if (st === 1) label = 'IN PROGRESS';
    else if (st === 2) label = 'FINISHED';
    else label = '—';

    if (st === 0 && cd > 0) {
      elMatchStatus.textContent = label + ' · ' + formatMs(cd);
    } else {
      elMatchStatus.textContent = label;
    }
  }

  function pickTeamCoins(playerBattle, team) {
    var k;
    var pb;
    var tid;
    for (k in playerBattle) {
      if (!Object.prototype.hasOwnProperty.call(playerBattle, k)) continue;
      pb = playerBattle[k];
      tid = num(pb[Attr.TeamID]);
      if (tid === team) {
        return num(pb[Attr.TM_Coins]);
      }
    }
    return 0;
  }

  function updateTeamScores(playerBattle, battle) {
    var red = pickTeamCoins(playerBattle, 0);
    var blue = pickTeamCoins(playerBattle, 1);
    if (red === 0 && blue === 0) {
      var c = num(battle[Attr.TM_Coins]);
      if (c > 0) {
        if (teamId === 0) red = c;
        else if (teamId === 1) blue = c;
      }
    }
    elScoreRed.textContent = String(red);
    elScoreBlue.textContent = String(blue);
  }

  function updatePlayerPanel(battle) {
    var hp = num(battle[Attr.Health]);
    var hpMax = num(battle[Attr.HealthMax]);
    if (hpMax > 0) {
      var pct = Math.min(100, (hp / hpMax) * 100);
      elHealthFill.style.width = pct + '%';
      elHealthFill.style.backgroundColor = healthColor(pct);
      elHealthText.textContent = hp + ' / ' + hpMax;
    } else {
      elHealthFill.style.width = '0%';
      elHealthText.textContent = '—';
    }

    var buf = num(battle[Attr.BufferEnergy]);
    var bufMax = num(battle[Attr.BufferEnergyMax]);
    if (bufMax > 0) {
      elBufferFill.style.width = Math.min(100, (buf / bufMax) * 100) + '%';
    } else {
      elBufferFill.style.width = '0%';
    }

    var heat = num(battle[Attr.FiringHeat1]);
    var heatMax = num(battle[Attr.FiringHeatMax1]);
    var heatT = heatMax > 0 ? heat / heatMax : 0;
    elHeatFill.style.width = Math.min(100, heatT * 100) + '%';
    elHeatFill.style.background = heatFillStyle(heatT);

    var lv = num(battle[Attr.Level]);
    elLevel.textContent = lv > 0 ? 'Lv.' + lv : 'Lv.0';

    var cls = num(battle[Attr.Class]);
    elClassName.textContent = careerName(cls);

    var newTeam = battle[Attr.TeamID];
    if (newTeam !== undefined && newTeam !== teamId) {
      teamId = newTeam;
      updateTeamTag();
    }

    var bulletType = num(battle[Attr.BulletType]);
    var ammo =
      bulletType === 0
        ? num(battle[Attr.Ammo42mmCount])
        : num(battle[Attr.Ammo17mmCount]);
    elAmmo.textContent = String(ammo);
  }

  function resolveBases(baseData) {
    var keys = Object.keys(baseData || {});
    var red = { hp: 0, max: 0 };
    var blue = { hp: 0, max: 0 };
    var gotRed = false;
    var gotBlue = false;
    var i;
    var k;
    var b;
    var team;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      b = baseData[k] || {};
      if (hasAttr(b, Attr.TB_BelongTeamID)) {
        team = num(b[Attr.TB_BelongTeamID]);
      } else if (hasAttr(b, Attr.TeamID)) {
        team = num(b[Attr.TeamID]);
      } else {
        team = -99;
      }
      if (team === 0) {
        red.hp = num(b[Attr.Health]);
        red.max = num(b[Attr.HealthMax]);
        gotRed = true;
      } else if (team === 1) {
        blue.hp = num(b[Attr.Health]);
        blue.max = num(b[Attr.HealthMax]);
        gotBlue = true;
      }
    }
    if (!gotRed || !gotBlue) {
      keys.sort(function (a, b2) {
        return parseInt(a, 10) - parseInt(b2, 10);
      });
      if (keys.length >= 2) {
        if (!gotRed) {
          b = baseData[keys[0]] || {};
          red.hp = num(b[Attr.Health]);
          red.max = num(b[Attr.HealthMax]);
        }
        if (!gotBlue) {
          b = baseData[keys[1]] || {};
          blue.hp = num(b[Attr.Health]);
          blue.max = num(b[Attr.HealthMax]);
        }
      } else if (keys.length === 1) {
        b = baseData[keys[0]] || {};
        if (!gotRed) {
          red.hp = num(b[Attr.Health]);
          red.max = num(b[Attr.HealthMax]);
        }
      }
    }
    return { red: red, blue: blue };
  }

  function updateBaseStatus(baseData) {
    var R = resolveBases(baseData);
    if (R.red.max > 0) {
      elRedBase.style.width = Math.min(100, (R.red.hp / R.red.max) * 100) + '%';
    } else {
      elRedBase.style.width = '0%';
    }
    if (R.blue.max > 0) {
      elBlueBase.style.width =
        Math.min(100, (R.blue.hp / R.blue.max) * 100) + '%';
    } else {
      elBlueBase.style.width = '0%';
    }
  }

  function teamShortName(tid) {
    if (tid === -1) return 'NEUTRAL';
    if (tid === 0) return 'RED';
    if (tid === 1) return 'BLUE';
    return '—';
  }

  function updateOutposts(global) {
    elOutRedOwner.textContent = teamShortName(
      num(global[Attr.G_RedOutpostZone_TeamID]),
    );
    elOutBlueOwner.textContent = teamShortName(
      num(global[Attr.G_BlueOutpostZone_TeamID]),
    );
  }

  function setOverlay(el, on) {
    if (!el) return;
    if (on) el.classList.remove('hidden');
    else el.classList.add('hidden');
  }

  function updateTagOverlays(battle) {
    setOverlay(elOvDef, num(battle[Attr.Defeated]) === 1);
    setOverlay(elOvHot, num(battle[Attr.Overheated]) === 1);
    setOverlay(elOvBlock, num(battle[Attr.Blocked]) === 1);
  }

  function renderTeammates(playerBattle) {
    var arr = [];
    var k;
    var pb;
    var pid;
    var tid;
    for (k in playerBattle) {
      if (!Object.prototype.hasOwnProperty.call(playerBattle, k)) continue;
      pid = parseInt(k, 10);
      if (isNaN(pid)) continue;
      pb = playerBattle[k];
      tid = num(pb[Attr.TeamID]);
      if (tid !== teamId) continue;
      if (pid === playerId) continue;
      arr.push({
        pid: pid,
        teamNum: num(pb[Attr.TeamNumber]),
        lv: num(pb[Attr.Level]),
        hp: num(pb[Attr.Health]),
        hpMax: num(pb[Attr.HealthMax]),
      });
    }
    arr.sort(function (a, b) {
      return a.teamNum - b.teamNum;
    });
    if (arr.length > 4) {
      arr = arr.slice(0, 4);
    }

    elTeammateList.innerHTML = '';
    var i;
    var row;
    var head;
    var numEl;
    var lvEl;
    var track;
    var fill;
    var pct;
    var hcol;
    for (i = 0; i < arr.length; i++) {
      row = document.createElement('div');
      row.className = 'teammate-card glass-panel';
      head = document.createElement('div');
      head.className = 'teammate-card-header';
      numEl = document.createElement('span');
      numEl.className = 'teammate-num';
      numEl.textContent = '#' + (arr[i].teamNum || arr[i].pid);
      lvEl = document.createElement('span');
      lvEl.className = 'teammate-lv';
      lvEl.textContent =
        arr[i].lv > 0 ? 'Lv.' + arr[i].lv : '';
      head.appendChild(numEl);
      head.appendChild(lvEl);
      track = document.createElement('div');
      track.className = 'teammate-hp-track';
      fill = document.createElement('div');
      fill.className = 'teammate-hp-fill';
      pct = arr[i].hpMax > 0 ? (arr[i].hp / arr[i].hpMax) * 100 : 0;
      fill.style.width = Math.min(100, pct) + '%';
      hcol = healthColor(pct);
      fill.style.backgroundColor = hcol;
      track.appendChild(fill);
      row.appendChild(head);
      row.appendChild(track);
      elTeammateList.appendChild(row);
    }
  }
})();
