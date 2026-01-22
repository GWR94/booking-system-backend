import { Dayjs } from "dayjs";

export const PEAK_RATE = 4500; // £45
export const OFF_PEAK_RATE = 3500; // £35

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
