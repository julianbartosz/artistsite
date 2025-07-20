# CI/CD & Deployment Documentation

## Overview
This document outlines the comprehensive CI/CD pipeline and deployment strategy for the Artist Site project, covering automated testing, security scanning, containerization, and multi-environment deployments.

## Pipeline Architecture

### 🔄 Workflow Stages
1. **Quality Gates** - Linting, type checking, testing with coverage
2. **Security Scanning** - npm audit, Trivy vulnerability scanning
3. **Build & Test** - Application build and artifact creation
4. **Docker Build** - Multi-platform container creation with security scanning
5. **Performance Testing** - Lighthouse CI performance validation
6. **Deployment** - Automated staging/production deployments
7. **Monitoring** - Health checks and error tracking

### 🌍 Environments

#### Development
- **Branch**: `feature/*`, `dev/*`
- **Triggers**: Pull requests to main
- **Actions**: Quality gates, security scanning, performance testing
- **Access**: Local development, GitHub Actions runners

#### Staging
- **Branch**: `develop`
- **Triggers**: Push to develop branch
- **URL**: `https://staging.artistsite.com`
- **Actions**: Full pipeline + deployment to Azure Container Instances
- **Purpose**: Pre-production testing, stakeholder reviews

#### Production
- **Branch**: `main`
- **Triggers**: GitHub releases (tags)
- **URL**: `https://artistsite.com`
- **Actions**: Full pipeline + production deployment
- **Purpose**: Live customer-facing application

## Deployment Process

### Prerequisites
1. **Azure CLI** installed and authenticated
2. **Docker** installed for local testing
3. **GitHub Secrets** configured (see Environment Variables section)
4. **Azure Resource Group** created for container deployments

### Environment Variables & Secrets
Required GitHub repository secrets:

```bash
# Azure Configuration
AZURE_RG=artistsite-resources

# Staging Environment
STAGING_STRIPE_PUBLISHABLE_KEY=pk_test_...
STAGING_STRIPE_SECRET_KEY=sk_test_...
STAGING_MAILCHIMP_API_KEY=...
STAGING_MAILCHIMP_LIST_ID=...

# Production Environment
PROD_STRIPE_PUBLISHABLE_KEY=pk_live_...
PROD_STRIPE_SECRET_KEY=sk_live_...
PROD_MAILCHIMP_API_KEY=...
PROD_MAILCHIMP_LIST_ID=...

# Monitoring & Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
LHCI_GITHUB_APP_TOKEN=...
```

### Manual Deployment Commands

#### Local Development
```bash
# Start development server
npm run dev

# Build and test locally
npm run build
npm run test:coverage

# Local Docker testing
npm run docker:build
npm run docker:run
```

#### Staging Deployment
```bash
# Deploy to staging (requires Azure CLI auth)
npm run deploy:staging

# Test staging deployment
curl -f https://staging.artistsite.com/api/health
```

#### Production Deployment
```bash
# Deploy to production (requires clean main branch)
npm run deploy:production

# Verify production deployment
curl -f https://artistsite.com/api/health
```

## Monitoring & Health Checks

### Health Endpoint
- **URL**: `/api/health`
- **Method**: GET
- **Response**: System metrics, service status, performance data

### Error Tracking
- **URL**: `/api/errors`
- **Methods**: GET (retrieve), POST (report)
- **Features**: Error aggregation, filtering, monitoring integration

### Performance Monitoring
- **Lighthouse CI**: Automated performance testing on PRs
- **Metrics**: Performance, Accessibility, Best Practices, SEO scores
- **Thresholds**: Performance ≥85%, Accessibility ≥95%, SEO ≥95%

## Security Features

### Container Security
- Multi-stage Docker builds
- Non-root user execution
- Vulnerability scanning with Trivy
- Minimal Alpine Linux base images

### Application Security
- Rate limiting via Nginx
- Security headers (HSTS, CSP, etc.)
- Input validation and sanitization
- Environment variable isolation

### CI/CD Security
- Dependency vulnerability scanning
- Secret management via GitHub Secrets
- Signed container images
- Audit trails for all deployments

## Troubleshooting

### Common Issues

#### Deployment Failures
```bash
# Check Azure container logs
az container logs --resource-group $AZURE_RG --name artistsite-staging

# Verify environment variables
az container show --resource-group $AZURE_RG --name artistsite-staging --query environmentVariables
```

#### Health Check Failures
```bash
# Test health endpoint
curl -v https://staging.artistsite.com/api/health

# Check error logs
curl https://staging.artistsite.com/api/errors
```

#### Performance Issues
```bash
# Run local Lighthouse audit
npm run lighthouse:ci

# Check system metrics
curl https://artistsite.com/api/health | jq '.memory'
```

### Rollback Procedures

#### Staging Rollback
```bash
# Redeploy previous version
az container restart --resource-group $AZURE_RG --name artistsite-staging
```

#### Production Rollback
```bash
# Deploy previous stable version
git checkout <previous-release-tag>
npm run deploy:production
```

## Monitoring Dashboard URLs

### Development Tools
- **GitHub Actions**: Repository > Actions tab
- **Code Coverage**: `coverage/lcov-report/index.html`
- **Lighthouse Reports**: GitHub Actions artifacts

### Production Monitoring
- **Health Status**: `https://artistsite.com/api/health`
- **Error Tracking**: `https://artistsite.com/api/errors`
- **Azure Portal**: Container Instances dashboard

## Performance Benchmarks

### Target Metrics
- **Response Time**: < 200ms (API), < 1s (pages)
- **Lighthouse Performance**: ≥ 85/100
- **Lighthouse Accessibility**: ≥ 95/100
- **Memory Usage**: < 512MB normal operation
- **Error Rate**: < 0.1% of requests

### Load Testing
```bash
# Basic load test
curl -w "@curl-format.txt" -s -o /dev/null https://artistsite.com/

# Concurrent requests test
ab -n 100 -c 10 https://artistsite.com/
```

## Next Steps & Improvements

### Phase 1 (Current)
- ✅ Automated CI/CD pipeline
- ✅ Multi-environment deployments
- ✅ Health monitoring
- ✅ Error tracking

### Phase 2 (Future)
- [ ] Database integration and monitoring
- [ ] Advanced caching strategies
- [ ] Blue-green deployments
- [ ] Automated performance regression detection
- [ ] Enhanced security scanning (SAST/DAST)

### Phase 3 (Advanced)
- [ ] Multi-region deployments
- [ ] Auto-scaling based on metrics
- [ ] Advanced observability (APM)
- [ ] Chaos engineering practices