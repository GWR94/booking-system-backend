import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import passiveAuthenticate from "./passive-authenticate";
import { AuthenticatedRequest } from "@interfaces";

jest.mock("jsonwebtoken");

describe("passiveAuthenticate Middleware", () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      cookies: {},
    };
    res = {};
    next = jest.fn();
    process.env.ACCESS_TOKEN_SECRET = "test_secret";
  });

  it("should call next and set currentUser if token is valid", async () => {
    req.cookies = { accessToken: "valid_token" };
    const mockUser = { id: 1, email: "test@test.com" };
    (jwt.verify as jest.Mock).mockReturnValue(mockUser);

    await passiveAuthenticate(
      req as AuthenticatedRequest,
      res as Response,
      next,
    );

    expect(jwt.verify).toHaveBeenCalledWith("valid_token", "test_secret");
    expect(req.currentUser).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
  });

  it("should call next and NOT set currentUser if token is missing", async () => {
    req.cookies = {};

    await passiveAuthenticate(
      req as AuthenticatedRequest,
      res as Response,
      next,
    );

    expect(jwt.verify).not.toHaveBeenCalled();
    expect(req.currentUser).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("should call next and NOT set currentUser if token is invalid", async () => {
    req.cookies = { accessToken: "invalid_token" };
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    await passiveAuthenticate(
      req as AuthenticatedRequest,
      res as Response,
      next,
    );

    expect(jwt.verify).toHaveBeenCalled();
    expect(req.currentUser).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
