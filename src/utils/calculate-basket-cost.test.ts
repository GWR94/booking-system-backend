import { describe, it, expect } from "@jest/globals";
import calculateBasketCost from "./calculate-basket-cost";

describe("calculateBasketCost", () => {
  it("should sum up prices correctly", () => {
    // 3 items, each with 1 slot. Total 3 slots.
    // 3 * 4500 = 13500
    const basket = [
      { slotIds: [1] },
      { slotIds: [2] },
      { slotIds: [3] },
    ] as any;
    const total = calculateBasketCost(basket);
    expect(total).toBe(13500);
  });

  it("should handle multiple slots in one item", () => {
    // 1 item with 2 slots.
    // 2 * 4500 = 9000
    const basket = [{ slotIds: [1, 2] }] as any;
    expect(calculateBasketCost(basket)).toBe(9000);
  });

  it("should return 0 for empty basket", () => {
    expect(calculateBasketCost([])).toBe(0);
  });
});
