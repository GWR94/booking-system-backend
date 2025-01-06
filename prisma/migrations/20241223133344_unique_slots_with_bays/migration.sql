/*
  Warnings:

  - A unique constraint covering the columns `[startTime,endTime,bayId]` on the table `Slot` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Slot_startTime_endTime_key";

-- CreateIndex
CREATE UNIQUE INDEX "Slot_startTime_endTime_bayId_key" ON "Slot"("startTime", "endTime", "bayId");
