import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../utils/prismaClient";
import { User } from "../controllers/userController";

const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const accessToken = req.cookies.accessToken;
  console.log({ accessToken });

  if (!accessToken) {
    return res.status(401).json({ message: "No access token provided" });
  }

  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      return res.status(401).json({ error: "No access token" });
    }

    const decoded = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET as string
    ) as User;

    (req as any).user = decoded;
    next();
  } catch (error) {
    return res
      .status(403)
      .json({ message: "Invalid or expired access token", error });
  }
};

export default authenticateToken;
