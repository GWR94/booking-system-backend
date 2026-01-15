import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  refreshToken,
  verifyUser,
  setOAuthTokensThenRedirect,
  deleteUserProfile,
  checkEmailExists,
  updateUser,
  createSubscriptionSession,
  createPortalSession,
  unlinkProvider,
} from "../controllers/user.controller";
import authenticateToken from "../middleware/authenticate-token";
import passiveAuthenticate from "../middleware/passive-authenticate";
import passport from "../config/passport";
import { validateRegistration, validateLogin } from "../middleware/validation";

const router = Router();

// Route to register a new user
router.post("/register", validateRegistration, registerUser);

// Route to login an existing user
router.post("/login", validateLogin, loginUser);

// Route to logout an existing user
router.post("/logout", logoutUser);

router.get(
  "/login/google",
  passiveAuthenticate,
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/login/google/callback",
  passiveAuthenticate,
  passport.authenticate("google", { session: false }),
  setOAuthTokensThenRedirect
);

router.get(
  "/login/facebook",
  passiveAuthenticate,
  passport.authenticate("facebook")
);

router.get(
  "/login/facebook/callback",
  passiveAuthenticate,
  passport.authenticate("facebook", { session: false }),
  setOAuthTokensThenRedirect
);

router.get(
  "/login/twitter",
  passiveAuthenticate,
  passport.authenticate("twitter")
);

router.get(
  "/login/twitter/callback",
  passiveAuthenticate,
  passport.authenticate("twitter", { session: false }),
  setOAuthTokensThenRedirect
);

router.delete(
  "/social-connection/:provider",
  authenticateToken,
  unlinkProvider
);

router.delete("/profile/delete", authenticateToken, deleteUserProfile);

router.get("/verify", verifyUser);

router.post("/refresh", refreshToken);

// Protected route to get user profile
router.get("/profile", authenticateToken, getUserProfile);

// Protected route to update user profile
router.patch("/profile", authenticateToken, updateUser);

// Subscription routes
router.post(
  "/subscription/create-session",
  authenticateToken,
  createSubscriptionSession
);
router.post(
  "/subscription/portal-session",
  authenticateToken,
  createPortalSession
);

router.get("/check-email", checkEmailExists);

export default router;
