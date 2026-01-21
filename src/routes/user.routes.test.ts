import request from "supertest";
jest.unmock("@config");
jest.unmock("@config/prisma.config");

import app from "../../app";
import { prisma, disconnectDb } from "@config";
import generateTokens from "@utils/generate-tokens";

describe("User Routes Integration", () => {
  let testUser: any;
  let userToken: string;

  beforeAll(async () => {
    // Ensure clean state
    await prisma.user.deleteMany({ where: { email: "new-user@example.com" } });

    testUser = await prisma.user.upsert({
      where: { email: "user-route-test@example.com" },
      update: {},
      create: {
        email: "user-route-test@example.com",
        name: "Route Tester",
        passwordHash:
          "$2b$10$EixzaoW9CQQ.pMj7NppA4eS9S/De.S7Y.u696vG.W1W2W3W4W5W6W", // dummy bcrypt hash
      },
    });
    userToken = generateTokens(testUser).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: "user-route-test@example.com" },
    });
    await prisma.user.deleteMany({ where: { email: "new-user@example.com" } });
    await disconnectDb();
  });

  describe("POST /api/user/register", () => {
    it("should register a new user", async () => {
      const uniqueEmail = `new-user-${Date.now()}@example.com`;
      const res = await request(app).post("/api/user/register").send({
        email: uniqueEmail,
        name: "New User",
        password: "Password123!",
      });

      expect(res.status).toBe(201);
    });

    it("should fail if email is already taken", async () => {
      const res = await request(app).post("/api/user/register").send({
        email: "user-route-test@example.com",
        name: "Another Tester",
        password: "Password123!",
      });

      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/user/profile", () => {
    it("should return profile for authenticated user", async () => {
      const res = await request(app)
        .get("/api/user/profile")
        .set("Cookie", [`accessToken=${userToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("user-route-test@example.com");
    });
  });

  describe("PATCH /api/user/profile", () => {
    it("should update user profile", async () => {
      const res = await request(app)
        .patch("/api/user/profile")
        .set("Cookie", [`accessToken=${userToken}`])
        .send({
          name: "Updated Name",
        });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe("Updated Name");

      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(user?.name).toBe("Updated Name");
    });
  });

  describe("GET /api/user/check-email", () => {
    it("should return exists: true if email exists", async () => {
      const res = await request(app)
        .get("/api/user/check-email")
        .query({ email: "user-route-test@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.exists).toBe(true);
    });

    it("should return exists: false if email doesn't exist", async () => {
      const res = await request(app)
        .get("/api/user/check-email")
        .query({ email: "non-existent@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.exists).toBe(false);
    });
  });
});
