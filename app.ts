import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import session from "express-session";
import passport from "./src/config/passport";
import cookieParser from "cookie-parser";
import routes from "./src/routes";
import errorHandler from "./src/middleware/error-handler";
import("./src/config/passport");

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
  })
);
app.use(helmet()); // Sets secure HTTP headers
app.use(
  cors({
    origin: process.env.FRONT_END,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(morgan("dev")); // Request logging
app.use(
  express.json({
    verify: (req: RequestWithBody, res, buf) => {
      req.rawBody = buf;
    },
  })
);
// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max requests per IP
});

app.use("/api", apiLimiter);

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api", routes);

// Root route
app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to the Booking System API");
});

// Error Handling Middleware
app.use(errorHandler);

export default app;
