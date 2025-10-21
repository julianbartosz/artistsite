# Grafana Synthetic Monitoring - Provisioning

This directory contains scripts to provision Synthetic Monitoring checks via the Grafana Cloud API.

## Prerequisites

### 1. Create Access Policy Token

Navigate to **Grafana Cloud → Home → Administration → Access Policies**:

1. Click **"Create access policy"**
2. Name: `Synthetic Monitoring CI`
3. Add scope: **`synthetics:write`** (or `synthetics:read` + `synthetics:write`)
4. Click **"Create"**, then **"Add token"**
5. Name: `GitHub Actions`
6. Click **"Create"** and **copy the token** (starts with `glsa_...`)

⚠️ **Important**: This is different from API Keys. Use Access Policies, not API Keys.

### 2. Find Your Stack ID

**Method 1** - From URL when logged into Grafana Cloud:
- Look at the browser URL: `https://grafana.com/orgs/<YOUR_STACK_ID>`

**Method 2** - From Synthetic Monitoring Settings:
- Navigate to: **Home → Testing & Synthetic Monitoring → Configuration**
- Look for "Stack" or "Org ID" in the settings panel

### 3. Configure GitHub Secrets

Run these commands (requires `gh` CLI):

```bash
# Set the Access Policy token (starts with glsa_)
gh secret set GRAFANA_SM_ACCESS_TOKEN --body "glsa_YOUR_ACTUAL_TOKEN_HERE"

# Set your Grafana Cloud stack ID (slug or numeric ID)
gh secret set GRAFANA_CLOUD_STACK_ID --body "your-stack-id"

# Set the base URL to monitor
gh secret set SYNTHETIC_BASE_URL --body "https://michalelena.me"

# Optional: Set specific API endpoint (has automatic fallback)
gh secret set GRAFANA_SM_API_URL --body "https://synthetic-monitoring-api-us-east-0.grafana.net"
```

### 4. Verify Setup

Test authentication locally before pushing to CI:

```bash
export GRAFANA_SM_ACCESS_TOKEN="glsa_..."
export GRAFANA_CLOUD_STACK_ID="your-stack-id"
export SYNTHETIC_BASE_URL="https://michalelena.me"

# Run authentication diagnostic
node synthetics/grafana/test-auth.js

# If successful, try dry-run
node synthetics/grafana/create-checks.js --dry-run --verbose
```

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
