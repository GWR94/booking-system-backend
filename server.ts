import app from "./app";
import dotenv from "dotenv";
import "./src/jobs/bookingCleanup";

dotenv.config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Handle unhandled promise rejections and uncaught exceptions
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception", err);
  process.exit(1);
});
