import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import prisma from "../config/prisma-client";
import generateTokens from "../middleware/generateTokens";
import { Booking } from "./bookingController";

const SALT_ROUNDS = 10;

export interface User {
  id: number;
  email: string;
  passwordHash?: string | null;
  role: string;
  name: string;
  bookings?: Booking[];
  googleId?: string | null;
  facebookId?: string | null;
  appleId?: string | null;
}

interface Error {
  message: string;
  error: string;
}

// Register a new user
export const registerUser = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  try {
    // Check if the user exists
    const userExists = await prisma.user.findUnique({
      where: { email },
    });

    if (userExists)
      return res.status(409).json({
        message: "User with this email exists",
        error: "DUPLICATE_USER",
      });

    // Hash the password before saving
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create new user in the database
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

    res.status(201).json({
      message: "User registered successfully",
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({
      message: "Couldn't complete registration.",
      error,
    });
  }
};

// verify user
export const verifyUser = async (req: Request, res: Response) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res
        .status(401)
        .json({ message: "No access token", error: "NO_ACCESS_TOKEN" });
    }

    const decoded = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET as string
    ) as User;

    const { email, name, id, role, bookings } = (await prisma.user.findUnique({
      where: { email: decoded.email },
      include: {
        bookings: {
          include: {
            slot: true,
          },
        },
      },
    })) as User;
    res.json({
      user: {
        email,
        name,
        id,
        role,
        bookings,
      },
    });
  } catch (error) {
    res.status(404).json({ message: "User not found", error });
  }
};

// Login user
export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found", error: "USER_NOT_FOUND" });
    }

    if (!user.passwordHash)
      return res.status(422).json({
        error: "WRONG_AUTH_METHOD",
        message: `Try signing in with OAuth`,
      });

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email and password combination",
        error: "WRONG_PASSWORD",
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    console.log({ accessToken, refreshToken });

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

    res.json({ message: "Login successful" });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({
      message: "Error logging in",
      error,
    });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      message: "No refresh token provided",
      error: "NO_REFRESH_TOKEN",
    });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET as string
    ) as User;
    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
    });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user as User
    );

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

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Only HTTPS in production
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      domain:
        process.env.NODE_ENV === "production"
          ? process.env.FRONT_END
          : "localhost",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    console.log("tokens refreshed...");
    res.json({ message: "Tokens refreshed" });
  } catch (err) {
    res.status(403).json({ message: "Invalid refresh token" });
  }
};

export const logoutUser = async (req: Request, res: Response) => {
  res.cookie("accessToken", "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    expires: new Date(0), // Expires immediately
  });

  res.json({ message: "Logged out successfully" });
};

// Get user profile (protected route)
export const getUserProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, bookings: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Error fetching user profile", error });
  }
};
