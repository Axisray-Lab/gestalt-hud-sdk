#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIR, '..');
const SCHEMA_DIR = resolve(REPOSITORY_ROOT, 'schemas/fbs');
const SOURCE_METADATA_PATH = resolve(REPOSITORY_ROOT, 'schemas/source.json');

const OUTPUTS = {
  enums: resolve(REPOSITORY_ROOT, 'src/protocol/generated/fbs-enums.ts'),
  types: resolve(REPOSITORY_ROOT, 'src/protocol/generated/fbs-types.ts'),
  json: resolve(REPOSITORY_ROOT, 'protocol/protocol-reference.json'),
  markdown: resolve(REPOSITORY_ROOT, 'docs/generated/fbs-reference.md'),
};

const args = new Set(process.argv.slice(2));
const verify = args.delete('--verify') || args.delete('--check');
if (args.has('--help')) {
  console.log('Usage: node scripts/generate-fbs-protocol.mjs [--verify|--check]');
  process.exit(0);
}
if (args.size > 0) {
  fail(`Unknown argument(s): ${[...args].join(', ')}`);
}

const sourceMetadata = readJson(SOURCE_METADATA_PATH);
validateSourceMetadata(sourceMetadata);
validateSchemaDirectory(sourceMetadata);

const schemas = sourceMetadata.files.map((fileMetadata) => {
  const path = resolve(SCHEMA_DIR, fileMetadata.name);
  const source = readFileSync(path, 'utf8');
  validatePublicCommentEncoding(fileMetadata.name, source);
  const actualSha256 = sha256(source);
  if (actualSha256 !== fileMetadata.vendoredSha256) {
    fail(
      `Vendored SHA-256 mismatch for ${fileMetadata.name}: expected ` +
      `${fileMetadata.vendoredSha256}, received ${actualSha256}`,
    );
  }
  return parseSchema(fileMetadata.name, source);
});

const enums = schemas.flatMap((schema) => schema.enums);
const enumNames = new Set();
for (const enumDefinition of enums) {
  if (enumNames.has(enumDefinition.name)) {
    fail(`Duplicate public enum name: ${enumDefinition.name}`);
  }
  enumNames.add(enumDefinition.name);
}

const protocolReference = {
  schemaVersion: 1,
  generatedFrom: sourceMetadata,
  namespaces: [...new Set(schemas.map((schema) => schema.namespace))],
  enumCount: enums.length,
  valueCount: enums.reduce((total, enumDefinition) => total + enumDefinition.values.length, 0),
  enums,
};

const generated = new Map([
  [OUTPUTS.enums, generateEnums(enums, sourceMetadata)],
  [OUTPUTS.types, generateTypes(sourceMetadata)],
  [OUTPUTS.json, `${JSON.stringify(protocolReference, null, 2)}\n`],
  [OUTPUTS.markdown, generateMarkdown(protocolReference)],
]);

if (verify) {
  const stale = [];
  for (const [path, expected] of generated) {
    let actual;
    try {
      actual = readFileSync(path, 'utf8');
    } catch {
      stale.push(relativePath(path));
      continue;
    }
    if (actual !== expected) {
      stale.push(relativePath(path));
    }
  }
  if (stale.length > 0) {
    fail(
      'Generated FBS protocol outputs are missing or stale:\n' +
      stale.map((path) => `  - ${path}`).join('\n') +
      '\nRun: node scripts/generate-fbs-protocol.mjs',
    );
  }
  console.log(
    `Verified ${protocolReference.enumCount} enums / ` +
    `${protocolReference.valueCount} values from ${schemas.length} FBS files.`,
  );
} else {
  for (const [path, content] of generated) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
    console.log(`Wrote ${relativePath(path)}`);
  }
  console.log(
    `Generated ${protocolReference.enumCount} enums / ` +
    `${protocolReference.valueCount} values from ${schemas.length} FBS files.`,
  );
}

