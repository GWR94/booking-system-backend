import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";

// Mock Stripe
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
  }));
});

// Mock PrismaClient
jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      booking: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      slot: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      bay: {
        findUnique: jest.fn(),
      },
    })),
  };
});

// Mock environment variables
process.env.STRIPE_SECRET_KEY = "test_key";
process.env.FRONT_END = "http://localhost:3000";

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  jest.resetModules();
});
