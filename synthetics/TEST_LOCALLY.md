# Testing SM API Endpoint

Since the workflow is still getting 404s after you updated the secret, let's verify the exact URL format.

## Quick Test Commands

Run these locally with your real credentials:

```bash
# Set your credentials (replace with actual values)
export GRAFANA_SM_API_TOKEN="glsa_..."  # Your Access Policy token
export GRAFANA_CLOUD_STACK_ID="your-stack-id"  # Your stack slug or ID

# Test 1: US East endpoint (most common)
export GRAFANA_SM_API_URL="https://synthetic-monitoring-api-us-east-0.grafana.net"
./synthetics/grafana/test-endpoint.sh

# If that fails, test 2: Global endpoint
export GRAFANA_SM_API_URL="https://synthetic-monitoring-api.grafana.net"
./synthetics/grafana/test-endpoint.sh

# If both fail, test 3: EU endpoint
export GRAFANA_SM_API_URL="https://synthetic-monitoring-api-eu-west-0.grafana.net"
./synthetics/grafana/test-endpoint.sh
```

## Expected Success Output

```
🔍 Synthetic Monitoring API Endpoint Test

Configuration:
  Base URL: https://synthetic-monitoring-api-us-east-0.grafana.net
  Stack ID: your-stack-id
  Token length: 124

Testing: https://synthetic-monitoring-api-us-east-0.grafana.net/api/v1/probes

HTTP Status: 200

✅ Success! API endpoint is correct.

First probe:
{
  "id": 1,
  "name": "Atlanta",
  "region": "us-east",
  "online": true,
  ...
}

Total probes: 10
```

## What to Check in Grafana Cloud UI

1. **Log into Grafana Cloud**: https://grafana.com
2. **Navigate to**: Testing & Synthetic Monitoring → Configuration
3. **Look for**: "API Access" or "API Endpoint" section
4. **Copy**: The exact URL shown (should be `https://synthetic-monitoring-api-*.grafana.net`)

## Update GitHub Secret

Once you find the correct URL:

```bash
# Update the secret with the EXACT URL from Grafana Cloud UI
gh secret set GRAFANA_SM_API_URL --body "https://synthetic-monitoring-api-us-east-0.grafana.net"

# Verify it was set
gh secret list
```

## Alternative: Check with API

If you have access to Grafana Cloud API, you can query for the SM endpoint:

```bash
# Using your Grafana Cloud credentials
curl -H "Authorization: Bearer $GRAFANA_CLOUD_API_KEY" \
  "https://grafana.com/api/instances/$GRAFANA_CLOUD_STACK_ID"
```

The response should include the SM API endpoint URL.
