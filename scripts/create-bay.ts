import { PrismaClient } from "../prisma/generated/prisma/client";

async function createBays(prisma: PrismaClient) {
  console.log(`Seeding database...`);

  await prisma.bay.upsert({
    where: { name: "Bay 1" },
    update: {},
    create: { name: "Bay 1" },
  });

  await prisma.bay.upsert({
    where: { name: "Bay 2" },
    update: {},
    create: { name: "Bay 2" },
  });

  await prisma.bay.upsert({
    where: { name: "Bay 3" },
    update: {},
    create: { name: "Bay 3" },
  });

  await prisma.bay.upsert({
    where: { name: "Bay 4" },
    update: {},
    create: { name: "Bay 4" },
  });

  console.log("Bays created successfully!");
}

export { createBays };