function parseSchema(sourceFile, source) {
  const namespaceMatch = source.match(/\bnamespace\s+([A-Za-z_][A-Za-z0-9_.]*)\s*;/);
  if (!namespaceMatch) {
    fail(`Missing namespace in ${sourceFile}`);
  }

  const enums = [];
  const enumPattern = /\benum\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
  let match;
  while ((match = enumPattern.exec(source)) !== null) {
    const bodyStart = enumPattern.lastIndex;
    const bodyClosePattern = /^[ \t]*}/gm;
    bodyClosePattern.lastIndex = bodyStart;
    const bodyCloseMatch = bodyClosePattern.exec(source);
    const bodyEnd = bodyCloseMatch?.index ?? -1;
    if (bodyEnd === -1) {
      fail(`Unterminated enum ${match[1]} in ${sourceFile}`);
    }

    const enumStartLine = lineNumberAt(source, match.index);
    const preceding = source.slice(0, match.index);
    const enumDescription = readPrecedingComment(preceding);
    const body = source.slice(bodyStart, bodyEnd);
    const values = parseEnumValues(sourceFile, match[1], body, lineNumberAt(source, bodyStart));

    enums.push({
      name: match[1],
      namespace: namespaceMatch[1],
      underlyingType: match[2],
      sourceFile,
      sourceLine: enumStartLine,
      ...(enumDescription ? { description: enumDescription } : {}),
      values,
    });
    enumPattern.lastIndex = bodyEnd + 1;
  }

  if (enums.length === 0) {
    fail(`No enums found in ${sourceFile}`);
  }

  return {
    sourceFile,
    namespace: namespaceMatch[1],
    enums,
  };
}

function parseEnumValues(sourceFile, enumName, body, bodyStartLine) {
  const values = [];
  const pendingComments = [];
  let previousValue = -1;
  let inBlockComment = false;

  for (const [lineOffset, originalLine] of body.split('\n').entries()) {
    let line = originalLine.trim();
    if (!line) {
      if (!inBlockComment) pendingComments.length = 0;
      continue;
    }

    if (inBlockComment) {
      const end = line.indexOf('*/');
      const commentPart = end === -1 ? line : line.slice(0, end);
      appendComment(pendingComments, commentPart);
      if (end === -1) continue;
      inBlockComment = false;
      line = line.slice(end + 2).trim();
      if (!line) continue;
    }

    while (line.startsWith('/*')) {
      const end = line.indexOf('*/', 2);
      if (end === -1) {
        appendComment(pendingComments, line.slice(2));
        inBlockComment = true;
        line = '';
        break;
      }
      appendComment(pendingComments, line.slice(2, end));
      line = line.slice(end + 2).trim();
    }
    if (!line) continue;

    if (line.startsWith('//')) {
      appendComment(pendingComments, line.slice(2));
      continue;
    }

    const inlineCommentIndex = line.indexOf('//');
    let inlineComment = '';
    if (inlineCommentIndex !== -1) {
      inlineComment = line.slice(inlineCommentIndex + 2);
      line = line.slice(0, inlineCommentIndex).trim();
    }

    const valueMatch = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)(?:\s*=\s*([^,]+?))?\s*,?\s*$/,
    );
    if (!valueMatch) {
      fail(
        `Unsupported enum statement in ${sourceFile}:${bodyStartLine + lineOffset}: ` +
        originalLine.trim(),
      );
    }

    const literal = valueMatch[2]?.trim();
    const value = literal === undefined
      ? previousValue + 1
      : parseIntegerLiteral(literal, sourceFile, bodyStartLine + lineOffset);
    previousValue = value;

    if (inlineComment) appendComment(pendingComments, inlineComment);
    const description = normalizeDescription(pendingComments.join(' '));
    values.push({
      name: valueMatch[1],
      value,
      literal: literal ?? null,
      implicit: literal === undefined,
      sourceLine: bodyStartLine + lineOffset,
      ...(description ? { description } : {}),
    });
    pendingComments.length = 0;
  }

  if (inBlockComment) {
    fail(`Unterminated block comment in enum ${enumName} (${sourceFile})`);
  }
  if (values.length === 0) {
    fail(`Enum ${enumName} in ${sourceFile} has no values`);
  }
  return values;
}

function parseIntegerLiteral(literal, sourceFile, sourceLine) {
  const normalized = literal.replaceAll('_', '');
  if (!/^[+-]?(?:0[xX][0-9a-fA-F]+|[0-9]+)$/.test(normalized)) {
    fail(`Unsupported enum value at ${sourceFile}:${sourceLine}: ${literal}`);
  }
  const sign = normalized.startsWith('-') ? -1 : 1;
  const unsigned = normalized.replace(/^[+-]/, '');
  const value = unsigned.toLowerCase().startsWith('0x')
    ? sign * Number.parseInt(unsigned.slice(2), 16)
    : sign * Number.parseInt(unsigned, 10);
  if (!Number.isSafeInteger(value)) {
    fail(`Enum value is not a safe JavaScript integer at ${sourceFile}:${sourceLine}`);
  }
  return value;
}

