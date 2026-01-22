import { Router } from "express";
import {
  getAllUsers,
  getAllBookings,
  getDashboardStats,
  createAdminBooking,
  createSlot,
  updateSlot,
  deleteSlot,
  updateBookingStatus,
  deleteBooking,
  extendBooking,
  checkBookingExtendAvailability,
  blockSlots,
  unblockSlots,
  getAdminSlots,
  updateUserDetails,
  resetUserPassword,
} from "@controllers";
import { authenticateToken, authorizeAdmin } from "@middleware";

const router = Router();

router.use(authenticateToken, authorizeAdmin);

router.get("/dashboard-stats", getDashboardStats);
router.get("/users", getAllUsers);
router.put("/users/:id", updateUserDetails);
router.post("/users/:id/reset-password", resetUserPassword);
router.get("/bookings", getAllBookings);
router.get("/bookings/:id/extend-availability", checkBookingExtendAvailability);
router.patch("/bookings/:id/status", updateBookingStatus);
router.patch("/bookings/:id/extend", extendBooking);
router.delete("/bookings/:id", deleteBooking);
router.post("/bookings/local-book", createAdminBooking);

router.post("/slots", createSlot);
router.put("/slots/:id", updateSlot);
router.delete("/slots/:id", deleteSlot);

router.post("/slots/block", blockSlots);
router.post("/slots/unblock", unblockSlots);
router.get("/slots", getAdminSlots);

export default router;
