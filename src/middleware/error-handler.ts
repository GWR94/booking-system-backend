import { NextFunction, Request, Response } from "express";
import { logger } from "@utils";
import { AppError } from "../utils/errors";

const errorHandler = async (
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) => {
  const statusCode =
    err instanceof AppError
      ? err.statusCode
      : err.status || err.statusCode || 500;
  const errorCode =
    err instanceof AppError ? err.errorCode : "INTERNAL_SERVER_ERROR";
  const message = err.message || "Internal Server Error";

  if (statusCode === 500) {
    logger.error(err.stack);
  }

  res.status(statusCode).json({
    message,
    error: errorCode,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default errorHandler;
