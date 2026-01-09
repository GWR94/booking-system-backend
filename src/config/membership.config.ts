export const MEMBERSHIP_TIERS = {
  BRONZE: {
    name: "Bronze",
    includedHours: 5,
    discount: 0.1, // 10%
    priceId: process.env.STRIPE_PRICE_ID_BRONZE,
    price: 19999, // in pence
  },
  SILVER: {
    name: "Silver",
    includedHours: 10,
    discount: 0.15, // 15%
    priceId: process.env.STRIPE_PRICE_ID_SILVER,
    price: 29999,
  },
  GOLD: {
    name: "Gold",
    includedHours: 15,
    discount: 0.2, // 20%
    priceId: process.env.STRIPE_PRICE_ID_GOLD,
    price: 49999,
  },
} as const;

export type MembershipTier = keyof typeof MEMBERSHIP_TIERS;
