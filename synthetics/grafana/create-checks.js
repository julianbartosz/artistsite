#!/usr/bin/env node
/**
 * Grafana Synthetic Monitoring - Check Provisioner
 * 
 * Idempotent script to create/update HTTP checks via Synthetic Monitoring API.
 * Supports dry-run mode and verbose logging.
 * 
 * Usage:
 *   node create-checks.js [--dry-run] [--verbose]
 * 
 * Environment variables:
 *   GRAFANA_SM_API_URL       - Synthetic Monitoring API endpoint
 *   GRAFANA_SM_ACCESS_TOKEN  - API token with Editor permissions
 *   GRAFANA_CLOUD_STACK_ID   - Grafana Cloud stack ID (numeric)
 *   SYNTHETIC_BASE_URL       - Base URL to monitor (default: https://michalelena.me)
 *   GRAFANA_SM_PROBES        - Comma-separated probe IDs (default: 1,3,8)
 * 
 * Reference: https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/set-up/provisioning/
 */

const { exit } = require('process');

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose') || isDryRun;

// Load environment variables
const {
  GRAFANA_SM_API_URL,
  GRAFANA_SM_ACCESS_TOKEN,
  GRAFANA_CLOUD_STACK_ID,
  SYNTHETIC_BASE_URL = 'https://michalelena.me',
  GRAFANA_SM_PROBES = '1,3,8'
} = process.env;

// Validate required environment variables
const missingVars = [];
if (!GRAFANA_SM_API_URL) missingVars.push('GRAFANA_SM_API_URL');
if (!GRAFANA_SM_ACCESS_TOKEN) missingVars.push('GRAFANA_SM_ACCESS_TOKEN');
if (!GRAFANA_CLOUD_STACK_ID) missingVars.push('GRAFANA_CLOUD_STACK_ID');

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('\nExample:');
  console.error('  export GRAFANA_SM_API_URL="https://synthetic-monitoring-api-us-east-0.grafana.net"');
  console.error('  export GRAFANA_SM_ACCESS_TOKEN="your-token-here"');
  console.error('  export GRAFANA_CLOUD_STACK_ID="123456"');
  console.error('  export SYNTHETIC_BASE_URL="https://michalelena.me"');
  exit(1);
}

// Parse probe IDs
const probeIds = GRAFANA_SM_PROBES.split(',').map(id => parseInt(id.trim(), 10));

if (isVerbose) {
  console.log('🔧 Configuration:');
  console.log(`  API URL: ${GRAFANA_SM_API_URL}`);
  console.log(`  Stack ID: ${GRAFANA_CLOUD_STACK_ID}`);
  console.log(`  Base URL: ${SYNTHETIC_BASE_URL}`);
  console.log(`  Probes: [${probeIds.join(', ')}]`);
  console.log(`  Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'APPLY (live changes)'}`);
  console.log('');
}

// HTTP client wrapper
async function apiRequest(method, path, body = null) {
  const url = `${GRAFANA_SM_API_URL}${path}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${GRAFANA_SM_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  if (isVerbose) {
    const redactedToken = GRAFANA_SM_ACCESS_TOKEN.substring(0, 8) + '...' + GRAFANA_SM_ACCESS_TOKEN.slice(-4);
    console.log(`📡 ${method} ${path}`);
    if (body && method !== 'GET') {
      console.log(`   Body: ${JSON.stringify(body, null, 2).substring(0, 200)}...`);
    }
  }

  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { rawResponse: text };
    }

    if (!response.ok) {
      if (isVerbose) {
        console.error(`❌ HTTP ${response.status}: ${text}`);
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}\n${text}`);
    }

    if (isVerbose && data) {
      console.log(`✅ ${response.status} OK`);
      if (method === 'GET' && Array.isArray(data)) {
        console.log(`   Found ${data.length} items`);
      }
    }

    return data;
  } catch (error) {
    console.error(`❌ API request failed: ${error.message}`);
    throw error;
  }
}

// Define checks to provision
const checksToProvision = [
  {
    job: 'homepage',
    target: `${SYNTHETIC_BASE_URL}/`,
    frequency: 300000, // 5 minutes in ms
    timeout: 10000,    // 10s
    labels: [
      { name: 'team', value: 'platform' },
      { name: 'env', value: 'prod' },
      { name: 'check_type', value: 'uptime' }
    ],
    settings: {
      http: {
        method: 'GET',
        validStatusCodes: [200],
        failIfSSL: false,
        failIfNotSSL: false,
        noFollowRedirects: false
      }
    }
  },
  {
    job: 'shop',
    target: `${SYNTHETIC_BASE_URL}/shop`,
    frequency: 300000,
    timeout: 10000,
    labels: [
      { name: 'team', value: 'platform' },
      { name: 'env', value: 'prod' },
      { name: 'check_type', value: 'uptime' }
    ],
    settings: {
      http: {
        method: 'GET',
        validStatusCodes: [200],
        failIfSSL: false,
        failIfNotSSL: false,
        noFollowRedirects: false
      }
    }
  },
  {
    job: 'checkout',
    target: `${SYNTHETIC_BASE_URL}/checkout`,
    frequency: 300000,
    timeout: 10000,
    labels: [
      { name: 'team', value: 'platform' },
      { name: 'env', value: 'prod' },
      { name: 'check_type', value: 'uptime' }
    ],
    settings: {
      http: {
        method: 'GET',
        validStatusCodes: [200],
        failIfSSL: false,
        failIfNotSSL: false,
        noFollowRedirects: false
      }
    }
  },
  {
    job: 'api-health',
    target: `${SYNTHETIC_BASE_URL}/api/health`,
    frequency: 300000,
    timeout: 5000,     // 5s for API
    labels: [
      { name: 'team', value: 'platform' },
      { name: 'env', value: 'prod' },
      { name: 'check_type', value: 'api' }
    ],
    settings: {
      http: {
        method: 'GET',
        validStatusCodes: [200],
        failIfSSL: false,
        failIfNotSSL: false,
        noFollowRedirects: false
      }
    }
  },
  {
    job: 'api-search',
    target: `${SYNTHETIC_BASE_URL}/api/search?q=art`,
    frequency: 300000,
    timeout: 5000,
    labels: [
      { name: 'team', value: 'platform' },
      { name: 'env', value: 'prod' },
      { name: 'check_type', value: 'api' }
    ],
    settings: {
      http: {
        method: 'GET',
        validStatusCodes: [200],
        failIfSSL: false,
        failIfNotSSL: false,
        noFollowRedirects: false
      }
    }
  }
];

