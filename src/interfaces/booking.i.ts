import { Dayjs } from "dayjs";

export const PRICE_PER_HOUR = 4500; // £45

export interface Booking {
  id: number;
  userId: number;
  slotId: number;
  bookingTime: Date;
  status: StatusType;
  paymentId?: string;
  paymentStatus?: string;
}

export interface GuestBooking {
  email: string;
  name: string;
  phone?: string;
}

export interface BasketItem {
  startTime: Dayjs;
  endTime: Dayjs;
  slotIds: number[];
}

type StatusType = "available" | "booked" | "unavailable";
