-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "triggerType" TEXT,
    "triggerValue" DOUBLE PRECISION,
    "config" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Offer_shop_idx" ON "Offer"("shop");

-- CreateIndex
CREATE INDEX "Offer_shop_status_idx" ON "Offer"("shop", "status");
