-- Add in-person MarketEvent support and link Orders to market events
CREATE TABLE "market_events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "booth_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "other_expenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sales_tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "promo_code" TEXT,
    "follow_up_enabled" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_delay_days" INTEGER NOT NULL DEFAULT 1,
    "follow_up_subject" TEXT,
    "follow_up_body" TEXT,
    "follow_up_sent_at" TIMESTAMP(3),
    "price_sheet_config" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_events_slug_key" ON "market_events"("slug");
CREATE INDEX "market_events_start_date_idx" ON "market_events"("start_date");

ALTER TABLE "Order" ADD COLUMN "marketEventId" TEXT;
CREATE INDEX "Order_marketEventId_idx" ON "Order"("marketEventId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_marketEventId_fkey"
    FOREIGN KEY ("marketEventId") REFERENCES "market_events"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
