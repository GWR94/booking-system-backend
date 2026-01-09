import { NextFunction, Request, Response } from "express";

interface CustomError extends Error {
  status?: number;
}

const errorHandler = async (
  err: CustomError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  console.error(err.stack);
  res.status(err?.status ?? 500).json({
    message: err?.message ?? "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
};

export default errorHandler;
