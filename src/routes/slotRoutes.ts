import { Router } from "express";
import {
  createSlot,
  getSlots,
  updateSlot,
  getUniqueSlot,
  deleteSlot,
} from "../controllers/slotController";
import authenticateToken from "../middleware/authenticateToken";
import authorizeAdmin from "../middleware/authorizeAdmin";

const router = Router() as any;

// Route to create a slot (protected by admin role)
router.post("/", authenticateToken, authorizeAdmin, createSlot);

// Route to get all available slots
router.get("/", getSlots);

router.get("/:id", getUniqueSlot);

// Route to update a slot (protected by admin role)
router.put("/:id", authenticateToken, authorizeAdmin, updateSlot);

// Route to delete a slot (protected by admin role)
router.delete("/:id", authenticateToken, authorizeAdmin, deleteSlot);

export default router;
