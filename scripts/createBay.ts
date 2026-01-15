import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createBays() {
  console.log(`Seeding database...`);

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

  console.log("Bays created successfully!");
}

async function main() {
  await createBays();
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
