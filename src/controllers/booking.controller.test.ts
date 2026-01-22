import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterAll,
} from "@jest/globals";
import Stripe from "stripe";
import { Response, NextFunction } from "express";
import {
  createBooking,
  cancelBooking,
  getBookingByPaymentId,
  createPaymentIntent,
  createGuestBooking,
  createGuestPaymentIntent,
} from "./booking.controller";
import { prisma } from "@config";
import { AuthenticatedRequest } from "@interfaces";

jest.mock("@utils", () => ({
  groupSlotsByBay: jest.fn(),
  calculateBasketCost: jest.fn(),
  __esModule: true,
}));

jest.mock("@services", () => ({
  BookingService: {
    createBooking: jest.fn(),
    confirmBooking: jest.fn(),
    handleFailedPayment: jest.fn(),
  },
  MembershipService: {
    handleMembershipUpdate: jest.fn(),
  },
}));

jest.mock("axios");

jest.mock("stripe", () => {
  const mockPaymentIntents = {
    create: jest.fn(),
  };
  const mockInstance = {
    paymentIntents: mockPaymentIntents,
  };
  const mockConstructor = jest.fn(() => mockInstance);
  (mockConstructor as any).__mockInstance = mockInstance;

  return {
    __esModule: true,
    default: mockConstructor,
  };
});

