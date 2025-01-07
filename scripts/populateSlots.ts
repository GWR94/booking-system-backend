import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Define the start and end times for each of the slots per day
const timeSlots = [
  { start: "09:00", end: "09:55" },
  { start: "10:00", end: "10:55" },
  { start: "11:00", end: "11:55" },
  { start: "12:00", end: "12:55" },
  { start: "13:00", end: "13:55" },
  { start: "14:00", end: "14:55" },
  { start: "15:00", end: "15:55" },
  { start: "16:00", end: "16:55" },
];

// Define the total number of slots and the number of days
const totalSlots = 1000;
const slotsPerDay = timeSlots.length;
const daysRequired = Math.ceil(totalSlots / slotsPerDay);
const noOfBays = 4;

async function createSlots() {
  // First, ensure bays exist
  const bays = await prisma.bay.findMany();
  if (bays.length === 0) {
    throw new Error("No bays found. Please run createBay.ts first");
  }

  for (let i = 0; i < daysRequired; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    for (const slot of timeSlots) {
      if (i * slotsPerDay + timeSlots.indexOf(slot) >= totalSlots) break;

      const startTime = new Date(date);
      const endTime = new Date(date);

      startTime.setHours(parseInt(slot.start.split(":")[0]));
      startTime.setMinutes(parseInt(slot.start.split(":")[1]));
      endTime.setHours(parseInt(slot.end.split(":")[0]));
      endTime.setMinutes(parseInt(slot.end.split(":")[1]));

      // Create slots for each bay
      for (const bay of bays) {
        await prisma.slot.create({
          data: {
            startTime,
            endTime,
            status: "available",
            bayId: bay.id,
          },
        });
      }
    }
  }
}

async function main() {
  console.log(
    `Seeding ${totalSlots} slots for each of the ${noOfBays} bays into the database...`
  );
  await createSlots();
  console.log("Slots seeded successfully!");
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { createSlots };
