import request from "supertest";
jest.unmock("@config");
jest.unmock("@config/prisma.config");

import app from "../../app";
import { prisma, disconnectDb } from "@config";
import generateTokens from "@utils/generate-tokens";

jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ client_secret: "test_secret" }),
    },
  }));
});

describe("Booking Routes Integration", () => {
  let userToken: string;
  let testUser: any;
  let testBay: any;
  let testSlot: any;

  beforeAll(async () => {
    testUser = await prisma.user.upsert({
      where: { email: "booking-test@example.com" },
      update: {},
      create: {
        email: "booking-test@example.com",
        name: "Booking Tester",
        passwordHash: "hash",
      },
    });
    userToken = generateTokens(testUser).accessToken;

    testBay = await prisma.bay.upsert({
      where: { name: "Test Bay Booking" },
      update: {},
      create: { name: "Test Bay Booking" },
    });

    testSlot = await prisma.slot.create({
      data: {
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 3600000), // tomorrow + 1 hour
        bayId: testBay.id,
        status: "available",
      },
    });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { userId: testUser.id } });
    await prisma.slot.deleteMany({ where: { bayId: testBay.id } });
    await prisma.bay.delete({ where: { id: testBay.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await disconnectDb();
  });

  describe("POST /api/bookings/create-payment-intent", () => {
    it("should create a payment intent for authenticated user", async () => {
      const res = await request(app)
        .post("/api/bookings/create-payment-intent")
        .set("Cookie", [`accessToken=${userToken}`])
        .send({
          items: [{ slotIds: [testSlot.id], startTime: testSlot.startTime }],
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("clientSecret");
    });

    it("should deny access for unauthenticated user", async () => {
      const res = await request(app)
        .post("/api/bookings/create-payment-intent")
        .send({
          items: [{ slotIds: [testSlot.id], startTime: testSlot.startTime }],
        });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/bookings/", () => {
    it("should create a booking for authenticated user", async () => {
      const res = await request(app)
        .post("/api/bookings/")
        .set("Cookie", [`accessToken=${userToken}`])
        .send({
          slotIds: [testSlot.id],
          date: testSlot.startTime.toISOString().split("T")[0],
          paymentId: "pi_test_123",
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Booking created successfully");
      expect(res.body.booking).toBeDefined();
    });
  });

  describe("DELETE /api/bookings/:bookingId", () => {
    it("should cancel an existing booking", async () => {
      const booking = await prisma.booking.create({
        data: {
          userId: testUser.id,
          status: "pending",
          bookingTime: new Date(),
          slots: { connect: { id: testSlot.id } },
        },
      });

      const res = await request(app)
        .delete(`/api/bookings/${booking.id}`)
        .set("Cookie", [`accessToken=${userToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Booking cancelled successfully");

      const updatedSlot = await prisma.slot.findUnique({
        where: { id: testSlot.id },
      });
      expect(updatedSlot?.status).toBe("available");
    });
  });
});
