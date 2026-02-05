import dayjs from "dayjs";
import { Slot } from "@prisma/client";
import { PEAK_RATE, OFF_PEAK_RATE } from "../interfaces/booking.i";

const isPeakTime = (date: Date | string | dayjs.Dayjs): boolean => {
  const d = dayjs(date);
  const dayOfWeek = d.day(); // 0 = Sunday, 6 = Saturday
  const hour = d.hour();

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isPeakHour = hour >= 17; // 5 PM or later

  return isWeekend || isPeakHour;
};

interface CalculationOptions {
  tierConfig?: {
    discount: number;
    includedHours: number;
    weekendAccess: boolean;
  };
  remainingIncludedHours?: number;
}

const calculateBasketCost = (slots: Slot[], options?: CalculationOptions) => {
  const { tierConfig, remainingIncludedHours = 0 } = options || {};
  let currentRemaining = remainingIncludedHours;

  const total = slots.reduce((acc: number, slot: Slot) => {
    const isPeak = isPeakTime(slot.startTime);
    const rate = isPeak ? PEAK_RATE : OFF_PEAK_RATE;

    if (tierConfig) {
      const slotTime = dayjs(slot.startTime);
      const dayOfWeek = slotTime.day(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isEligibleForFree = tierConfig.weekendAccess || !isWeekend;

      if (isEligibleForFree && currentRemaining > 0) {
        currentRemaining--;
        return acc;
      }

      return acc + rate * (1 - tierConfig.discount);
    }

    return acc + rate;
  }, 0);

  return Math.round(total);
};

export default calculateBasketCost;
