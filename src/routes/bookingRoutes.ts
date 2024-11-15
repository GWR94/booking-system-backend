import { Router } from "express";
import { createBooking, cancelBooking } from "../controllers/bookingController";
import authenticateToken from "../middleware/authenticateToken";

const router = Router() as any;

// Route to create a new booking (authenticated users)
router.post("/", authenticateToken, createBooking);

// Route to cancel an existing booking (authenticated users)
router.delete("/:bookingId", authenticateToken, cancelBooking);

export default router;
