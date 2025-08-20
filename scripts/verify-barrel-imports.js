#!/usr/bin/env node
/**
 * Barrel Import Enforcement
 * Fails if any cross-feature deep domain import is found, e.g.:
 *   import { X } from '@domain/seo/sitemap'
 * Allowed: deep imports only from inside the same feature folder (src/domain/<feature>/...)
 * CI usage: node scripts/verify-barrel-imports.js --check
 */
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const checkMode = args.includes('--check');
const root = path.resolve(__dirname, '..');
const SRC = path.join(root, 'src');
const exts = ['.ts', '.tsx', '.js', '.jsx'];
const violations = [];
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    if (d.name === 'node_modules' || d.name.startsWith('.next') || d.name === 'coverage') return [];
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return walk(full);
    if (exts.some(e => d.name.endsWith(e))) return [full];
    return [];
  });
}
const files = walk(SRC);
const importRegex = /import[^'";]*from\s+['"]@domain\/([^/'"\\]+)\/([^'";]+)['"];?/g;
files.forEach(file => {
  const rel = path.relative(root, file);
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const feature = match[1];
    const rest = match[2];
    // Allow inside same feature folder (internal deep import)
    const featureDir = path.join('src', 'domain', feature + path.sep);
    if (rel.startsWith(featureDir)) continue;
    violations.push({ file: rel, feature, path: `@domain/${feature}/${rest}` });
  }
});
if (violations.length) {
  console.error(`Barrel import rule violations (${violations.length}):`);
  violations.forEach(v => console.error(`  ${v.file}: ${v.path}`));
  process.exit(1);
} else if (!checkMode) {
  console.log('No barrel import violations.');
} else {
  console.log('Barrel import check passed.');
}
