import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const noOfBays = 4;

async function createBays() {
  await prisma.bay.create({
    data: {
      name: "Bay 1",
    },
  });
  await prisma.bay.create({
    data: {
      name: "Bay 2",
    },
  });
  await prisma.bay.create({
    data: {
      name: "Bay 3",
    },
  });
  await prisma.bay.create({
    data: {
      name: "Bay 4",
    },
  });
}

async function main() {
  console.log(`Creating ${noOfBays} bays into the database...`);
  await createBays();
  console.log("Bays created successfully!");
}

// Only run main function if this file is being executed directly
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

export { createBays };
