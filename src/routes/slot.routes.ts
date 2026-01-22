import { Router } from "express";
import { getSlots } from "@controllers";

const router = Router();

// Route to get all available slots
router.get("/", getSlots);

export default router;