// Main provisioning logic
async function provisionChecks() {
  console.log('🚀 Starting Synthetic Monitoring check provisioner...\n');

  // Step 1: Discover existing checks
  console.log('📋 Discovering existing checks...');
  let existingChecks = [];
  try {
    existingChecks = await apiRequest('GET', '/api/v1/checks');
    console.log(`✅ Found ${existingChecks.length} existing checks\n`);
  } catch (error) {
    console.error('⚠️  Failed to list existing checks, will attempt to create all checks as new');
    console.error(`   Error: ${error.message}\n`);
  }

  // Index existing checks by job name
  const checksByJob = new Map();
  existingChecks.forEach(check => {
    if (check.job) {
      checksByJob.set(check.job, check);
    }
  });

  if (isVerbose && existingChecks.length > 0) {
    console.log('📊 Existing checks:');
    existingChecks.forEach(check => {
      console.log(`   - ${check.job} (id: ${check.id}, enabled: ${check.enabled})`);
    });
    console.log('');
  }

  // Step 2: Discover available probes
  console.log('🌍 Discovering available probes...');
  let availableProbes = [];
  try {
    availableProbes = await apiRequest('GET', '/api/v1/probes');
    console.log(`✅ Found ${availableProbes.length} probes\n`);
  } catch (error) {
    console.error('⚠️  Failed to list probes, will use configured probe IDs');
    console.error(`   Error: ${error.message}\n`);
  }

  if (isVerbose && availableProbes.length > 0) {
    console.log('📍 Available probes:');
    availableProbes.slice(0, 10).forEach(probe => {
      console.log(`   - [${probe.id}] ${probe.name} (${probe.region}, online: ${probe.online})`);
    });
    if (availableProbes.length > 10) {
      console.log(`   ... and ${availableProbes.length - 10} more`);
    }
    console.log('');
  }

  // Validate probe IDs
  const validProbeIds = availableProbes.length > 0
    ? probeIds.filter(id => availableProbes.some(p => p.id === id))
    : probeIds; // Fallback to configured IDs if probe discovery failed

  if (validProbeIds.length === 0) {
    console.error('❌ No valid probe IDs found. Cannot provision checks.');
    exit(1);
  }

  console.log(`📍 Using probes: [${validProbeIds.join(', ')}]`);
  if (availableProbes.length > 0) {
    validProbeIds.forEach(id => {
      const probe = availableProbes.find(p => p.id === id);
      if (probe) {
        console.log(`   - [${id}] ${probe.name} (${probe.region})`);
      }
    });
  }
  console.log('');

  // Step 3: Provision checks (create or update)
  const results = {
    created: [],
    updated: [],
    skipped: [],
    failed: []
  };

  for (const checkDef of checksToProvision) {
    const existingCheck = checksByJob.get(checkDef.job);
    const checkPayload = {
      ...checkDef,
      enabled: true,
      probes: validProbeIds,
      alertSensitivity: 'medium'
    };

    console.log(`\n🔍 Processing check: ${checkDef.job}`);
    console.log(`   Target: ${checkDef.target}`);
    console.log(`   Frequency: ${checkDef.frequency / 1000}s`);

    if (isDryRun) {
      console.log(`   💡 DRY RUN: Would ${existingCheck ? 'UPDATE' : 'CREATE'} check`);
      if (isVerbose) {
        console.log(`   Payload: ${JSON.stringify(checkPayload, null, 2).substring(0, 300)}...`);
      }
      results.skipped.push(checkDef.job);
      continue;
    }

    try {
      if (existingCheck) {
        // Update existing check
        console.log(`   🔄 Updating existing check (id: ${existingCheck.id})...`);
        const updated = await apiRequest('PUT', `/api/v1/checks/${existingCheck.id}`, checkPayload);
        console.log(`   ✅ Updated successfully`);
        results.updated.push(checkDef.job);
      } else {
        // Create new check
        console.log(`   ➕ Creating new check...`);
        const created = await apiRequest('POST', '/api/v1/checks', checkPayload);
        console.log(`   ✅ Created successfully (id: ${created.id})`);
        results.created.push(checkDef.job);
      }
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      results.failed.push({ job: checkDef.job, error: error.message });
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
  console.log('  1. Verify checks in Grafana Cloud: https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/');
  console.log('  2. Configure alert notification channels (email already configured)');
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
