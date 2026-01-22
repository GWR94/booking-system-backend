import dayjs from "dayjs";
import { BasketItem, PEAK_RATE, OFF_PEAK_RATE } from "../interfaces/booking.i";

const isPeakTime = (date: Date | string | dayjs.Dayjs): boolean => {
  const d = dayjs(date);
  const dayOfWeek = d.day(); // 0 = Sunday, 6 = Saturday
  const hour = d.hour();

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isPeakHour = hour >= 17; // 5 PM or later

  return isWeekend || isPeakHour;
};

const calculateBasketCost = (items: BasketItem[]) => {
  return items.reduce((total: number, item: BasketItem) => {
    const rate = isPeakTime(item.startTime) ? PEAK_RATE : OFF_PEAK_RATE;
    return total + item.slotIds.length * rate;
  }, 0);
};

export default calculateBasketCost;
