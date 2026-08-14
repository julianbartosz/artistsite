-- Add nullable production fields for in-site marketing execution and shipment tracking.

ALTER TABLE "Order" ADD COLUMN "shippingCarrier" TEXT;

ALTER TABLE "email_campaigns" ADD COLUMN "content" JSONB;
ALTER TABLE "email_campaigns" ADD COLUMN "scheduled_at" TIMESTAMP(3);