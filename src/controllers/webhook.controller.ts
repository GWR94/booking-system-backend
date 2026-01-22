import { RequestWithBody } from "../../app";
import Stripe from "stripe";
import { Response, Request, NextFunction } from "express";
import { BookingService, MembershipService } from "@services";
import { logger } from "@utils";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export const handleWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  let event = req.body;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
  const rawBody = (req as RequestWithBody).rawBody || req.body;

  if (endpointSecret) {
    const signature = req.headers["stripe-signature"] as string | string[];
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        endpointSecret,
      );
    } catch (err) {
      logger.error(
        `⚠️  Webhook signature verification failed. ${(err as Error).message}`,
      );
      res.sendStatus(400);
      return;
    }
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const payment = event.data.object as Stripe.PaymentIntent;
        const { bookingId } = payment.metadata;

        if (bookingId) {
          await BookingService.confirmBooking(
            parseInt(bookingId, 10),
            payment.id,
            payment.status,
          );
        }
        break;
      }
      case "payment_intent.created": {
        const payment = event.data.object as Stripe.PaymentIntent;
        const { userId, slotIds, isGuest, guestName, guestEmail, guestPhone } =
          payment.metadata;

        let booking;
        if (isGuest === "true") {
          booking = await BookingService.createBooking({
            slotIds: JSON.parse(slotIds),
            paymentId: payment.id,
            paymentStatus: payment.status,
            guestInfo: {
              name: guestName,
              email: guestEmail,
              phone: guestPhone,
            },
          });
        } else {
          booking = await BookingService.createBooking({
            userId: parseInt(userId, 10),
            slotIds: JSON.parse(slotIds),
            paymentId: payment.id,
            paymentStatus: payment.status,
          });
        }

        await stripe.paymentIntents.update(payment.id, {
          metadata: { ...payment.metadata, bookingId: booking.id.toString() },
        });
        break;
      }
      case "payment_intent.payment_failed": {
        const payment = event.data.object as Stripe.PaymentIntent;
        const { bookingId } = payment.metadata;

        if (bookingId) {
          await BookingService.handleFailedPayment(parseInt(bookingId, 10));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await MembershipService.handleMembershipUpdate(subscription);
        break;
      }
      default:
        logger.warn(`Unhandled event type ${event.type}.`);
        break;
    }
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};
