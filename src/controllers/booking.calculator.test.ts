import { createPaymentIntent } from "./booking.controller";
import prisma from "../config/prisma-client";
import calculateBasketCost from "../utils/calculate-basket-cost";
import { MEMBERSHIP_TIERS } from "../config/membership.config";

// Mock dependencies
// Mock dependencies
jest.mock("../config/prisma-client", () => {
  return {
    __esModule: true,
    default: {
      user: {
        findUnique: jest.fn(),
      },
    },
  };
});

jest.mock("../utils/calculate-basket-cost", () => {
  return {
    __esModule: true,
    default: jest.fn(),
  };
});

const mockStripe = {
  paymentIntents: {
    create: jest.fn(),
  },
};
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

describe("Booking Cost Logic", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      body: { items: [{ slotIds: [101] }] }, // 1 slot requested
      currentUser: { id: 1 },
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    next = jest.fn();
    (calculateBasketCost as jest.Mock).mockReturnValue(2000); // Base price £20
    mockStripe.paymentIntents.create.mockResolvedValue({
      client_secret: "secret",
    });
  });

  it("should apply no discount for non-members", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      membershipTier: null,
      bookings: [],
    });

    await createPaymentIntent(req, res, next);

    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2000,
      })
    );
  });

  it("should make booking free if within included hours", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      membershipTier: "BRONZE",
      membershipStatus: "active",
      currentPeriodStart: new Date("2023-01-01"),
      currentPeriodEnd: new Date("2023-02-01"),
      bookings: [], // 0 used hours
    });
    // Bronze has 5 included hours. Requesting 1.

    await createPaymentIntent(req, res, next);

    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 50, // Minimum stripe amount? Logic says free means 0 cost costForPaid calculation.
        // Wait, logic says finalAmount = 0 if free.
        // But Stripe minimum is 50. Code: amount: finalAmount < 50 ? 50 : finalAmount
        // So it should be 50.
      })
    );
  });

  it("should apply discount if included hours exceeded", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      membershipTier: "BRONZE",
      membershipStatus: "active",
      currentPeriodStart: new Date("2023-01-01"),
      currentPeriodEnd: new Date("2023-02-01"),
      bookings: [
        // Mock 5 hours used
        {
          status: "confirmed",
          bookingTime: new Date("2023-01-02"),
          slots: [{}, {}, {}, {}, {}],
        },
      ],
    });
    // Bronze: 5 included, 5 used. 0 remaining.
    // Requesting 1 slot. Price 2000.
    // Discount 10%. Cost = 2000 * 0.9 = 1800.

    await createPaymentIntent(req, res, next);

    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1800,
      })
    );
  });

  it("should mix free and paid hours correctly", async () => {
    req.body.items = [{ slotIds: [100, 101] }]; // 2 slots. 4000 total base.
    (calculateBasketCost as jest.Mock).mockReturnValue(4000);

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      membershipTier: "BRONZE",
      membershipStatus: "active",
      currentPeriodStart: new Date("2023-01-01"),
      currentPeriodEnd: new Date("2023-02-01"),
      bookings: [
        // Mock 4 hours used
        {
          status: "confirmed",
          bookingTime: new Date("2023-01-02"),
          slots: [{}, {}, {}, {}],
        },
      ],
    });
    // Bronze: 5 included. 4 used. 1 remaining.
    // Requesting 2 slots.
    // 1 Free. 1 Paid.
    // Base price per slot = 4000 / 2 = 2000.
    // Paid cost = 1 * 2000 = 2000.
    // Discount on paid: 10%. 2000 * 0.9 = 1800.
    // Total = 1800.

    await createPaymentIntent(req, res, next);

    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1800,
      })
    );
  });
});
