CREATE TABLE "user_release_receipts" (
    "userId" INTEGER NOT NULL,
    "releaseId" VARCHAR(120) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_release_receipts_pkey" PRIMARY KEY ("userId", "releaseId")
);

ALTER TABLE "user_release_receipts" ADD CONSTRAINT "user_release_receipts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
