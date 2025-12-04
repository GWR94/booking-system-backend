import { CookieOptions, NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma-client";
import generateTokens from "../utils/generate-tokens";
import { User, UserPayload } from "../interfaces/user.i";
import { AuthenticatedRequest } from "../interfaces/common.i";
import ERRORS from "../utils/errors";

const SALT_ROUNDS = 10;

const accessTokenConfig: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // Only HTTPS in production
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  domain:
    process.env.NODE_ENV === "production" ? process.env.FRONT_END : "localhost",
  maxAge: 15 * 60 * 1000, // 15 minutes
};

const refreshTokenConfig: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // Only HTTPS in production
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  domain:
    process.env.NODE_ENV === "production" ? process.env.FRONT_END : "localhost",
  path: "/api/user/refresh",
};

// Register a new user
export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { name, email, password } = req.body;

  try {
    // Check if the user exists
    const userExists = await prisma.user.findUnique({
      where: { email },
    });

    if (userExists && userExists.passwordHash) {
      res.status(409).json(ERRORS.DUPLICATE_USER);
      return;
    }

    // Hash the password before saving
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    if (userExists) {
      const updatedUser = await prisma.user.update({
        where: { email },
        data: {
          passwordHash,
        },
      });

      res.status(201).json({
        message: "User registered successfully (Merged)",
        user: { id: updatedUser.id, email: updatedUser.email },
      });
      return;
    }

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
    return;
  } catch (error) {
    next(error);
  }
};

// verify user
export const verifyUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { accessToken } = req.cookies;
    if (!accessToken) {
      res.status(401).json(ERRORS.NO_ACCESS_TOKEN);
      return;
    }

    const decoded = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET as string
    ) as User;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: decoded?.email },
          { googleId: decoded?.googleId },
          { facebookId: decoded?.facebookId },
          { appleId: decoded?.appleId },
        ],
      },
      include: {
        bookings: {
          include: {
            slots: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json(ERRORS.USER_NOT_FOUND);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = user;
    res.json({
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
};

// Login user
export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email, password, rememberMe = false } = req.body;

  try {
    // Check if the user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(404).json(ERRORS.USER_NOT_FOUND);
      return;
    }

    if (!user.passwordHash) {
      res.status(422).json(ERRORS.WRONG_AUTH_METHOD);
      return;
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      res.status(401).json(ERRORS.INCORRECT_INPUT);
      return;
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    if (rememberMe) {
      refreshTokenConfig.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    const { accessToken, refreshToken } = generateTokens(user);

    res.cookie("accessToken", accessToken, accessTokenConfig);
    res.cookie("refreshToken", refreshToken, refreshTokenConfig);

    res.json({ message: "Login successful" });
  } catch (error) {
    next(error);
  }
};

export const checkEmailExists = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email } = req.query;

  try {
    const user = await prisma.user.findUnique({
      where: { email: email as string },
    });

    if (!user) {
      res.json({ exists: false });
      return;
    }

    res.json({ exists: true, role: user.role });
  } catch (error) {
    console.error("Error checking email:", error);
    res.json({ exists: false, error: true });
  }
};

export const setOAuthTokensThenRedirect = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as UserPayload;
  try {
    if (!user) {
      res.status(400).json(ERRORS.NOT_AUTHENTICATED);
      return;
    }
    const { accessToken, refreshToken } = generateTokens(user);
    res.cookie("accessToken", accessToken, accessTokenConfig);
    res.cookie("refreshToken", refreshToken, refreshTokenConfig);
    res.redirect(process.env.FRONT_END as string);
    return;
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as UserPayload;
  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...req.body,
      },
    });
    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    res.status(401).json(ERRORS.NO_REFRESH_TOKEN);
    return;
  }

  const decoded = jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET as string
  ) as UserPayload;

  try {
    // Verify refresh token
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user as User
    );

    res.cookie("accessToken", accessToken, accessTokenConfig);
    res.cookie("refreshToken", newRefreshToken, refreshTokenConfig);
    res.json({ message: "Tokens refreshed" });
  } catch (error) {
    next(error);
  }
};

export const logoutUser = (req: Request, res: Response) => {
  res.clearCookie("accessToken", accessTokenConfig);
  res.clearCookie("refreshToken", refreshTokenConfig);
  res.json({ message: "Logged out successfully" });
};

// Get user profile (protected route)
export const getUserProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.currentUser) {
    res.status(400).json(ERRORS.NOT_AUTHENTICATED);
    return;
  }
  const { id } = req.currentUser;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        name: true,
        email: true,
        bookings: true,
        googleId: true,
        facebookId: true,
        appleId: true,
      },
    });

    if (!user) {
      res.status(404).json(ERRORS.USER_NOT_FOUND);
      return;
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const deleteUserProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.currentUser) {
    res.status(400).json(ERRORS.NOT_AUTHENTICATED);
    return;
  }
  const { id } = req.currentUser;
  try {
    await prisma.user.delete({
      where: { id },
    });
    res.json({ message: "User successfully deleted" });
  } catch (error) {
    next(error);
  }
};
