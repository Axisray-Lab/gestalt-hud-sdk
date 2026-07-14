#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  basename,
  dirname,
  join,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIR, '..');
const TEMP_PREFIX = 'gestalt-hud-sdk-consumer-';
const temporaryRoot = mkdtempSync(join(tmpdir(), TEMP_PREFIX));

try {
  const packOutput = runNpm(
    ['pack', '--json', '--ignore-scripts', '--pack-destination', temporaryRoot],
    REPOSITORY_ROOT,
  );
  const packResult = JSON.parse(packOutput);
  assert.equal(Array.isArray(packResult), true, 'npm pack must return a JSON array');
  assert.equal(packResult.length, 1, 'npm pack must create exactly one tarball');

  const tarballPath = join(temporaryRoot, packResult[0].filename);
  assert.equal(existsSync(tarballPath), true, `Missing npm tarball: ${tarballPath}`);

  writeFileSync(
    join(temporaryRoot, 'package.json'),
    `${JSON.stringify({ private: true }, null, 2)}\n`,
    'utf8',
  );
  runNpm(
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      tarballPath,
    ],
    temporaryRoot,
  );

  writeFileSync(
    join(temporaryRoot, 'consumer.ts'),
    `import {
  AttributeStore,
  ERobotBridgeDemoAttributeId,
  HUDBridge,
  TrustedWebSocketMethod,
} from '@axisray-lab/gestalt-hud-sdk';
import {
  ERobotBridgeDemoBulletType,
  CAPABILITY_BIT_HUD,
  MAP_ID_TO_NAME,
  WORKSHOP_MANIFEST_SCHEMA_VERSION,
  checkRequiredMods,
  isHUDInitMessage,
  validateManifest,
  type FBSProtocolReference,
  type WorkshopModManifest,
} from '@axisray-lab/gestalt-hud-sdk/protocol';
import {
  ERobotBridgeDemoMapType,
  GestaltHUDBridge,
  type HUDDebugLogMessage,
} from '@axisray-lab/gestalt-hud-sdk/workshop';

const manifest: WorkshopModManifest = {
  sdk_version: WORKSHOP_MANIFEST_SCHEMA_VERSION,
  name: 'Packed SDK consumer',
  version: '1.0.0',
  author: 'SDK CI',
  description: 'Strict compile-only package fixture',
  provides: ['hud'],
};

validateManifest(manifest);
checkRequiredMods(2, [], 2, []);
isHUDInitMessage({});
void CAPABILITY_BIT_HUD;
void MAP_ID_TO_NAME;
void AttributeStore;
void HUDBridge;
void TrustedWebSocketMethod;
void ERobotBridgeDemoAttributeId;
void ERobotBridgeDemoBulletType;
void ERobotBridgeDemoMapType;
void GestaltHUDBridge;
void (null as FBSProtocolReference | HUDDebugLogMessage | null);
`,
    'utf8',
  );
  writeFileSync(
    join(temporaryRoot, 'tsconfig.json'),
    `${JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        lib: ['ES2020', 'DOM'],
        strict: true,
        skipLibCheck: false,
        noEmit: true,
      },
      include: ['consumer.ts'],
    }, null, 2)}\n`,
    'utf8',
  );

  const requireFromRepository = createRequire(join(REPOSITORY_ROOT, 'package.json'));
  const tscPath = requireFromRepository.resolve('typescript/bin/tsc');
  run(process.execPath, [tscPath, '--project', join(temporaryRoot, 'tsconfig.json')], {
    cwd: temporaryRoot,
    label: 'strict TypeScript consumer',
  });

  writeFileSync(
    join(temporaryRoot, 'runtime-check.mjs'),
    `import assert from 'node:assert/strict';
import * as root from '@axisray-lab/gestalt-hud-sdk';
import * as protocol from '@axisray-lab/gestalt-hud-sdk/protocol';
import * as workshop from '@axisray-lab/gestalt-hud-sdk/workshop';

assert.equal(typeof root.AttributeStore, 'function');
assert.equal(typeof root.HUDBridge, 'function');
assert.equal(typeof protocol.validateManifest, 'function');
assert.equal(protocol.WORKSHOP_MANIFEST_SCHEMA_VERSION, 2);
assert.equal(typeof workshop.GestaltHUDBridge, 'function');
`,
    'utf8',
  );
  writeFileSync(
    join(temporaryRoot, 'runtime-check.cjs'),
    `const assert = require('node:assert/strict');
const root = require('@axisray-lab/gestalt-hud-sdk');
const protocol = require('@axisray-lab/gestalt-hud-sdk/protocol');
const workshop = require('@axisray-lab/gestalt-hud-sdk/workshop');
const protocolReference = require(
  '@axisray-lab/gestalt-hud-sdk/protocol-reference.json',
);

assert.equal(typeof root.AttributeStore, 'function');
assert.equal(typeof root.HUDBridge, 'function');
assert.equal(typeof protocol.validateManifest, 'function');
assert.equal(protocol.WORKSHOP_MANIFEST_SCHEMA_VERSION, 2);
assert.equal(typeof workshop.GestaltHUDBridge, 'function');
assert.equal(protocolReference.enumCount > 0, true);
assert.match(
  require.resolve(
    '@axisray-lab/gestalt-hud-sdk/schemas/fbs/RobotBridgeDemoAttributeDefines.fbs',
  ),
  /RobotBridgeDemoAttributeDefines\\.fbs$/,
);
`,
    'utf8',
  );
  run(process.execPath, [join(temporaryRoot, 'runtime-check.mjs')], {
    cwd: temporaryRoot,
    label: 'ES module consumer',
  });
  run(process.execPath, [join(temporaryRoot, 'runtime-check.cjs')], {
    cwd: temporaryRoot,
    label: 'CommonJS consumer',
  });

  const installedPackageRoot = join(
    temporaryRoot,
    'node_modules',
    '@axisray-lab',
    'gestalt-hud-sdk',
  );
  verifyPublicProtocolFiles(installedPackageRoot);

  console.log(
    `[package-consumer] Verified ${packResult[0].filename}: strict types, ` +
      'ESM/CJS entry points, protocol JSON, and public FBS sources.',
  );
} finally {
  removeTemporaryRoot(temporaryRoot);
}

