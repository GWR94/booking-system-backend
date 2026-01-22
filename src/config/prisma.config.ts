import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
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

let pool: Pool | undefined;

const prismaClientSingleton = () => {
  const isAccelerate = connectionString.startsWith("prisma://");

  if (isAccelerate) {
    return new PrismaClient({
      accelerateUrl: connectionString,
    });
  }

  pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export const disconnectDb = async () => {
  await prisma.$disconnect();
  if (pool) {
    await pool.end();
  }
};

export default prisma;

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
