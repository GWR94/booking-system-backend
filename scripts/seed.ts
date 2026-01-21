import prisma from "../src/config/prisma.config";
import { createBays } from "./create-bay";
import { createSlots } from "./populate-slots";
import { initialiseAdmin } from "./initialise-admin";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not defined");
  process.exit(1);
}

// Prisma client is imported from singleton
async function main() {
  await createBays(prisma);
  await createSlots(prisma);
  await initialiseAdmin(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
