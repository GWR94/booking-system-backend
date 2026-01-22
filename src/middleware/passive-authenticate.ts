import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest, UserPayload } from "@interfaces";

export const passiveAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accessToken } = req.cookies;
    if (accessToken) {
      const decoded = jwt.verify(
        accessToken,
        process.env.ACCESS_TOKEN_SECRET as string
      ) as UserPayload;
      req.currentUser = decoded; // Populates if valid
    }
    return next();
  } catch (error) {
    // If token is invalid/expired, we just ignore it and treat as guest
    // (Passport will then treat as new login attempt)
    return next();
  }
};

export default passiveAuthenticate;
