import { CookieOptions, NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma-client";
import generateTokens from "../utils/generate-tokens";
import { User, UserPayload } from "../interfaces/user.i";
import { AuthenticatedRequest } from "../interfaces/common.i";
import { MEMBERSHIP_TIERS, MembershipTier } from "../config/membership.config";
import Stripe from "stripe";

const SALT_ROUNDS = 10;

const accessTokenConfig: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 15 * 60 * 1000, // 15 minutes
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const refreshTokenConfig: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
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
      res.status(409).json({
        message: "User already exists",
        error: "DUPLICATE_USER",
      });
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
      res.status(401).json({
        message: "No access token found",
        error: "NO_ACCESS_TOKEN",
      });
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
          { twitterId: decoded?.twitterId },
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
      res.status(404).json({
        message: "User not found",
        error: "USER_NOT_FOUND",
      });
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
      res.status(404).json({
        message: "User not found",
        error: "USER_NOT_FOUND",
      });
      return;
    }

    if (!user.passwordHash) {
      res.status(422).json({
        message: "User authentication method not supported",
        error: "WRONG_AUTH_METHOD",
      });
      return;
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      res.status(401).json({
        message: "Incorrect email or password",
        error: "INCORRECT_INPUT",
      });
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
      res.status(400).json({
        message: "User not authenticated",
        error: "NOT_AUTHENTICATED",
      });
      return;
    }
    const { accessToken, refreshToken } = generateTokens(user);
    res.cookie("accessToken", accessToken, accessTokenConfig);
    res.cookie("refreshToken", refreshToken, refreshTokenConfig);
    res.redirect(process.env.FRONT_END as string);
    return;
  } catch (error) {
    console.error("Error in setOAuthTokensThenRedirect:", error);
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
    res.status(401).json({
      message: "No refresh token found",
      error: "NO_REFRESH_TOKEN",
    });
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
    res.status(400).json({
      message: "User not authenticated",
      error: "NOT_AUTHENTICATED",
    });
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
        twitterId: true,
      },
    });

    if (!user) {
      res.status(404).json({
        message: "User not found",
        error: "USER_NOT_FOUND",
      });
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
    res.status(400).json({
      message: "User not authenticated",
      error: "NOT_AUTHENTICATED",
    });
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

export const createSubscriptionSession = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const tokenUser = req.currentUser;
  const { tier } = req.body;

  if (!tokenUser) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (!tier || !MEMBERSHIP_TIERS[tier as MembershipTier]) {
    res.status(400).json({ message: "Invalid membership tier" });
    return;
  }

  const selectedTier = MEMBERSHIP_TIERS[tier as MembershipTier];

  try {
    const user = await prisma.user.findUnique({
      where: { id: tokenUser.id },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.name,
        metadata: {
          userId: user.id.toString(),
        },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    } else if (user.email) {
      await stripe.customers.update(customerId, {
        email: user.email,
        name: user.name,
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: selectedTier.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONT_END}/profile?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONT_END}/membership`,
      metadata: {
        userId: user.id.toString(),
        tier: tier,
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    next(error);
  }
};

export const createPortalSession = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const tokenUser = req.currentUser;

  if (!tokenUser) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: tokenUser.id },
    });

    if (!user || !user.stripeCustomerId) {
      res.status(400).json({ message: "User has no subscription to manage" });
      return;
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONT_END}/profile`,
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
};
