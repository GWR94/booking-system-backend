/*
  Warnings:

  - You are about to drop the column `appleId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[twitterId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeCustomerId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('PAR', 'BIRDIE', 'HOLEINONE');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- DropIndex
DROP INDEX "public"."User_appleId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "appleId",
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN DEFAULT false,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN     "membershipStatus" "MembershipStatus",
ADD COLUMN     "membershipTier" "MembershipTier",
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "twitterId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_twitterId_key" ON "User"("twitterId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
