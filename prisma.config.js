const { defineConfig } = require("@prisma/config");

module.exports = defineConfig({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
      // directUrl is used for migrations (e.g. npx prisma migrate deploy)
      directUrl: process.env.DIRECT_URL,
    },
  },
});
