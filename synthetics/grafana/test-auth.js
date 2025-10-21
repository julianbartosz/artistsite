#!/usr/bin/env node
/**
 * Test authentication with Grafana Synthetic Monitoring API
 * Helps diagnose 404 errors by testing different token/header combinations
 */

const { GRAFANA_SM_ACCESS_TOKEN, GRAFANA_CLOUD_STACK_ID } = process.env;

if (!GRAFANA_SM_ACCESS_TOKEN || !GRAFANA_CLOUD_STACK_ID) {
  console.error('❌ Missing GRAFANA_SM_ACCESS_TOKEN or GRAFANA_CLOUD_STACK_ID');
  process.exit(1);
}

console.log('🔐 Auth Diagnostics\n');
console.log(`Token length: ${GRAFANA_SM_ACCESS_TOKEN.length}`);
console.log(`Token prefix: ${GRAFANA_SM_ACCESS_TOKEN.substring(0, 10)}...`);
console.log(`Stack ID: ${GRAFANA_CLOUD_STACK_ID}`);
console.log('');

async function testEndpoint(baseUrl, headers) {
  const url = `${baseUrl}/api/v1/probes`;
  console.log(`\n📡 Testing: ${url}`);
  console.log(`   Headers:`, JSON.stringify(headers, null, 2));
  
  try {
    const response = await fetch(url, { method: 'GET', headers });
    const text = await response.text();
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response: ${text.substring(0, 200)}`);
    
    return response.ok;
  } catch (error) {
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  const bases = [
    'https://synthetic-monitoring-api-us-east-0.grafana.net',
    'https://synthetic-monitoring-api.grafana.net'
  ];
  
  const headerVariants = [
    {
      name: 'X-Stack-Id (correct)',
      headers: {
        'Authorization': `Bearer ${GRAFANA_SM_ACCESS_TOKEN}`,
        'X-Stack-Id': GRAFANA_CLOUD_STACK_ID,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'X-Stack-ID (wrong casing)',
      headers: {
        'Authorization': `Bearer ${GRAFANA_SM_ACCESS_TOKEN}`,
        'X-Stack-ID': GRAFANA_CLOUD_STACK_ID,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'No X-Stack header',
      headers: {
        'Authorization': `Bearer ${GRAFANA_SM_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  ];
  
  for (const base of bases) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing: ${base}`);
    console.log('='.repeat(70));
    
    for (const variant of headerVariants) {
      console.log(`\n🧪 Variant: ${variant.name}`);
      await testEndpoint(base, variant.headers);
    }
  }
  
  console.log('\n\n💡 Troubleshooting tips:');
  console.log('  1. Verify token has "Synthetic Monitoring" scope in Grafana Cloud');
  console.log('  2. Ensure Stack ID matches your Grafana Cloud organization');
  console.log('  3. Check if your organization uses a custom SM API endpoint');
  console.log('  4. Try creating a new Access Policy token with SM permissions\n');
}

runTests().catch(console.error);
