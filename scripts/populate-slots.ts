import { PrismaClient } from "../prisma/generated/client";

const timeSlots = [
  { start: "10:00", end: "10:55" },
  { start: "11:00", end: "11:55" },
  { start: "12:00", end: "12:55" },
  { start: "13:00", end: "13:55" },
  { start: "14:00", end: "14:55" },
  { start: "15:00", end: "15:55" },
  { start: "16:00", end: "16:55" },
  { start: "17:00", end: "17:55" },
  { start: "18:00", end: "18:55" },
  { start: "19:00", end: "19:55" },
  { start: "20:00", end: "20:55" },
  { start: "21:00", end: "21:55" },
];

const daysToCreate = 365;
const noOfBays = 4;

async function createSlots(prisma: PrismaClient) {
  const bays = await prisma.bay.findMany();
  if (bays.length === 0) {
    throw new Error("No bays found. Please run createBay.ts first");
  }

  for (let i = 0; i < daysToCreate; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    // Skip Sundays
    if (date.getDay() === 0) {
      console.log(`Skipping slot creation for Sunday: ${date.toDateString()}`);
      continue;
    }

    const slotsToCreate = [];

    for (const slot of timeSlots) {
      const startTime = new Date(date);
      const endTime = new Date(date);

      startTime.setHours(parseInt(slot.start.split(":")[0]));
      startTime.setMinutes(parseInt(slot.start.split(":")[1]));
      startTime.setSeconds(0);
      startTime.setMilliseconds(0);

      endTime.setHours(parseInt(slot.end.split(":")[0]));
      endTime.setMinutes(parseInt(slot.end.split(":")[1]));
      endTime.setSeconds(0);
      endTime.setMilliseconds(0);

      for (const bay of bays) {
        slotsToCreate.push({
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          status: "available",
          bayId: bay.id,
        });
      }
    }

    if (slotsToCreate.length > 0) {
      await prisma.slot.createMany({
        data: slotsToCreate,
        skipDuplicates: true,
      });
    }
  }
}

export { createSlots };
