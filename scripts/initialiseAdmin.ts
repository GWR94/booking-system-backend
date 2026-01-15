import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function initialiseAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL as string;
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail, role: "admin" },
  });

  if (existingAdmin) {
    console.log("Admin user already exists.");
    return;
  }

  const password = process.env.ADMIN_PASSWORD as string;
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  await prisma.user.create({
    data: {
      email: adminEmail,
      name: "Administrator",
      role: "admin",
      passwordHash,
    },
  });
}

async function main() {
  await initialiseAdmin();
  console.log("Admin user created");
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
export { initialiseAdmin };
