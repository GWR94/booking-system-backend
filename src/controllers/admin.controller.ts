import { NextFunction, Request, Response } from "express";
import { prisma } from "@config";
import { AuthenticatedRequest } from "@interfaces";
import dayjs from "dayjs";
import jwt from "jsonwebtoken";
import { handleSendEmail, logger } from "@utils";

// --- Dashboard Stats ---

export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const today = dayjs().startOf("day");
    const tomorrow = today.add(1, "day");

    const [
      totalUsers,
      activeMembers,
      totalBookings,
      bookingsToday,
      cancelledBookings,
      parMembers,
      birdieMembers,
      holeInOneMembers,
      activeNoTier,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { membershipStatus: "ACTIVE" },
      }),
      prisma.booking.count(),
      prisma.booking.count({
        where: {
          bookingTime: {
            gte: today.toDate(),
            lt: tomorrow.toDate(),
          },
        },
      }),
      prisma.booking.count({
        where: { status: "cancelled" },
      }),
      prisma.user.count({
        where: { membershipTier: "PAR", membershipStatus: "ACTIVE" },
      }),
      prisma.user.count({
        where: { membershipTier: "BIRDIE", membershipStatus: "ACTIVE" },
      }),
      prisma.user.count({
        where: { membershipTier: "HOLEINONE", membershipStatus: "ACTIVE" },
      }),
      prisma.user.count({
        where: { membershipTier: null, membershipStatus: "ACTIVE" },
      }),
    ]);

    res.json({
      totalUsers,
      activeMembers,
      totalBookings,
      bookingsToday,
      cancelledBookings,
      membershipStats: {
        PAR: parMembers,
        BIRDIE: birdieMembers,
        HOLEINONE: holeInOneMembers,
        NONE: activeNoTier,
      },
    });
  } catch (error) {
    next(error);
  }
};

// --- User Management ---

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        bookings: {
          include: {
            slots: {
              include: {
                bay: true,
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

export const updateUserDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;
  const { name, email, role, membershipTier, membershipStatus } = req.body;

  try {
    const userId = parseInt(id, 10);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Prepare update data
    const updateData: any = {
      name,
      email,
      role,
      membershipTier,
      membershipStatus,
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key],
    );

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    res.json({ message: "User updated successfully", user });
  } catch (error) {
    next(error);
  }
};

export const resetUserPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;

  try {
    const userId = parseInt(id, 10);
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (!user.email) {
      res.status(400).json({ message: "User has no email address" });
      return;
    }

    const resetToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "1h" },
    );
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    const resetUrl = `${process.env.FRONT_END}/reset-password?token=${resetToken}`;

    await handleSendEmail({
      senderPrefix: "noreply",
      recipientEmail: user.email,
      subject: "Admin Requested Password Reset",
      templateName: "password-reset",
      templateContext: {
        name: user.name,
        resetUrl: resetUrl,
        year: new Date().getFullYear(),
        baseUrl: process.env.FRONT_END!,
        logoUrl: process.env.LOGO_URL!,
      },
    });

    res.json({ message: "Password reset link sent to user's email" });
  } catch (error) {
    next(error);
  }
};

// --- Booking Management ---

export const getAllBookings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { status: { contains: search, mode: "insensitive" } },
      ];
      const searchId = parseInt(search);
      if (!isNaN(searchId)) {
        where.OR.push({ id: searchId });
      }
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          user: true,
          slots: {
            include: {
              bay: true,
            },
          },
        },
        orderBy: { bookingTime: "desc" },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({
      data: bookings,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateBookingStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const booking = await prisma.booking.update({
      where: { id: parseInt(id, 10) },
      data: { status },
    });
    res.json({ message: "Booking status updated successfully", booking });
  } catch (error) {
    next(error);
  }
};

export const deleteBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;

  try {
    const bookingId = parseInt(id, 10);

    // Get associated slots
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slots: true },
    });

    if (!booking) {
      res.status(404).json({ message: "Booking not found" });
      return;
    }

    // Free up slots
    const slotIds = booking.slots.map((s) => s.id);
    if (slotIds.length > 0) {
      await prisma.slot.updateMany({
        where: { id: { in: slotIds } },
        data: { status: "available" },
      });
    }

    // Delete booking
    await prisma.booking.delete({
      where: { id: bookingId },
    });

    res.json({ message: "Booking deleted and slots freed successfully" });
  } catch (error) {
    next(error);
  }
};

