import prisma from "../src/config/prisma.config";

async function main() {
  console.log("Starting debug query...");
  try {
    const thresholdDate = new Date(Date.now() - 15 * 60 * 1000);
    console.log("Threshold date:", thresholdDate);

    const staleBookings = await prisma.booking.findMany({
      where: {
        status: "pending",
        bookingTime: { lt: thresholdDate },
      },
      include: { slots: true },
    });

    console.log("Query successful. Found:", staleBookings.length);
  } catch (error) {
    console.error("Query failed!");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
