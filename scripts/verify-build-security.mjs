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
  const candidates = [];
  const registryPath = path.join(projectRoot, 'lib', 'user-registry.json');
  try {
    const registry = JSON.parse(await readFile(registryPath, 'utf8'));
    for (const user of registry.users ?? []) {
      for (const value of [
        user.username,
        user.password?.salt,
        user.password?.hash
      ]) {
        if (typeof value === 'string' && value.length >= 4) {
          candidates.push(value);
        }
      }
    }
  } catch {
    // A clean clone deliberately has no local registry.
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
