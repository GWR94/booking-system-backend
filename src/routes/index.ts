import { Router } from "express";
import userRoutes from "./userRoutes";
import slotRoutes from "./slotRoutes";
import bookingRoutes from "./bookingRoutes";

const router = Router();

router.use("/user", userRoutes);
router.use("/slots", slotRoutes);
router.use("/bookings", bookingRoutes);

export default router;
