import { CookieOptions, NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma, MEMBERSHIP_TIERS, MembershipTier } from "@config";
import { generateTokens, handleSendEmail, logger } from "@utils";
import { User, UserPayload, AuthenticatedRequest } from "@interfaces";
import { MembershipService } from "@services";
import Stripe from "stripe";

const SALT_ROUNDS = 10;

const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.FRONT_END?.startsWith("https");

const domain = isProduction
  ? new URL(process.env.FRONT_END!).hostname.replace(/^[^.]+\./g, ".")
  : undefined;

const accessTokenConfig: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 15 * 60 * 1000, // 15 minutes
  domain,
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const refreshTokenConfig: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/api/user/refresh",
  domain,
};

export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { name, email, password } = req.body;

  try {
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

export const verifyUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { accessToken, refreshToken } = req.cookies;

    // If no access token AND no refresh token, user is simply not logged in (Guest)
    // Return null user instead of 401 to prevent frontend refresh loop
    if (!accessToken && !refreshToken) {
      res.json({ user: null });
      return;
    }

    if (!accessToken) {
      // If we have a refresh token but no access token, let the frontend
      // interceptor handle the refresh via 401
      res.status(401).json({
        message: "No access token found",
        error: "NO_ACCESS_TOKEN",
      });
      return;
    }

    const decoded = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET as string,
    ) as User;

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
      include: {
        bookings: {
          include: {
            slots: {
              include: {
                bay: true,
              },
            },
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

    const membershipUsage = await MembershipService.getUsageStats(user as any);

    res.json({
      user: {
        ...safeUser,
        membershipUsage,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { email, password, rememberMe = false } = req.body;

  try {
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
  next: NextFunction,
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
    logger.error(`Error checking email: ${error}`);
    res.json({ exists: false, error: true });
  }
};

export const setOAuthTokensThenRedirect = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
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
    res.cookie("refreshToken", refreshToken, {
      ...refreshTokenConfig,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.redirect(process.env.FRONT_END as string);
    return;
  } catch (error) {
    logger.error(`Error in setOAuthTokensThenRedirect: ${error}`);
    next(error);
  }
};

export const updateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const user = (req.user || req.currentUser) as UserPayload;
  try {
    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
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
  next: NextFunction,
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
    process.env.REFRESH_TOKEN_SECRET as string,
  ) as UserPayload;

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user as User,
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

export const getUserProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
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
  next: NextFunction,
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
  next: NextFunction,
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
  next: NextFunction,
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

export const unlinkProvider = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const { provider } = req.params;
  const userPayload = req.currentUser;

  if (!userPayload) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const allowedProviders = ["google", "facebook", "twitter"];
  if (!allowedProviders.includes(provider)) {
    res.status(400).json({ message: "Invalid provider" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userPayload.id },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Safety Check: Prevent lockout
    const activeProviderCount = [
      user.googleId,
      user.facebookId,
      user.twitterId,
    ].filter((id) => !!id).length;

    const hasPassword = !!user.passwordHash;

    if (!hasPassword && activeProviderCount <= 1) {
      res.status(400).json({
        message:
          "Cannot disconnect your only login method. Please set a password or connect another account first.",
        error: "LOCKOUT_PREVENTION",
      });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        [`${provider}Id`]: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        bookings: true,
        googleId: true,
        facebookId: true,
        twitterId: true,
        // Exclude passwordHash
      },
    });

    res.json({
      message: `${provider} disconnected successfully`,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { email } = req.body;
  const safetyMessage =
    "If an account with that email exists, a password reset link has been sent.";

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // For security, always send a success message even if user not found
      res.json({
        message: safetyMessage,
      });
      return;
    }

    const resetToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "1h" },
    );
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    const resetUrl = `${process.env.FRONT_END}/reset-password?token=${resetToken}`;

    await handleSendEmail({
      senderPrefix: "noreply",
      recipientEmail: user.email as string,
      subject: "Password Reset Request",
      templateName: "password-reset",
      templateContext: {
        name: user.name,
        resetUrl: resetUrl,
        year: new Date().getFullYear(),
        baseUrl: process.env.FRONT_END!,
        logoUrl: process.env.LOGO_URL!,
      },
    });

    res.json({
      message: safetyMessage,
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { token, password } = req.body;

  try {
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET as string,
    ) as { id: number; email: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (
      !user ||
      user.resetToken !== token ||
      (user.resetTokenExpiry && user.resetTokenExpiry < new Date())
    ) {
      res.status(400).json({
        message: "Invalid or expired reset token",
        error: "INVALID_TOKEN",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    if (
      (error as Error).name === "JsonWebTokenError" ||
      (error as Error).name === "TokenExpiredError"
    ) {
      res.status(400).json({
        message: "Invalid or expired reset token",
        error: "INVALID_TOKEN",
      });
      return;
    }
    next(error);
  }
};
