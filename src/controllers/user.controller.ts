import { CookieOptions, NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma, MEMBERSHIP_TIERS, MembershipTier } from "@config";
import {
  generateTokens,
  handleSendEmail,
  logger,
  AuthError,
  ValidationError,
} from "@utils";
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
      throw new AuthError("User already exists", 409, "DUPLICATE_USER");
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
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userPayload = req.currentUser;

    // If we have a valid access token (via passiveAuthenticate), return the user
    if (userPayload) {
      const user = await prisma.user.findUnique({
        where: {
          id: userPayload.id,
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
        throw new AuthError("User not found", 404, "USER_NOT_FOUND");
      }

      const hasPassword = !!user.passwordHash;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...safeUser } = user;

      const membershipUsage = await MembershipService.getUsageStats(
        user as any,
      );

      res.json({
        user: {
          ...safeUser,
          hasPassword,
          membershipUsage,
        },
      });
      return;
    }

    // If no access token but we have a refresh token, let the frontend
    // interceptor handle the refresh via 401
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      throw new AuthError("No access token found", 401, "NO_ACCESS_TOKEN");
    }

    // If neither, user is Guest
    res.json({ user: null });
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
      throw new AuthError("User not found", 404, "USER_NOT_FOUND");
    }

    if (!user.passwordHash) {
      throw new AuthError(
        "User authentication method not supported",
        422,
        "WRONG_AUTH_METHOD",
      );
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      throw new AuthError(
        "Incorrect email or password",
        401,
        "INCORRECT_INPUT",
      );
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
      throw new AuthError("User not authenticated", 400, "NOT_AUTHENTICATED");
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
  const { newPassword, password } = req.body;
  try {
    if (!user) {
      throw new AuthError("Unauthorized", 401, "UNAUTHORIZED");
    }
    const allowedUpdates = [
      "name",
      "phone",
      "allowMarketing",
      "googleId",
      "facebookId",
      "twitterId",
    ];
    const updates = Object.keys(req.body)
      .filter((key) => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {} as any);

    if (newPassword) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!dbUser) {
        throw new AuthError("User not found", 404, "USER_NOT_FOUND");
      }

      if (dbUser.passwordHash) {
        if (!password) {
          throw new ValidationError(
            "Current password is required",
            400,
            "PASSWORD_REQUIRED",
          );
        }

        const validPassword = await bcrypt.compare(
          password,
          dbUser.passwordHash,
        );

        if (!validPassword) {
          throw new AuthError(
            "Incorrect current password",
            401,
            "INCORRECT_PASSWORD",
          );
        }
      }

      updates.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      const finalEmail =
        updates.email !== undefined ? updates.email : dbUser.email;
      if (!finalEmail) {
        throw new ValidationError(
          "Email is required to set a password",
          400,
          "EMAIL_REQUIRED",
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new ValidationError(
        "No valid fields to update",
        400,
        "NO_VALID_FIELDS",
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updates,
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
    throw new AuthError("No refresh token found", 401, "NO_REFRESH_TOKEN");
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
    throw new AuthError("User not authenticated", 400, "NOT_AUTHENTICATED");
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
      throw new AuthError("User not found", 404, "USER_NOT_FOUND");
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
    throw new AuthError("User not authenticated", 400, "NOT_AUTHENTICATED");
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
    throw new AuthError("Unauthorized", 401, "UNAUTHORIZED");
  }

  if (!tier || !MEMBERSHIP_TIERS[tier as MembershipTier]) {
    throw new ValidationError("Invalid membership tier", 400, "INVALID_TIER");
  }

  const selectedTier = MEMBERSHIP_TIERS[tier as MembershipTier];

  try {
    const user = await prisma.user.findUnique({
      where: { id: tokenUser.id },
    });

    if (!user) {
      throw new AuthError("User not found", 404, "USER_NOT_FOUND");
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
    throw new AuthError("Unauthorized", 401, "UNAUTHORIZED");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: tokenUser.id },
    });

    if (!user || !user.stripeCustomerId) {
      throw new ValidationError(
        "User has no subscription to manage",
        400,
        "NO_SUBSCRIPTION",
      );
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
    throw new AuthError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const allowedProviders = ["google", "facebook", "twitter"];
  if (!allowedProviders.includes(provider)) {
    throw new ValidationError("Invalid provider", 400, "INVALID_PROVIDER");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userPayload.id },
    });

    if (!user) {
      throw new AuthError("User not found", 404, "USER_NOT_FOUND");
    }

    // Safety Check: Prevent lockout
    const activeProviderCount = [
      user.googleId,
      user.facebookId,
      user.twitterId,
    ].filter((id) => !!id).length;

    const hasPassword = !!user.passwordHash;

    if (!hasPassword && activeProviderCount <= 1) {
      throw new ValidationError(
        "Cannot disconnect your only login method. Please set a password or connect another account first.",
        400,
        "LOCKOUT_PREVENTION",
      );
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
      throw new ValidationError(
        "Invalid or expired reset token",
        400,
        "INVALID_TOKEN",
      );
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
      return next(
        new ValidationError(
          "Invalid or expired reset token",
          400,
          "INVALID_TOKEN",
        ),
      );
    }
    next(error);
  }
};
