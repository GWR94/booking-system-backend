import { Request, Response } from "express";
import prisma from "../utils/prismaClient";

// Create a booking
export const createBooking = async (req: Request, res: Response) => {
  console.log(res);
  const { userId, slotId } = req.body;

  try {
    // Check if the slot is available
    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
    });

    if (!slot || slot.status !== "available") {
      return res.status(400).json({ message: "Slot is not available" });
    }

    return res.json({ slot, userId, slotId });

    // Create a booking and update slot status to 'booked'
    const booking = await prisma.booking.create({
      data: {
        userId,
        slotId,
      },
    });

    // Update slot status to 'booked'
    await prisma.slot.update({
      where: { id: slotId },
      data: { status: "booked" },
    });

    res.status(201).json({ message: "Booking created successfully", booking });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ message: "Error creating booking" });
  }
};

// Cancel a booking
export const cancelBooking = async (req: Request, res: Response) => {
  const { bookingId } = req.params;

  try {
    // Get booking details
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId, 10) },
      include: { slot: true },
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // TODO
    // [ ] Add date / time check for company policy - eg no closer than 2 weeks

    // Delete the booking
    await prisma.booking.delete({
      where: { id: booking.id },
    });

    // Update slot status to 'available' if it was booked
    if (booking.slot.status === "booked") {
      await prisma.slot.update({
        where: { id: booking.slotId },
        data: { status: "available" },
      });
    }

    res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    console.error("Error canceling booking:", error);
    res.status(500).json({ message: "Error cancelling booking" });
  }
};
