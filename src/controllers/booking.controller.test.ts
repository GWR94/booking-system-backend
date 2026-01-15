import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterAll,
} from "@jest/globals";
import { Response, NextFunction } from "express";
import { createBooking } from "./booking.controller";
import prisma from "../config/prisma-client";
import { AuthenticatedRequest } from "../interfaces/common.i";

jest.mock("../utils/group-slots", () => ({
  groupSlotsByBay: jest.fn(),
}));

jest.mock("../utils/calculate-basket-cost", () => jest.fn());

jest.mock("stripe", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      paymentIntents: {
        create: jest.fn(),
      },
    })),
  };
});

// Mock dependencies
jest.mock("../config/prisma-client", () => {
  const client = {
    booking: { create: jest.fn() },
    slot: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  (client.$transaction as jest.Mock) = jest.fn((cb: any) => cb(client));

  return {
    __esModule: true,
    default: client,
  };
});

describe("BookingController Integration", () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      currentUser: {
        id: 1,
        email: "test@test.com",
        membershipTier: "PAR",
        membershipStatus: "ACTIVE",
      },
      body: {},
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

  describe("#createBooking", () => {
    it("should create a booking successfully when slot is available", async () => {
      // Arrange
      req.body = {
        slotIds: [123],
        date: "2025-05-20",
      };

      const mockSlot = { id: 123, isBooked: false };
      const mockBooking = {
        id: 1,
        slotId: 123,
        userId: 1,
      };

      // Mock Prisma behavior
      (prisma.slot.findMany as any).mockResolvedValue([mockSlot]);
      (prisma.booking.create as any).mockResolvedValue(mockBooking);
      (prisma.slot.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(prisma);
      });

      await createBooking(req as AuthenticatedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Booking created successfully",
          booking: expect.objectContaining({
            id: 1,
            slotId: 123,
            userId: 1,
          }),
        })
      );
    });

    it("should fail if slot is missing or already booked", async () => {
      // Arrange
      req.body = { slotIds: [999] };

      (prisma.slot.findMany as any).mockResolvedValue([]);

      await createBooking(req as AuthenticatedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