function verifyPublicProtocolFiles(packageRoot) {
  const sourceMetadataPath = join(packageRoot, 'schemas', 'source.json');
  const protocolReferencePath = join(
    packageRoot,
    'protocol',
    'protocol-reference.json',
  );
  assert.equal(
    existsSync(sourceMetadataPath),
    true,
    'Packed SDK is missing schemas/source.json',
  );
  assert.equal(
    existsSync(protocolReferencePath),
    true,
    'Packed SDK is missing protocol/protocol-reference.json',
  );

  const sourceMetadata = JSON.parse(readFileSync(sourceMetadataPath, 'utf8'));
  const protocolReference = JSON.parse(readFileSync(protocolReferencePath, 'utf8'));
  assert.equal(Array.isArray(sourceMetadata.files), true);
  assert.ok(sourceMetadata.files.length > 0, 'No public FBS sources are declared');
  assert.equal(protocolReference.enumCount > 0, true, 'Protocol reference has no enums');
  assert.equal(
    protocolReference.generatedFrom?.source?.commit,
    sourceMetadata.source?.commit,
    'Protocol reference and source metadata use different upstream commits',
  );

  for (const file of sourceMetadata.files) {
    assert.equal(file.name, basename(file.name), `Unsafe FBS filename: ${file.name}`);
    const schemaPath = join(packageRoot, 'schemas', 'fbs', file.name);
    assert.equal(existsSync(schemaPath), true, `Packed SDK is missing ${file.name}`);
    const source = readFileSync(schemaPath);
    const actualHash = createHash('sha256').update(source).digest('hex');
    assert.equal(
      actualHash,
      file.vendoredSha256,
      `Packed FBS hash mismatch: ${file.name}`,
    );
  }
}

function runNpm(args, cwd) {
  const npmCli = findNpmCli();
  if (npmCli) {
    return run(process.execPath, [npmCli, ...args], { cwd, label: `npm ${args[0]}` });
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return run(npmCommand, args, { cwd, label: `npm ${args[0]}` });
}

function findNpmCli() {
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    resolve(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

function run(command, args, { cwd, label }) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status}.\n` +
        `${result.stdout ?? ''}${result.stderr ?? ''}`,
    );
  }
  return (result.stdout ?? '').trim();
}

function removeTemporaryRoot(path) {
  const resolvedPath = resolve(path);
  const resolvedTempDirectory = resolve(tmpdir());
  assert.equal(
    dirname(resolvedPath),
    resolvedTempDirectory,
    `Refusing to clean a directory outside the system temp root: ${resolvedPath}`,
  );
  assert.equal(
    basename(resolvedPath).startsWith(TEMP_PREFIX),
    true,
    `Refusing to clean an unexpected temp directory: ${resolvedPath}`,
  );
  rmSync(resolvedPath, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
}
