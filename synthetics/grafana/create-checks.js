#!/usr/bin/env node
/**
 * Grafana Synthetic Monitoring - Check Provisioner
 * 
 * Idempotent script to create/update HTTP checks via Synthetic Monitoring API.
 * Supports dry-run mode, verbose logging, and automatic API endpoint failover.
 * 
 * Usage:
 *   node create-checks.js [--dry-run] [--verbose]
 * 
 * Environment variables:
 *   GRAFANA_SM_API_URL       - Synthetic Monitoring API endpoint (optional, has fallbacks)
 *   GRAFANA_SM_ACCESS_TOKEN  - Access Policy token with Synthetic Monitoring scope
 *   GRAFANA_CLOUD_STACK_ID   - Grafana Cloud stack slug (e.g., "mystack" or numeric ID)
 *   SYNTHETIC_BASE_URL       - Base URL to monitor (default: https://michalelena.me)
 * 
 * Reference: https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/set-up/provisioning/
 */

const { exit } = require('process');

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose') || isDryRun;

// Load environment variables
const BASE_URL = process.env.GRAFANA_SM_API_URL; // e.g. https://synthetic-monitoring-api-us-east-0.grafana.net
const TOKEN    = process.env.GRAFANA_SM_API_TOKEN || process.env.GRAFANA_SM_ACCESS_TOKEN;
const STACK_ID = process.env.GRAFANA_CLOUD_STACK_ID; // your stack slug, e.g. michalelena-monitoring
const SYNTHETIC_BASE_URL = process.env.SYNTHETIC_BASE_URL || 'https://michalelena.me';

// Validate required environment variables
const missingVars = [];
if (!TOKEN) missingVars.push('GRAFANA_SM_API_TOKEN (or GRAFANA_SM_ACCESS_TOKEN)');
if (!STACK_ID) missingVars.push('GRAFANA_CLOUD_STACK_ID');

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('\nExample:');
  console.error('  export GRAFANA_SM_API_TOKEN="your-access-policy-token"');
  console.error('  export GRAFANA_CLOUD_STACK_ID="your-stack-slug"');
  console.error('  export SYNTHETIC_BASE_URL="https://michalelena.me"');
  console.error('  export GRAFANA_SM_API_URL="https://synthetic-monitoring-api-us-east-0.grafana.net"');
  exit(1);
}

// Common headers for all SM API requests
const commonHeaders = {
  'Authorization': `Bearer ${TOKEN}`,
  'X-Stack-Id': STACK_ID,
  'Content-Type': 'application/json'
};

if (isVerbose) {
  console.log('🔧 Configuration:');
  console.log(`  Stack ID: ${STACK_ID}`);
  console.log(`  Base URL: ${SYNTHETIC_BASE_URL}`);
  console.log(`  SM API URL: ${BASE_URL || '(not set)'}`);
  console.log(`  Token length: ${TOKEN.length}`);
  console.log(`  Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'APPLY (live changes)'}`);
  console.log('');
}

if (!BASE_URL) {
  console.error('❌ GRAFANA_SM_API_URL is required');
  console.error('   Set it to your SM API endpoint, e.g.:');
  console.error('   export GRAFANA_SM_API_URL="https://synthetic-monitoring-api-us-east-0.grafana.net"');
  exit(1);
}

