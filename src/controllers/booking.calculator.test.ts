import { createPaymentIntent } from "./booking.controller";
import prisma from "../config/prisma-client";
import calculateBasketCost from "../utils/calculate-basket-cost";
import Stripe from "stripe";

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

// Mock Stripe wrapper
// We define the mock factory to return a consistent structure that matches the Stripe class instance.
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
    },
  }));
});

describe("Booking Cost Logic", () => {
  let req: any;
  let res: any;
  let next: any;
  let mockPaymentIntentsCreate: jest.Mock;

  beforeAll(() => {
    // Retrieve the mock instance created by the controller.
    // Since `booking.controller.ts` instantiates `new Stripe()` at the module level (top-level),
    // the mock constructor record will allow us to grab the instance.
    const stripeConstructorMock = Stripe as unknown as jest.Mock;

    // Check results first (preferred for constructor returns) else instances
    const mockInstance =
      (stripeConstructorMock.mock.results[0] &&
        stripeConstructorMock.mock.results[0].value) ||
      stripeConstructorMock.mock.instances[0];

    if (!mockInstance) {
      // If this happens, it means the controller didn't instantiate Stripe, or import order is messing up.
      // However, standard Jest behavior should capture it.
      throw new Error(
        "Could not find Stripe mock instance. Ensure booking.controller.ts is importing and instantiating Stripe."
      );
    }

    mockPaymentIntentsCreate = mockInstance.paymentIntents.create;
  });

  beforeEach(() => {
    req = {
      body: { items: [{ slotIds: [101] }] },
      currentUser: { id: 1 },
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    next = jest.fn();

    // Default mocks
    (calculateBasketCost as jest.Mock).mockReturnValue(4500); // 4500 pence (£45)
    mockPaymentIntentsCreate.mockResolvedValue({
      client_secret: "test_client_secret",
    });
    mockPaymentIntentsCreate.mockClear();
    (prisma.user.findUnique as jest.Mock).mockReset();
  });

  it("should apply no discount for non-members", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      membershipTier: null,
      bookings: [],
    });

    await createPaymentIntent(req, res, next);

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4500,
      })
    );
  });

  it("should make booking free if within included hours (Bronze)", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      membershipTier: "PAR",
      bookings: [], // 0 used hours
      currentPeriodStart: new Date("2023-01-01"),
      currentPeriodEnd: new Date("2023-02-01"),
      membershipStatus: "active",
    });

    await createPaymentIntent(req, res, next);

    // Should be free, so no Stripe call or amount 0?
    expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ clientSecret: null, amount: 0 });
  });

  it("should apply discount if included hours exceeded (Bronze)", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      membershipTier: "PAR",
      membershipStatus: "active",
      currentPeriodStart: new Date("2023-01-01"),
      currentPeriodEnd: new Date("2023-02-01"),
      bookings: [
        {
          status: "confirmed",
          bookingTime: new Date("2023-01-02"),
          slots: new Array(5).fill({}), // 5 slots used
        },
      ],
    });
    // Bronze: 5 included, 5 used. 0 remaining.
    // Requesting 1 slot (default req body). Price 4500.
    // Discount 10%. Cost = 4500 * 0.9 = 4050.

    await createPaymentIntent(req, res, next);

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4050,
      })
    );
  });

  it("should mix free and paid hours correctly", async () => {
    // Request 2 slots. Total base cost 9000.
    req.body.items = [{ slotIds: [101, 102] }];
    (calculateBasketCost as jest.Mock).mockReturnValue(9000);

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      membershipTier: "PAR",
      membershipStatus: "active",
      currentPeriodStart: new Date("2023-01-01"),
      currentPeriodEnd: new Date("2023-02-01"),
      bookings: [
        {
          status: "confirmed",
          bookingTime: new Date("2023-01-02"),
          slots: new Array(4).fill({}), // 4 slots used
        },
      ],
    });
    // Bronze: 5 included. 4 used. 1 remaining.
    // Requesting 2 slots.
    // 1 Free. 1 Paid.
    // Base price per slot = 4500.
    // Paid component: 1 slot * 4500 * 0.9 (10% off) = 4050.
    // Free component: 0.
    // Total = 4050.

    await createPaymentIntent(req, res, next);

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4050,
      })
    );
  });

  it("should apply Silver discount (15%) correctly", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      membershipTier: "BIRDIE",
      membershipStatus: "active",
      currentPeriodStart: new Date("2023-01-01"),
      currentPeriodEnd: new Date("2023-02-01"),
      bookings: [
        {
          status: "confirmed",
          bookingTime: new Date("2023-01-02"),
          slots: new Array(10).fill({}), // 10 slots used (all included used)
        },
      ],
    });
    // Requesting 1 slot. Base 4500.
    // Silver discount 15%.
    // Cost = 4500 * 0.85 = 3825.

    await createPaymentIntent(req, res, next);

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 3825,
      })
    );
  });
  it("should charge Par member for weekend slots even if included hours available", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      membershipTier: "PAR", // Par
      membershipStatus: "active",
      currentPeriodStart: new Date("2023-01-01"),
      currentPeriodEnd: new Date("2023-02-01"),
      bookings: [], // 0 used
    });

    // Jan 8, 2023 is a Sunday
    req.body.items = [
      {
        slotIds: [101], // 1 hour
        startTime: "2023-01-08T10:00:00Z",
      },
    ];

    await createPaymentIntent(req, res, next);

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4050, // 4500 * 0.9
      })
    );
  });
});
