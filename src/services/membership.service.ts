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
}
