CREATE TABLE "property_listing_refresh" (
    "id" INTEGER NOT NULL,
    "runId" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'idle',
    "total" INTEGER NOT NULL DEFAULT 0,
    "pendingIds" JSONB NOT NULL DEFAULT '[]',
    "updatedIds" JSONB NOT NULL DEFAULT '[]',
    "failed" JSONB NOT NULL DEFAULT '[]',
    "retryAttempt" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMP(3),
    "message" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "property_listing_refresh_pkey" PRIMARY KEY ("id")
);
