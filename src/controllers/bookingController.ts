import { Request, Response } from "express";
import prisma from "../config/prisma-client";
import Stripe from "stripe";
import dayjs, { Dayjs } from "dayjs";

export interface Booking {
  id: number;
  userId: number;
  slotId: number;
  bookingTime: Date;
  status: StatusType;
  paymentId?: string;
  paymentStatus?: string;
}

interface BasketItem {
  startTime: Dayjs;
  endTime: Dayjs;
  slotIds: number[];
}

type StatusType = "available" | "booked" | "unavailable";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const PRICE_PER_HOUR = 4500; // £45

export const createBooking = async (req: Request, res: Response) => {
  const { userId, slotIds } = req.body;

  try {
    // Verify all slots exist and are available
    const slots = await prisma.slot.findMany({
      where: {
        id: {
          in: slotIds,
        },
      },
    });

    if (slots.length !== slotIds.length) {
      return res.status(400).json({
        message: "One or more slots are not available or don't exist",
        data: { slots, slotIds }, //FIXME
      });
    }

    // Create booking with connected slots
    const booking = await prisma.booking.create({
      data: {
        user: {
          connect: { id: userId },
        },
        slots: {
          connect: slotIds.map((id: number) => ({ id })),
        },
        status: "pending",
      },
      include: {
        slots: true,
        user: true,
      },
    });

    // Update all slots to booked status
    await prisma.slot.updateMany({
      where: {
        id: {
          in: slotIds,
        },
      },
      data: {
        status: "booked",
      },
    });

    console.log(booking);

    res.status(201).json({
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ message: "Error creating booking" });
  }
};

export const confirmBooking = async (req: Request, res: Response) => {
  const { bookingId, paymentStatus, paymentId } = req.body;

  try {
    // Update booking status to confirmed
    const booking = await prisma.booking.update({
      where: { id: parseInt(bookingId, 10) },
      data: {
        status: "confirmed",
        paymentId,
        paymentStatus,
      },
    });

    res.json({ message: "Booking confirmed successfully", booking });
  } catch (error) {
    console.error("Error confirming booking:", error);
    res.status(500).json({ message: "Error confirming booking" });
  }
};

const calculateBasketCost = (items: BasketItem[]) => {
  return items.reduce(
    (total: number, item: BasketItem) =>
      (total += item.slotIds.length * PRICE_PER_HOUR),
    0
  );
};

export const createPaymentIntent = async (req: Request, res: Response) => {
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).send({ error: "Invalid item selection" });
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount: calculateBasketCost(items),
      currency: "gbp",
    });

    res.json({ clientSecret: intent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({
      error,
      message: "Unable to create payment intent",
    });
  }
};

export const cancelBooking = async (req: Request, res: Response) => {
  const { bookingId } = req.params;

  try {
    // Get booking details with associated slots
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId, 10) },
      include: { slots: true },
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // TODO
    // [ ] Add date / time check for company policy - eg no closer than 2 weeks
    // [ ] Add stripe refund ??

    // Get all slot IDs associated with this booking
    const slotIds = booking.slots.map((slot) => slot.id);

    // Update all associated slots back to 'available'
    await prisma.slot.updateMany({
      where: {
        id: {
          in: slotIds,
        },
      },
      data: {
        status: "available",
      },
    });

    // Delete the booking
    await prisma.booking.delete({
      where: { id: booking.id },
    });

    res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    console.error("Error canceling booking:", error);
    res.status(500).json({ message: "Error cancelling booking" });
  }
};
