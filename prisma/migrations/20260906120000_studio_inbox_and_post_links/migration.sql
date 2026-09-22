-- Studio inbox, saved updates, and post personalization fields
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "relatedProductId" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "relatedArtworkSlug" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "pullQuote" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "processStage" TEXT;

CREATE TABLE IF NOT EXISTS "StudioMessageThread" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT,
    "relatedPostSlug" TEXT,
    "relatedOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "artistLastReadAt" TIMESTAMP(3),
    "userLastReadAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioMessageThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StudioMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "senderUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SavedUpdate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudioMessageThread_userEmail_idx" ON "StudioMessageThread"("userEmail");
CREATE INDEX IF NOT EXISTS "StudioMessageThread_userId_idx" ON "StudioMessageThread"("userId");
CREATE INDEX IF NOT EXISTS "StudioMessageThread_lastMessageAt_idx" ON "StudioMessageThread"("lastMessageAt");
CREATE INDEX IF NOT EXISTS "StudioMessageThread_relatedPostSlug_idx" ON "StudioMessageThread"("relatedPostSlug");
CREATE INDEX IF NOT EXISTS "StudioMessage_threadId_createdAt_idx" ON "StudioMessage"("threadId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SavedUpdate_userId_postSlug_key" ON "SavedUpdate"("userId", "postSlug");
CREATE INDEX IF NOT EXISTS "SavedUpdate_userId_idx" ON "SavedUpdate"("userId");

DO $$ BEGIN
    ALTER TABLE "StudioMessageThread" ADD CONSTRAINT "StudioMessageThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StudioMessage" ADD CONSTRAINT "StudioMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "StudioMessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SavedUpdate" ADD CONSTRAINT "SavedUpdate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
