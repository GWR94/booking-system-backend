import { PrismaClient } from "@prisma/client";

import path from "path";
import dotenv from "dotenv";

if (!process.env.DATABASE_URL) {
  const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
  dotenv.config({ path: path.resolve(process.cwd(), envFile) });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing. Initialization failed.");
}

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export const disconnectDb = async () => {
  await prisma.$disconnect();
};

export default prisma;

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
