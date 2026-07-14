import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CdpClient, sleep } from './cdp-client.mjs';

const argv = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = argv.indexOf(flag);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const cdpPort = Number(value('--port', '8088'));
const mapId = Number(value('--map-id', '0'));
const expectedVersion = value('--expected-version', '');
const expectedName = value('--expected-name', 'Gestalt HUD SDK - Example');
const timeoutMs = Number(value('--timeout-ms', '180000'));
const stabilityMs = Number(value('--stability-ms', '15000'));
const outDir = path.resolve(value('--out', 'artifacts/steam-workshop-e2e'));

const report = {
  startedAt: new Date().toISOString(),
  mapId,
  expectedName,
  expectedVersion,
  target: null,
  parent: null,
  frame: null,
  initialDiagnostics: null,
  diagnostics: null,
  ui: null,
  exceptions: [],
  checks: [],
  passed: false,
};

function check(name, passed, detail = '') {
  report.checks.push({ name, passed: Boolean(passed), detail });
  const prefix = passed ? 'PASS' : 'FAIL';
  console.log(`[workshop-e2e] ${prefix} ${name}${detail ? ` — ${detail}` : ''}`);
  return Boolean(passed);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const client = new CdpClient();
  let workshopContextId = null;
  client.on('Runtime.exceptionThrown', (params) => {
    const exception = params?.exceptionDetails;
    report.exceptions.push({
      text: exception?.exception?.description ?? exception?.text ?? 'unknown',
      url: exception?.url ?? '',
      executionContextId: exception?.executionContextId ?? null,
      lineNumber: exception?.lineNumber,
      columnNumber: exception?.columnNumber,
    });
  });

  try {
    report.target = await client.connect({ port: cdpPort, timeoutMs });
    console.log(`[workshop-e2e] attached to ${report.target.url}`);

    const parentReady = await client.waitFor(
      `() => {
        try {
          const app = document.getElementById('app')?.__vue_app__;
          const store = app?.config?.globalProperties?.$pinia?._s?.get('game');
          const iframe = document.querySelector('iframe.workshop-hud-iframe');
          return store?.getPageState?.() === 3 && !!iframe;
        } catch { return false; }
      }`,
      { timeoutMs },
    );
    check('game reached pageState 3 with Workshop iframe', parentReady);

    report.parent = await client.evaluate(`() => {
      const app = document.getElementById('app')?.__vue_app__;
      const store = app?.config?.globalProperties?.$pinia?._s?.get('game');
      const iframe = document.querySelector('iframe.workshop-hud-iframe');
      if (!iframe) return { pageState: store?.getPageState?.() ?? null, iframe: null };
      const rect = iframe.getBoundingClientRect();
      const style = getComputedStyle(iframe);
      return {
        pageState: store?.getPageState?.() ?? null,
        iframe: {
          src: iframe.src,
          sandbox: iframe.getAttribute('sandbox') ?? '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
        },
      };
    }`);

    check('parent pageState is 3', report.parent?.pageState === 3);
    check(
      'Workshop iframe is visible',
      report.parent?.iframe?.width > 200 &&
        report.parent?.iframe?.height > 120 &&
        report.parent?.iframe?.display !== 'none' &&
        report.parent?.iframe?.visibility !== 'hidden' &&
        Number(report.parent?.iframe?.opacity ?? 1) !== 0,
      JSON.stringify(report.parent?.iframe ?? null),
    );
    check(
      'Workshop iframe uses the game sandbox contract',
      /allow-scripts/.test(report.parent?.iframe?.sandbox ?? '') &&
        /allow-same-origin/.test(report.parent?.iframe?.sandbox ?? ''),
      report.parent?.iframe?.sandbox ?? '',
    );

    let frame = null;
    const frameDeadline = Date.now() + timeoutMs;
    while (Date.now() < frameDeadline) {
      frame = await client.getWorkshopFrame();
      if (frame) break;
      await sleep(500);
    }
    report.frame = frame;
    check('Workshop frame is present in CDP frame tree', Boolean(frame), frame?.url ?? '');
    if (!frame) throw new Error('Workshop frame never appeared');

    const contextId = await client.getFrameContext(frame.id);
    workshopContextId = contextId;
    const hudReady = await client.waitFor(
      `() => {
        const d = globalThis.__GESTALT_HUD_DIAGNOSTICS__;
        return !!d && d.initReceived === true && d.readySent === true && d.updateCount > 0;
      }`,
      { contextId, timeoutMs },
    );
    check('HUD completed init → ready → attribute_update', hudReady);

    const readHudState = () => client.evaluate(
      `() => {
        const d = globalThis.__GESTALT_HUD_DIAGNOSTICS__ ?? null;
        const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
        return {
          diagnostics: d ? JSON.parse(JSON.stringify(d)) : null,
          title: document.title,
          bodyText: (document.body?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 500),
          resources,
          readyState: document.readyState,
          ui: ['#version-badge', '.crosshair', '#match-timer', '.player-badge', '.ammo-display']
            .map((selector) => {
              const element = document.querySelector(selector);
              if (!element) return { selector, present: false, visible: false };
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return {
                selector,
                present: true,
                visible: rect.width > 0 && rect.height > 0 &&
                  style.display !== 'none' && style.visibility !== 'hidden' &&
                  Number(style.opacity) !== 0,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              };
            }),
        };
      }`,
      { contextId },
    );
    report.initialDiagnostics = await readHudState();
    await sleep(stabilityMs);
    report.diagnostics = await readHudState();
    report.ui = report.diagnostics?.ui ?? null;

    const diagnostics = report.diagnostics?.diagnostics;
    const initial = report.initialDiagnostics?.diagnostics;
    check('HUD diagnostics are exposed', Boolean(diagnostics));
    check(
      'core HUD elements are present and visible',
      Array.isArray(report.ui) &&
        report.ui.length === 5 &&
        report.ui.every((element) => element.present && element.visible),
      JSON.stringify(report.ui),
    );
    check(
      'HUD name matches release',
      diagnostics?.name === expectedName,
      diagnostics?.name ?? '',
    );
    if (expectedVersion) {
      check(
        'HUD version matches release',
        diagnostics?.version === expectedVersion,
        diagnostics?.version ?? '',
      );
    }
    if (mapId > 0) {
      check(
        'HUD received the requested map id',
        Number(diagnostics?.lastMapId) === mapId,
        String(diagnostics?.lastMapId ?? ''),
      );
    }
    check(
      'attribute update counter advances',
      Number(diagnostics?.updateCount) > Number(initial?.updateCount ?? 0),
      `${initial?.updateCount ?? 0} → ${diagnostics?.updateCount ?? 0} over ${stabilityMs}ms`,
    );
    check(
      'global scope contains attributes',
      Number(diagnostics?.scopeCounts?.global) > 0,
      JSON.stringify(diagnostics?.scopeCounts ?? null),
    );
    check(
      'battle scope contains attributes',
      Number(diagnostics?.scopeCounts?.battle) > 0,
      JSON.stringify(diagnostics?.scopeCounts ?? null),
    );
    check(
      'core health signal is valid',
      typeof diagnostics?.keySignals?.health === 'number' &&
        typeof diagnostics?.keySignals?.healthMax === 'number' &&
        diagnostics.keySignals.healthMax > 0,
      JSON.stringify(diagnostics?.keySignals ?? null),
    );
    const bulletType = diagnostics?.keySignals?.bulletType;
    const ammoByBulletType = {
      0: diagnostics?.keySignals?.ammo42,
      1: diagnostics?.keySignals?.ammo17,
      2: diagnostics?.keySignals?.ammoDart,
      3: diagnostics?.keySignals?.ammoLaser,
    };
    check(
      'active bullet type and its ammo signal are present',
      Number.isInteger(bulletType) &&
        bulletType >= 0 && bulletType <= 3 &&
        typeof ammoByBulletType[bulletType] === 'number',
      JSON.stringify(diagnostics?.keySignals ?? null),
    );
    check(
      'game-time and match-status signals are valid',
      typeof diagnostics?.keySignals?.gameTime === 'number' &&
        typeof diagnostics?.keySignals?.matchStatus === 'number',
      JSON.stringify(diagnostics?.keySignals ?? null),
    );
    check(
      'HUD reported no internal errors',
      Array.isArray(diagnostics?.errors) && diagnostics.errors.length === 0,
      JSON.stringify(diagnostics?.errors ?? null),
    );
    const workshopExceptions = report.exceptions.filter(
      (exception) =>
        exception.executionContextId === workshopContextId ||
        /(?:workshop-hud|3698375578|publish-test)/i.test(exception.url),
    );
    check(
      'CEF reported no uncaught exceptions',
      workshopExceptions.length === 0,
      workshopExceptions.map((item) => item.text).join(' | '),
    );

    await client.screenshot(path.join(outDir, `map-${mapId}-hud.png`));
    report.passed = report.checks.every((item) => item.passed);
  } finally {
    client.close();
  }
}

let fatal = false;
try {
  await main();
} catch (error) {
  fatal = true;
  console.error(`[workshop-e2e] fatal: ${error.stack ?? error}`);
  report.checks.push({
    name: 'fatal error',
    passed: false,
    detail: String(error),
  });
  report.passed = false;
}

report.finishedAt = new Date().toISOString();
await mkdir(outDir, { recursive: true });
await writeFile(
  path.join(outDir, `map-${mapId}-report.json`),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
process.exitCode = fatal ? 2 : report.passed ? 0 : 1;
