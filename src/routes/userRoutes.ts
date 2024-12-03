import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  refreshToken,
  verifyUser,
} from "../controllers/userController";
import authenticateToken from "../middleware/authenticateToken";
import { validateRegistration, validateLogin } from "../middleware/validation";

const router = Router() as any;

// Route to register a new user
router.post("/register", validateRegistration, registerUser);

// Route to login an existing user
router.post("/login", validateLogin, loginUser);

// Route to logout an existing user
router.post("/logout", logoutUser);

router.get("/verify", verifyUser);

router.post("/refresh", refreshToken);

// Protected route to get user profile
router.get("/profile", authenticateToken, getUserProfile);

export default router;
