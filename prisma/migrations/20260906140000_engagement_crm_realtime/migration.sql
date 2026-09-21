-- Order-linked private posts, inbox CRM, comments/likes
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "relatedOrderId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "BlogPost_relatedOrderId_key" ON "BlogPost"("relatedOrderId") WHERE "relatedOrderId" IS NOT NULL;

ALTER TABLE "StudioMessageThread" ADD COLUMN IF NOT EXISTS "crmStage" TEXT NOT NULL DEFAULT 'new';
ALTER TABLE "StudioMessageThread" ADD COLUMN IF NOT EXISTS "tags" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS "UpdateComment" (
  "id" TEXT NOT NULL,
  "postSlug" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'visible',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UpdateComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UpdateLike" (
  "id" TEXT NOT NULL,
  "postSlug" TEXT NOT NULL,
  "userId" TEXT,
  "sessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UpdateLike_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UpdateComment_postSlug_status_createdAt_idx" ON "UpdateComment"("postSlug", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "UpdateLike_postSlug_idx" ON "UpdateLike"("postSlug");

CREATE UNIQUE INDEX IF NOT EXISTS "UpdateLike_postSlug_userId_key" ON "UpdateLike"("postSlug", "userId") WHERE "userId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UpdateLike_postSlug_sessionId_key" ON "UpdateLike"("postSlug", "sessionId") WHERE "sessionId" IS NOT NULL;

ALTER TABLE "UpdateComment" ADD CONSTRAINT "UpdateComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UpdateLike" ADD CONSTRAINT "UpdateLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
