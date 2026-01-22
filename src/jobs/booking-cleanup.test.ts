import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import cron from "node-cron";
import { prisma } from "@config";
import { startBookingCleanupJob } from "./booking-cleanup";

// Mock node-cron
jest.mock("node-cron", () => ({
  schedule: jest.fn(),
}));

// The prisma mock is already handled in setupTests.ts via @config/prisma.config
// We just need to mock node-cron and capture the callback

describe("Booking Cleanup Job", () => {
  let cleanupCallback: () => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Capture the callback passed to cron.schedule
    (cron.schedule as jest.Mock).mockImplementation((_pattern, callback) => {
      cleanupCallback = callback as () => Promise<void>;
    });

    startBookingCleanupJob();
  });

  it("should schedule the job to run every minute", () => {
    expect(cron.schedule).toHaveBeenCalledWith(
      "* * * * *",
      expect.any(Function),
    );
  });

  it("should cancel stale bookings and release slots", async () => {
    const mockBookings = [
      {
        id: "booking-1",
        slots: [{ id: "slot-1" }, { id: "slot-2" }],
      },
    ];

    (prisma.booking.findMany as any).mockResolvedValue(mockBookings);
    (prisma.booking.update as any).mockResolvedValue({});
    (prisma.slot.updateMany as any).mockResolvedValue({ count: 2 });

    await cleanupCallback();

    // Verify it searched for stale bookings
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "pending",
          bookingTime: { lt: expect.any(Date) },
        }),
      }),
    );

    // Verify booking was updated to cancelled
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: { status: "cancelled" },
    });

    // Verify slots were reverted to available
    expect(prisma.slot.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["slot-1", "slot-2"] } },
      data: { status: "available" },
    });
  });

  it("should handle Prisma P5010 errors with a retry", async () => {
    const mockBookings = [{ id: "booking-1", slots: [] }];

    // First call fails with P5010
    (prisma.booking.findMany as any)
      .mockRejectedValueOnce({ code: "P5010", message: "fetch failed" })
      .mockResolvedValueOnce(mockBookings);

    await cleanupCallback();

    // Verify findMany was called twice (initial + retry)
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(2);
    // Verify booking was updated to cancelled
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "booking-1" },
        data: { status: "cancelled" },
      }),
    );
  });

  it("should not crash if no stale bookings are found", async () => {
    (prisma.booking.findMany as any).mockResolvedValue([]);

    await cleanupCallback();

    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(prisma.slot.updateMany).not.toHaveBeenCalled();
  });

  it("should prevent concurrent job execution", async () => {
    // Mock findMany to take some time
    let resolveFindMany: (value: any) => void;
    const findManyPromise = new Promise((resolve) => {
      resolveFindMany = resolve;
    });
    (prisma.booking.findMany as any).mockReturnValue(findManyPromise);

    // Start first run
    const firstRun = cleanupCallback();

    // Start second run immediately
    await cleanupCallback();

    // Second run should skip because isJobRunning is true
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);

    // Finish first run
    resolveFindMany!([]);
    await firstRun;

    // Now start third run
    await cleanupCallback();
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(2);
  });
});
