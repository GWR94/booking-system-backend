import { NextFunction, Request, Response } from "express";
import { prisma, MEMBERSHIP_TIERS, MembershipTier } from "@config";
import Stripe from "stripe";
import { BasketItem, PRICE_PER_HOUR, AuthenticatedRequest } from "@interfaces";
import { calculateBasketCost, groupSlotsByBay } from "@utils";
import { BookingService } from "@services";
import axios from "axios";
import dayjs from "dayjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export const createBooking = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const { slotIds, paymentId, paymentStatus } = req.body;
  const { currentUser } = req;

  try {
    if (!currentUser) {
      res.status(401).json({
        message: "Unauthorized",
        error: "NOT_AUTHENTICATED",
      });
      return;
    }

    const booking = await BookingService.createBooking({
      userId: currentUser.id,
      slotIds,
      paymentId,
      paymentStatus,
    });

    res.status(201).json({
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    if (
      (error as Error).message ===
      "One or more slots do not exist or have been booked"
    ) {
      res.status(400).json({
        message: (error as Error).message,
        error: "SLOT_NOT_AVAILABLE",
      });
      return;
    }
    next(error);
  }
};

export const createPaymentIntent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const { items } = req.body;
  const { currentUser } = req;
  const slotIds = items.map((item: BasketItem) => item.slotIds).flat();
  const slots = JSON.stringify(slotIds);

  if (!items || items.length === 0) {
    res.status(400).send({ error: "Invalid item selection" });
    return;
  }

  if (!currentUser) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    let finalAmount = calculateBasketCost(items);
    const totalHoursRequested = slotIds.length;

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: {
        bookings: {
          include: { slots: true },
        },
      },
    });

    if (user?.membershipTier && user.membershipStatus === "ACTIVE") {
      const tierConfig =
        MEMBERSHIP_TIERS[user.membershipTier as MembershipTier];
      if (tierConfig) {
        const periodStart = user.currentPeriodStart || new Date();
        const periodEnd = user.currentPeriodEnd || new Date();

        // Calculate used hours in current period
        let usedHours = 0;
        user.bookings.forEach((booking) => {
          // Only count confirmed bookings in the current period
          if (booking.status === "confirmed" || booking.status === "pending") {
            // Check date overlap - primitive check
            const bookingDate = new Date(booking.bookingTime);
            if (bookingDate >= periodStart && bookingDate <= periodEnd) {
              usedHours += booking.slots.length;
            }
          }
        });

        const includedHours = tierConfig.includedHours;
        let remainingIncluded = Math.max(0, includedHours - usedHours);

        let freeHours = 0;
        let paidHours = 0;

        // Iterate through all requested slots to determine which are eligible for 'included' hours
        for (const item of items) {
          const start = dayjs(item.startTime);
          const durationHours = item.slotIds.length; // Assuming 1 slot = 1 hour as per line 192

          for (let i = 0; i < durationHours; i++) {
            const slotTime = start.add(i, "hour");
            const dayOfWeek = slotTime.day(); // 0 = Sunday, 6 = Saturday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isEligibleForFree = tierConfig.weekendAccess || !isWeekend;

            if (isEligibleForFree && remainingIncluded > 0) {
              freeHours++;
              remainingIncluded--;
            } else {
              paidHours++;
            }
          }
        }

        const costForPaid = paidHours * PRICE_PER_HOUR;
        const discountedCost = costForPaid * (1 - tierConfig.discount);

        finalAmount = Math.round(discountedCost);
      }
    }

    if (finalAmount === 0) {
      // Free booking (covered by membership)
      res.json({ clientSecret: null, amount: 0 });
      return;
    }

    const intent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: "gbp",
      metadata: {
        userId: currentUser.id.toString(),
        slotIds: slots,
      },
    });

    res.json({ clientSecret: intent.client_secret, amount: finalAmount });
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { bookingId } = req.params;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId, 10) },
      include: { slots: true },
    });

    if (!booking) {
      res
        .status(404)
        .json({ message: "Booking not found", error: "BOOKING_NOT_FOUND" });
      return;
    }

    // TODO
    // [ ] Add date / time check for company policy - eg no closer than 2 weeks
    // [ ] Add stripe refund ??

    const slotIds = booking.slots.map((slot) => slot.id);

    if (slotIds.length === 0) {
      res.status(400).json({
        message: "No slots associated with this booking to cancel",
        error: "NO_SLOTS_TO_CANCEL",
      });
      return;
    }

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

    await prisma.booking.delete({
      where: { id: booking.id },
    });

    res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    next(error);
  }
};

export const createGuestPaymentIntent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { items, guestInfo, recaptchaToken } = req.body;
  const slotIds = items.map((item: BasketItem) => item.slotIds).flat();
  const slots = JSON.stringify(slotIds);

  if (!items || items.length === 0) {
    res.status(400).send({ error: "Invalid item selection" });
    return;
  }

  if (!guestInfo?.email || !guestInfo?.name) {
    res.status(400).send({ error: "Guest information required" });
    return;
  }

  try {
    const recaptchaResponse = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.CAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
    );

    if (!recaptchaResponse.data.success) {
      res.status(400).json({
        message: "reCAPTCHA verification failed",
        error: "RECAPTCHA_FAILED",
      });
      return;
    }

    const intent = await stripe.paymentIntents.create({
      amount: calculateBasketCost(items),
      currency: "gbp",
      metadata: {
        slotIds: slots,
        isGuest: "true",
        guestName: guestInfo.name,
        guestEmail: guestInfo.email,
        guestPhone: guestInfo.phone || "",
      },
    });

    res.json({ clientSecret: intent.client_secret });
  } catch (error) {
    next(error);
  }
};

export const createGuestBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { slotIds, paymentId, paymentStatus, guestInfo } = req.body;

  try {
    const booking = await BookingService.createBooking({
      slotIds,
      paymentId,
      paymentStatus,
      guestInfo,
    });

    res.status(201).json({
      message: "Guest booking created successfully",
      booking,
      guestEmail: guestInfo.email,
    });
  } catch (error) {
    if (
      (error as Error).message ===
      "One or more slots do not exist or have been booked"
    ) {
      res.status(400).json({
        message: (error as Error).message,
        error: "SLOT_NOT_AVAILABLE",
      });
      return;
    }
    next(error);
  }
};

export const getBookingByPaymentId = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { paymentId } = req.params;

  try {
    const booking = await prisma.booking.findFirst({
      where: { paymentId },
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
      res.status(404).json({ message: "Booking not found" });
      return;
    }

    const groupedSlots = groupSlotsByBay(booking.slots);

    res.json({ booking, groupedSlots });
  } catch (error) {
    next(error);
  }
};