export const createAdminBooking = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const { slotIds } = req.body;

  try {
    // Verify all slots exist and are available
    const slots = await prisma.slot.findMany({
      where: {
        id: {
          in: slotIds,
        },
        status: "available",
      },
    });

    if (slots.length !== slotIds.length) {
      const unavailableSlotIds = slotIds.filter(
        (id: number) => !slots.some((slot) => slot.id === id),
      );
      res.status(400).json({
        message: `The following slots are not available or don't exist: ${unavailableSlotIds.join(
          ", ",
        )}`,
        error: "SLOT_NOT_AVAILABLE",
      });
      return;
    }

    // Create booking with connected slots
    const booking = await prisma.booking.create({
      data: {
        user: {
          connect: { id: req.currentUser!.id },
        },
        slots: {
          connect: slotIds.map((id: number) => ({ id })),
        },
        status: "confirmed - local",
      },
      include: {
        slots: true,
        user: true,
      },
    });

    // Update all slots to booked status individually
    for (const slotId of slotIds) {
      try {
        await prisma.slot.update({
          where: { id: slotId },
          data: { status: "booked" },
        });
      } catch (error) {
        logger.error(
          `Failed to update slot ${slotId} to booked status: ${error}`,
        );
        res.status(500).json({
          message: `Failed to update slot ${slotId} to booked status`,
          error: "PARTIAL_UPDATE_FAILURE",
        });
        return;
      }
    }

    res.status(201).json({
      message: "Admin booking created successfully",
      booking,
    });
  } catch (error) {
    next(error);
  }
};

// --- Slot Management ---

export const createSlot = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { startTime, endTime, status = "available", bay } = req.body;

  try {
    const slot = await prisma.slot.create({
      data: {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status,
        bayId: bay as number,
      },
    });

    res.status(201).json({ message: "Slot created successfully", slot });
  } catch (error) {
    next(error);
  }
};

export const updateSlot = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;
  const { startTime, endTime, status, bay } = req.body;
  if (!startTime || !endTime || !status) {
    res.status(400).json({ error: "Invalid startTime, endTime or status" });
    return;
  }
  try {
    const slot = await prisma.slot.update({
      where: { id: parseInt(id, 10) },
      data: {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status,
        bayId: bay.id,
      },
    });

    res.json({ message: "Slot updated successfully", slot });
  } catch (error) {
    next(error);
  }
};

export const deleteSlot = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;

  try {
    await prisma.slot.delete({
      where: { id: parseInt(id, 10) },
    });
    res.json({ message: "Slot deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const extendBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;
  const { hours } = req.body;

  try {
    const bookingId = parseInt(id, 10);

    // Validate hours parameter
    if (hours !== 1 && hours !== 2) {
      res.status(400).json({
        message: "Invalid hours parameter. Must be 1 or 2.",
        error: "INVALID_HOURS",
      });
      return;
    }

    // Get the booking with its slots
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        slots: {
          include: { bay: true },
          orderBy: { startTime: "asc" },
        },
      },
    });

    if (!booking) {
      res.status(404).json({ message: "Booking not found" });
      return;
    }

    if (booking.slots.length === 0) {
      res.status(400).json({
        message: "Booking has no slots",
        error: "NO_SLOTS",
      });
      return;
    }

    // Get the last slot to determine where to extend from
    const lastSlot = booking.slots[booking.slots.length - 1];
    const bayId = lastSlot.bayId;
    // Add 5 minutes to account for the gap between slots
    const extendFromTime = dayjs(lastSlot.endTime).add(5, "minutes");

    // Find the next consecutive available slots for the same bay
    const requiredSlots = await prisma.slot.findMany({
      where: {
        bayId: bayId,
        status: "available",
        startTime: {
          gte: extendFromTime.toDate(),
          lt: extendFromTime.add(hours, "hour").toDate(),
        },
      },
      orderBy: { startTime: "asc" },
    });

    // Verify we have enough consecutive slots
    if (requiredSlots.length !== hours) {
      res.status(400).json({
        message: `Not enough available slots to extend by ${hours} hour(s). Only ${requiredSlots.length} slot(s) available.`,
        error: "INSUFFICIENT_SLOTS",
        availableSlots: requiredSlots.length,
      });
      return;
    }

    // Verify slots are consecutive
    for (let i = 0; i < requiredSlots.length; i++) {
      const expectedStartTime = extendFromTime.add(i, "hour");
      const slotStartTime = dayjs(requiredSlots[i].startTime);

      if (!slotStartTime.isSame(expectedStartTime)) {
        res.status(400).json({
          message: "Available slots are not consecutive",
          error: "NON_CONSECUTIVE_SLOTS",
        });
        return;
      }
    }

    // Add the new slots to the booking
    const slotIds = requiredSlots.map((slot) => slot.id);

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        slots: {
          connect: slotIds.map((id) => ({ id })),
        },
      },
      include: {
        slots: {
          include: { bay: true },
          orderBy: { startTime: "asc" },
        },
        user: true,
      },
    });

    // Update the new slots to booked status
    await prisma.slot.updateMany({
      where: { id: { in: slotIds } },
      data: { status: "booked" },
    });

    res.json({
      message: `Booking extended by ${hours} hour(s) successfully`,
      booking: updatedBooking,
    });
  } catch (error) {
    next(error);
  }
};

