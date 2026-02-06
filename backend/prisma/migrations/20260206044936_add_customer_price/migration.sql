-- CreateTable
CREATE TABLE "public"."CustomerPrice" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "CustomerPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerPrice_customerId_idx" ON "public"."CustomerPrice"("customerId");

-- CreateIndex
CREATE INDEX "CustomerPrice_productId_idx" ON "public"."CustomerPrice"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPrice_customerId_productId_key" ON "public"."CustomerPrice"("customerId", "productId");

-- AddForeignKey
ALTER TABLE "public"."CustomerPrice" ADD CONSTRAINT "CustomerPrice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerPrice" ADD CONSTRAINT "CustomerPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
