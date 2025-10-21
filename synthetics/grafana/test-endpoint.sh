#!/bin/bash
# Quick test to verify SM API endpoint without running full provisioning

set -e

echo "🔍 Synthetic Monitoring API Endpoint Test"
echo ""

if [ -z "$GRAFANA_SM_API_URL" ]; then
  echo "❌ GRAFANA_SM_API_URL not set"
  echo ""
  echo "Set it to your SM API endpoint:"
  echo "  export GRAFANA_SM_API_URL='https://synthetic-monitoring-api-us-east-0.grafana.net'"
  echo ""
  echo "Or try the global endpoint:"
  echo "  export GRAFANA_SM_API_URL='https://synthetic-monitoring-api.grafana.net'"
  exit 1
fi

if [ -z "$GRAFANA_SM_API_TOKEN" ]; then
  echo "❌ GRAFANA_SM_API_TOKEN not set"
  exit 1
fi

if [ -z "$GRAFANA_CLOUD_STACK_ID" ]; then
  echo "❌ GRAFANA_CLOUD_STACK_ID not set"
  exit 1
fi

echo "Configuration:"
echo "  Base URL: $GRAFANA_SM_API_URL"
echo "  Stack ID: $GRAFANA_CLOUD_STACK_ID"
echo "  Token length: ${#GRAFANA_SM_API_TOKEN}"
echo ""

# Test the endpoint
endpoint="$GRAFANA_SM_API_URL/api/v1/probes"
echo "Testing: $endpoint"
echo ""

response=$(curl -sS -w "\n%{http_code}" \
  -H "Authorization: Bearer $GRAFANA_SM_API_TOKEN" \
  -H "X-Stack-Id: $GRAFANA_CLOUD_STACK_ID" \
  "$endpoint")

body=$(echo "$response" | head -n -1)
status=$(echo "$response" | tail -n 1)

echo "HTTP Status: $status"
echo ""

if [ "$status" = "200" ]; then
  echo "✅ Success! API endpoint is correct."
  echo ""
  echo "First probe:"
  echo "$body" | jq '.[0] // {}' 2>/dev/null || echo "$body"
  echo ""
  echo "Total probes: $(echo "$body" | jq 'length' 2>/dev/null || echo 'N/A')"
  exit 0
else
  echo "❌ Failed with HTTP $status"
  echo ""
  echo "Response body:"
  echo "$body"
  echo ""
  echo "Troubleshooting:"
  if [ "$status" = "401" ]; then
    echo "  - Token is invalid or expired"
    echo "  - Check that token has 'synthetics:write' scope"
    echo "  - Verify Stack ID matches your Grafana Cloud org"
  elif [ "$status" = "404" ]; then
    echo "  - URL is incorrect or pointing to wrong service"
    echo "  - Must be: https://synthetic-monitoring-api-<region>.grafana.net"
    echo "  - NOT: https://<stack>.grafana.net (your Grafana instance)"
    echo ""
    echo "Try these endpoints:"
    echo "  - https://synthetic-monitoring-api-us-east-0.grafana.net"
    echo "  - https://synthetic-monitoring-api.grafana.net"
  fi
  exit 1
fi
