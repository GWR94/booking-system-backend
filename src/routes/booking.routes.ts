import { Router } from "express";
import {
  cancelBooking,
  createPaymentIntent,
  createBooking,
  createGuestBooking,
  createGuestPaymentIntent,
  getBookingByPaymentId,
} from "@controllers";
import { authenticateToken } from "@middleware";

export const router = Router();

router.post("/guest", createGuestBooking);

router.post("/guest/create-payment-intent", createGuestPaymentIntent);

router.post("/", authenticateToken, createBooking);

// route to get client secret and create payment intent
router.post("/create-payment-intent", authenticateToken, createPaymentIntent);

// Route to cancel an existing booking (authenticated users)
router.delete("/:bookingId", authenticateToken, cancelBooking);

router.get("/payment/:paymentId", getBookingByPaymentId);

export default router;
