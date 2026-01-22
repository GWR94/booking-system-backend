import { defineConfig } from "prisma/config";
import dotenv from "dotenv";

const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: envFile });

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
