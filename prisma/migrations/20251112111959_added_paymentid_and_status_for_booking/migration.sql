-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allowMarketing" BOOLEAN,
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "_BookingSlots" ADD CONSTRAINT "_BookingSlots_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "public"."_BookingSlots_AB_unique";