function generateEnums(enums, sourceMetadata) {
  const lines = [
    '/* eslint-disable */',
    '/**',
    ' * AUTO-GENERATED from the public FBS snapshot in schemas/fbs.',
    ' * Do not edit by hand. Run scripts/generate-fbs-protocol.mjs.',
    ` * Upstream gestalt_system commit: ${sourceMetadata.source.commit}`,
    ' */',
    '',
  ];

  for (const enumDefinition of enums) {
    if (enumDefinition.description) {
      lines.push('/**');
      for (const line of wrapComment(enumDefinition.description)) {
        lines.push(` * ${escapeJSDoc(line)}`);
      }
      lines.push(` * @source ${enumDefinition.sourceFile}:${enumDefinition.sourceLine}`);
      lines.push(' */');
    } else {
      lines.push(
        `/** @source ${enumDefinition.sourceFile}:${enumDefinition.sourceLine} */`,
      );
    }
    lines.push(`export enum ${enumDefinition.name} {`);
    for (const value of enumDefinition.values) {
      if (value.description) {
        lines.push(`  /** ${escapeJSDoc(value.description)} */`);
      }
      lines.push(`  ${value.name} = ${value.value},`);
    }
    lines.push('}', '');
  }

  if (lines.at(-1) === '') lines.pop();
  return `${lines.join('\n')}\n`;
}

function generateTypes(sourceMetadata) {
  const metadata = JSON.stringify(sourceMetadata, null, 2)
    .split('\n')
    .map((line, index) => (index === 0 ? line : `  ${line}`))
    .join('\n');

  return `/**
 * AUTO-GENERATED public FBS protocol metadata types.
 * Do not edit by hand. Run scripts/generate-fbs-protocol.mjs.
 */

export type FBSScalarType =
  | 'bool'
  | 'byte'
  | 'ubyte'
  | 'short'
  | 'ushort'
  | 'int'
  | 'uint'
  | 'long'
  | 'ulong'
  | 'float'
  | 'double'
  | 'string';

export interface FBSProtocolEnumValue {
  name: string;
  value: number;
  literal: string | null;
  implicit: boolean;
  sourceLine: number;
  description?: string;
}

export interface FBSProtocolEnum {
  name: string;
  namespace: string;
  underlyingType: FBSScalarType;
  sourceFile: string;
  sourceLine: number;
  description?: string;
  values: FBSProtocolEnumValue[];
}

export interface FBSProtocolReference {
  schemaVersion: 1;
  generatedFrom: typeof FBS_PROTOCOL_SOURCE;
  namespaces: string[];
  enumCount: number;
  valueCount: number;
  enums: FBSProtocolEnum[];
}

/** Source revision and integrity hashes for the public vendored FBS snapshot. */
export const FBS_PROTOCOL_SOURCE = ${metadata} as const;
`;
}

