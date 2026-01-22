import { PrismaClient } from "../../prisma/generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
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
  const isAccelerate =
    connectionString.startsWith("prisma://") ||
    connectionString.startsWith("prisma+postgres://");

  if (isAccelerate) {
    return new PrismaClient({
      accelerateUrl: connectionString,
      log: ["query", "info", "warn", "error"],
    }).$extends(withAccelerate());
  } else {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
      max: 20,
    });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({
      adapter,
      log: ["query", "info", "warn", "error"],
    });
  }
};

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

const prisma = (globalThis.prismaGlobal ??
  prismaClientSingleton()) as PrismaClient;

export const disconnectDb = async () => {
  if (pool) {
    await pool.end();
  }
  await prisma.$disconnect();
};

export default prisma;

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
