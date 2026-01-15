import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterAll,
} from "@jest/globals";
import { Request, Response, NextFunction } from "express";

// Mock Stripe
jest.mock("stripe", () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      webhooks: {
        constructEvent: jest.fn(),
      },
      paymentIntents: {
        update: jest.fn(),
        retrieve: jest.fn(() => Promise.resolve({ amount: 2000 })), // Mock return for retrieve
      },
    })),
  };
});

// Mock Prisma
jest.mock("../config/prisma-client", () => ({
  __esModule: true,
  default: {
    booking: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      upsert: jest.fn(),
    },
  },
}));

// Mock Utils
jest.mock("../utils/email", () => ({
  handleSendEmail: jest.fn(),
}));

jest.mock("../utils/group-slots", () => ({
  groupSlotsByBay: jest.fn(),
}));

describe("Webhook Controller", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let handleWebhook: any; // Dynamic import

  beforeEach(() => {
    jest.resetModules(); // Reset cache to force re-execution of top-level code (new Stripe)

    // Re-require dependencies to get fresh mocks/modules
    const prisma = require("../config/prisma-client").default;
    (prisma.booking.update as any).mockClear();
    (prisma.booking.findUnique as any).mockClear();

    // Re-require controller
    const controller = require("./webhook.controller");
    handleWebhook = controller.handleWebhook;

    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    req = {
      headers: { "stripe-signature": "test_signature" },
      body: { some: "raw_data" },
    };

    const resObj: any = {};
    resObj.sendStatus = jest.fn().mockReturnValue(resObj);
    resObj.json = jest.fn().mockReturnValue(resObj);
    res = resObj;

    next = jest.fn();
  });

  afterAll(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("should return 400 if signature verification fails", async () => {
    // Arrange
    const StripeClass = (jest.requireMock("stripe") as any).default;
    // With resetModules, constructor ran again. results[0] should be the new instance.
    // However, since clearMocks might clear history, we rely on the fact that resetModules runs AFTER clearMocks (in beforeEach).
    // Or rather: clearMocks runs before 'beforeEach'?
    const stripeInstance = StripeClass.mock.results[0].value;

    stripeInstance.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("Signature verification failed");
    });

    // Act
    await handleWebhook(req as Request, res as Response, next);

    // Assert
    expect(res.sendStatus).toHaveBeenCalledWith(400);
  });

  it("should process payment_intent.succeeded event", async () => {
    // Arrange
    const mockEvent = {
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_123",
          status: "succeeded",
          metadata: { bookingId: "1" },
        },
      },
    };

    const StripeClass = (jest.requireMock("stripe") as any).default;
    const stripeInstance = StripeClass.mock.results[0].value;
    stripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    const prisma = require("../config/prisma-client").default;
    (prisma.booking.update as any).mockResolvedValue({ id: 1 } as any);
    (prisma.booking.findUnique as any).mockResolvedValue({
      id: 1,
      user: { email: "test@test.com" },
      slots: [],
    } as any);

    // Act
    await handleWebhook(req as Request, res as Response, next);

    // Assert
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: "confirmed" }),
      })
    );
  });

  it("should handle unhandled event types gracefully", async () => {
    // Arrange
    const mockEvent = { type: "unhandled.event", data: {} };
    const StripeClass = (jest.requireMock("stripe") as any).default;
    const stripeInstance = StripeClass.mock.results[0].value;
    stripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    // Act
    await handleWebhook(req as Request, res as Response, next);

    // Assert
    expect(next).not.toHaveBeenCalled();
  });
});
