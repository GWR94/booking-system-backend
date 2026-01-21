import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterAll,
} from "@jest/globals";
import { Request, Response, NextFunction } from "express";
import {
  registerUser,
  verifyUser,
  loginUser,
  logoutUser,
  refreshToken,
  unlinkProvider,
  getUserProfile,
  updateUser,
  requestPasswordReset,
  resetPassword,
} from "./user.controller";
import { prisma } from "@config";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

jest.mock("@config", () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
  default: {
    prisma: {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    },
  },
}));

jest.mock("bcrypt");
jest.mock("@utils", () => ({
  __esModule: true,
  generateTokens: () => ({
    accessToken: "mock_access_token",
    refreshToken: "mock_refresh_token",
  }),
  handleSendEmail: jest.fn(),
}));

jest.mock("jsonwebtoken", () => {
  const mockJwt = {
    sign: jest.fn(),
    verify: jest.fn(),
  };
  return {
    ...mockJwt,
    default: mockJwt,
    __esModule: true,
  };
});

describe("UserController Integration", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      params: {},
      cookies: {},
    };

    const resObj: any = {};
    resObj.status = jest.fn().mockReturnValue(resObj);
    resObj.json = jest.fn().mockReturnValue(resObj);
    resObj.cookie = jest.fn().mockReturnValue(resObj);
    resObj.clearCookie = jest.fn().mockReturnValue(resObj);
    res = resObj;

    next = jest.fn();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("#registerUser", () => {
    it("should register a new user successfully", async () => {
      req.body = {
        email: "test@example.com",
        password: "password123",
        name: "Test",
      };
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue("hashed");
      (prisma.user.create as any).mockResolvedValue({
        id: "1",
        email: "test@example.com",
      });

      await registerUser(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("#loginUser", () => {
    it("should login successfully", async () => {
      req.body = { email: "test@example.com", password: "password123" };
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "1",
        passwordHash: "hashed",
      });
      (bcrypt.compare as any).mockResolvedValue(true);

      await loginUser(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Login successful" }),
      );
    });
  });

  describe("#requestPasswordReset", () => {
    it("should return success message if user exists", async () => {
      req.body = { email: "test@example.com" };
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "1",
        email: "test@example.com",
      });
      (jwt.sign as jest.Mock).mockReturnValue("token");

      await requestPasswordReset(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    });

    it("should return success message even if user does not exist", async () => {
      req.body = { email: "nonexistent@example.com" };
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await requestPasswordReset(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    });
  });

  describe("#resetPassword", () => {
    it("should reset password successfully", async () => {
      req.body = { token: "token", password: "newpassword" };
      (jwt.verify as jest.Mock).mockReturnValue({ id: "1" });
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "1",
        resetToken: "token",
        resetTokenExpiry: new Date(Date.now() + 100000),
      });
      (bcrypt.hash as any).mockResolvedValue("newhashed");

      await resetPassword(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        message: "Password updated successfully",
      });
    });

    it("should return 400 for invalid token", async () => {
      req.body = { token: "invalid", password: "newpassword" };
      (jwt.verify as jest.Mock).mockImplementation(() => {
        const err = new Error("Invalid token");
        err.name = "JsonWebTokenError";
        throw err;
      });

      await resetPassword(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "INVALID_TOKEN" }),
      );
    });
  });
});
