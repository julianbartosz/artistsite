-- Extend blog posts into a mixed updates feed with optional collector-only audience.

ALTER TABLE "BlogPost" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'article';
ALTER TABLE "BlogPost" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "BlogPost" ADD COLUMN "media" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "BlogPostAudience" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,

    CONSTRAINT "BlogPostAudience_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlogPostAudience_postId_email_key" ON "BlogPostAudience"("postId", "email");
CREATE INDEX "BlogPostAudience_email_idx" ON "BlogPostAudience"("email");
CREATE INDEX "BlogPostAudience_userId_idx" ON "BlogPostAudience"("userId");
CREATE INDEX "BlogPost_visibility_isDraft_publishedAt_idx" ON "BlogPost"("visibility", "isDraft", "publishedAt");
CREATE INDEX "BlogPost_format_idx" ON "BlogPost"("format");

ALTER TABLE "BlogPostAudience" ADD CONSTRAINT "BlogPostAudience_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlogPostAudience" ADD CONSTRAINT "BlogPostAudience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
