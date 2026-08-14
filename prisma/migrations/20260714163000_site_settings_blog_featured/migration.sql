-- Add database-backed site settings and real blog featured state.

ALTER TABLE "BlogPost" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);