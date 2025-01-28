import { NextFunction, Response, Request, Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  refreshToken,
  verifyUser,
  User,
  setOAuthTokensThenRedirect,
  deleteUserProfile,
} from "../controllers/userController";
import authenticateToken from "../middleware/authenticateToken";
import passport from "../config/passport";
import { validateRegistration, validateLogin } from "../middleware/validation";
import generateTokens from "../middleware/generateTokens";

// /api/user/...
const router = Router() as any;

// Route to register a new user
router.post("/register", validateRegistration, registerUser);

// Route to login an existing user
router.post("/login", validateLogin, loginUser);

// Route to logout an existing user
router.post("/logout", logoutUser);

router.get(
  "/login/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/login/google/callback",
  passport.authenticate("google", { session: false }),
  setOAuthTokensThenRedirect
);

router.get("/login/facebook", passport.authenticate("facebook"));

router.get(
  "/login/facebook/callback",
  passport.authenticate("facebook", { session: false }),
  setOAuthTokensThenRedirect
);

router.delete("/profile/delete", deleteUserProfile);

router.get("/verify", verifyUser);

router.post("/refresh", refreshToken);

// Protected route to get user profile
router.get("/profile", authenticateToken, getUserProfile);

export default router;
