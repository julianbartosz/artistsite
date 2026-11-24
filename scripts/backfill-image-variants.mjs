#!/usr/bin/env node
/**
 * Idempotent WebP variant backfill for images already in Azure Blob / local uploads.
 *
 * Preferred production path after deploy (signed in as admin):
 *   fetch('/api/upload/image', { method: 'PUT' })
 *
 * Ops / CI fallback from a machine with Azure credentials:
 *   npx tsx --env-file=.env.fly scripts/backfill-image-variants.mjs
 */
import { readFileSync } from 'fs';

function loadEnvFile(filePath) {
  try {
    for (const line of readFileSync(filePath, 'utf8').split(/\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq);
      let value = trimmed.slice(eq + 1);
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Caller may already have exported env vars.
  }
}

loadEnvFile(process.env.ENV_FILE || '.env.fly');

const { backfillMissingImageVariants } = await import('../src/lib/storage.ts');
const summary = await backfillMissingImageVariants();
console.log(JSON.stringify(summary, null, 2));
if (Array.isArray(summary.failed) && summary.failed.length > 0) {
  process.exitCode = 1;
}
