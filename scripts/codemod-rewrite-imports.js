#!/usr/bin/env node
/**
 * Phase 7 Codemod: Rewrite legacy '@/components/*' imports to '@ui/components/*'.
 * Strategy:
 *  - Scan all source & test TS/TSX/JS/JSX files under src/ for import-like usages of '@/components/'
 *  - For each, attempt to read the corresponding shim file under src/components/<name>.tsx
 *    and extract the canonical '@ui/components/...' target. If found, use that.
 *  - Otherwise fall back to '@ui/components/<original-subpath>'.
 *  - Also updates occurrences in jest.mock, export { ... } from, and dynamic import strings.
 *  - --check mode: exit 1 if any legacy imports remain (no modifications written).
 */
const fs = require('fs');
const path = require('path');
const exts = ['.ts', '.tsx', '.js', '.jsx'];
const root = path.resolve(__dirname, '..');
const SRC_DIR = path.join(root, 'src');
const legacyPattern = /(['"])@\/components\/(.+?)\1/g; // matches '@/components/...' inside quotes
const args = process.argv.slice(2);
const checkMode = args.includes('--check');
let legacyCount = 0;
/** Recursively collect files */
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    if (d.name === 'node_modules' || d.name.startsWith('.next')) return [];
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return walk(full);
    if (exts.some(e => d.name.endsWith(e))) return [full];
    return [];
  });
}
function resolveShimTarget(subpath) {
  // Try each extension
  for (const ext of exts) {
    const shimPath = path.join(SRC_DIR, 'components', subpath + ext);
    if (fs.existsSync(shimPath)) {
      try {
        const content = fs.readFileSync(shimPath, 'utf8');
        const match = content.match(/@ui\/(components\/[\w\/-]+)/);
        if (match) return match[0];
      } catch { /* ignore */ }
    }
  }
  // Default fallback
  return '@ui/components/' + subpath;
}
const files = walk(SRC_DIR);
files.forEach(file => {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes("@/components/")) return; // fast path
  let modified = false;
  text = text.replace(legacyPattern, (full, quote, subpath) => {
    legacyCount++;
    const target = resolveShimTarget(subpath);
    if (checkMode) return full; // do not modify in check mode
    modified = true;
    return `${quote}${target}${quote}`;
  });
  if (modified && !checkMode) {
    fs.writeFileSync(file, text, 'utf8');
    console.log(`Rewritten legacy imports in: ${path.relative(root, file)}`);
  }
});
if (checkMode) {
  if (legacyCount > 0) {
    console.error(`codemod:imports --check failed. Found ${legacyCount} legacy '@/components/' import(s). Run: npm run codemod:imports`);
    process.exit(1);
  } else {
    console.log('codemod:imports --check passed. No legacy imports found.');
  }
} else {
  if (legacyCount === 0) {
    console.log('No legacy imports found to rewrite.');
  } else {
    console.log(`Rewrote ${legacyCount} legacy import occurrence(s).`);
  }
}
