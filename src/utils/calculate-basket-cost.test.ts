import { describe, it, expect } from "@jest/globals";
import calculateBasketCost from "./calculate-basket-cost";
import { PEAK_RATE, OFF_PEAK_RATE } from "../interfaces/booking.i";

describe("calculateBasketCost", () => {
  it("should calculate Off-Peak cost correctly (Weekday 10 AM)", () => {
    const basket = [
      {
        startTime: "2024-01-22T10:00:00Z", // Wednesday
        slotIds: [1],
      },
    ] as any;
    const total = calculateBasketCost(basket);
    expect(total).toBe(OFF_PEAK_RATE);
  });

  it("should calculate Peak cost correctly (Weekday 6 PM)", () => {
    const basket = [
      {
        startTime: "2024-01-22T18:00:00Z", // Wednesday
        slotIds: [1],
      },
    ] as any;
    const total = calculateBasketCost(basket);
    expect(total).toBe(PEAK_RATE);
  });

  it("should calculate Peak cost correctly (Saturday)", () => {
    const basket = [
      {
        startTime: "2024-01-20T10:00:00Z", // Saturday
        slotIds: [1],
      },
    ] as any;
    const total = calculateBasketCost(basket);
    expect(total).toBe(PEAK_RATE);
  });

  it("should handle mixed Peak and Off-Peak items", () => {
    const basket = [
      {
        startTime: "2024-01-22T10:00:00Z", // Off-Peak
        slotIds: [1],
      },
      {
        startTime: "2024-01-22T18:00:00Z", // Peak
        slotIds: [2, 3], // 2 slots
      },
    ] as any;
    const total = calculateBasketCost(basket);
    expect(total).toBe(OFF_PEAK_RATE + 2 * PEAK_RATE);
  });

  it("should return 0 for empty basket", () => {
    expect(calculateBasketCost([])).toBe(0);
  });
});
