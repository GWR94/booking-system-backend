import { RequestWithBody } from "../../app";
import Stripe from "stripe";
import prisma from "../config/prisma-client";
import { Response, Request, NextFunction } from "express";
import { handleSendEmail } from "../utils/email";
import { groupSlotsByBay } from "../utils/group-slots";
import crypto from "crypto";
import dayjs from "dayjs";
import advanced from "dayjs/plugin/advancedFormat";

dayjs.extend(advanced);

export interface Booking {
  id: number;
  userId: number;
  slotId: number;
  bookingTime: Date;
  status: StatusType;
  paymentId?: string;
  paymentStatus?: string;
}

type StatusType = "available" | "booked" | "unavailable" | "pending";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export const handleWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let event = req.body;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
  const rawBody = (req as RequestWithBody).rawBody || req.body;
  if (endpointSecret) {
    // Get the signature sent by Stripe
    const signature = req.headers["stripe-signature"] as string | string[];
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        endpointSecret
      );
    } catch (err) {
      console.log(
        `⚠️  Webhook signature verification failed.`,
        (err as Error).message,
        err
      );
      res.sendStatus(400);
    }
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const payment = event.data.object as Stripe.PaymentIntent;
        const { bookingId } = payment.metadata;

        // Handle regular booking confirmation
        const booking = await confirmBooking(
          payment.id,
          payment.status,
          bookingId
        );
        console.log("Regular booking confirmed:", booking);
        break;
      }
      case "payment_intent.created": {
        const payment = event.data.object as Stripe.PaymentIntent;
        const { userId, slotIds, isGuest, guestName, guestEmail, guestPhone } =
          payment.metadata;

        let booking;
        if (isGuest === "true") {
          // Guest booking - find or create guest user
          const guestUser = await prisma.user.upsert({
            where: { email: guestEmail },
            update: {
              name: guestName,
              ...(guestPhone && { phone: guestPhone }),
            },
            create: {
              email: guestEmail,
              name: guestName,
              ...(guestPhone && { phone: guestPhone }),
              role: "guest",
            },
          });

          booking = await createBooking(
            guestUser.id,
            JSON.parse(slotIds),
            payment.id,
            payment.status
          );
        } else {
          // Authenticated user booking
          booking = await createBooking(
            parseInt(userId, 10),
            JSON.parse(slotIds),
            payment.id,
            payment.status
          );
        }

        await stripe.paymentIntents.update(payment.id, {
          metadata: { ...payment.metadata, bookingId: booking.id.toString() },
        });
        break;
      }
      case "payment_intent.payment_failed": {
        const payment = event.data.object as Stripe.PaymentIntent;
        const { bookingId } = payment.metadata;
        console.log(`Payment failed for booking ${bookingId}`);

        if (bookingId) {
          await handleFailedPayment(parseInt(bookingId));
        } else {
          console.error("No bookingId found in payment metadata");
        }
        break;
      }
      default:
        // Unexpected event type
        console.log(`Unhandled event type ${event.type}.`);
        console.log({ type: event.type, data: event.data });
        break;
    }
  } catch (error) {
    next(error);
  }
};

export const createBooking = async (
  userId: number,
  slotIds: number[],
  paymentId: string,
  paymentStatus: string
) => {
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
      throw new Error("One or more slots do not exist or have been booked");
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
        paymentId,
        paymentStatus,
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
        status: "awaiting payment",
      },
    });

    return booking;
  } catch (error) {
    console.error("Error creating booking:", error);
    throw new Error("Error creating booking");
  }
};

export const createGuestBooking = async (
  slotIds: number[],
  paymentId: string,
  paymentStatus: string,
  guestName: string,
  guestEmail: string,
  guestPhone?: string
) => {
  try {
    // Create guest user first
    const guestUser = await prisma.user.create({
      data: {
        email: guestEmail,
        name: guestName,
        ...(guestPhone && { phone: guestPhone }),
        role: "guest",
      },
    });

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
      throw new Error("One or more slots do not exist or have been booked");
    }

    // Create booking with connected slots
    const booking = await prisma.booking.create({
      data: {
        user: {
          connect: { id: guestUser.id },
        },
        slots: {
          connect: slotIds.map((id: number) => ({ id })),
        },
        status: "pending",
        paymentId,
        paymentStatus,
      },
      include: {
        slots: true,
      },
    });

    // Update all slots to awaiting payment status
    await prisma.slot.updateMany({
      where: {
        id: {
          in: slotIds,
        },
      },
      data: {
        status: "awaiting payment",
      },
    });

    return booking;
  } catch (error) {
    console.error("Error creating guest booking:", error);
    throw new Error("Error creating guest booking");
  }
};

export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // For security, always send a success message even if user not found
      res.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
      return;
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Construct the reset URL (this should point to your frontend reset page)
    const resetUrl = `${process.env.FRONT_END}/reset-password?token=${resetToken}`;

    // Send the email
    await handleSendEmail({
      recipientEmail: user.email as string,
      subject: "Password Reset Request",
      templateName: "password-reset",
      templateContext: {
        name: user.name,
        resetUrl: resetUrl,
        year: new Date().getFullYear(),
        baseUrl: process.env.FRONT_END!,
        logoUrl: `${process.env.FRONT_END}/GLF-logo.png`,
      },
    });

    res.json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

export const confirmBooking = async (
  paymentId: string,
  paymentStatus: string,
  bookingId: string
) => {
  try {
    console.log("Confirming booking:", { paymentId, paymentStatus, bookingId });
    // update booking to confirm
    const update = await prisma.booking.update({
      where: { id: parseInt(bookingId, 10) },
      data: {
        status: "confirmed",
        paymentId,
        paymentStatus,
      },
    });

    const booking = await prisma.booking.findUnique({
      where: { id: update.id },
      include: {
        slots: {
          include: {
            bay: true,
          },
        },
        user: true,
      },
    });

    if (!booking) {
      console.error("Booking not found");
      throw new Error("Booking not found");
    }

    const intents = await stripe.paymentIntents.retrieve(paymentId);
    const amount = intents.amount / 100;

    // Group consecutive slots by bay
    const groupedSlots = groupSlotsByBay(booking.slots);

    console.log("Sending confirmation email to:", booking.user.email);

    await handleSendEmail({
      recipientEmail: booking.user.email!,
      templateName: "confirmation",
      subject: "Booking Confirmation",
      templateContext: {
        booking: {
          id: booking.id,
          slots: groupedSlots,
        },
        payment: {
          intentId: paymentId,
          amount: amount.toFixed(2),
        },
        year: new Date().getFullYear(),
        baseUrl: process.env.FRONT_END!,
        logoUrl: `${process.env.FRONT_END}/GLF-logo.png`,
      },
    });

    console.log(booking);

    return booking;
  } catch (error) {
    console.error("Error confirming booking:", error);
    throw new Error("Error confirming booking");
  }
};

// Handle failed payments - release slots and update booking status
const handleFailedPayment = async (bookingId: number) => {
  try {
    // Update booking status to failed
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "failed",
      },
      include: {
        slots: true,
      },
    });

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

    // Note: No email sent for failed payments since user sees immediate error on frontend
    console.log(`Payment failed for booking ${bookingId}. Slots released.`);
  } catch (error) {
    console.error("Error handling failed payment:", error);
  }
};
