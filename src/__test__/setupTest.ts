jest.mock("bcrypt");
jest.mock("jsonwebtoken");

// Mock Stripe
// jest.mock("stripe", () => {
//   return jest.fn().mockImplementation(() => ({
//     checkout: {
//       sessions: {
//         create: jest.fn(),
//       },
//     },
//     paymentIntents: {
//       create: jest.fn().mockResolvedValue({
//         client_secret: "mock_secret_key",
//       }),
//     },
//   }));
// });

// Mock PrismaClient
jest.mock("../config/prisma-client", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    slot: {
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    bay: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock environment variables
process.env.STRIPE_SECRET_KEY = "test_key";
process.env.FRONT_END = "http://localhost:3000";

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  jest.resetModules();
});
