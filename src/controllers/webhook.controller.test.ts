import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterAll,
} from "@jest/globals";
import { Request, Response, NextFunction } from "express";

jest.mock("stripe", () => {
  const mockWebhooks = {
    constructEvent: jest.fn(),
  };
  const mockPaymentIntents = {
    update: jest.fn(),
    retrieve: jest.fn(() => Promise.resolve({ amount: 2000 })),
  };
  const mockInstance = {
    webhooks: mockWebhooks,
    paymentIntents: mockPaymentIntents,
  };
  const mockConstructor = jest.fn(() => mockInstance);
  (mockConstructor as any).__mockInstance = mockInstance;

  return {
    __esModule: true,
    default: mockConstructor,
  };
});

jest.mock("@config", () => ({
  __esModule: true,
  prisma: {
    booking: {
      update: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    slot: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
  MEMBERSHIP_TIERS: {
    PAR: { priceId: "price_par" },
  },
  default: {
    prisma: {
      booking: {
        update: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      slot: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    },
  },
}));

jest.mock("@utils", () => ({
  handleSendEmail: jest.fn(),
  groupSlotsByBay: jest.fn(),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("Webhook Controller", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let handleWebhook: any; // Dynamic import

  beforeEach(() => {
    jest.resetModules(); // Reset cache to force re-execution of top-level code (new Stripe)

    // Re-require dependencies to get fresh mocks/modules
    const { prisma } = require("@config");
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
    const StripeClass = (jest.requireMock("stripe") as any).default;
    const stripeInstance = StripeClass.__mockInstance;

    stripeInstance.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("Signature verification failed");
    });

    await handleWebhook(req as Request, res as Response, next);

    expect(res.sendStatus).toHaveBeenCalledWith(400);
  });

  it("should process payment_intent.succeeded event", async () => {
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
    const stripeInstance = StripeClass.__mockInstance;
    stripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    const { prisma } = require("@config");
    (prisma.booking.update as any).mockResolvedValue({ id: 1 } as any);
    (prisma.booking.findUnique as any).mockResolvedValue({
      id: 1,
      user: { email: "test@test.com" },
      slots: [],
    } as any);

    await handleWebhook(req as Request, res as Response, next);

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: "confirmed" }),
      }),
    );
  });

  it("should process payment_intent.created for authenticated user", async () => {
    const mockEvent = {
      type: "payment_intent.created",
      data: {
        object: {
          id: "pi_auth",
          metadata: { userId: "10", slotIds: "[501, 502]", isGuest: "false" },
        },
      },
    };

    const StripeClass = (jest.requireMock("stripe") as any).default;
    const stripeInstance = StripeClass.__mockInstance;
    stripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    const { prisma } = require("@config");
    (prisma.slot.findMany as any).mockResolvedValue([
      { id: 501, status: "available" },
      { id: 502, status: "available" },
    ]);
    (prisma.booking.create as any).mockResolvedValue({ id: 100 } as any);

    await handleWebhook(req as Request, res as Response, next);

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ user: { connect: { id: 10 } } }),
      }),
    );
    expect(stripeInstance.paymentIntents.update).toHaveBeenCalledWith(
      "pi_auth",
      { metadata: expect.objectContaining({ bookingId: "100" }) },
    );
  });

  it("should process payment_intent.created for guest user", async () => {
    const mockEvent = {
      type: "payment_intent.created",
      data: {
        object: {
          id: "pi_guest",
          metadata: {
            slotIds: "[601]",
            isGuest: "true",
            guestName: "Guest",
            guestEmail: "guest@test.com",
          },
        },
      },
    };

    const StripeClass = (jest.requireMock("stripe") as any).default;
    const stripeInstance = StripeClass.__mockInstance;
    stripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    const { prisma } = require("@config");
    (prisma.user.upsert as any).mockResolvedValue({
      id: 99,
      email: "guest@test.com",
    });
    (prisma.slot.findMany as any).mockResolvedValue([
      { id: 601, status: "available" },
    ]);
    (prisma.booking.create as any).mockResolvedValue({ id: 101 } as any);

    await handleWebhook(req as Request, res as Response, next);

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "guest@test.com" } }),
    );
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ user: { connect: { id: 99 } } }),
      }),
    );
  });

  it("should handle payment_intent.payment_failed via handleFailedPayment", async () => {
    const mockEvent = {
      type: "payment_intent.payment_failed",
      data: {
        object: {
          metadata: { bookingId: "50" },
        },
      },
    };
    const StripeClass = (jest.requireMock("stripe") as any).default;
    const stripeInstance = StripeClass.__mockInstance;
    stripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    const { prisma } = require("@config");
    (prisma.booking.update as any).mockResolvedValue({
      id: 50,
      slots: [{ id: 501 }],
    });

    await handleWebhook(req as Request, res as Response, next);

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 50 },
        data: { status: "failed" },
      }),
    );
    expect(prisma.slot.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [501] } },
        data: { status: "available" },
      }),
    );
  });

  it("should handle customer.subscription.created/updated", async () => {
    const mockEvent = {
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_123",
          status: "active",
          current_period_start: 1700000000,
          current_period_end: 1702000000,
          items: { data: [{ price: { id: "price_par" } }] },
          cancel_at_period_end: false,
        },
      },
    };

    const StripeClass = (jest.requireMock("stripe") as any).default;
    const stripeInstance = StripeClass.__mockInstance;
    stripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    const { prisma } = require("@config");
    // Mock MEMBERSHIP_TIERS lookup indirectly by ensuring logic works or mocking config if possible.
    // For now, assuming price_par doesn't match mocked config keys or relies on env vars.
    // Ideally we'd mock config, but it's a const.

    await handleWebhook(req as Request, res as Response, next);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeCustomerId: "cus_123" },
        data: expect.objectContaining({ membershipStatus: "ACTIVE" }),
      }),
    );
  });

  it("should handle customer.subscription.deleted", async () => {
    const mockEvent = {
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_456" } },
    };
    const StripeClass = (jest.requireMock("stripe") as any).default;
    const stripeInstance = StripeClass.__mockInstance;
    stripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    const { prisma } = require("@config");

    await handleWebhook(req as Request, res as Response, next);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeCustomerId: "cus_456" },
        data: expect.objectContaining({ membershipStatus: "CANCELLED" }),
      }),
    );
  });

  it("should handle unhandled event types gracefully", async () => {
    const mockEvent = { type: "unhandled.event", data: {} };
    const StripeClass = (jest.requireMock("stripe") as any).default;
    const stripeInstance = StripeClass.__mockInstance;
    stripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

    await handleWebhook(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
  });
});
