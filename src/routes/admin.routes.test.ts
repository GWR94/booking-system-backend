import request from "supertest";
jest.unmock("@config");
jest.unmock("@config/prisma.config");
import app from "../../app";
import { prisma, disconnectDb } from "@config";
import generateTokens from "@utils/generate-tokens";
import dayjs from "dayjs";

describe("Admin Routes", () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const admin = await prisma.user.upsert({
      where: { email: "admin-test@example.com" },
      update: {},
      create: {
        email: "admin-test@example.com",
        name: "Admin Tester",
        role: "admin",
        passwordHash: "hash",
      },
    });
    adminToken = generateTokens(admin).accessToken;

    const user = await prisma.user.upsert({
      where: { email: "user-test@example.com" },
      update: {},
      create: {
        email: "user-test@example.com",
        name: "Regular User",
        role: "user",
        passwordHash: "hash",
      },
    });
    userToken = generateTokens(user).accessToken;

    const bay = await prisma.bay.upsert({
      where: { name: "Test Bay Admin" },
      update: {},
      create: { name: "Test Bay Admin" },
    });

    const pastSlot = await prisma.slot.create({
      data: {
        startTime: dayjs().subtract(2, "day").hour(10).toDate(),
        endTime: dayjs().subtract(2, "day").hour(10).minute(55).toDate(),
        bayId: bay.id,
        status: "booked",
      },
    });

    const todaySlot = await prisma.slot.create({
      data: {
        startTime: dayjs().hour(12).toDate(),
        endTime: dayjs().hour(12).minute(55).toDate(),
        bayId: bay.id,
        status: "booked",
      },
    });

    const booking1 = await prisma.booking.create({
      data: {
        userId: user.id,
        status: "confirmed",
        bookingTime: dayjs().subtract(2, "day").toDate(),
        paymentStatus: "paid",
        slots: { connect: { id: pastSlot.id } },
      },
    });

    const booking2 = await prisma.booking.create({
      data: {
        userId: user.id,
        status: "confirmed",
        bookingTime: dayjs().toDate(),
        paymentStatus: "paid",
        slots: { connect: { id: todaySlot.id } },
      },
    });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({
      where: {
        user: {
          email: { in: ["admin-test@example.com", "user-test@example.com"] },
        },
      },
    });

    await prisma.slot.deleteMany({
      where: { bay: { name: "Test Bay Admin" } },
    });

    await prisma.user.deleteMany({
      where: {
        email: { in: ["admin-test@example.com", "user-test@example.com"] },
      },
    });

    await disconnectDb();
  });

  describe("GET /api/admin/dashboard-stats", () => {
    it("should return stats for admin", async () => {
      const res = await request(app)
        .get("/api/admin/dashboard-stats")
        .set("Cookie", [`accessToken=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.totalUsers).toBeGreaterThanOrEqual(2);
      expect(res.body.totalBookings).toBeGreaterThanOrEqual(2);
      expect(res.body.bookingsToday).toBeGreaterThanOrEqual(1);
    });

    it("should deny access for regular user", async () => {
      const res = await request(app)
        .get("/api/admin/dashboard-stats")
        .set("Cookie", [`accessToken=${userToken}`]);

      expect(res.status).toBe(403);
    });
  });
});
