import { Request, Response, NextFunction } from "express";
import { validateRegistration, validateLogin } from "./validation";

describe("Validation Middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    next = jest.fn();
    // Mock console.log to keep test output clean
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("validateRegistration", () => {
    it("should call next for valid input", () => {
      req.body = {
        email: "test@example.com",
        name: "Test User",
        password: "Password1!",
      };

      validateRegistration(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid email", () => {
      req.body = {
        email: "invalid-email",
        name: "Test User",
        password: "Password1!",
      };

      validateRegistration(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("email"),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid name (too short)", () => {
      req.body = {
        email: "test@example.com",
        name: "Bob", // Too short
        password: "Password1!",
      };

      validateRegistration(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Name"),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid password (complexity)", () => {
      req.body = {
        email: "test@example.com",
        name: "Test User",
        password: "password", // No uppercase/special char
      };

      validateRegistration(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Password"),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("validateLogin", () => {
    it("should call next for valid input", () => {
      req.body = {
        email: "test@example.com",
        password: "Password1!",
      };

      validateLogin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it("should return 400 for missing email", () => {
      req.body = {
        password: "Password1!",
      };

      validateLogin(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
