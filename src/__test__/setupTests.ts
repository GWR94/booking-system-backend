jest.mock("nodemailer-express-handlebars", () => () => ({}));
jest.mock("passport", () => ({
  use: jest.fn(),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn(),
  initialize: jest.fn(() => (req: any, res: any, next: any) => next()),
  session: jest.fn(() => (req: any, res: any, next: any) => next()),
  authenticate: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

// Mock environment variables
process.env.ACCESS_TOKEN_SECRET = "test_access_secret";
process.env.REFRESH_TOKEN_SECRET = "test_refresh_secret";
process.env.STRIPE_SECRET_KEY = "test_key";
process.env.FRONT_END = "http://localhost:3000";
process.env.JWT_SECRET = "test_jwt_secret";
process.env.JWT_REFRESH_SECRET = "test_jwt_refresh_secret";
process.env.GOOGLE_CLIENT_ID = "mock_google_id";
process.env.GOOGLE_CLIENT_SECRET = "mock_google_secret";
process.env.FACEBOOK_APP_ID = "mock_fb_id";
process.env.FACEBOOK_APP_SECRET = "mock_fb_secret";
process.env.TWITTER_CONSUMER_KEY = "mock_twitter_key";
process.env.TWITTER_CONSUMER_SECRET = "mock_twitter_secret";

// Mock Passport Strategies
const MockStrategy = jest.fn().mockImplementation(() => ({
  name: "mock-strategy",
  authenticate: jest.fn(),
}));

jest.mock("passport-google-oauth20", () => ({
  Strategy: MockStrategy,
}));
jest.mock("passport-facebook", () => ({
  Strategy: MockStrategy,
}));
jest.mock("passport-twitter", () => ({
  Strategy: MockStrategy,
}));

// Conditional Prisma Mock: unit tests will use this, integration tests will unmock it.
// Note: We use a named mock that can be overridden or unmocked in test files.
jest.mock("@config/prisma.config", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    booking: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    slot: {
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    bay: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    membership: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    adminSettings: {
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    $disconnect: jest.fn(),
    $transaction: jest.fn((cb) =>
      cb({
        user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
        booking: { create: jest.fn(), update: jest.fn() },
        slot: { findMany: jest.fn(), updateMany: jest.fn() },
      }),
    ),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  jest.resetModules();
});
