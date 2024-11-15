import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Define the start and end times for each of the 8 slots per day
const timeSlots = [
  { start: "09:00", end: "10:00" },
  { start: "10:00", end: "11:00" },
  { start: "11:00", end: "12:00" },
  { start: "12:00", end: "13:00" },
  { start: "13:00", end: "14:00" },
  { start: "14:00", end: "15:00" },
  { start: "15:00", end: "16:00" },
  { start: "16:00", end: "17:00" },
];

// Define the total number of slots and the number of days
const totalSlots = 100;
const slotsPerDay = timeSlots.length;
const daysRequired = Math.ceil(totalSlots / slotsPerDay);

async function createSlots() {
  for (let i = 0; i < daysRequired; i++) {
    // Calculate the date for `i` days from today
    const date = new Date();
    date.setDate(date.getDate() + i);

    // Loop through each time slot and create a slot for this date
    for (const slot of timeSlots) {
      if (i * slotsPerDay + timeSlots.indexOf(slot) >= totalSlots) break;

      const startTime = new Date(date);
      const endTime = new Date(date);

      // Set the start and end times
      startTime.setHours(parseInt(slot.start.split(":")[0]));
      startTime.setMinutes(parseInt(slot.start.split(":")[1]));
      endTime.setHours(parseInt(slot.end.split(":")[0]));
      endTime.setMinutes(parseInt(slot.end.split(":")[1]));

      // Create the slot in the database
      await prisma.slot.create({
        data: {
          startTime,
          endTime,
          status: "available",
        },
      });
    }
  }
}

async function main() {
  console.log(`Seeding ${totalSlots} slots into the database...`);
  await createSlots();
  console.log("Slots seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
