/*
  Warnings:

  - You are about to drop the column `slotId` on the `Booking` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[startTime,endTime]` on the table `Slot` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_slotId_fkey";

-- DropForeignKey
ALTER TABLE "Slot" DROP CONSTRAINT "Slot_bayId_fkey";

-- DropIndex
DROP INDEX "Booking_userId_slotId_key";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "slotId";

-- AlterTable
ALTER TABLE "Slot" ALTER COLUMN "bayId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "_BookingSlots" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_BookingSlots_AB_unique" ON "_BookingSlots"("A", "B");

-- CreateIndex
CREATE INDEX "_BookingSlots_B_index" ON "_BookingSlots"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Slot_startTime_endTime_key" ON "Slot"("startTime", "endTime");

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "Bay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingSlots" ADD CONSTRAINT "_BookingSlots_A_fkey" FOREIGN KEY ("A") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookingSlots" ADD CONSTRAINT "_BookingSlots_B_fkey" FOREIGN KEY ("B") REFERENCES "Slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
