import prisma from "./src/config/prisma.config";

async function main() {
  console.log("Testing Prisma connection...");
  try {
    const userCount = await prisma.user.count();
    console.log(`Connection successful! User count: ${userCount}`);
  } catch (error) {
    console.error("Connection failed:", error);
  } finally {
    process.exit(0);
  }
}

main();
