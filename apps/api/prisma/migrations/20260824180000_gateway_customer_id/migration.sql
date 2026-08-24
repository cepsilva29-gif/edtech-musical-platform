-- AlterTable
ALTER TABLE "users" ADD COLUMN "gateway_customer_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_gateway_customer_id_key" ON "users"("gateway_customer_id");
