-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "phone" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "company" TEXT,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "shipping" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentIntentId" TEXT,
    "paymentStatus" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "shippingAddressId" TEXT,
    "billingAddressId" TEXT,
    "trackingNumber" TEXT,
    "estimatedDelivery" TIMESTAMP(3),
    "specialInstructions" TEXT,
    "giftMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "productTitle" TEXT NOT NULL,
    "productImage" TEXT NOT NULL,
    "selectedVariant" JSONB,
    "customizations" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTimelineEntry" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT,
    "trackingNumber" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderTimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "productImage" TEXT NOT NULL,
    "productPrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductView" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "productId" TEXT NOT NULL,
    "sessionId" TEXT,
    "source" TEXT,
    "referrer" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAnalytics" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "uniqueViews" INTEGER NOT NULL DEFAULT 0,
    "avgViewTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wishlistAdds" INTEGER NOT NULL DEFAULT 0,
    "cartAdds" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCalculated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchQuery" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "resultCount" INTEGER NOT NULL,
    "clickedResults" JSONB,
    "source" TEXT,
    "filters" JSONB,
    "sortBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRecommendation" (
    "id" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "recommendedProductId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "conversionCount" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductInventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "availableStock" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "minStockLevel" INTEGER NOT NULL DEFAULT 0,
    "maxStockLevel" INTEGER,
    "stockStatus" TEXT NOT NULL DEFAULT 'in_stock',
    "isTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowBackorders" BOOLEAN NOT NULL DEFAULT false,
    "lastRestocked" TIMESTAMP(3),
    "lastSold" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,
    "orderId" TEXT,
    "userId" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "batchNumber" TEXT,
    "expirationDate" TIMESTAMP(3),
    "supplier" TEXT,
    "cost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "orderId" TEXT,
    "cartSessionId" TEXT,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAlert" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "message" TEXT NOT NULL,
    "currentStock" INTEGER NOT NULL,
    "thresholdValue" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "segments" TEXT NOT NULL,
    "behavior_score" INTEGER NOT NULL DEFAULT 0,
    "preferences" TEXT NOT NULL,
    "lifetime_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "engagement_score" INTEGER NOT NULL DEFAULT 0,
    "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT,
    "properties" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "page_url" TEXT,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "segments" TEXT NOT NULL,
    "metrics" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "campaign_id" TEXT,
    "discount_type" TEXT NOT NULL,
    "discount_value" DOUBLE PRECISION NOT NULL,
    "usage_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media_posts" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "postId" TEXT,
    "content" TEXT NOT NULL,
    "mediaUrls" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "engagement" TEXT NOT NULL,
    "campaignId" TEXT,
    "hashtags" TEXT,
    "mentions" TEXT,
    "createdBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_media_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "campaignId" TEXT,
    "type" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "budgetType" TEXT NOT NULL,
    "budgetAmount" DOUBLE PRECISION NOT NULL,
    "bidStrategy" TEXT NOT NULL,
    "bidAmount" DOUBLE PRECISION,
    "adSets" TEXT NOT NULL,
    "creatives" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "performance" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_attribution" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "firstTouch" TEXT NOT NULL,
    "lastTouch" TEXT NOT NULL,
    "touchpoints" TEXT NOT NULL,
    "primaryChannel" TEXT NOT NULL,
    "attribution" TEXT NOT NULL,
    "attributedRevenue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_attribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_budgets" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "allocatedBudget" DOUBLE PRECISION NOT NULL,
    "spentBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetRevenue" DOUBLE PRECISION,
    "actualRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetRoi" DOUBLE PRECISION,
    "actualRoi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CustomerProfileToEmailCampaign" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CustomerProfileToEmailCampaign_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_userId_productId_key" ON "WishlistItem"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAnalytics_productId_key" ON "ProductAnalytics"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRecommendation_sourceProductId_recommendedProductId__key" ON "ProductRecommendation"("sourceProductId", "recommendedProductId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ProductInventory_productId_key" ON "ProductInventory"("productId");

-- CreateIndex
CREATE INDEX "StockReservation_expiresAt_idx" ON "StockReservation"("expiresAt");

-- CreateIndex
CREATE INDEX "StockReservation_status_idx" ON "StockReservation"("status");

-- CreateIndex
CREATE INDEX "StockAlert_isActive_productId_idx" ON "StockAlert"("isActive", "productId");

-- CreateIndex
CREATE INDEX "StockAlert_type_severity_idx" ON "StockAlert"("type", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_email_key" ON "customer_profiles"("email");

-- CreateIndex
CREATE INDEX "analytics_events_event_name_idx" ON "analytics_events"("event_name");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_idx" ON "analytics_events"("user_id");

-- CreateIndex
CREATE INDEX "analytics_events_session_id_idx" ON "analytics_events"("session_id");

-- CreateIndex
CREATE INDEX "analytics_events_timestamp_idx" ON "analytics_events"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "social_media_posts_platform_publishedAt_idx" ON "social_media_posts"("platform", "publishedAt");

-- CreateIndex
CREATE INDEX "social_media_posts_status_idx" ON "social_media_posts"("status");

-- CreateIndex
CREATE INDEX "ad_campaigns_platform_status_idx" ON "ad_campaigns"("platform", "status");

-- CreateIndex
CREATE INDEX "ad_campaigns_startDate_endDate_idx" ON "ad_campaigns"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "marketing_attribution_orderId_idx" ON "marketing_attribution"("orderId");

-- CreateIndex
CREATE INDEX "marketing_attribution_primaryChannel_idx" ON "marketing_attribution"("primaryChannel");

-- CreateIndex
CREATE INDEX "marketing_budgets_channel_periodStart_idx" ON "marketing_budgets"("channel", "periodStart");

-- CreateIndex
CREATE INDEX "_CustomerProfileToEmailCampaign_B_index" ON "_CustomerProfileToEmailCampaign"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTimelineEntry" ADD CONSTRAINT "OrderTimelineEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchQuery" ADD CONSTRAINT "SearchQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "ProductInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "ProductInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "customer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CustomerProfileToEmailCampaign" ADD CONSTRAINT "_CustomerProfileToEmailCampaign_A_fkey" FOREIGN KEY ("A") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CustomerProfileToEmailCampaign" ADD CONSTRAINT "_CustomerProfileToEmailCampaign_B_fkey" FOREIGN KEY ("B") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

