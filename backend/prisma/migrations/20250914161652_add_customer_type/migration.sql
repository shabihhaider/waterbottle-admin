-- CreateEnum
CREATE TYPE "public"."CustomerType" AS ENUM ('REGULAR', 'PACKAGE');

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "customerType" "public"."CustomerType" NOT NULL DEFAULT 'REGULAR';
