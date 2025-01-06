import { PrismaClient } from "@prisma/client";
import { createBays } from "./createBay";
import { createSlots } from "./populateSlots";

const prisma = new PrismaClient();

async function main() {
  await createBays();
  await createSlots();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
