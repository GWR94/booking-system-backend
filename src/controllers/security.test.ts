import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterAll,
} from "@jest/globals";
import { Response, NextFunction } from "express";
import { updateUser } from "./user.controller";
import { prisma } from "@config";
import { AuthenticatedRequest } from "@interfaces";

// Mock Utils
jest.mock("@utils", () => ({
  generateTokens: jest.fn(),
  handleSendEmail: jest.fn(),
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock Stripe
jest.mock("stripe", () => {
  const mockInstance = {
    paymentIntents: { create: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
    customers: { create: jest.fn(), update: jest.fn() },
    billingPortal: { sessions: { create: jest.fn() } },
  };
  const mockConstructor = jest.fn(() => mockInstance);
  (mockConstructor as any).__mockInstance = mockInstance;
  return {
    __esModule: true,
    default: mockConstructor,
  };
});

// Mock dependencies
jest.mock("@config", () => {
  const client = {
    user: {
      update: jest.fn(),
    },
    booking: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    slot: {
      updateMany: jest.fn(),
    },
  };
  return {
    __esModule: true,
    prisma: client,
    default: { prisma: client },
  };
});

describe("Security Vulnerability Verification", () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      currentUser: {
        id: 1,
        email: "victim@test.com",
        role: "user",
      } as any,
      body: {},
      params: {},
    } as Partial<AuthenticatedRequest>;

    const resObj: any = {};
    resObj.status = jest.fn().mockReturnValue(resObj);
    resObj.json = jest.fn().mockReturnValue(resObj);
    res = resObj;

    next = jest.fn();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("Mass Assignment (User Controller)", () => {
    it("should NOT allow updating restricted fields like 'role'", async () => {
      req.body = {
        name: "Hacker",
        role: "admin", // Restricted field
      };

      // Mock successful update for allowed fields
      (prisma.user.update as any).mockResolvedValue({
        id: 1,
        name: "Hacker",
        role: "user", // DB should still show 'user'
      });

      await updateUser(req as AuthenticatedRequest, res as Response, next);

      // Verify that prisma.update was called, but ONLY with 'name', not 'role'
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: {
            name: "Hacker",
            // role should NOT be present here
          },
        }),
      );

      const updateCallArgs = (prisma.user.update as any).mock.calls[0][0];
      expect(updateCallArgs.data).not.toHaveProperty("role");
    });
  });
});
