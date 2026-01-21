import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@interfaces";

const authorizeAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const { currentUser } = req;

  if (currentUser?.role !== "admin") {
    res.status(403).json({ message: "Access denied, admin only" });
    return;
  }

  next();
};

export default authorizeAdmin;
