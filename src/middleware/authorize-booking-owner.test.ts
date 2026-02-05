import { Response, NextFunction } from "express";
import { prisma } from "@config";
import authorizeBookingOwner from "./authorize-booking-owner";

jest.mock("@config", () => ({
  prisma: {
    booking: {
      findUnique: jest.fn(),
    },
  },
}));

describe("AuthorizeBookingOwner Middleware", () => {
  let req: any;
  let res: any;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      params: { bookingId: "1" },
      currentUser: { id: 1, role: "user" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it("should allow owner to access booking", async () => {
    const mockBooking = { id: 1, userId: 1, slots: [] };
    (prisma.booking.findUnique as any).mockResolvedValue(mockBooking);

    await authorizeBookingOwner(req, res, next);

    expect(req.booking).toEqual(mockBooking);
    expect(next).toHaveBeenCalled();
  });

  it("should allow admin to access any booking", async () => {
    req.currentUser = { id: 99, role: "admin" };
    const mockBooking = { id: 1, userId: 1, slots: [] };
    (prisma.booking.findUnique as any).mockResolvedValue(mockBooking);

    await authorizeBookingOwner(req, res, next);

    expect(req.booking).toEqual(mockBooking);
    expect(next).toHaveBeenCalled();
  });

  it("should deny access if user is not owner and not admin", async () => {
    req.currentUser = { id: 2, role: "user" };
    const mockBooking = { id: 1, userId: 1, slots: [] };
    (prisma.booking.findUnique as any).mockResolvedValue(mockBooking);

    await authorizeBookingOwner(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "FORBIDDEN" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 404 if booking does not exist", async () => {
    (prisma.booking.findUnique as any).mockResolvedValue(null);

    await authorizeBookingOwner(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "NOT_FOUND" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if user is not authenticated", async () => {
    req.currentUser = null;

    await authorizeBookingOwner(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "UNAUTHORIZED" }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
