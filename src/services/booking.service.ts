import { prisma } from "@config";
import Stripe from "stripe";
import { handleSendEmail, groupSlotsByBay, logger, BookingError } from "@utils";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export class BookingService {
  /**
   * Create a booking for a user (authenticated or guest)
   */
  static async createBooking({
    userId,
    slotIds,
    paymentId,
    paymentStatus,
    guestInfo,
  }: {
    userId?: number;
    slotIds: number[];
    paymentId: string;
    paymentStatus: string;
    guestInfo?: { name: string; email: string; phone?: string };
  }) {
    let finalUserId = userId;

    // If guestInfo is provided, we either find or create the guest user
    if (guestInfo) {
      const guestUser = await prisma.user.upsert({
        where: { email: guestInfo.email },
        update: {
          name: guestInfo.name,
          ...(guestInfo.phone && { phone: guestInfo.phone }),
        },
        create: {
          email: guestInfo.email,
          name: guestInfo.name,
          ...(guestInfo.phone && { phone: guestInfo.phone }),
          role: "guest",
        },
      });
      finalUserId = guestUser.id;
    }

    if (!finalUserId) {
      throw new BookingError(
        "User ID or guest info must be provided",
        400,
        "MISSING_USER_CONTEXT",
      );
    }

    const slots = await prisma.slot.findMany({
      where: {
        id: { in: slotIds },
        status: "available",
      },
    });

    if (slots.length !== slotIds.length) {
      throw new BookingError(
        "One or more slots do not exist or have been booked",
        400,
        "SLOT_NOT_AVAILABLE",
      );
    }

    const booking = await prisma.booking.create({
      data: {
        user: { connect: { id: finalUserId } },
        slots: { connect: slotIds.map((id) => ({ id })) },
        status: "pending",
        paymentId,
        paymentStatus,
      },
      include: { slots: true },
    });

    await prisma.slot.updateMany({
      where: { id: { in: slotIds } },
      data: { status: "awaiting payment" },
    });

    return booking;
  }

  /**
   * Confirm a booking after successful payment
   */
  static async confirmBooking(
    bookingId: number,
    paymentId: string,
    paymentStatus: string,
  ) {
    const update = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "confirmed",
        paymentId,
        paymentStatus,
      },
    });

    const booking = await prisma.booking.findUnique({
      where: { id: update.id },
      include: {
        slots: { include: { bay: true } },
        user: true,
      },
    });

    if (!booking) {
      throw new BookingError("Booking not found", 404, "BOOKING_NOT_FOUND");
    }

    const intent = await stripe.paymentIntents.retrieve(paymentId);
    const amount = intent.amount / 100;
    const groupedSlots = groupSlotsByBay(booking.slots);

    await handleSendEmail({
      senderPrefix: "bookings",
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
        logoUrl: process.env.LOGO_URL!,
      },
    });

    return booking;
  }

  /**
   * Handle failed payment by releasing slots
   */
  static async handleFailedPayment(bookingId: number) {
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "failed" },
      include: { slots: true },
    });

    const slotIds = booking.slots.map((slot) => slot.id);

    await prisma.slot.updateMany({
      where: { id: { in: slotIds } },
      data: { status: "available" },
    });

    logger.info(`Payment failed for booking ${bookingId}. Slots released.`);
    return booking;
  }
}
