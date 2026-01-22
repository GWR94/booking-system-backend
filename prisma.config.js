const { defineConfig } = require("@prisma/config");
require("dotenv").config();

module.exports = defineConfig({
  datasource: {
    // For CLI commands (migrate, studio, etc.), we need the direct connection.
    // If DIRECT_URL is set (Production/Accelerate), use it.
    // Otherwise fallback to DATABASE_URL (Local Dev).
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
