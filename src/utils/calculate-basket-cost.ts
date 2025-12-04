import { BasketItem, PRICE_PER_HOUR } from "../interfaces/booking.i";

const calculateBasketCost = (items: BasketItem[]) => {
  return items.reduce(
    (total: number, item: BasketItem) =>
      (total += item.slotIds.length * PRICE_PER_HOUR),
    0
  );
};

export default calculateBasketCost;
