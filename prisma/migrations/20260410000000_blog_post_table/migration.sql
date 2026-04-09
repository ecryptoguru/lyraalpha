-- CreateTable
CREATE TABLE IF NOT EXISTS "BlogPost" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "author" TEXT NOT NULL DEFAULT 'LyraAlpha Research',
  "category" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'published',
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metaDescription" TEXT,
  "keywords" TEXT[] NOT NULL,
  "heroImageUrl" TEXT,
  "sourceAgent" TEXT,
  "sourceContentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BlogPost_slug_key" UNIQUE ("slug"),
  CONSTRAINT "BlogPost_sourceContentId_key" UNIQUE ("sourceContentId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt" DESC);
CREATE INDEX IF NOT EXISTS "BlogPost_slug_idx" ON "BlogPost"("slug");
CREATE INDEX IF NOT EXISTS "BlogPost_category_idx" ON "BlogPost"("category");
