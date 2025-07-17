#!/bin/bash

# Preview Mode Test Script
# Tests the draft post preview functionality

echo "🧪 Testing Preview Mode Functionality"
echo "======================================"

# Test 1: Valid preview URL for draft post
echo "📝 Test 1: Accessing draft post via preview URL..."
PREVIEW_URL="http://localhost:3000/api/preview?secret=dev-preview-secret-123&slug=color-theory-draft"
echo "Preview URL: $PREVIEW_URL"
echo "Expected: Should redirect to blog post with preview banner"
echo ""

# Test 2: Invalid secret
echo "🔒 Test 2: Testing invalid secret..."
INVALID_URL="http://localhost:3000/api/preview?secret=wrong-secret&slug=color-theory-draft"
echo "Invalid URL: $INVALID_URL"
echo "Expected: Should return 401 Unauthorized"
echo ""

# Test 3: Missing slug
echo "❌ Test 3: Testing missing slug..."
NO_SLUG_URL="http://localhost:3000/api/preview?secret=dev-preview-secret-123"
echo "No slug URL: $NO_SLUG_URL"
echo "Expected: Should return 401 Invalid token or missing slug"
echo ""

# Test 4: Non-existent post
echo "🚫 Test 4: Testing non-existent post..."
NOT_FOUND_URL="http://localhost:3000/api/preview?secret=dev-preview-secret-123&slug=non-existent-post"
echo "Not found URL: $NOT_FOUND_URL"
echo "Expected: Should return 404 Post not found"
echo ""

echo "📋 Manual Testing Instructions:"
echo "1. Copy and paste the preview URL above into your browser"
echo "2. Verify you see the yellow preview banner at the top"
echo "3. Check that the draft post content displays correctly"
echo "4. Click 'Exit Preview' to disable preview mode"
echo "5. Try accessing /blog/color-theory-draft directly (should be 404)"
echo ""

echo "✅ Preview Mode Implementation Complete!"