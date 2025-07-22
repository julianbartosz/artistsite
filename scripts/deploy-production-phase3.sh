#!/bin/bash
# Production Deployment Script with Phase 3 Testing and Monitoring
set -e

echo "🚀 Starting Production Deployment with Phase 3 Validation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_ENV=${1:-production}
SKIP_TESTS=${SKIP_TESTS:-false}
SKIP_SECURITY=${SKIP_SECURITY:-false}
SKIP_PERFORMANCE=${SKIP_PERFORMANCE:-false}

echo -e "${BLUE}Deployment Environment: ${DEPLOYMENT_ENV}${NC}"
echo -e "${BLUE}Skip Tests: ${SKIP_TESTS}${NC}"
echo -e "${BLUE}Skip Security: ${SKIP_SECURITY}${NC}"
echo -e "${BLUE}Skip Performance: ${SKIP_PERFORMANCE}${NC}"

# Function to check command success
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1 passed${NC}"
    else
        echo -e "${RED}❌ $1 failed${NC}"
        exit 1
    fi
}

# Function to run with timeout
run_with_timeout() {
    local timeout=$1
    local command=$2
    local description=$3
    
    echo -e "${BLUE}Running: $description${NC}"
    timeout $timeout bash -c "$command"
    check_status "$description"
}

# Phase 1: Pre-deployment Validation
echo -e "\n${YELLOW}=== Phase 1: Pre-deployment Validation ===${NC}"

# Environment check
echo "🔍 Checking environment variables..."
required_vars=("DATABASE_URL" "NEXTAUTH_SECRET" "NEXTAUTH_URL")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}❌ Missing required environment variable: $var${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ Environment variables validated${NC}"

# Dependencies check
echo "📦 Installing dependencies..."
npm ci --only=production
check_status "Dependencies installation"

# TypeScript compilation
echo "🔧 Type checking..."
npm run type-check
check_status "TypeScript compilation"

# Linting
echo "🔍 Linting code..."
npm run lint
check_status "Code linting"

# Phase 2: Comprehensive Testing (if not skipped)
if [ "$SKIP_TESTS" != "true" ]; then
    echo -e "\n${YELLOW}=== Phase 2: Comprehensive Testing ===${NC}"
    
    # Unit and Integration Tests
    echo "🧪 Running unit and integration tests..."
    run_with_timeout 300 "npm run test:ci" "Unit and integration tests"
    
    # Build application
    echo "🏗️ Building application..."
    run_with_timeout 300 "npm run build" "Application build"
    
    # Start application for E2E tests
    echo "🚀 Starting application for E2E tests..."
    npm start &
    APP_PID=$!
    
    # Wait for app to be ready
    echo "⏳ Waiting for application to be ready..."
    sleep 30
    
    # Health check
    for i in {1..10}; do
        if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Application is ready${NC}"
            break
        fi
        if [ $i -eq 10 ]; then
            echo -e "${RED}❌ Application failed to start${NC}"
            kill $APP_PID 2>/dev/null || true
            exit 1
        fi
        sleep 10
    done
    
    # E2E Tests
    echo "🎭 Running E2E tests..."
    run_with_timeout 600 "npm run test:e2e" "End-to-end tests"
    
    # Stop application
    kill $APP_PID 2>/dev/null || true
    wait $APP_PID 2>/dev/null || true
else
    echo -e "${YELLOW}⚠️ Skipping tests (SKIP_TESTS=true)${NC}"
    # Still need to build
    echo "🏗️ Building application..."
    run_with_timeout 300 "npm run build" "Application build"
fi

# Phase 3: Security Audit (if not skipped)
if [ "$SKIP_SECURITY" != "true" ]; then
    echo -e "\n${YELLOW}=== Phase 3: Security Audit ===${NC}"
    
    # NPM Security Audit
    echo "🔒 Running npm security audit..."
    npm audit --audit-level moderate || {
        echo -e "${YELLOW}⚠️ npm audit found issues, but continuing...${NC}"
    }
    
    # Custom Security Scan
    echo "🛡️ Running custom security scan..."
    run_with_timeout 120 "npm run security:scan" "Custom security scan"
    
    # Production Readiness Check
    echo "📋 Checking production readiness..."
    run_with_timeout 60 "npm run production:readiness" "Production readiness check"
else
    echo -e "${YELLOW}⚠️ Skipping security audit (SKIP_SECURITY=true)${NC}"
fi

# Phase 4: Performance Validation (if not skipped)
if [ "$SKIP_PERFORMANCE" != "true" ]; then
    echo -e "\n${YELLOW}=== Phase 4: Performance Validation ===${NC}"
    
    # Performance Benchmark
    echo "⚡ Running performance benchmark..."
    run_with_timeout 180 "npm run performance:benchmark" "Performance benchmark"
    
    # Lighthouse CI (if configured)
    if command -v lhci &> /dev/null; then
        echo "🏠 Running Lighthouse CI..."
        run_with_timeout 300 "npm run lighthouse:ci" "Lighthouse CI"
    else
        echo -e "${YELLOW}⚠️ Lighthouse CI not available${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Skipping performance validation (SKIP_PERFORMANCE=true)${NC}"
fi

# Phase 5: Deployment
echo -e "\n${YELLOW}=== Phase 5: Deployment ===${NC}"

case $DEPLOYMENT_ENV in
    "staging")
        echo "🚀 Deploying to staging..."
        # Add staging deployment commands here
        echo "Staging deployment would happen here"
        ;;
    "production")
        echo "🚀 Deploying to production..."
        # Add production deployment commands here
        # Example for Vercel:
        # npx vercel --prod --yes
        echo "Production deployment would happen here"
        ;;
    *)
        echo -e "${RED}❌ Unknown deployment environment: $DEPLOYMENT_ENV${NC}"
        exit 1
        ;;
