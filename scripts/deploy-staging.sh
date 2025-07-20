#!/bin/bash
set -e

echo "🚀 Starting deployment to staging environment..."

# Build and tag the image
echo "📦 Building Docker image..."
docker build -t artistsite:staging .

# Tag for registry
docker tag artistsite:staging ghcr.io/artistsite/artistsite:staging

# Push to registry
echo "📤 Pushing to container registry..."
docker push ghcr.io/artistsite/artistsite:staging

# Deploy to staging
echo "🚁 Deploying to Azure Container Instances..."
az container create \
  --resource-group $AZURE_RG \
  --name artistsite-staging \
  --image ghcr.io/artistsite/artistsite:staging \
  --dns-name-label artistsite-staging \
  --ports 3000 \
  --environment-variables \
    NODE_ENV=staging \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$STAGING_STRIPE_PUBLISHABLE_KEY \
  --secure-environment-variables \
    STRIPE_SECRET_KEY=$STAGING_STRIPE_SECRET_KEY \
    MAILCHIMP_API_KEY=$STAGING_MAILCHIMP_API_KEY \
    MAILCHIMP_LIST_ID=$STAGING_MAILCHIMP_LIST_ID \
  --restart-policy Always

# Wait for deployment and run health check
echo "⏳ Waiting for deployment..."
sleep 30

echo "🔍 Running health check..."
HEALTH_URL="https://artistsite-staging.eastus.azurecontainer.io/api/health"
if curl -f $HEALTH_URL; then
  echo "✅ Staging deployment successful!"
  echo "🌐 Staging URL: https://artistsite-staging.eastus.azurecontainer.io"
else
  echo "❌ Health check failed!"
  exit 1
fi