// HTTP client wrapper for SM API calls
async function smFetch(path, opts = {}) {
  const cleanBase = BASE_URL.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  const url = `${cleanBase}/api/v1/${cleanPath}`;
  
  const options = {
    ...opts,
    headers: {
      ...commonHeaders,
      ...(opts.headers || {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  };

  if (isVerbose) {
    console.log(`📡 ${opts.method || 'GET'} ${url}`);
  }

  const response = await fetch(url, options);
  
  // Parse response
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { rawResponse: text };
  }

  // Handle non-OK responses
  if (!response.ok) {
    const errorMsg = `${response.status} ${response.statusText} at ${url} :: ${text}`;
    if (isVerbose) {
      console.error(`   ❌ ${errorMsg}`);
    }
    throw new Error(errorMsg);
  }

  // Success
  if (isVerbose) {
    console.log(`   ✅ ${response.status} OK`);
    if (opts.method === 'GET' && Array.isArray(data)) {
      console.log(`   Found ${data.length} items`);
    }
  }

  return { data, response };
}

// Main provisioning logic
async function provisionChecks() {
  console.log('🚀 Starting Synthetic Monitoring check provisioner...\n');

  // Step 1: Discover probes
  console.log('🌍 Discovering available probes...');
  let probes = [];
  let selectedProbeIds = [];
  
  try {
    const { data } = await smFetch('/probes', { method: 'GET' });
    probes = data || [];
    console.log(`✅ Found ${probes.length} probes\n`);

    if (isVerbose && probes.length > 0) {
      console.log('📍 Available probes:');
      probes.slice(0, 10).forEach(probe => {
        console.log(`   - [${probe.id}] ${probe.name} (${probe.region}, online: ${probe.online})`);
      });
      if (probes.length > 10) {
        console.log(`   ... and ${probes.length - 10} more`);
      }
      console.log('');
    }

    // Select probes by region (prefer distributed coverage)
    const findProbe = (name) => probes.find(p => (p.name || '').toLowerCase().includes(name.toLowerCase()));
    const usEast = findProbe('us-east');
    const usWest = findProbe('us-west');
    const euWest = findProbe('eu-west');
    
    selectedProbeIds = [usEast?.id, usWest?.id, euWest?.id].filter(Boolean);
    
    if (selectedProbeIds.length === 0 && probes.length > 0) {
      // Fallback: use first 3 available probes
      selectedProbeIds = probes.slice(0, 3).map(p => p.id);
    }

    if (selectedProbeIds.length === 0) {
      console.error('❌ No probes available. Cannot provision checks.');
      exit(1);
    }

    console.log(`📍 Selected probes: [${selectedProbeIds.join(', ')}]`);
    selectedProbeIds.forEach(id => {
      const probe = probes.find(p => p.id === id);
      if (probe) {
        console.log(`   - [${id}] ${probe.name} (${probe.region})`);
      }
    });
    console.log('');
  } catch (error) {
    console.error('❌ Failed to discover probes:', error.message);
    exit(1);
  }

  // Step 2: Discover existing checks
  console.log('📋 Discovering existing checks...');
  let existingChecks = [];
  
  try {
    const { data } = await smFetch('/checks', { method: 'GET' });
    existingChecks = data || [];
    console.log(`✅ Found ${existingChecks.length} existing checks\n`);

    if (isVerbose && existingChecks.length > 0) {
      console.log('📊 Existing checks:');
      existingChecks.forEach(check => {
        console.log(`   - ${check.job} (id: ${check.id}, enabled: ${check.enabled})`);
      });
      console.log('');
    }
  } catch (error) {
    console.warn('⚠️  Failed to list existing checks, will attempt to create all as new');
    console.warn(`   Error: ${error.message}\n`);
  }

  // Step 3: Define checks to provision
  const checksToProvision = [
    { job: 'homepage', path: '/', timeoutMs: 10000, thresholdMs: 2000 },
    { job: 'shop', path: '/shop', timeoutMs: 10000, thresholdMs: 2500 },
    { job: 'checkout', path: '/checkout', timeoutMs: 10000, thresholdMs: 2500 },
    { job: 'api-health', path: '/api/health', timeoutMs: 5000, thresholdMs: 500 },
    { job: 'api-search', path: '/api/search?q=art', timeoutMs: 5000, thresholdMs: 500 }
  ];

  // Step 4: Upsert each check
  const results = {
    created: [],
    updated: [],
    skipped: [],
    failed: []
  };

  for (const checkDef of checksToProvision) {
    const { job, path, timeoutMs } = checkDef;
    const target = `${SYNTHETIC_BASE_URL}${path}`;
    
    const checkPayload = {
      job,
      enabled: true,
      frequency: 300000, // 5 minutes in ms
      timeout: timeoutMs,
      probes: selectedProbeIds,
      target,
      alertSensitivity: 'medium',
      settings: {
        http: {
          method: 'GET',
          failIfSSL: false,
          failIfNotSSL: false,
          noFollowRedirects: false
        }
      },
      labels: [
        { name: 'app', value: 'artistsite' },
        { name: 'path', value: path },
        { name: 'env', value: 'prod' }
      ]
    };

    console.log(`\n🔍 Processing check: ${job}`);
    console.log(`   Target: ${target}`);
    console.log(`   Frequency: ${checkPayload.frequency / 1000}s`);
    console.log(`   Timeout: ${timeoutMs}ms`);

    if (isDryRun) {
      const existingCheck = existingChecks.find(c => c.job === job);
      console.log(`   💡 DRY RUN: Would ${existingCheck ? 'UPDATE' : 'CREATE'} check`);
      if (isVerbose) {
        console.log(`   Payload preview: ${JSON.stringify(checkPayload, null, 2).substring(0, 300)}...`);
      }
      results.skipped.push(job);
      continue;
    }

    try {
      const existingCheck = existingChecks.find(c => c.job === job);
      
      if (existingCheck) {
        // Update existing check
        console.log(`   🔄 Updating existing check (id: ${existingCheck.id})...`);
        const updatePayload = { ...existingCheck, ...checkPayload };
        await smFetch(`checks/${existingCheck.id}`, {
          method: 'PUT',
          body: updatePayload
        });
        console.log(`   ✅ Updated successfully`);
        results.updated.push(job);
      } else {
        // Create new check
        console.log(`   ➕ Creating new check...`);
        const { data } = await smFetch('checks', {
          method: 'POST',
          body: checkPayload
        });
        console.log(`   ✅ Created successfully (id: ${data.id})`);
        results.created.push(job);
      }
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      results.failed.push({ job, error: error.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Provisioning Summary');
  console.log('='.repeat(60));
  console.log(`✅ Created: ${results.created.length} checks`);
  if (results.created.length > 0) {
    results.created.forEach(job => console.log(`   - ${job}`));
  }
  console.log(`🔄 Updated: ${results.updated.length} checks`);
  if (results.updated.length > 0) {
    results.updated.forEach(job => console.log(`   - ${job}`));
  }
  console.log(`⏭️  Skipped: ${results.skipped.length} checks (dry-run mode)`);
  if (results.skipped.length > 0) {
    results.skipped.forEach(job => console.log(`   - ${job}`));
  }
  console.log(`❌ Failed: ${results.failed.length} checks`);
  if (results.failed.length > 0) {
    results.failed.forEach(({ job, error }) => console.log(`   - ${job}: ${error}`));
  }
  console.log('='.repeat(60) + '\n');

  if (results.failed.length > 0) {
    console.error('⚠️  Some checks failed to provision. Review errors above.');
    exit(1);
  }

  if (isDryRun) {
    console.log('💡 Dry-run completed. Run without --dry-run to apply changes.');
    exit(0);
  }

  console.log('🎉 Provisioning completed successfully!');
  console.log('\n📍 Next steps:');
  console.log('  1. Verify checks in Grafana Cloud: Synthetic Monitoring → Checks');
  console.log('  2. Confirm alert notifications are configured');
  console.log('  3. Monitor check results for 24h to establish baseline\n');
  exit(0);
}

// Run the provisioner
provisionChecks().catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  if (isVerbose) {
    console.error(error.stack);
  }
  exit(1);
});