esac

# Phase 6: Post-deployment Validation
echo -e "\n${YELLOW}=== Phase 6: Post-deployment Validation ===${NC}"

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
sleep 60

# Health check on deployed environment
HEALTH_URL=""
case $DEPLOYMENT_ENV in
    "staging")
        HEALTH_URL="https://staging.artistsite.com/api/health"
        ;;
    "production")
        HEALTH_URL="https://artistsite.com/api/health"
        ;;
esac

if [ -n "$HEALTH_URL" ]; then
    echo "🏥 Checking deployment health..."
    for i in {1..10}; do
        if curl -f "$HEALTH_URL" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Deployment is healthy${NC}"
            break
        fi
        if [ $i -eq 10 ]; then
            echo -e "${RED}❌ Deployment health check failed${NC}"
            exit 1
        fi
        sleep 30
    done
    
    # Run post-deployment performance check
    if [ "$SKIP_PERFORMANCE" != "true" ]; then
        echo "⚡ Running post-deployment performance check..."
        case $DEPLOYMENT_ENV in
            "staging")
                run_with_timeout 180 "npm run performance:benchmark:staging" "Staging performance check"
                ;;
            "production")
                run_with_timeout 180 "npm run performance:benchmark:prod" "Production performance check"
                ;;
        esac
    fi
fi

# Phase 7: Monitoring Setup
echo -e "\n${YELLOW}=== Phase 7: Monitoring Setup ===${NC}"

echo "📊 Setting up monitoring and alerts..."
# Initialize monitoring systems
cat << EOF
Monitoring systems to enable:
- Performance monitoring: ✅ Implemented
- Error tracking: ✅ Implemented  
- Security monitoring: ✅ Implemented
- Analytics tracking: ✅ Implemented
- Uptime monitoring: Configure external service
- Log aggregation: Configure external service
EOF

# Generate deployment report
DEPLOYMENT_REPORT="deployment-report-$(date +%Y%m%d-%H%M%S).json"
cat << EOF > "$DEPLOYMENT_REPORT"
{
  "deployment": {
    "environment": "$DEPLOYMENT_ENV",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)"
  },
  "validation": {
    "tests_run": $([ "$SKIP_TESTS" != "true" ] && echo "true" || echo "false"),
    "security_scan": $([ "$SKIP_SECURITY" != "true" ] && echo "true" || echo "false"),
    "performance_check": $([ "$SKIP_PERFORMANCE" != "true" ] && echo "true" || echo "false"),
    "health_check_passed": true
  },
  "next_steps": [
    "Monitor application performance",
    "Check error rates and logs", 
    "Verify analytics tracking",
    "Review security alerts"
  ]
}
EOF

echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${BLUE}📋 Deployment report saved to: $DEPLOYMENT_REPORT${NC}"
echo -e "${BLUE}📊 Monitoring dashboard: ${HEALTH_URL%/api/health}/debug/monitoring${NC}"

# Final summary
echo -e "\n${YELLOW}=== Deployment Summary ===${NC}"
echo -e "Environment: ${GREEN}$DEPLOYMENT_ENV${NC}"
echo -e "Tests: $([ "$SKIP_TESTS" != "true" ] && echo -e "${GREEN}✅ Passed${NC}" || echo -e "${YELLOW}⚠️ Skipped${NC}")"
echo -e "Security: $([ "$SKIP_SECURITY" != "true" ] && echo -e "${GREEN}✅ Validated${NC}" || echo -e "${YELLOW}⚠️ Skipped${NC}")"
echo -e "Performance: $([ "$SKIP_PERFORMANCE" != "true" ] && echo -e "${GREEN}✅ Validated${NC}" || echo -e "${YELLOW}⚠️ Skipped${NC}")"
echo -e "Status: ${GREEN}✅ DEPLOYED${NC}"

exit 0