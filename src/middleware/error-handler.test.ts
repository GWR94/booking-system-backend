import { Request, Response, NextFunction } from "express";
import errorHandler from "./error-handler";
import { logger } from "@utils";

jest.mock("@utils", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("errorHandler Middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    next = jest.fn();
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("should return 500 if error has no status", async () => {
    const error = new Error("Something went wrong");

    await errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Something went wrong",
      }),
    );
  });

  it("should return custom status if error has status", async () => {
    const error: any = new Error("Not Found");
    error.status = 404;

    await errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Not Found",
      }),
    );
  });

  it("should return default message if error has no message", async () => {
    const error: any = {}; // No message property

    await errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Internal Server Error",
      }),
    );
  });

  it("should log the error stack", async () => {
    const error = new Error("System failure");

    await errorHandler(error, req as Request, res as Response, next);

    expect(logger.error).toHaveBeenCalledWith(error.stack);
  });
});
