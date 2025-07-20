#!/bin/bash
set -e

echo "🚀 Starting deployment to production environment..."

# Ensure we're on the main branch
if [ "$(git branch --show-current)" != "main" ]; then
  echo "❌ Production deployments must be from main branch"
  exit 1
fi

# Ensure working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Working directory must be clean for production deployment"
  exit 1
fi

# Get version from package.json or use git tag
VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "latest")
echo "📦 Deploying version: $VERSION"

# Build and tag the image
echo "📦 Building Docker image..."
docker build -t artistsite:$VERSION .

# Tag for registry
docker tag artistsite:$VERSION ghcr.io/artistsite/artistsite:$VERSION
docker tag artistsite:$VERSION ghcr.io/artistsite/artistsite:latest

# Push to registry
echo "📤 Pushing to container registry..."
docker push ghcr.io/artistsite/artistsite:$VERSION
docker push ghcr.io/artistsite/artistsite:latest

# Deploy to production
echo "🚁 Deploying to Azure Container Instances..."
az container create \
  --resource-group $AZURE_RG \
  --name artistsite-production \
  --image ghcr.io/artistsite/artistsite:$VERSION \
  --dns-name-label artistsite-prod \
  --ports 3000 \
  --cpu 2 \
  --memory 4 \
  --environment-variables \
    NODE_ENV=production \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$PROD_STRIPE_PUBLISHABLE_KEY \
  --secure-environment-variables \
    STRIPE_SECRET_KEY=$PROD_STRIPE_SECRET_KEY \
    MAILCHIMP_API_KEY=$PROD_MAILCHIMP_API_KEY \
    MAILCHIMP_LIST_ID=$PROD_MAILCHIMP_LIST_ID \
  --restart-policy Always

# Wait for deployment and run comprehensive health checks
echo "⏳ Waiting for deployment..."
sleep 60

echo "🔍 Running production health checks..."
HEALTH_URL="https://artistsite-prod.eastus.azurecontainer.io/api/health"
MAIN_URL="https://artistsite-prod.eastus.azurecontainer.io"

# Health check
if curl -f $HEALTH_URL; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed!"
  exit 1
fi

# Main page check
if curl -f $MAIN_URL; then
  echo "✅ Main page accessible"
else
  echo "❌ Main page check failed!"
  exit 1
fi

# API endpoints check
for endpoint in "/api/subscribe" "/api/contact"; do
  if curl -f -X GET "$MAIN_URL$endpoint" > /dev/null 2>&1; then
    echo "✅ API endpoint $endpoint accessible"
  else
    echo "⚠️  API endpoint $endpoint check inconclusive (may require POST)"
  fi
done

echo "🎉 Production deployment successful!"
echo "🌐 Production URL: https://artistsite-prod.eastus.azurecontainer.io"
echo "📊 Version deployed: $VERSION"