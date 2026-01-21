import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import session from "express-session";
import passport from "./src/config/passport.config";
import cookieParser from "cookie-parser";
import routes from "./src/routes";
import errorHandler from "./src/middleware/error-handler";
import("./src/config/passport.config");

dotenv.config();

export interface RequestWithBody extends Request {
  rawBody?: Buffer;
}

const app = express();

app.set("trust proxy", 1);

// Middleware
app.use(cookieParser());
// FIXME - test removal
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.FRONT_END?.startsWith("https");

const domain = isProduction
  ? new URL(process.env.FRONT_END!).hostname.replace(/^[^.]+\./g, ".")
  : undefined;

app.use(
  session({
    secret: process.env.SESSION_SECRET || "",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: isProduction, // Set to true if using https
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: isProduction ? "none" : "lax",
      domain,
    },
  }),
);
app.use(helmet()); // Sets secure HTTP headers
app.use(
  cors({
    origin: process.env.FRONT_END,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(morgan("dev")); // Request logging
app.use(
  express.json({
    verify: (req: RequestWithBody, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max requests per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request, res: Response): string => {
    const cloudflareIP = req.header("CF-Connecting-IP");
    return (
      (Array.isArray(cloudflareIP) ? cloudflareIP[0] : cloudflareIP) ||
      req.ip ||
      "127.0.0.1"
    );
  },
});

app.use("/api", apiLimiter);

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api", routes);

import { prisma } from "@config";

// Root route
app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to the Booking System API");
});

// Health Check
app.get("/health", async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", timestamp: new Date() });
  } catch (error) {
    console.error("Health check failed:", error);
    res
      .status(500)
      .json({ status: "error", message: "Database connection failed" });
  }
});

// Error Handling Middleware
app.use(errorHandler);

export default app;
