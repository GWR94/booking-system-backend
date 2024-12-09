import { NextFunction, Response, Request, Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  refreshToken,
  verifyUser,
  User,
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
  (req: Request, res: Response) => {
    const { accessToken, refreshToken } = generateTokens(req.user as User);
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Only HTTPS in production
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      domain:
        process.env.NODE_ENV === "production"
          ? process.env.FRONT_END
          : "localhost",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Only HTTPS in production
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      domain:
        process.env.NODE_ENV === "production"
          ? process.env.FRONT_END
          : "localhost",
      path: "/api/user/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.redirect(process.env.FRONT_END as string);
  }
);

router.get("/verify", verifyUser);

router.post("/refresh", refreshToken);

// Protected route to get user profile
router.get("/profile", authenticateToken, getUserProfile);

export default router;
