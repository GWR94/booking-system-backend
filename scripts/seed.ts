import { PrismaClient } from "@prisma/client";
import { createBays } from "./createBay";
import { createSlots } from "./populateSlots";
import { initialiseAdmin } from "./initialiseAdmin";

const prisma = new PrismaClient();

async function main() {
  await createBays();
  await createSlots();
  await initialiseAdmin();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
