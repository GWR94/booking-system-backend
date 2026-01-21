import "@config/env.config";
import { configurePassport } from "@config/passport.config";
import { startBookingCleanupJob } from "./src/jobs/booking-cleanup";
import { logger } from "./src/utils";
import app from "./app";

configurePassport();
startBookingCleanupJob();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
