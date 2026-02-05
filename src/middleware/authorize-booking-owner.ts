import { Response, NextFunction } from "express";
import { prisma } from "@config";
import { AuthenticatedRequest } from "@interfaces";

/**
 * Middleware to authorize access to a booking.
 * Ensures the booking exists and the current user is either the owner or an admin.
 * Attaches the fetched booking (including slots) to req.booking.
 */
const authorizeBookingOwner = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const { bookingId } = req.params;
  const { currentUser } = req;

  if (!currentUser) {
    res
      .status(401)
      .json({ message: "Not authenticated", error: "UNAUTHORIZED" });
    return;
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId as string) },
      include: { slots: true },
    });

    if (!booking) {
      res
        .status(404)
        .json({ message: "Booking not found", error: "NOT_FOUND" });
      return;
    }

    const isOwner = booking.userId === currentUser.id;
    const isAdmin = currentUser.role === "admin";

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        message: "You do not have permission to access this booking",
        error: "FORBIDDEN",
      });
      return;
    }

    // Attach to request object for use in controller
    req.booking = booking;
    next();
  } catch (error) {
    next(error);
  }
};

export default authorizeBookingOwner;
