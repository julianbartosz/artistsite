-- CreateTable
CREATE TABLE "studio_jobs" (
    "id" TEXT NOT NULL,
    "job_number" TEXT NOT NULL,
    "share_token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'custom',
    "status" TEXT NOT NULL DEFAULT 'inquiry',
    "client_name" TEXT NOT NULL,
    "client_email" TEXT NOT NULL,
    "thread_id" TEXT,
    "scope" TEXT NOT NULL DEFAULT '',
    "medium" TEXT,
    "dimensions" TEXT,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "deposit_percent" INTEGER NOT NULL DEFAULT 50,
    "deposit_cents" INTEGER NOT NULL DEFAULT 0,
    "balance_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "turnaround_days" INTEGER NOT NULL DEFAULT 21,
    "due_date" TIMESTAMP(3),
    "license_type" TEXT NOT NULL DEFAULT 'personal',
    "revision_cap" INTEGER NOT NULL DEFAULT 2,
    "kill_fee_percent" INTEGER NOT NULL DEFAULT 25,
    "terms_snapshot" JSONB,
    "accepted_at" TIMESTAMP(3),
    "deposit_order_id" TEXT,
    "balance_order_id" TEXT,
    "deposit_paid_at" TIMESTAMP(3),
    "balance_paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "timeline" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates_of_authenticity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order_id" TEXT,
    "job_id" TEXT,
    "product_id" TEXT,
    "artwork_title" TEXT NOT NULL,
    "artist_name" TEXT NOT NULL,
    "medium" TEXT,
    "dimensions" TEXT,
    "year" INTEGER,
    "edition_info" TEXT,
    "license_type" TEXT NOT NULL DEFAULT 'personal',
    "collector_name" TEXT,
    "collector_email" TEXT,
    "artwork_image" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "certificates_of_authenticity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consignment_placements" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "venue_name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "asking_price" DOUBLE PRECISION NOT NULL,
    "artist_split_percent" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'out',
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "return_due_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "reminder_sent_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consignment_placements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "studio_jobs_job_number_key" ON "studio_jobs"("job_number");
CREATE UNIQUE INDEX "studio_jobs_share_token_key" ON "studio_jobs"("share_token");
CREATE UNIQUE INDEX "studio_jobs_deposit_order_id_key" ON "studio_jobs"("deposit_order_id");
CREATE UNIQUE INDEX "studio_jobs_balance_order_id_key" ON "studio_jobs"("balance_order_id");
CREATE INDEX "studio_jobs_status_idx" ON "studio_jobs"("status");
CREATE INDEX "studio_jobs_client_email_idx" ON "studio_jobs"("client_email");
CREATE INDEX "studio_jobs_thread_id_idx" ON "studio_jobs"("thread_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_of_authenticity_code_key" ON "certificates_of_authenticity"("code");
CREATE UNIQUE INDEX "certificates_of_authenticity_order_id_product_id_key" ON "certificates_of_authenticity"("order_id", "product_id");
CREATE INDEX "certificates_of_authenticity_order_id_idx" ON "certificates_of_authenticity"("order_id");
CREATE INDEX "certificates_of_authenticity_job_id_idx" ON "certificates_of_authenticity"("job_id");

-- CreateIndex
CREATE INDEX "consignment_placements_product_id_idx" ON "consignment_placements"("product_id");
CREATE INDEX "consignment_placements_status_return_due_at_idx" ON "consignment_placements"("status", "return_due_at");
