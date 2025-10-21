# Grafana Synthetic Monitoring - Provisioning

This directory contains scripts to provision Synthetic Monitoring checks via the Grafana Cloud API.

## Prerequisites

You need three secrets configured in GitHub Actions (or set as environment variables locally):

1. **GRAFANA_SM_API_URL** - The Synthetic Monitoring API endpoint
   - Format: `https://synthetic-monitoring-api-<region>.grafana.net`
   - Example: `https://synthetic-monitoring-api-us-east-0.grafana.net`
   - Find yours in: Grafana Cloud → Synthetic Monitoring → Settings → API

2. **GRAFANA_SM_ACCESS_TOKEN** - A Grafana Cloud API token with `Editor` permissions
   - Create at: Grafana Cloud → Administration → API Keys
   - Required scope: `synthetic-monitoring:write`

3. **GRAFANA_CLOUD_STACK_ID** - Your Grafana Cloud stack ID (numeric)
   - Find in: Grafana Cloud → Stack details
   - Or in the URL: `https://<stack-name>.grafana.net` → Stack ID in admin panel

## API Documentation

- [Grafana Synthetic Monitoring HTTP API](https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/manage-via-api/)
- [Provisioning Playbook](https://grafana.com/docs/grafana-cloud/testing/synthetic-monitoring/set-up/provisioning/)
- [API Endpoints Reference](https://github.com/grafana/synthetic-monitoring-api-go-client)

## Usage

### Local Testing (Dry-Run)

```bash
export GRAFANA_SM_API_URL="https://synthetic-monitoring-api-us-east-0.grafana.net"
export GRAFANA_SM_ACCESS_TOKEN="your-token-here"
export GRAFANA_CLOUD_STACK_ID="123456"
export SYNTHETIC_BASE_URL="https://michalelena.me"

# Preview without making changes
node synthetics/grafana/create-checks.js --dry-run --verbose
```

### Apply Changes

```bash
# Run with real API calls (creates/updates checks)
node synthetics/grafana/create-checks.js --verbose

# Or use npm script
npm run syn:grafana:provision
```

### CI/CD

The GitHub Actions workflow (`.github/workflows/synthetics.yml`) automatically provisions checks on:
- Push to `main` or `feature/synthetic-monitoring-clean-v2`
- Manual workflow dispatch
- Scheduled runs (every 2 hours)

## Provisioned Checks

The script provisions 5 HTTP checks:

| Check Name | Target | Frequency | Timeout | Probes |
|-----------|--------|-----------|---------|--------|
| homepage | `GET /` | 5min | 10s | US-East, US-West, EU-West |
| shop | `GET /shop` | 5min | 10s | US-East, US-West, EU-West |
| checkout | `GET /checkout` | 5min | 10s | US-East, US-West, EU-West |
| api-health | `GET /api/health` | 5min | 5s | US-East, US-West, EU-West |
| api-search | `GET /api/search?q=art` | 5min | 5s | US-East, US-West, EU-West |

All checks:
- Run every 300 seconds (5 minutes)
- Use 3 probes for geo-redundancy
- Have labels: `team=platform`, `env=prod`, `check_type=uptime|api`
- Are idempotent (safe to run multiple times)

## Troubleshooting

### 404 Errors

If you see `404 page not found` errors:

1. **Check API URL** - Ensure it's the Synthetic Monitoring API endpoint, not your Grafana instance URL
   ```bash
   # Correct:
   https://synthetic-monitoring-api-us-east-0.grafana.net
   
   # Wrong:
   https://your-stack.grafana.net
   ```

2. **Verify Token Permissions** - Token needs `synthetic-monitoring:write` scope

3. **Check Stack ID** - Must be numeric, find in Grafana Cloud admin panel

### Authentication Failures

- Ensure the token hasn't expired
- Verify the token has `Editor` role for Synthetic Monitoring
- Check that `X-Stack-ID` header matches your stack

### Probe IDs

Default probes: `1,3,8` (US-East, US-West, EU-West)

To use different probes:
```bash
export GRAFANA_SM_PROBES="1,3,5,8"  # Comma-separated probe IDs
```

List available probes:
```bash
curl -H "Authorization: Bearer $GRAFANA_SM_ACCESS_TOKEN" \
     -H "X-Stack-ID: $GRAFANA_CLOUD_STACK_ID" \
     "$GRAFANA_SM_API_URL/api/v1/probes"
```

## Alternative: Grizzly (IaC)

If the HTTP API proves difficult, you can use Grafana's Grizzly CLI:

```bash
# Install
brew install grafana/grafana/grr

# Configure
export GRAFANA_URL="https://$GRAFANA_CLOUD_STACK_ID.grafana.net"
export GRAFANA_SM_URL="$GRAFANA_SM_API_URL"
export GRAFANA_TOKEN="$GRAFANA_SM_ACCESS_TOKEN"

# Apply resources
grr apply synthetics/grizzly/sm -v
```

See: https://grafana.com/docs/grizzly/latest/
