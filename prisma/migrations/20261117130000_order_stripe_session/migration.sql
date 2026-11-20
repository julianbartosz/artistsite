-- AlterTable
ALTER TABLE "Order" ADD COLUMN "stripeSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");

-- Indexes declared in schema.prisma that no earlier migration created
CREATE INDEX IF NOT EXISTS "BlogPost_featured_publishedAt_idx" ON "BlogPost"("featured", "publishedAt");
CREATE INDEX IF NOT EXISTS "BlogPost_relatedOrderId_idx" ON "BlogPost"("relatedOrderId");
CREATE INDEX IF NOT EXISTS "StudioMessageThread_crmStage_idx" ON "StudioMessageThread"("crmStage");
