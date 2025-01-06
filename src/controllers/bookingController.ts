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
}

interface BasketItem {
  startTime: Dayjs;
  endTime: Dayjs;
}

type StatusType = "available" | "booked" | "unavailable";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-11-20.acacia; custom_checkout_beta=v1" as any,
});
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
        status: "available",
      },
    });

    if (slots.length !== slotIds.length) {
      return res.status(400).json({
        message: "One or more slots are not available or don't exist",
      });
    }

    // Create booking with connected slots
    const booking = await prisma.booking.create({
      data: {
        userId,
        slots: {
          connect: slotIds.map((id: number) => ({ id })),
        },
        status: "confirmed",
      },
      include: {
        slots: true,
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

    res.status(201).json({
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ message: "Error creating booking" });
  }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  const { basket } = req.body;
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      basket.map((item: BasketItem) => ({
        price_data: {
          currency: "gbp",
          product_data: {
            name: `${dayjs(item.startTime).format("dd mm yyyy hh:mm")} -
              ${dayjs(item.endTime).format("hh:mm")}
            }`,
          },
          unit_amount: PRICE_PER_HOUR,
        },
        quantity: 1,
      })),
    ],
    mode: "payment",
    return_url: `${process.env.FRONT_END}/bookings`,
  });

  res.json({ clientSecret: session.client_secret });
};

// export const createPaymentIntent = async (req: Request, res: Response) => {
//   const { paymentMethodId, sessionLength } = req.body;

//   if (!sessionLength || sessionLength > 3 || sessionLength <= 0) {
//     return res.status(400).send({ error: "Invalid session selected" });
//   }

//   try {
//     const intent = await stripe.paymentIntents.create({
//       amount: PRICE_PER_HOUR * sessionLength,
//       currency: "gbp",
//       payment_method: paymentMethodId,
//       confirmation_method: "manual",
//       confirm: true,
//     });

//     res.json({ clientSecret: intent.client_secret });
//   } catch (error) {
//     console.error("Error creating payment intent:", error);
//     res.status(500).json({
//       error,
//       message: "Unable to create payment intent",
//     });
//   }
// };

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
