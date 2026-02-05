import { Router } from "express";
import {
  cancelBooking,
  createPaymentIntent,
  createBooking,
  createGuestBooking,
  createGuestPaymentIntent,
  getBookingByPaymentId,
} from "@controllers";
import {
  authenticateToken,
  validateBooking,
  validateGuestBooking,
  authorizeBookingOwner,
} from "@middleware";

export const router = Router();

router.post("/guest", validateGuestBooking, createGuestBooking);

router.post("/guest/create-payment-intent", createGuestPaymentIntent);

router.post("/", authenticateToken, validateBooking, createBooking);

// route to get client secret and create payment intent
router.post("/create-payment-intent", authenticateToken, createPaymentIntent);

// Route to cancel an existing booking (authenticated users)
router.delete(
  "/:bookingId",
  authenticateToken,
  authorizeBookingOwner,
  cancelBooking,
);

router.get("/payment/:paymentId", getBookingByPaymentId);

export default router;
