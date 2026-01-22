import request from "supertest";
jest.unmock("@config");
jest.unmock("@config/prisma.config");
import app from "../../app";
import { prisma, disconnectDb } from "@config";

describe("Slot Routes Integration", () => {
  let testBay: any;
  let testSlots: any[];

  beforeAll(async () => {
    testBay = await prisma.bay.upsert({
      where: { name: "Test Bay Slot Route" },
      update: {},
      create: { name: "Test Bay Slot Route" },
    });

    testSlots = await Promise.all([
      prisma.slot.create({
        data: {
          startTime: new Date("2025-06-01T10:00:00Z"),
          endTime: new Date("2025-06-01T10:55:00Z"),
          bayId: testBay.id,
          status: "available",
        },
      }),
      prisma.slot.create({
        data: {
          startTime: new Date("2025-06-01T11:00:00Z"),
          endTime: new Date("2025-06-01T11:55:00Z"),
          bayId: testBay.id,
          status: "available",
        },
      }),
    ]);
  });

  afterAll(async () => {
    await prisma.slot.deleteMany({ where: { bayId: testBay.id } });
    await prisma.bay.delete({ where: { id: testBay.id } });
    await disconnectDb();
  });

  describe("GET /api/slots", () => {
    it("should return available slots for a given date range", async () => {
      const res = await request(app).get("/api/slots").query({
        from: "2025-06-01T00:00:00Z",
        to: "2025-06-02T00:00:00Z",
      });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body.some((s: any) => s.id === testSlots[0].id)).toBe(true);
    });

    it("should return individual slots by multiple IDs", async () => {
      const ids = testSlots.map((s) => s.id).join(",");
      const res = await request(app).get("/api/slots").query({ ids });

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    it("should return 400 if 'from' is missing", async () => {
      const res = await request(app)
        .get("/api/slots")
        .query({ to: "2025-06-01T00:00:00Z" });

      expect(res.status).toBe(400);
    });
  });
});
