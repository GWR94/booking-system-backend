import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import prisma from "./src/utils/prismaClient"; // Prisma Client import
import routes from "./src/routes";
import errorHandler from "./src/middleware/errorHandler";

dotenv.config();

const app = express();

// Middleware
app.use(helmet()); // Sets secure HTTP headers
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" })); // Configure CORS
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

// Root route
app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to the Booking System API");
});

// Error Handling Middleware
app.use(errorHandler);

export default app;
