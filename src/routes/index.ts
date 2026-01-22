import { Router } from "express";
import userRoutes from "./user.routes";
import slotRoutes from "./slot.routes";
import bookingRoutes from "./booking.routes";
import webhookRoutes from "./webhook.routes";
import contactRoutes from "./contact.routes";
import adminRoutes from "./admin.routes";

const router = Router();

router.use("/user", userRoutes);
router.use("/slots", slotRoutes);
router.use("/bookings", bookingRoutes);
router.use("/webhook", webhookRoutes);
router.use("/contact", contactRoutes);
router.use("/admin", adminRoutes);

export default router;
