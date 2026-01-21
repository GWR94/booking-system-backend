import cron from "node-cron";
import prisma from "../config/prisma.config";
import { logger } from "@utils";

// Schedule the job to run every minute
const JOB_TIMEOUT = 50000; // 50 seconds safety timeout
let isJobRunning = false;

// Schedule the job to run every minute
// Schedule the job to run every minute
export const startBookingCleanupJob = () => {
  cron.schedule("* * * * *", async () => {
    if (isJobRunning) {
      logger.info(
        "Skipping booking cleanup job - previous run still in progress",
      );
      return;
    }

    isJobRunning = true;

    // Safety timeout to release lock if stuck
    const timeoutId = setTimeout(() => {
      if (isJobRunning) {
        logger.warn("Booking cleanup job timed out, forcing lock release");
        isJobRunning = false;
      }
    }, JOB_TIMEOUT);

    try {
      // Calculate the threshold date (15 minutes ago)
      const thresholdDate = new Date(Date.now() - 15 * 60 * 1000);

      let staleBookings = [];
      try {
        // Find bookings still pending that were created before the threshold
        staleBookings = await prisma.booking.findMany({
          where: {
            status: "pending",
            bookingTime: { lt: thresholdDate },
          },
          include: { slots: true },
        });
      } catch (err: any) {
        if (err?.code === "P5010" || err?.message?.includes("fetch failed")) {
          logger.warn("Prisma fetch failed, retrying once...");
          await new Promise((r) => setTimeout(r, 1000));
          staleBookings = await prisma.booking.findMany({
            where: {
              status: "pending",
              bookingTime: { lt: thresholdDate },
            },
            include: { slots: true },
          });
        } else {
          throw err;
        }
      }

      if (staleBookings.length > 0) {
        logger.info(`Found ${staleBookings.length} stale bookings to clean up`);
      }

      for (const booking of staleBookings) {
        logger.info(`Cancelling stale booking ${booking.id}`);

        // Update the booking status to "cancelled"
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "cancelled" },
        });

        // Revert the associated slots back to "available"
        const slotIds = booking.slots.map((slot) => slot.id);
        if (slotIds.length > 0) {
          logger.info(
            `Reverting slots ${slotIds.join(", ")} back to available`,
          );
          await prisma.slot.updateMany({
            where: { id: { in: slotIds } },
            data: { status: "available" },
          });
        }
      }
    } catch (error) {
      logger.error(`Error cleaning up stale bookings: ${error}`);
    } finally {
      clearTimeout(timeoutId);
      isJobRunning = false;
    }
  });
};
