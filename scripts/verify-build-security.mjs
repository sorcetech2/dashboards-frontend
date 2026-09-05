#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const buildRoot = path.join(projectRoot, '.next');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(filename)));
    if (entry.isFile()) files.push(filename);
  }
  return files;
}

async function loadSensitiveCandidates() {
  // Scan for the salts and hashes of every registry the build could have
  // traced: the developer's local file and, on a clean CI checkout, the E2E
  // fixture. Usernames are excluded because short words such as "admin"
  // legitimately appear in client bundles.
  const registryPaths = [
    process.env.AUTH_USER_REGISTRY_LOCAL_PATH,
    path.join(projectRoot, 'lib', 'user-registry.json'),
    path.join(projectRoot, 'tests', 'fixtures', 'e2e-user-registry.json')
  ].filter(Boolean);
  const candidates = [];
  for (const registryPath of registryPaths) {
    let registry;
    try {
      registry = JSON.parse(await readFile(registryPath, 'utf8'));
    } catch {
      continue;
    }
    for (const user of registry.users ?? []) {
      for (const value of [user.password?.salt, user.password?.hash]) {
        if (typeof value === 'string' && value.length >= 16) {
          candidates.push(value);
        }
      }
    }
  }
  return candidates;
}

let files;
try {
  files = await walk(buildRoot);
} catch {
  console.error('Production build output is missing; run `pnpm build` first.');
  process.exitCode = 1;
  process.exit();
}

const actionManifests = files.filter((filename) =>
  filename.endsWith('server-reference-manifest.json')
);
for (const filename of actionManifests) {
  const contents = await readFile(filename, 'utf8');
  if (/lib[\\/]users(?:\.ts|[\\/])/.test(contents)) {
    console.error(
      'A user repository module was registered as a Server Action.'
    );
    process.exitCode = 1;
  }
}

const bundleFiles = files.filter((filename) => {
  const relative = path.relative(buildRoot, filename);
  return (
    relative.startsWith(`static${path.sep}`) ||
    relative.includes(`server${path.sep}middleware`) ||
    relative.includes(`server${path.sep}edge`)
  );
});
const candidates = await loadSensitiveCandidates();
if (candidates.length === 0) {
  console.error(
    'No registry credential values were available; the bundle scan cannot run.'
  );
  process.exitCode = 1;
}
for (const filename of bundleFiles) {
  const contents = await readFile(filename, 'utf8');
  if (candidates.some((candidate) => contents.includes(candidate))) {
    console.error(
      'A credential-derived registry value was found in a client/Edge bundle.'
    );
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) {
  console.log(
    `Build security checks passed (${actionManifests.length} action manifests, ${bundleFiles.length} client/Edge assets).`
  );
}
