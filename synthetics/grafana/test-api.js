#!/usr/bin/env node
/**
 * Grafana Synthetic Monitoring API - Connection Tester
 * 
 * Tests connectivity and authentication to the Synthetic Monitoring API.
 * Run this to diagnose 404 errors before provisioning checks.
 */

const {
  GRAFANA_SM_API_URL,
  GRAFANA_SM_ACCESS_TOKEN,
  GRAFANA_CLOUD_STACK_ID
} = process.env;

if (!GRAFANA_SM_API_URL || !GRAFANA_SM_ACCESS_TOKEN || !GRAFANA_CLOUD_STACK_ID) {
  console.error('❌ Missing required environment variables');
  console.error('   Set: GRAFANA_SM_API_URL, GRAFANA_SM_ACCESS_TOKEN, GRAFANA_CLOUD_STACK_ID');
  process.exit(1);
}

console.log('🔧 Testing Grafana Synthetic Monitoring API...\n');
console.log(`API URL: ${GRAFANA_SM_API_URL}`);
console.log(`Stack ID: ${GRAFANA_CLOUD_STACK_ID}`);
console.log(`Token: ${GRAFANA_SM_ACCESS_TOKEN.substring(0, 8)}...${GRAFANA_SM_ACCESS_TOKEN.slice(-4)}\n`);

async function testEndpoint(name, path, method = 'GET') {
  const url = `${GRAFANA_SM_API_URL}${path}`;
  console.log(`\n📡 Testing: ${name}`);
  console.log(`   ${method} ${url}`);
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${GRAFANA_SM_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Stack-ID': GRAFANA_CLOUD_STACK_ID
      }
    });
    
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { rawText: text };
    }
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log(`   ✅ Success!`);
      if (Array.isArray(data)) {
        console.log(`   Found ${data.length} items`);
        if (data.length > 0 && data.length <= 3) {
          console.log(`   Sample: ${JSON.stringify(data[0], null, 2).substring(0, 200)}...`);
        }
      } else if (data) {
        console.log(`   Response: ${JSON.stringify(data, null, 2).substring(0, 300)}...`);
      }
      return true;
    } else {
      console.log(`   ❌ Failed: ${text.substring(0, 200)}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  const tests = [
    ['Health Check', '/'],
    ['List Probes', '/api/v1/probes'],
    ['List Checks', '/api/v1/checks'],
    ['List Tenants', '/api/v1/tenants'],
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const [name, path] of tests) {
    const success = await testEndpoint(name, path);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Test Summary: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  
  if (failed > 0) {
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Verify API URL is the Synthetic Monitoring endpoint:');
    console.log('      https://synthetic-monitoring-api-<region>.grafana.net');
    console.log('   2. Check token has "synthetic-monitoring:write" scope');
    console.log('   3. Verify Stack ID is correct (numeric)');
    console.log('   4. Try curl manually to test authentication:');
    console.log(`\n      curl -H "Authorization: Bearer $TOKEN" \\`);
    console.log(`           -H "X-Stack-ID: ${GRAFANA_CLOUD_STACK_ID}" \\`);
    console.log(`           "${GRAFANA_SM_API_URL}/api/v1/probes"`);
    console.log('\n   5. Consider using Grizzly CLI as fallback:');
    console.log('      https://grafana.com/docs/grizzly/latest/\n');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
