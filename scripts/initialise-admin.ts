import { PrismaClient } from "../prisma/generated/client";
import bcrypt from "bcrypt";

async function initialiseAdmin(prisma: PrismaClient) {
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

export { initialiseAdmin };
