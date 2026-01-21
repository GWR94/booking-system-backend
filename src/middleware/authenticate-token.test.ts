import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterAll,
} from "@jest/globals";
import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { authenticateToken } from "./authenticate-token";
import { AuthenticatedRequest } from "@interfaces";

jest.mock("jsonwebtoken");

describe("Authenticate Token Middleware", () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.resetAllMocks();

    req = {
      cookies: {},
    };

    const resObj: any = {};
    resObj.status = jest.fn().mockReturnValue(resObj);
    resObj.json = jest.fn().mockReturnValue(resObj);
    res = resObj;

    next = jest.fn();

    process.env.ACCESS_TOKEN_SECRET = "test-secret";
  });

  afterAll(() => {
    delete process.env.ACCESS_TOKEN_SECRET;
  });

  it("should call next() if token is valid", () => {
    const mockUserPayload = { id: 1, email: "test@test.com" };
    req.cookies = { accessToken: "valid-token" };

    (jwt.verify as jest.Mock).mockReturnValue(mockUserPayload);

    authenticateToken(req as AuthenticatedRequest, res as Response, next);

    expect(jwt.verify).toHaveBeenCalledWith("valid-token", "test-secret");
    expect(req.currentUser).toEqual(mockUserPayload);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should return 401 if access token is missing", () => {
    req.cookies = {};

    authenticateToken(req as AuthenticatedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "No access token" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 if token is invalid or expired", () => {
    req.cookies = { accessToken: "invalid-token" };
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    authenticateToken(req as AuthenticatedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid or expired access token" }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
