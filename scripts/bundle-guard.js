#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');
function scanFiles(patterns, markers) {
  const matches = [];
  for (const pattern of patterns) {
    const files = glob.sync(pattern, { nodir: true });
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const marker of markers) {
        if (content.includes(marker)) {
          matches.push({ file, marker });
        }
      }
    }
  }
  return matches;
}
function main() {
  const root = process.cwd();
  const chunkPatterns = [
    path.join(root, '.next', 'static', 'chunks', '**', '*.js'),
    path.join(root, '.next', 'static', 'chunks', '*.js'),
  ];
  const forbiddenMarkers = [
    '/src/domain/security/auditor',
    '/src/domain/performance/monitor',
    '@domain/security/auditor',
    '@domain/performance/monitor',
    'security_audit',
    'security_alert',
    'production_readiness_check',
    'performance_metrics',
    'load_test_completed',
  ];
  const results = scanFiles(chunkPatterns, forbiddenMarkers);
  if (results.length > 0) {
    console.error('❌ Bundle guard failed: server-only modules detected in client chunks');
    for (const r of results) {
      console.error(` - Found marker "${r.marker}" in ${path.relative(root, r.file)}`);
    }
    process.exit(1);
  }
  console.log('✅ Bundle guard passed: no server-only markers found in client chunks');
}
main();
