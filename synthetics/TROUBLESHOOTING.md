# Synthetic Monitoring - Troubleshooting 404 Errors

## Current Status

✅ **Environment variables are set correctly in CI**
- Token length: 124 characters (valid Access Policy token)
- Stack ID is configured
- Base URL is configured

❌ **Getting HTTP 404 from `/api/v1/probes`**
- Response: `404 page not found`
- This means the API endpoint is incorrect

## Root Cause

The `GRAFANA_SM_API_URL` secret is pointing to the **wrong endpoint**. The Synthetic Monitoring API has a specific regional URL format that's different from your main Grafana Cloud instance.

### ❌ Wrong URL Patterns

```bash
# Your Grafana Cloud instance (WRONG for SM API)
https://michalelena.grafana.net
https://your-stack-name.grafana.net

# Generic Grafana API (WRONG for SM API)
https://grafana.com/api/...
```

### ✅ Correct URL Pattern

The Synthetic Monitoring API is hosted on **dedicated regional endpoints**:

```bash
# US East (most common)
https://synthetic-monitoring-api-us-east-0.grafana.net

# Global endpoint (fallback)
https://synthetic-monitoring-api.grafana.net
```

## How to Find Your Correct SM API Endpoint

### Method 1: Check Grafana Cloud UI

1. Log into Grafana Cloud
2. Navigate to: **Testing & Synthetic Monitoring** → **Configuration**
3. Look for "API endpoint" or "Synthetic Monitoring API URL"
4. Copy the full URL (should start with `https://synthetic-monitoring-api-`)

### Method 2: Try the Standard Endpoint

Most Grafana Cloud accounts use the US East endpoint. Try this first:

```bash
export GRAFANA_SM_API_URL="https://synthetic-monitoring-api-us-east-0.grafana.net"
```

### Method 3: Test Locally

Use the test script to validate the endpoint:

```bash
# Set your credentials
export GRAFANA_SM_API_TOKEN="glsa_..."
export GRAFANA_CLOUD_STACK_ID="your-stack-id"
export GRAFANA_SM_API_URL="https://synthetic-monitoring-api-us-east-0.grafana.net"

# Test authentication
node synthetics/grafana/test-auth.js
```

Expected output:
```
🔐 Auth Diagnostics

SM API URL: https://synthetic-monitoring-api-us-east-0.grafana.net
Token length: 124
Token prefix: glsa_xxxxx...
Stack ID: your-stack-id

======================================================================
Testing: https://synthetic-monitoring-api-us-east-0.grafana.net/api/v1/probes
======================================================================

🧪 Variant: X-Stack-Id (correct)

📡 Testing: https://synthetic-monitoring-api-us-east-0.grafana.net/api/v1/probes
   Headers: {
  "Authorization": "Bearer glsa_...",
  "X-Stack-Id": "your-stack-id",
  "Content-Type": "application/json"
}
   Status: 200 OK
   Response: [{"id":1,"name":"Atlanta",...}]
```

## Fix Steps

### 1. Update the GitHub Secret

```bash
# Replace with the correct SM API endpoint
gh secret set GRAFANA_SM_API_URL --body "https://synthetic-monitoring-api-us-east-0.grafana.net"
```

### 2. Verify All Secrets

```bash
# Check all secrets are set
gh secret list

# Should show:
# GRAFANA_SM_API_URL          Updated <timestamp>
# GRAFANA_SM_API_TOKEN        Updated <timestamp>
# GRAFANA_CLOUD_STACK_ID      Updated <timestamp>
```

### 3. Test Locally (Optional)

Before pushing to CI, test the provisioning script:

```bash
export GRAFANA_SM_API_URL="https://synthetic-monitoring-api-us-east-0.grafana.net"
export GRAFANA_SM_API_TOKEN="glsa_..."
export GRAFANA_CLOUD_STACK_ID="your-stack-id"
export SYNTHETIC_BASE_URL="https://michalelena.me"

# Dry run
node synthetics/grafana/create-checks.js --dry-run --verbose
```

Expected output:
```
🔧 Configuration:
  Stack ID: your-stack-id
  Base URL: https://michalelena.me
  SM API URL: https://synthetic-monitoring-api-us-east-0.grafana.net
  Token length: 124
  Mode: DRY RUN (no changes)

🚀 Starting Synthetic Monitoring check provisioner...

🌍 Discovering available probes...
📡 GET https://synthetic-monitoring-api-us-east-0.grafana.net/api/v1/probes
   ✅ 200 OK
   Found 10 items

📍 Available probes:
   - [1] Atlanta (us-east, online: true)
   - [3] San Francisco (us-west, online: true)
   ...
```

### 4. Re-run CI

Once the secret is updated, push any change to trigger the workflow:

```bash
# Trigger workflow
git commit --allow-empty -m "test: trigger SM provisioning with corrected API URL"
git push

# Watch the run
gh run watch
```

The **Preflight - SM API probes sanity** step should now show:
```
Base URL: https://synthetic-monitoring-api-us-east-0.grafana.net
Stack ID: your-stack-id
Token length: 124
Full endpoint: https://synthetic-monitoring-api-us-east-0.grafana.net/api/v1/probes

HTTP 200 from /api/v1/probes
✅ Preflight passed
```

## Common Pitfalls

### ❌ Using Main Grafana Cloud URL

```bash
# WRONG - This is your Grafana instance, not the SM API
GRAFANA_SM_API_URL="https://michalelena.grafana.net"
GRAFANA_SM_API_URL="https://your-stack.grafana.net"
```

The Synthetic Monitoring API is **separate** from your main Grafana Cloud instance. They use different hostnames.

### ❌ Adding Extra Path Segments

```bash
# WRONG - Don't add /api/v1 to the base URL
GRAFANA_SM_API_URL="https://synthetic-monitoring-api-us-east-0.grafana.net/api/v1"

# CORRECT - Base URL only, script adds /api/v1/* paths
GRAFANA_SM_API_URL="https://synthetic-monitoring-api-us-east-0.grafana.net"
```

### ❌ Wrong Token Type

```bash
# WRONG - This is an API Key, not an Access Policy token
GRAFANA_SM_API_TOKEN="eyJrIjoi..."  # Grafana API Key (starts with eyJr)

# CORRECT - Access Policy token for Synthetic Monitoring
GRAFANA_SM_API_TOKEN="glsa_..."  # Grafana Access Policy token (starts with glsa_)
```

## Reference Documentation

- [Grafana Cloud - Synthetic Monitoring API Access](https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/set-up/configure-api-access/)
- [Synthetic Monitoring API Reference](https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/manage-via-api/)
- [Access Policies (not API Keys)](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/)

## Next Steps After Fix

Once the preflight passes (HTTP 200), the provisioning script will:

1. ✅ Discover available probes (us-east, us-west, eu-west)
2. ✅ List existing checks (if any)
3. ✅ Create/update 5 HTTP checks:
   - `homepage` → `GET /`
   - `shop` → `GET /shop`
   - `checkout` → `GET /checkout`
   - `api-health` → `GET /api/health`
   - `api-search` → `GET /api/search?q=art`
4. ✅ Configure each check with:
   - Frequency: 5 minutes
   - Timeout: 5-10 seconds
   - Probes: 3 regions
   - Labels: `app=artistsite`, `env=prod`

You'll see the checks in **Grafana Cloud → Testing & Synthetic Monitoring → Checks** within a few minutes.
