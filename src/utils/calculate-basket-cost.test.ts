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
        id: 1,
      },
      {
        startTime: "2024-01-22T18:00:00Z", // Peak
        id: 2,
      },
      {
        startTime: "2024-01-22T18:00:00Z", // Peak
        id: 3,
      },
    ] as any;
    const total = calculateBasketCost(basket);
    expect(total).toBe(OFF_PEAK_RATE + 2 * PEAK_RATE);
  });

  it("should calculate member cost with discount", () => {
    const basket = [
      {
        startTime: "2024-01-22T10:00:00Z", // Weekday
        id: 1,
      },
    ] as any;
    const tierConfig = {
      discount: 0.1,
      includedHours: 0,
      weekendAccess: false,
    };
    const total = calculateBasketCost(basket, { tierConfig });
    expect(total).toBe(Math.round(OFF_PEAK_RATE * 0.9));
  });

  it("should handle included hours for members", () => {
    const basket = [
      {
        startTime: "2024-01-22T10:00:00Z", // Weekday (Eligible)
        id: 1,
      },
    ] as any;
    const tierConfig = {
      discount: 0.1,
      includedHours: 5,
      weekendAccess: false,
    };
    const total = calculateBasketCost(basket, {
      tierConfig,
      remainingIncludedHours: 1,
    });
    expect(total).toBe(0);
  });

  it("should deny free hours on weekends if tier doesn't support it", () => {
    const basket = [
      {
        startTime: "2024-01-20T10:00:00Z", // Saturday (Not Eligible for this tier)
        id: 1,
      },
    ] as any;
    const tierConfig = {
      discount: 0.1,
      includedHours: 5,
      weekendAccess: false,
    };
    const total = calculateBasketCost(basket, {
      tierConfig,
      remainingIncludedHours: 1,
    });
    // Should apply discount but not free hour
    expect(total).toBe(Math.round(PEAK_RATE * 0.9));
  });

  it("should return 0 for empty basket", () => {
    expect(calculateBasketCost([])).toBe(0);
  });
});
