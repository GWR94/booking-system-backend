import "@config/env.config";
import { configurePassport } from "@config/passport.config";
import { startBookingCleanupJob } from "./src/jobs/booking-cleanup";
import { logger } from "@utils";
import app from "./app";
import { prisma } from "@config";

configurePassport();
startBookingCleanupJob();

const PORT = process.env.PORT || 4000;

const startServer = async () => {
  try {
    await prisma.$connect();
    logger.info("Database connected successfully");

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
