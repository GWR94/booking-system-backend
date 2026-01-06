import { Booking } from "./booking.i";

export interface User {
  id: number;
  email: string | null;
  passwordHash: string | null;
  role: string;
  name: string;
  bookings?: Booking[];
  googleId?: string | null;
  facebookId?: string | null;
  appleId?: string | null;
  twitterId?: string | null;
}

export interface UserPayload {
  id: number;
  // userId: number;
  email: string | null;
  facebookId?: string | null;
  googleId?: string | null;
  appleId?: string | null;
  twitterId?: string | null;
  role?: string;
}