jest.mock("@config", () => {
  const client = {
    booking: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
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
    prisma: client,
    MEMBERSHIP_TIERS: {
      PAR: {
        name: "Par",
        includedHours: 5,
        discount: 0.1,
        weekendAccess: false,
      },
      BIRDIE: {
        name: "Birdie",
        includedHours: 10,
        discount: 0.15,
        weekendAccess: true,
      },
      HOLEINONE: {
        name: "Hole-In-One",
        includedHours: 15,
        discount: 0.2,
        weekendAccess: true,
      },
    },
    default: { prisma: client },
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

      const { BookingService } = require("@services");
      (BookingService.createBooking as any).mockResolvedValue(mockBooking);

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
        }),
      );
    });

    it("should fail if slot is missing or already booked", async () => {
      req.body = { slotIds: [999] };

      const { BookingService } = require("@services");
      (BookingService.createBooking as any).mockRejectedValue(
        new Error("One or more slots do not exist or have been booked"),
      );

      await createBooking(req as AuthenticatedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should handle creation failure gracefully", async () => {
      req.body = { slotIds: [123], date: "2025-05-20" };
      const { BookingService } = require("@services");
      (BookingService.createBooking as any).mockRejectedValue(
        new Error("Database error"),
      );

      await createBooking(req as AuthenticatedRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("#cancelBooking", () => {
    it("should cancel booking and free up slots", async () => {
      req.params = { bookingId: "1" };
      const mockBooking = { id: 1, slots: [{ id: 101 }, { id: 102 }] };

      (prisma.booking.findUnique as any).mockResolvedValue(mockBooking);
      (prisma.slot.updateMany as any).mockResolvedValue({ count: 2 });
      (prisma.booking.delete as any).mockResolvedValue(mockBooking);

      await cancelBooking(req as any, res as Response, next);

      expect(prisma.slot.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [101, 102] } },
        data: { status: "available" },
      });
      expect(prisma.booking.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res.json).toHaveBeenCalledWith({
        message: "Booking cancelled successfully",
      });
    });

    it("should return 404 if booking not found", async () => {
      req.params = { bookingId: "99" };
      (prisma.booking.findUnique as any).mockResolvedValue(null);

      await cancelBooking(req as any, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("#getBookingByPaymentId", () => {
    it("should return booking and grouped slots", async () => {
      req.params = { paymentId: "pi_123" };
      const mockBooking = {
        id: 1,
        paymentId: "pi_123",
        slots: [{ id: 101, bay: { id: 1, name: "Bay 1" } }],
      };

      // Mock utils/group-slots manually since it is mocked above
      const mockGrouped = { "Bay 1": [{ id: 101 }] };
      const groupSlotsMock = require("@utils").groupSlotsByBay;
      groupSlotsMock.mockReturnValue(mockGrouped);

      (prisma.booking.findFirst as any).mockResolvedValue(mockBooking);

      await getBookingByPaymentId(req as any, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        booking: mockBooking,
        groupedSlots: mockGrouped,
      });
    });

    it("should return 404 if booking not found", async () => {
      req.params = { paymentId: "invalid" };
      (prisma.booking.findFirst as any).mockResolvedValue(null);
      await getBookingByPaymentId(req as any, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("#createPaymentIntent", () => {
    it("should create payment intent successfully", async () => {
      req.body = {
        items: [{ slotIds: [301, 302], startTime: "2025-05-20T10:00:00Z" }],
      };
      const mockCost = 1000;

      const calcMock = require("@utils").calculateBasketCost;
      calcMock.mockReturnValue(mockCost);

      const stripeInstance = (Stripe as any).__mockInstance;
      (stripeInstance.paymentIntents.create as any).mockResolvedValue({
        client_secret: "pi_secret_123",
      });

      // Mock user for membership check (plain user, full price)
      (prisma.user.findUnique as any).mockResolvedValue({
        id: 1,
        membershipTier: null,
      });

      await createPaymentIntent(req as any, res as Response, next);

      expect(stripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          currency: "gbp",
          metadata: expect.objectContaining({ userId: "1" }),
        }),
      );
      expect(res.json).toHaveBeenCalledWith({
        clientSecret: "pi_secret_123",
        amount: 1000,
      });
    });

    it("should calculate membership discounts correctly", async () => {
      req.body = {
        items: [{ slotIds: [301], startTime: "2025-05-20T10:00:00Z" }],
      };

      const calcMock = require("@utils").calculateBasketCost;
      calcMock.mockReturnValue(2000);

      (prisma.user.findUnique as any).mockResolvedValue({
        id: 1,
        membershipTier: "BIRDIE",
        membershipStatus: "ACTIVE",
        currentPeriodStart: new Date("2025-05-01"),
        currentPeriodEnd: new Date("2025-06-01"),
        bookings: [], // No used hours
      });

      const stripeInstance = (Stripe as any).__mockInstance;
      (stripeInstance.paymentIntents.create as any).mockResolvedValue({
        client_secret: "pi_secret_free",
      });

      await createPaymentIntent(req as any, res as Response, next);

      // Birdie has 10 included hours. 1 slot requested -> should be free (amount 0)
      expect(res.json).toHaveBeenCalledWith({ clientSecret: null, amount: 0 });
    });

    it("should calculate PAR membership discounts correctly", async () => {
      req.body = {
        items: [{ slotIds: [301], startTime: "2025-05-20T10:00:00Z" }],
      };

      const calcMock = require("@utils").calculateBasketCost;
      calcMock.mockReturnValue(2000);

      (prisma.user.findUnique as any).mockResolvedValue({
        id: 1,
        membershipTier: "PAR",
        membershipStatus: "ACTIVE",
        currentPeriodStart: new Date("2025-05-01"),
        currentPeriodEnd: new Date("2025-06-01"),
        bookings: [], // No used hours
      });

      const stripeInstance = (Stripe as any).__mockInstance;
      (stripeInstance.paymentIntents.create as any).mockResolvedValue({
        client_secret: "pi_secret_par",
      });

      await createPaymentIntent(req as any, res as Response, next);

      // Par has 5 included hours. 1 slot requested -> should be free (amount 0)
      expect(res.json).toHaveBeenCalledWith({ clientSecret: null, amount: 0 });
    });

    it("should calculate membership discounts correctly (Peak/Off-Peak)", async () => {
      // Monday 10 AM (Off-Peak)
      req.body = {
        items: [{ slotIds: [301], startTime: "2025-05-19T10:00:00Z" }],
      };

      (prisma.user.findUnique as any).mockResolvedValue({
        id: 1,
        membershipTier: "BIRDIE",
        membershipStatus: "ACTIVE",
        currentPeriodStart: new Date("2025-05-01"),
        currentPeriodEnd: new Date("2025-06-01"),
        bookings: [
          {
            status: "confirmed",
            bookingTime: new Date("2025-05-02"),
            slots: new Array(10).fill({}),
          },
        ], // Already used all 10 hours
      });

      const stripeInstance = (Stripe as any).__mockInstance;
      (stripeInstance.paymentIntents.create as any).mockResolvedValue({
        client_secret: "pi_secret_birdie",
      });

      await createPaymentIntent(req as any, res as Response, next);

      // 10 hours used, so we pay.
      // Off-peak rate 3500 * (1 - 0.15 discount) = 2975
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2975,
        }),
      );
    });
  });

  describe("#createGuestBooking", () => {
    it("should create guest booking successfully", async () => {
      req.body = {
        slotIds: [401],
        paymentId: "pi_guest",
        paymentStatus: "succeeded",
        guestInfo: { name: "Guest User", email: "guest@example.com" },
      };
      const mockBooking = { id: 3, userId: 2, slots: [{ id: 401 }] };

      const { BookingService } = require("@services");
      (BookingService.createBooking as any).mockResolvedValue(mockBooking);

      await createGuestBooking(req as any, res as Response, next);

      expect(BookingService.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          slotIds: [401],
          guestInfo: expect.objectContaining({
            email: "guest@example.com",
          }),
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Guest booking created successfully",
          guestEmail: "guest@example.com",
        }),
      );
    });
  });

  describe("#createGuestPaymentIntent", () => {
    it("should create guest payment intent successfully", async () => {
      req.body = {
        items: [{ slotIds: [401], startTime: "2025-05-20T10:00:00Z" }],
        guestInfo: { name: "Guest", email: "guest@example.com" },
        recaptchaToken: "valid_token",
      };

      const axios = require("axios");
      (axios.post as any).mockResolvedValue({ data: { success: true } });

      const calcMock = require("@utils").calculateBasketCost;
      calcMock.mockReturnValue(500);

      const stripeInstance = (Stripe as any).__mockInstance;
      (stripeInstance.paymentIntents.create as any).mockResolvedValue({
        client_secret: "pi_guest",
      });

      await createGuestPaymentIntent(req as any, res as Response, next);

      expect(stripeInstance.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ isGuest: "true" }),
        }),
      );
      expect(res.json).toHaveBeenCalledWith({ clientSecret: "pi_guest" });
    });
  });
});
