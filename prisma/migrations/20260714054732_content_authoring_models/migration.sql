-- Add database-backed content models for in-site artist authoring.

CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "category" TEXT NOT NULL,
    "medium" TEXT NOT NULL,
    "dimensions" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "availability" TEXT NOT NULL DEFAULT 'available',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "images" JSONB NOT NULL,
    "tags" JSONB NOT NULL,
    "shipping" JSONB NOT NULL,
    "specifications" JSONB NOT NULL,
    "variants" JSONB,
    "customizations" JSONB,
    "relatedProducts" JSONB,
    "bundle" JSONB,
    "commissionInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tags" JSONB NOT NULL,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "coverImage" TEXT,
    "author" TEXT NOT NULL DEFAULT 'Artist',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Artwork" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "medium" TEXT NOT NULL DEFAULT 'Mixed Media',
    "dimensions" TEXT NOT NULL DEFAULT '',
    "year" TEXT NOT NULL,
    "category" JSONB NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "price" TEXT,
    "images" JSONB NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artwork_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_availability_idx" ON "Product"("availability");
CREATE INDEX "Product_category_idx" ON "Product"("category");
CREATE INDEX "Product_featured_idx" ON "Product"("featured");

CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX "BlogPost_isDraft_publishedAt_idx" ON "BlogPost"("isDraft", "publishedAt");

CREATE UNIQUE INDEX "Artwork_slug_key" ON "Artwork"("slug");
CREATE INDEX "Artwork_available_idx" ON "Artwork"("available");
CREATE INDEX "Artwork_featured_idx" ON "Artwork"("featured");