function generateMarkdown(reference) {
  const source = reference.generatedFrom.source;
  const lines = [
    '# Public FBS protocol reference',
    '',
    '> This file is generated by `scripts/generate-fbs-protocol.mjs`. Do not edit it by hand.',
    '',
    `Upstream: \`${source.repository}@${source.commit}\`  `,
    `Path: \`${source.path}\`  `,
    `Coverage: **${reference.enumCount} enums / ${reference.valueCount} values / ${reference.generatedFrom.files.length} FBS files**.`,
    '',
    'Numeric identifiers are protocol contracts. Names ending in `_Min`, `_MAX`,',
    '`Start`, or `_END` are range/sentinel members unless the source schema says otherwise.',
    '',
    '## Source integrity',
    '',
    '| FBS file | Upstream SHA-256 | Public vendored SHA-256 |',
    '| --- | --- | --- |',
  ];

  for (const file of reference.generatedFrom.files) {
    lines.push(
      `| \`${file.name}\` | \`${file.upstreamSha256}\` | \`${file.vendoredSha256}\` |`,
    );
  }

  lines.push('', '## Enum index', '');
  for (const enumDefinition of reference.enums) {
    lines.push(
      `- [${enumDefinition.name}](#${enumDefinition.name.toLowerCase()}) — ` +
      `${enumDefinition.values.length} values`,
    );
  }

  for (const enumDefinition of reference.enums) {
    lines.push(
      '',
      `## ${enumDefinition.name}`,
      '',
      `Source: \`${enumDefinition.sourceFile}:${enumDefinition.sourceLine}\`; ` +
      `FlatBuffers scalar: \`${enumDefinition.underlyingType}\`.`,
      '',
    );
    if (enumDefinition.description) {
      lines.push(enumDefinition.description, '');
    }
    lines.push(
      '| Name | Value | Declared literal | Line | Description |',
      '| --- | ---: | --- | ---: | --- |',
    );
    for (const value of enumDefinition.values) {
      lines.push(
        `| \`${value.name}\` | ${value.value} | ` +
        `${value.literal === null ? 'implicit' : `\`${value.literal}\``} | ` +
        `${value.sourceLine} | ${escapeMarkdownTable(value.description ?? '')} |`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

function validateSourceMetadata(metadata) {
  if (metadata?.schemaVersion !== 1 || !metadata.source?.commit || !metadata.source?.path) {
    fail('schemas/source.json is missing required source metadata');
  }
  if (!Array.isArray(metadata.files) || metadata.files.length === 0) {
    fail('schemas/source.json must describe at least one public FBS file');
  }
  const names = new Set();
  for (const file of metadata.files) {
    if (
      typeof file.name !== 'string' ||
      !/^[A-Za-z0-9_-]+\.fbs$/.test(file.name) ||
      !/^[0-9a-f]{64}$/.test(file.upstreamSha256) ||
      !/^[0-9a-f]{64}$/.test(file.vendoredSha256)
    ) {
      fail(`Invalid file metadata in schemas/source.json: ${JSON.stringify(file)}`);
    }
    if (names.has(file.name)) fail(`Duplicate file metadata: ${file.name}`);
    names.add(file.name);
  }
}

function validateSchemaDirectory(metadata) {
  const expected = metadata.files.map((file) => file.name).sort();
  const actual = readdirSync(SCHEMA_DIR)
    .filter((name) => name.toLowerCase().endsWith('.fbs'))
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(
      'schemas/fbs and schemas/source.json list different FBS files:\n' +
      `  metadata: ${expected.join(', ')}\n` +
      `  directory: ${actual.join(', ')}`,
    );
  }
}

function validatePublicCommentEncoding(sourceFile, source) {
  for (const [lineOffset, line] of source.split('\n').entries()) {
    const trimmed = line.trimStart();
    if (!/^(?:\/\/|\/\*|\*|\*\/)/.test(trimmed)) continue;
    if (/[\u0080-\u009f]/.test(line) || /(?:Ã|Â)/.test(line)) {
      fail(
        `Likely UTF-8 mojibake in public comment at ${sourceFile}:${lineOffset + 1}`,
      );
    }
  }
}

function readPrecedingComment(precedingSource) {
  const tail = precedingSource.slice(Math.max(0, precedingSource.length - 4000));
  const match = tail.match(
    /(?:\/\*\*?([\s\S]*?)\*\/|((?:\s*\/\/[^\n]*\n?)+))\s*$/,
  );
  if (!match) return '';
  const raw = match[1] ?? match[2] ?? '';
  return normalizeDescription(
    raw
      .split('\n')
      .map((line) => line.replace(/^\s*(?:\*|\/{2,3})?\s?/, ''))
      .join(' '),
  );
}

function appendComment(parts, comment) {
  const normalized = comment
    .replace(/^[ \t]*\*?[ \t]?/, '')
    .replace(/[ \t\r\n]+$/g, '');
  if (normalized) parts.push(normalized);
}

function normalizeDescription(description) {
  // Repair byte-preserving mojibake before Unicode whitespace normalization:
  // U+00A0 can represent the third UTF-8 byte in a corrupted Chinese character.
  const collapsed = repairMojibake(description).replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  return collapsed;
}

function repairMojibake(value) {
  const chars = [...value];
  const allLatin1 = chars.every((character) => character.codePointAt(0) <= 0xff);
  const suspicious = /[\u0080-\u009fÃÂ]/.test(value);
  if (!allLatin1 || !suspicious) return value;
  const repaired = Buffer.from(value, 'latin1').toString('utf8');
  return repaired.includes('\uFFFD') ? value : repaired;
}

function wrapComment(value, width = 96) {
  const words = value.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + word.length + 1 <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function escapeJSDoc(value) {
  return value.replaceAll('*/', '*\\/');
}

function escapeMarkdownTable(value) {
  return value.replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`Unable to read ${relativePath(path)}: ${error.message}`);
  }
}

function relativePath(path) {
  return path
    .slice(REPOSITORY_ROOT.length + 1)
    .replaceAll('\\\\', '/')
    .replaceAll('\\', '/');
}

function fail(message) {
  console.error(`FBS protocol generation failed: ${message}`);
  process.exit(1);
}
