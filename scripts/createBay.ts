import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Define the start and end times for each of the slots per day
const timeSlots = [
  {
    name: "Tiger",
  },
  {
    name: "Bryson",
  },
  {
    name: "McIlroy",
  },
  {
    name: "",
  },
];

const noOfBays = 4;

async function createBays() {
  await prisma.bay.create({
    data: {
      name: "Tiger",
    },
  });
  await prisma.bay.create({
    data: {
      name: "DeChambeau",
    },
  });
  await prisma.bay.create({
    data: {
      name: "Scheffler",
    },
  });
  await prisma.bay.create({
    data: {
      name: "Fleetwood",
    },
  });
}

async function main() {
  console.log(`Creating ${noOfBays} bays into the database...`);
  await createBays();
  console.log("Bays created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
