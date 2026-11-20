-- AlterTable
ALTER TABLE "email_campaigns" ADD COLUMN     "sent_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "email_campaign_deliveries" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_campaign_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_campaign_deliveries_campaign_id_status_idx" ON "email_campaign_deliveries"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "email_campaign_deliveries_campaign_id_email_key" ON "email_campaign_deliveries"("campaign_id", "email");

-- CreateIndex
CREATE INDEX "email_campaigns_status_scheduled_at_idx" ON "email_campaigns"("status", "scheduled_at");

-- AddForeignKey
ALTER TABLE "email_campaign_deliveries" ADD CONSTRAINT "email_campaign_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
