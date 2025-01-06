import { Router } from "express";
import {
  createBooking,
  cancelBooking,
  // createPaymentIntent,
  createCheckoutSession,
} from "../controllers/bookingController";
import authenticateToken from "../middleware/authenticateToken";

const router = Router() as any;

// Route to create a new booking (authenticated users)
router.post("/", authenticateToken, createBooking);

// route to get client secret and create payment intent
// router.post("/create-payment-intent", createPaymentIntent);

router.post("/create-checkout-session", createCheckoutSession);

// Route to cancel an existing booking (authenticated users)
router.delete("/:bookingId", authenticateToken, cancelBooking);

export default router;