export const checkBookingExtendAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { id } = req.params;

  try {
    const bookingId = parseInt(id, 10);

    // Get the booking with its slots
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        slots: {
          include: { bay: true },
          orderBy: { startTime: "asc" },
        },
      },
    });

    if (!booking) {
      res.status(404).json({ message: "Booking not found" });
      return;
    }

    if (booking.slots.length === 0) {
      res.json({ canExtend1Hour: false, canExtend2Hours: false });
      return;
    }

    // Get the last slot to determine where to extend from
    const lastSlot = booking.slots[booking.slots.length - 1];
    const bayId = lastSlot.bayId;
    // Add 5 minutes to account for the gap between slots
    const extendFromTime = dayjs(lastSlot.endTime).add(5, "minutes");

    // Check for 1 hour availability
    const oneHourSlots = await prisma.slot.findMany({
      where: {
        bayId: bayId,
        status: "available",
        startTime: {
          gte: extendFromTime.toDate(),
          lt: extendFromTime.add(1, "hour").toDate(),
        },
      },
      orderBy: { startTime: "asc" },
    });

    const canExtend1Hour =
      oneHourSlots.length === 1 &&
      dayjs(oneHourSlots[0].startTime).isSame(extendFromTime);

    // Check for 2 hours availability
    const twoHourSlots = await prisma.slot.findMany({
      where: {
        bayId: bayId,
        status: "available",
        startTime: {
          gte: extendFromTime.toDate(),
          lt: extendFromTime.add(2, "hour").toDate(),
        },
      },
      orderBy: { startTime: "asc" },
    });

    let canExtend2Hours = false;
    if (twoHourSlots.length === 2) {
      const firstSlotTime = dayjs(twoHourSlots[0].startTime);
      const secondSlotTime = dayjs(twoHourSlots[1].startTime);
      const expectedSecondSlotTime = extendFromTime.add(1, "hour");

      canExtend2Hours =
        firstSlotTime.isSame(extendFromTime) &&
        secondSlotTime.isSame(expectedSecondSlotTime);
    }

    res.json({ canExtend1Hour, canExtend2Hours });
  } catch (error) {
    next(error);
  }
};

// --- Block Out Management ---

export const blockSlots = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { startTime, endTime, bayId } = req.body;

  try {
    const start = new Date(startTime);
    const end = new Date(endTime);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ message: "Invalid date format" });
      return;
    }

    const whereClause: any = {
      startTime: {
        gte: start,
      },
      endTime: {
        lte: end,
      },
      status: "available",
      // Only block available slots to prevent overriding bookings
    };

    if (bayId) {
      whereClause.bayId = parseInt(bayId, 10);
    }

    const updated = await prisma.slot.updateMany({
      where: whereClause,
      data: {
        status: "maintenance",
      },
    });

    res.json({
      message: `Successfully blocked ${updated.count} slots`,
      count: updated.count,
    });
  } catch (error) {
    next(error);
  }
};

export const unblockSlots = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { startTime, endTime, bayId } = req.body;

  try {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ message: "Invalid date format" });
      return;
    }

    const whereClause: any = {
      startTime: {
        gte: start,
      },
      endTime: {
        lte: end,
      },
      status: "maintenance",
      // Only unblock maintenance slots
    };

    if (bayId) {
      whereClause.bayId = parseInt(bayId, 10);
    }

    const updated = await prisma.slot.updateMany({
      where: whereClause,
      data: {
        status: "available",
      },
    });

    res.json({
      message: `Successfully unblocked ${updated.count} slots`,
      count: updated.count,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminSlots = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { date, bayId } = req.query;

  try {
    if (!date) {
      res.status(400).json({ message: "Date is required" });
      return;
    }

    const startOfDay = dayjs(date as string)
      .startOf("day")
      .toDate();
    const endOfDay = dayjs(date as string)
      .endOf("day")
      .toDate();

    const whereClause: any = {
      startTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    if (bayId) {
      whereClause.bayId = parseInt(bayId as string, 10);
    }

    const slots = await prisma.slot.findMany({
      where: whereClause,
      include: {
        bay: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });

    res.json(slots);
  } catch (error) {
    next(error);
  }
};
