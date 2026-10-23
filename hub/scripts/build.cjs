#!/usr/bin/env node
/**
 * Validates every pack under hub/packs and publishes hub/dist:
 *   dist/index.json                  hub index (what the app reads)
 *   dist/packs/<id>-<version>.json   one bundle per pack, checksummed in the index
 * Usage: node hub/scripts/build.cjs [--check]   (--check validates without writing)
 * Requires the shared package to be built first (npm run hub:build does both).
 */
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { parse: parseYaml } = require('yaml');

const hubRoot = path.resolve(__dirname, '..');
const sharedDist = path.resolve(hubRoot, '../services/shared/dist');
let buildPack;
try {
  ({ buildPack } = require(path.join(sharedDist, 'content/pack-builder.js')));
} catch {
  console.error('Shared package is not built. Run "npm run hub:build" from the repository root.');
  process.exit(1);
}

const checkOnly = process.argv.includes('--check');
const packsDir = path.join(hubRoot, 'packs');
const distDir = path.join(hubRoot, 'dist');
const hubMeta = parseYaml(fs.readFileSync(path.join(hubRoot, 'hub.yaml'), 'utf8'));

function readTree(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push({ path: path.relative(root, full).split(path.sep).join('/'), content: fs.readFileSync(full, 'utf8') });
    }
  };
  walk(root);
  return files;
}

const entries = [];
let failed = false;
for (const folder of fs.readdirSync(packsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
  try {
    const bundle = buildPack(readTree(path.join(packsDir, folder)));
    if (bundle.manifest.id !== folder) throw new Error(`pack.yaml id "${bundle.manifest.id}" must match the folder name "${folder}"`);
    const json = `${JSON.stringify(bundle, null, 2)}\n`;
    const file = `packs/${bundle.manifest.id}-${bundle.manifest.version}.json`;
    entries.push({
      ...bundle.manifest,
      problemCount: bundle.problems.length,
      articleCount: bundle.articles.length,
      bundle: file,
      sha256: createHash('sha256').update(json).digest('hex'),
      size: Buffer.byteLength(json),
      json,
    });
    console.log(`✓ ${folder} ${bundle.manifest.version}: ${bundle.problems.length} problem(s), ${bundle.articles.length} article(s)`);
  } catch (error) {
    failed = true;
    console.error(`✗ ${folder}\n${error.issues ? error.issues.map((issue) => `    - ${issue}`).join('\n') : `    - ${error.message}`}`);
  }
}

if (failed) process.exit(1);
if (checkOnly) {
  console.log(`All ${entries.length} pack(s) are valid.`);
  process.exit(0);
}

fs.rmSync(path.join(distDir, 'packs'), { recursive: true, force: true });
fs.mkdirSync(path.join(distDir, 'packs'), { recursive: true });
for (const entry of entries) fs.writeFileSync(path.join(distDir, entry.bundle), entry.json);
const index = {
  format: 'archon-hub@1',
  name: hubMeta.name,
  updatedAt: new Date().toISOString(),
  packs: entries.map(({ json, ...entry }) => entry),
};
fs.writeFileSync(path.join(distDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(`Published ${entries.length} pack(s) to hub/dist.`);
