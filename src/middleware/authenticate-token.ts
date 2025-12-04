import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../interfaces/common.i";
import { UserPayload } from "../interfaces/user.i";

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accessToken } = req.cookies;
    if (!accessToken) {
      res.status(401).json({ error: "No access token" });
      return;
    }

    const decoded = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET as string
    ) as UserPayload;

    req.currentUser = decoded;
    return next();
  } catch (error) {
    res.status(403).json({ message: "Invalid or expired access token", error });
    return;
  }
};

export default authenticateToken;
