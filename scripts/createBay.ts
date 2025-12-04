import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
}

async function main() {
  console.log(`Creating 3 bays into the database...`);
  await createBays();
  console.log("Bays created successfully!");
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

export { createBays };
