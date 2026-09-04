#!/usr/bin/env node

/**
 * User registry validator/migration CLI.
 *
 * Safe examples:
 *   node scripts/migrate-users-to-hashed-registry.mjs --validate --input path
 *   node scripts/migrate-users-to-hashed-registry.mjs --prepare --input old.json --output new.json
 *   node scripts/migrate-users-to-hashed-registry.mjs --prepare --input old.json \
 *     --retain-users alice,bob --output new.json
 *   node scripts/migrate-users-to-hashed-registry.mjs --upload --input new.json \
 *     --bucket sorce-dashboard-data --key auth/users.json --region us-east-1 \
 *     --expected-etag '"..."'
 *   node scripts/migrate-users-to-hashed-registry.mjs --create-upload --input new.json \
 *     --bucket sorce-dashboard-data --key auth/users.json --region us-east-1
 *
 * No mode has a default input/output. Preparation never prints usernames,
 * object keys, password hashes, or any other registry values. Updates use the
 * AWS SDK's typed PutObject If-Match field; initial creation uses typed
 * If-None-Match '*'. Neither mode can silently fall back to an unconditional
 * or overwriting write.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const LEGACY_DASHBOARD_SALT = '12ca4b05c51ea3528e3904ef7fedfaa5';

function usage() {
  console.error(
    [
      'Usage:',
      '  --validate --input <registry.json>',
      '  --prepare --input <legacy-or-registry.json> --output <registry.json> [--retain-users <normalized-usernames>]',
      '  --upload --input <registry.json> --bucket <bucket> --key <key> --region <region> --expected-etag <etag>',
      '  --create-upload --input <registry.json> --bucket <bucket> --key <key> --region <region>'
    ].join('\n')
  );
}

function parseArgs(argv) {
  const values = {};
  let mode;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (
      arg === '--validate' ||
      arg === '--prepare' ||
      arg === '--upload' ||
      arg === '--create-upload'
    ) {
      if (mode) throw new Error('Choose exactly one mode');
      mode = arg.slice(2);
      continue;
    }
    if (!arg.startsWith('--')) throw new Error('Unexpected argument');
    const name = arg.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${name}`);
    }
    if (Object.hasOwn(values, name)) {
      throw new Error(`Duplicate option --${name}`);
    }
    values[name] = value;
    index += 1;
  }
  if (!mode) throw new Error('A mode is required');
  const allowedOptions = {
    validate: ['input'],
    prepare: ['input', 'output', 'retain-users'],
    upload: ['input', 'bucket', 'key', 'region', 'expected-etag'],
    'create-upload': ['input', 'bucket', 'key', 'region']
  }[mode];
  if (!allowedOptions) throw new Error('Unknown mode');
  for (const name of Object.keys(values)) {
    if (!allowedOptions.includes(name)) {
      throw new Error(`Option --${name} is not valid with --${mode}`);
    }
  }
  return { mode, values };
}

async function parseSchema(input) {
  // Node 22+ can strip the type syntax in this schema module.  It contains no
  // server-only import and therefore remains usable by this local CLI.
  const { parseUserRegistry } = await import('../lib/users/schema.ts');
  return parseUserRegistry(input);
}

async function retainSelectedUsers(registry, selection) {
  const { retainUsers } = await import('../lib/users/schema.ts');
  return retainUsers(registry, selection);
}

function legacyObjectKey(displayName) {
  const digest = createHash('sha256')
    .update(displayName)
    .update(Buffer.from(LEGACY_DASHBOARD_SALT))
    .digest('hex');
  return `companies/${digest}.data.json`;
}

function migrateLegacyShape(input) {
  if (input && Array.isArray(input.tenants)) return input;
  if (!input || !Array.isArray(input.users)) {
    throw new Error('Input does not contain a user registry');
  }

  const now = new Date().toISOString();
  const sourceUpdatedAt =
    typeof input.updatedAt === 'string' ? input.updatedAt : now;
  const tenants = [];
  const users = input.users.map((sourceUser) => {
    if (!sourceUser || typeof sourceUser !== 'object') {
      throw new Error('Input contains an invalid user record');
    }
    const id = String(sourceUser.id ?? '');
    const displayName = String(sourceUser.displayName ?? '');
    if (!id || !displayName)
      throw new Error('Input user is missing an identifier');
    const tenantId = `tenant-${id}`;
    tenants.push({
      id: tenantId,
      displayName,
      dashboardObjectKey: legacyObjectKey(displayName),
      enabled: sourceUser.enabled !== false,
      createdAt: sourceUser.createdAt ?? sourceUpdatedAt,
      updatedAt: sourceUser.updatedAt ?? sourceUpdatedAt
    });
    const role =
      sourceUser.role ?? (sourceUser.admin === true ? 'admin' : 'viewer');
    return {
      id,
      username: String(sourceUser.username ?? '')
        .trim()
        .toLowerCase(),
      displayName,
      password: sourceUser.password,
      role,
      tenantId,
      enabled: sourceUser.enabled !== false,
      authVersion: Number.isInteger(sourceUser.authVersion)
        ? sourceUser.authVersion
        : 1,
      createdAt: sourceUser.createdAt ?? sourceUpdatedAt,
      updatedAt: sourceUser.updatedAt ?? sourceUpdatedAt
    };
  });
  return {
    schemaVersion: 1,
    updatedAt: sourceUpdatedAt,
    tenants,
    users
  };
}

async function readJson(filename) {
  let text;
  try {
    text = await readFile(filename, 'utf8');
  } catch {
    throw new Error('Could not read input registry');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Input registry is not valid JSON');
  }
}

function requireValue(values, name) {
  if (!values[name] || values[name].trim() === '') {
    throw new Error(`--${name} is required`);
  }
  return values[name];
}

async function main() {
  const { mode, values } = parseArgs(process.argv.slice(2));
  const input = path.resolve(requireValue(values, 'input'));
  const source = await readJson(input);

  if (mode === 'validate') {
    await parseSchema(source);
    console.log('Registry is valid (secrets omitted).');
    return;
  }

  if (mode === 'prepare') {
    const output = path.resolve(requireValue(values, 'output'));
    if (output === input) {
      throw new Error('--output must be different from --input');
    }
    let prepared = await parseSchema(migrateLegacyShape(source));
    if (Object.hasOwn(values, 'retain-users')) {
      prepared = await retainSelectedUsers(prepared, values['retain-users']);
    }
    await writeFile(output, `${JSON.stringify(prepared, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600
    });
    console.log(
      `Prepared registry with ${prepared.users.length} users and ${prepared.tenants.length} tenants (secrets omitted).`
    );
    return;
  }

  const bucket = requireValue(values, 'bucket');
  const key = requireValue(values, 'key');
  const region = requireValue(values, 'region');
  const expectedETag =
    mode === 'upload' ? requireValue(values, 'expected-etag') : undefined;
  const prepared = await parseSchema(source);
  const inputBody = await readFile(input, 'utf8');
  let response;
  try {
    response = await new S3Client({ region }).send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: inputBody,
        ContentType: 'application/json',
        ...(mode === 'upload'
          ? { IfMatch: expectedETag }
          : { IfNoneMatch: '*' })
      })
    );
  } catch (error) {
    const status =
      typeof error === 'object' && error !== null && '$metadata' in error
        ? error.$metadata?.httpStatusCode
        : typeof error === 'object' && error !== null && 'statusCode' in error
          ? error.statusCode
          : undefined;
    if (status === 409 || status === 412) {
      throw new Error(
        mode === 'create-upload'
          ? 'Registry object already exists or creation conflicted'
          : 'Registry upload conflicted with a concurrent update'
      );
    }
    throw new Error('Registry upload failed');
  }
  console.log(
    `Uploaded registry with ${prepared.users.length} users and ${prepared.tenants.length} tenants (secrets omitted; ETag ${response.ETag ?? 'unavailable'}).`
  );
}

main().catch((error) => {
  usage();
  console.error(
    error instanceof Error ? error.message : 'Registry operation failed'
  );
  process.exitCode = 1;
});
