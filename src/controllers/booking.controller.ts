import { NextFunction, Request, Response } from "express";
import { prisma, MEMBERSHIP_TIERS, MembershipTier } from "@config";
import Stripe from "stripe";
import {
  BasketItem,
  PEAK_RATE,
  OFF_PEAK_RATE,
  AuthenticatedRequest,
} from "@interfaces";
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
    const booking = await BookingService.createBooking({
      userId: currentUser!.id,
      slotIds,
      paymentId,
      paymentStatus,
    });

    res.status(201).json({
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
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
  const ids = JSON.stringify(slotIds);

  if (!items || items.length === 0) {
    res.status(400).send({ error: "Invalid item selection" });
    return;
  }

  try {
    // Fetch authoritative slot data from the database
    const dbSlots = await prisma.slot.findMany({
      where: {
        id: { in: slotIds },
      },
    });

    if (dbSlots.length !== slotIds.length) {
      const foundIds = dbSlots.map((s) => s.id);
      const missingIds = slotIds.filter((id: number) => !foundIds.includes(id));
      res.status(400).json({
        error: "One or more slots are unavailable",
        missingSlotIds: missingIds,
      });
      return;
    }

    let finalAmount = 0;

    const user = await prisma.user.findUnique({
      where: { id: currentUser!.id },
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
            const bookingDate = new Date(booking.bookingTime);
            if (bookingDate >= periodStart && bookingDate <= periodEnd) {
              usedHours += booking.slots.length;
            }
          }
        });

        const remainingIncluded = Math.max(
          0,
          tierConfig.includedHours - usedHours,
        );
        finalAmount = calculateBasketCost(dbSlots, {
          tierConfig,
          remainingIncludedHours: remainingIncluded,
        });
      }
    } else {
      finalAmount = calculateBasketCost(dbSlots);
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
        userId: currentUser!.id.toString(),
        slotIds: ids,
      },
    });

    res.json({ clientSecret: intent.client_secret, amount: finalAmount });
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const booking = req.booking!;

    // Verify cancellation policy (24 hours notice)
    const firstSlot = booking.slots[0];
    let refundWarning: string | undefined;
    let refundStatus:
      | "refunded"
      | "not_refunded_policy"
      | "not_applicable"
      | "failed" = "not_applicable";

    if (firstSlot && booking.paymentId) {
      const slotTime = new Date(firstSlot.startTime).getTime();
      const now = Date.now();
      const hoursUntilBooking = (slotTime - now) / (1000 * 60 * 60);

      if (hoursUntilBooking >= 24) {
        try {
          await stripe.refunds.create({
            payment_intent: booking.paymentId,
          });
          refundStatus = "refunded";
        } catch (error) {
          console.error("Stripe refund failed:", error);
          refundWarning =
            "Booking cancelled, but automatic refund failed. Please contact support.";
          refundStatus = "failed";
        }
      } else {
        refundStatus = "not_refunded_policy";
      }
    }

    const slotIds = booking.slots.map((slot: any) => slot.id);

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

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled" },
    });

    res.json({
      message: "Booking cancelled successfully",
      refundWarning,
      refundStatus,
    });
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
  const ids = JSON.stringify(slotIds);

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

    // Fetch authoritative slot data from the database
    const dbSlots = await prisma.slot.findMany({
      where: {
        id: { in: slotIds },
      },
    });

    if (dbSlots.length !== slotIds.length) {
      const foundIds = dbSlots.map((s) => s.id);
      const missingIds = slotIds.filter((id: number) => !foundIds.includes(id));
      res.status(400).json({
        error: "One or more slots not found",
        missingSlotIds: missingIds,
      });
      return;
    }

    const intent = await stripe.paymentIntents.create({
      amount: calculateBasketCost(dbSlots),
      currency: "gbp",
      metadata: {
        slotIds: ids,
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
