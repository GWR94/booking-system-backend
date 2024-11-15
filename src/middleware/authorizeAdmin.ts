import { Request, Response, NextFunction } from "express";

function authorizeAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;

  if (user?.role !== "admin") {
    return res.status(403).json({ message: "Access denied, admin only" });
  }

  next();
}

export default authorizeAdmin;
