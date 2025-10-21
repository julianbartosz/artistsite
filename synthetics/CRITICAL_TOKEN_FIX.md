# 🚨 CRITICAL: Wrong Token Type Detected

## The Problem

The preflight logs show:
```
Token prefix: eyJrIjoiOT...
Token length: 124
```

**This is a Grafana API Key, NOT an Access Policy token!**

### Token Type Comparison

| Type | Prefix | Works with SM API? | Where to Create |
|------|--------|-------------------|-----------------|
| ❌ **API Key** | `eyJr...` | **NO** | Home → Administration → API Keys |
| ✅ **Access Policy Token** | `glsa_...` | **YES** | Home → Administration → Access Policies |

## How to Fix

### Step 1: Create Access Policy Token

1. Log into Grafana Cloud: https://grafana.com
2. Navigate to: **Home → Administration → Access Policies**
3. Click: **"Create access policy"**
4. Configure:
   - **Name**: `Synthetic Monitoring CI`
   - **Scope**: `synthetics:write` (or `synthetics:read` + `synthetics:write`)
5. Click: **"Create"**
6. Click: **"Add token"**
   - **Token name**: `GitHub Actions`
   - Click **"Create"**
7. **COPY THE TOKEN** - it will start with `glsa_`

### Step 2: Update GitHub Secret

```bash
# Replace the API Key with the Access Policy token
gh secret set GRAFANA_SM_API_TOKEN --body "glsa_YOUR_NEW_TOKEN_HERE"

# Verify it was updated
gh secret list
```

### Step 3: Verify

The token should:
- ✅ Start with `glsa_`
- ✅ Have scope `synthetics:write`
- ✅ Be created under "Access Policies", NOT "API Keys"

### Step 4: Test

Push to trigger workflow:

```bash
git commit --allow-empty -m "test: verify with Access Policy token"
git push
gh run watch
```

Expected preflight output:
```
Token prefix: glsa_XXXXX...
Token length: ~180-250 characters
HTTP 200 from /api/v1/probes
✅ Preflight passed
```

## Why API Keys Don't Work

- **API Keys** (`eyJr...`): For Grafana instance APIs (dashboards, datasources, etc.)
- **Access Policy Tokens** (`glsa_...`): For Grafana Cloud APIs (Synthetic Monitoring, k6 Cloud, etc.)

The Synthetic Monitoring API requires **Access Policy tokens** with the correct scope.

## Current Status

✅ URL is correct: `https://synthetic-monitoring-api-us-east...`  
❌ Token type is wrong: API Key instead of Access Policy token

Once you replace the token, everything should work immediately!
