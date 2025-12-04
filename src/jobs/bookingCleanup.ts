import cron from "node-cron";
import prisma from "../config/prisma-client";

// Schedule the job to run every minute
cron.schedule("* * * * *", async () => {
  try {
    // Calculate the threshold date (15 minutes ago)
    const thresholdDate = new Date(Date.now() - 15 * 60 * 1000);

    // Find bookings still pending that were created before the threshold
    const staleBookings = await prisma.booking.findMany({
      where: {
        status: "pending",
        bookingTime: { lt: thresholdDate },
      },
      include: { slots: true },
    });

    for (const booking of staleBookings) {
      console.log(`Cancelling stale booking ${booking.id}`);

      // Update the booking status to "cancelled"
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "cancelled" },
      });

      // Revert the associated slots back to "available"
      const slotIds = booking.slots.map((slot) => slot.id);
      console.log(`Reverting slots ${slotIds} back to available`);
      await prisma.slot.updateMany({
        where: { id: { in: slotIds } },
        data: { status: "available" },
      });
    }
  } catch (error) {
    console.error("Error cleaning up stale bookings:", error);
  }
});
