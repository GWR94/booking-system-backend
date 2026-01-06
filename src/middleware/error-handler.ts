import { Request, Response } from "express";

interface CustomError extends Error {
  status?: number;
}

const errorHandler = async (err: CustomError, req: Request, res: Response) => {
  console.error(err.stack);
  res
    .status(err?.status ?? 500)
    .json({ message: err?.message ?? "Internal Server Error", err });
};

export default errorHandler;
