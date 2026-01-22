import { prisma, MEMBERSHIP_TIERS } from "@config";
import { logger } from "@utils";
import Stripe from "stripe";
import {
  MembershipStatus,
  MembershipTier,
} from "../../prisma/generated/prisma/client";

export class MembershipService {
  /**
   * Handle all subscription-related events from Stripe (created, updated, deleted)
   */
  static async handleMembershipUpdate(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const stripeStatus = subscription.status;
    const currentPeriodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000)
      : null;
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;
    const priceId = subscription.items?.data[0]?.price.id;

    const tierEntry = Object.entries(MEMBERSHIP_TIERS).find(
      ([, val]) => val.priceId === priceId,
    );
    const tier = tierEntry ? (tierEntry[0] as MembershipTier) : null;

    let mappedStatus: MembershipStatus = MembershipStatus.CANCELLED;
    if (stripeStatus === "active") {
      mappedStatus = MembershipStatus.ACTIVE;
    }

    try {
      await prisma.user.update({
        where: { stripeCustomerId: customerId },
        data: {
          currentPeriodStart:
            mappedStatus === MembershipStatus.ACTIVE
              ? currentPeriodStart
              : null,
          currentPeriodEnd:
            mappedStatus === MembershipStatus.ACTIVE && tier
              ? currentPeriodEnd
              : null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          membershipTier:
            mappedStatus === MembershipStatus.ACTIVE && tier ? tier : null,
          membershipStatus:
            mappedStatus === MembershipStatus.ACTIVE && !tier
              ? MembershipStatus.CANCELLED
              : mappedStatus,
        },
      });
      logger.info(
        `Updated membership for customer ${customerId} to ${mappedStatus}`,
      );
    } catch (error) {
      logger.error(
        `Error updating membership for customer ${customerId}: ${error}`,
      );
      throw error;
    }
  }

  public static async getUsageStats(user: {
    id: number;
    membershipTier: MembershipTier | null;
    membershipStatus: MembershipStatus | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
  }) {
    if (
      !user.membershipTier ||
      user.membershipStatus !== MembershipStatus.ACTIVE ||
      !user.currentPeriodStart ||
      !user.currentPeriodEnd
    ) {
      return null;
    }

    try {
      const tierConfig = MEMBERSHIP_TIERS[user.membershipTier];
      if (!tierConfig) return null;

      const bookings = await prisma.booking.findMany({
        where: {
          userId: user.id,
          status: { in: ["confirmed", "pending"] },
          bookingTime: {
            gte: user.currentPeriodStart,
            lte: user.currentPeriodEnd,
          },
        },
        include: { slots: true },
      });

      let usedHours = 0;
      bookings.forEach((booking) => {
        booking.slots.forEach((slot) => {
          const slotTime = new Date(slot.startTime);
          const dayOfWeek = slotTime.getDay(); // 0 = Sunday, 6 = Saturday
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isEligible = tierConfig.weekendAccess || !isWeekend;

          if (isEligible) {
            usedHours++;
          }
        });
      });

      const totalHours = tierConfig.includedHours;
      const remainingHours = Math.max(0, totalHours - usedHours);

      return {
        usedHours,
        totalHours,
        remainingHours,
      };
    } catch (error) {
      logger.error(
        `Error calculating usage stats for user ${user.id}: ${error}`,
      );
      return null;
    }
  }
}
