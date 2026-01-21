import { Response, NextFunction } from "express";
import authorizeAdmin from "./authorize-admin";
import { AuthenticatedRequest } from "@interfaces";

describe("authorizeAdmin Middleware", () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    next = jest.fn();
  });

  it("should call next if user is an admin", async () => {
    req.currentUser = {
      id: 1,
      role: "admin",
      email: "admin@test.com",
      name: "Admin",
    } as any;

    await authorizeAdmin(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should return 403 if user is not an admin", async () => {
    req.currentUser = {
      id: 2,
      role: "user",
      email: "user@test.com",
      name: "User",
    } as any;

    await authorizeAdmin(req as AuthenticatedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Access denied, admin only",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 if currentUser is missing", async () => {
    req.currentUser = undefined;

    await authorizeAdmin(req as AuthenticatedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Access denied, admin only",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
