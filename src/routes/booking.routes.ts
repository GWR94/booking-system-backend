import { Router } from "express";
import {
  createAdminBooking,
  cancelBooking,
  createPaymentIntent,
  createBooking,
  createGuestBooking,
  createGuestPaymentIntent,
  getBookingByPaymentId,
} from "../controllers/booking.controller";
import authenticateToken from "../middleware/authenticate-token";
import authorizeAdmin from "../middleware/authorize-admin";

export const router = Router();

// Route to create a new admin booking (authenticated users)
router.post(
  "/local-book",
  authenticateToken,
  authorizeAdmin,
  createAdminBooking
);

router.post("/guest", createGuestBooking);

router.post("/guest/create-payment-intent", createGuestPaymentIntent);

router.post("/", authenticateToken, createBooking);

// route to get client secret and create payment intent
router.post("/create-payment-intent", authenticateToken, createPaymentIntent);

// Route to cancel an existing booking (authenticated users)
router.delete("/:bookingId", authenticateToken, cancelBooking);

router.get("/payment/:paymentId", getBookingByPaymentId);

export default router;
