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
import { registerUser } from "./user.controller";
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
});
