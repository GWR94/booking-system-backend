import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { findOrCreateUser } from "./auth-helpers";
import { prisma } from "@config";

// Mock Prisma
jest.mock("@config/prisma.config", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("Auth Helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("findOrCreateUser", () => {
    it("should return existing user if found by provider ID", async () => {
      const mockUser = { id: 1, googleId: "123", email: "test@test.com" };

      // Mock findFirst because logical flow uses it for unauthenticated provider lookup
      (prisma.user.findFirst as jest.Mock).mockImplementation(() => {
        return Promise.resolve(mockUser);
      });
      (prisma.user.update as jest.Mock).mockImplementation(() =>
        Promise.resolve(mockUser),
      );

      const req = {} as any;
      const profile = {
        id: "123",
        emails: [{ value: "test@test.com" }],
        displayName: "Test User",
        provider: "google",
      } as any;

      const result = await findOrCreateUser(req, profile);

      expect(result).toEqual(mockUser);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });
    });

    it("should link provider if user exists by email but not provider ID", async () => {
      const existingUser = { id: 1, email: "test@test.com", googleId: null };
      const updatedUser = { ...existingUser, googleId: "123" };

      (prisma.user.findFirst as jest.Mock).mockImplementation(() =>
        Promise.resolve(existingUser),
      );

      (prisma.user.update as jest.Mock).mockImplementation(() =>
        Promise.resolve(updatedUser),
      );

      const req = {} as any;
      const profile = {
        id: "123",
        emails: [{ value: "test@test.com" }],
        displayName: "Test User",
        provider: "google",
      } as any;

      const result = await findOrCreateUser(req, profile);

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { googleId: "123" },
        }),
      );
    });

    it("should create new user if neither provider ID nor email exists", async () => {
      const newUser = { id: 2, email: "new@test.com", googleId: "456" };

      (prisma.user.findFirst as jest.Mock).mockImplementation(() =>
        Promise.resolve(null),
      );
      (prisma.user.create as jest.Mock).mockImplementation(() =>
        Promise.resolve(newUser),
      );

      const req = {} as any;
      const profile = {
        id: "456",
        emails: [{ value: "new@test.com" }],
        displayName: "New User",
        provider: "google",
      } as any;

      const result = await findOrCreateUser(req, profile);

      expect(result).toEqual(newUser);
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });
});
