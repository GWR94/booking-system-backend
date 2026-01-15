import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
  afterAll,
} from "@jest/globals";
import { Request, Response, NextFunction } from "express";
import { registerUser, verifyUser } from "./user.controller";
import prisma from "../config/prisma-client";
import bcrypt from "bcrypt";

// Mock dependencies
jest.mock("../config/prisma-client", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("bcrypt");
jest.mock("../utils/generate-tokens", () => jest.fn());

describe("UserController Integration", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeAll(() => {
    // One-time setup if needed
  });

  beforeEach(() => {
    jest.resetAllMocks();

    req = {
      body: {},
    };

    const resObj: any = {};
    resObj.status = jest.fn().mockReturnValue(resObj);
    resObj.json = jest.fn().mockReturnValue(resObj);
    resObj.cookie = jest.fn().mockReturnValue(resObj);
    res = resObj;

    next = jest.fn();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("#registerUser", () => {
    it("should register a new user successfully when data is valid", async () => {
      // Arrange
      req.body = {
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      };

      // Mock Prisma: User does NOT exist
      (prisma.user.findUnique as any).mockResolvedValue(null);
      // Mock Bcrypt
      (bcrypt.hash as any).mockResolvedValue("hashed_password");
      // Mock Prisma Create
      (prisma.user.create as any).mockResolvedValue({
        id: "user-id-123",
        email: "test@example.com",
        name: "Test User",
      });

      // Act
      await registerUser(req as Request, res as Response, next);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User registered successfully",
          user: { id: "user-id-123", email: "test@example.com" },
        })
      );
    });

    it("should return 409 if user already exists with a password", async () => {
      // Arrange
      req.body = {
        name: "Existing User",
        email: "exists@example.com",
        password: "password123",
      };

      // Mock Prisma: User EXISTS
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "existing-id",
        email: "exists@example.com",
        passwordHash: "existing_hash",
      });

      // Act
      await registerUser(req as Request, res as Response, next);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.anything(),
        })
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });
  describe("#verifyUser", () => {
    it("should return user: null (200 OK) if no tokens present", async () => {
      // Arrange
      req.cookies = {}; // No tokens

      // Act
      await verifyUser(req as Request, res as Response, next);

      // Assert
      // Should NOT call res.status(401)
      expect(res.json).toHaveBeenCalledWith({ user: null });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 if refresh token exists but access token missing", async () => {
      // Arrange
      // This mimics the "expired session" state where frontend interceptor should refresh
      req.cookies = { refreshToken: "valid_refresh_token" };
      // No access token

      // Act
      await verifyUser(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "NO_ACCESS_TOKEN" })
      );
    });
  });
});
