/*
  Warnings:

  - The values [VIP] on the enum `CustomerStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [PACKAGE] on the enum `CustomerType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."CustomerStatus_new" AS ENUM ('ACTIVE', 'INACTIVE', 'PERMANENT');
ALTER TABLE "public"."Customer" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."Customer" ALTER COLUMN "status" TYPE "public"."CustomerStatus_new" USING ("status"::text::"public"."CustomerStatus_new");
ALTER TYPE "public"."CustomerStatus" RENAME TO "CustomerStatus_old";
ALTER TYPE "public"."CustomerStatus_new" RENAME TO "CustomerStatus";
DROP TYPE "public"."CustomerStatus_old";
ALTER TABLE "public"."Customer" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."CustomerType_new" AS ENUM ('REGULAR', 'VIP');
ALTER TABLE "public"."Customer" ALTER COLUMN "customerType" DROP DEFAULT;
ALTER TABLE "public"."Customer" ALTER COLUMN "customerType" TYPE "public"."CustomerType_new" USING ("customerType"::text::"public"."CustomerType_new");
ALTER TYPE "public"."CustomerType" RENAME TO "CustomerType_old";
ALTER TYPE "public"."CustomerType_new" RENAME TO "CustomerType";
DROP TYPE "public"."CustomerType_old";
ALTER TABLE "public"."Customer" ALTER COLUMN "customerType" SET DEFAULT 'REGULAR';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "statusReason" TEXT;
