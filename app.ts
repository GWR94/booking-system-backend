import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import session from "express-session";
import passport from "./src/config/passport";
import cookieParser from "cookie-parser";
import routes from "./src/routes";
import errorHandler from "./src/middleware/errorHandler";
import("./src/config/passport");

dotenv.config();

const app = express();

// Middleware
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Set to true if using https
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);
app.use(helmet()); // Sets secure HTTP headers
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONT_END
        : "http://localhost:3000",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(morgan("dev")); // Request logging
app.use(express.json()); // JSON body parsing

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max requests per IP
});

app.use("/api", apiLimiter);

// Routes
app.use("/api", routes);

app.use(passport.initialize());
app.use(passport.session());

// Root route
app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to the Booking System API");
});

// Error Handling Middleware
app.use(errorHandler);

export default app;
