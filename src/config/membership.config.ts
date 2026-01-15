export const MEMBERSHIP_TIERS = {
  PAR: {
    name: "Par",
    includedHours: 5,
    discount: 0.1, // 10%
    priceId: process.env.STRIPE_PRICE_ID_PAR,
    price: 19999, // in pence
    weekendAccess: false,
  },
  BIRDIE: {
    name: "Birdie",
    includedHours: 10,
    discount: 0.15, // 15%
    priceId: process.env.STRIPE_PRICE_ID_BIRDIE,
    price: 29999,
    weekendAccess: true,
  },
  HOLEINONE: {
    name: "Hole-In-One",
    includedHours: 15,
    discount: 0.2, // 20%
    priceId: process.env.STRIPE_PRICE_ID_HOLEINONE,
    price: 39999,
    weekendAccess: true,
  },
} as const;

export type MembershipTier = keyof typeof MEMBERSHIP_TIERS;
