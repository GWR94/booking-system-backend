import prisma from "../src/config/prisma.config";
import bcrypt from "bcrypt";
import dayjs from "dayjs";

/**
 * Script to seed realistic DEMO data for manual Admin Panel testing with configurable months.
 * Usage:
 *   npx ts-node scripts/seed-demo-data.ts [numberOfMonths] [pattern] [monthType]
 *   Example: npx ts-node scripts/seed-demo-data.ts 3 cycle
 *   Example: npx ts-node scripts/seed-demo-data.ts 6 random
 *   Example: npx ts-node scripts/seed-demo-data.ts 2 quiet (only quiet months)
 *   Example: npx ts-node scripts/seed-demo-data.ts 5 busy (only busy months)
 *
 * Pattern options:
 * - 'cycle' (default): Cycles through busy → mixed → quiet → busy → ...
 * - 'random': Randomly selects busy, mixed, or quiet for each month
 * - 'busy', 'mixed', or 'quiet': All months will be this type
 *
 * Month types:
 * - Busy months: High booking density (60-80% of available slots)
 * - Mixed months: Moderate booking density (40-60% with more variation)
 * - Quiet months: Low booking density (20-30% of available slots)
 */
async function seedDemoData(
  numberOfMonths: number = 2,
  pattern: "cycle" | "random" | "busy" | "mixed" | "quiet" = "cycle",
) {
  console.log(
    `🌱 Seeding Demo Data for ${numberOfMonths} month(s) with '${pattern}' pattern...`,
  );

  try {
    const passwordHash = await bcrypt.hash("Demo123!", 10);

    // 1. Demo Users - Mix of active members, guests, and cancelled accounts
    const demoUsers = [
      // Active members with various tiers
      {
        email: "demo.holeinone@example.com",
        name: "Harry Hole-in-One",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "HOLEINONE",
        phone: "07700900001",
        currentPeriodStart: dayjs().subtract(5, "day").toDate(),
        currentPeriodEnd: dayjs().add(25, "day").toDate(),
      },
      {
        email: "demo.par@example.com",
        name: "Peter Par",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "PAR",
        phone: "07700900002",
        currentPeriodStart: dayjs().subtract(10, "day").toDate(),
        currentPeriodEnd: dayjs().add(20, "day").toDate(),
      },
      {
        email: "demo.birdie1@example.com",
        name: "Connie Cancelling",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "BIRDIE",
        phone: "07700900005",
        currentPeriodStart: dayjs().subtract(15, "day").toDate(),
        currentPeriodEnd: dayjs().add(15, "day").toDate(),
        cancelAtPeriodEnd: true,
      },
      {
        email: "demo.birdie2@example.com",
        name: "Bella Birdie",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "BIRDIE",
        phone: "07700900006",
        currentPeriodStart: dayjs().subtract(8, "day").toDate(),
        currentPeriodEnd: dayjs().add(22, "day").toDate(),
      },
      {
        email: "demo.par3@example.com",
        name: "Patrick Parton",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "PAR",
        phone: "07700900007",
        currentPeriodStart: dayjs().subtract(12, "day").toDate(),
        currentPeriodEnd: dayjs().add(18, "day").toDate(),
      },
      {
        email: "demo.birdie4@example.com",
        name: "Betty Birdie",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "BIRDIE",
        phone: "07700900008",
        currentPeriodStart: dayjs().subtract(3, "day").toDate(),
        currentPeriodEnd: dayjs().add(27, "day").toDate(),
      },
      {
        email: "demo.holeinone3@example.com",
        name: "Holly Hio",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "HOLEINONE",
        phone: "07700900009",
        currentPeriodStart: dayjs().subtract(20, "day").toDate(),
        currentPeriodEnd: dayjs().add(10, "day").toDate(),
      },
      {
        email: "demo.par4@example.com",
        name: "Penny Par",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "PAR",
        phone: "07700900010",
        currentPeriodStart: dayjs().subtract(6, "day").toDate(),
        currentPeriodEnd: dayjs().add(24, "day").toDate(),
      },
      {
        email: "demo.par2@example.com",
        name: "Paula Par",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "PAR",
        phone: "07700900011",
        currentPeriodStart: dayjs().subtract(18, "day").toDate(),
        currentPeriodEnd: dayjs().add(12, "day").toDate(),
      },
      {
        email: "demo.holeinone2@example.com",
        name: "Harvey Hio",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "HOLEINONE",
        phone: "07700900012",
        currentPeriodStart: dayjs().subtract(2, "day").toDate(),
        currentPeriodEnd: dayjs().add(28, "day").toDate(),
      },
      {
        email: "demo.birdie3@example.com",
        name: "Bernie Bird",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "BIRDIE",
        phone: "07700900013",
        currentPeriodStart: dayjs().subtract(14, "day").toDate(),
        currentPeriodEnd: dayjs().add(16, "day").toDate(),
      },
      {
        email: "demo.holeinone4@example.com",
        name: "Henry Hio",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "HOLEINONE",
        phone: "07700900014",
        currentPeriodStart: dayjs().subtract(9, "day").toDate(),
        currentPeriodEnd: dayjs().add(21, "day").toDate(),
      },
      // Cancelled and guest users (won't make bookings)
      {
        email: "demo.cancelled@example.com",
        name: "Colin Cancelled",
        role: "user",
        membershipStatus: "CANCELLED",
        membershipTier: null,
        phone: "07700900003",
      },
      {
        email: "demo.guest@example.com",
        name: "Gary Guest",
        role: "user",
        membershipTier: null,
        phone: "07700900004",
      },
    ];

    const createdUsers = [];

    for (const u of demoUsers) {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          role: u.role,
          membershipStatus: u.membershipStatus as any,
          membershipTier: u.membershipTier as any,
          phone: u.phone,
          passwordHash,
          currentPeriodStart: u.currentPeriodStart,
          currentPeriodEnd: u.currentPeriodEnd,
          cancelAtPeriodEnd: (u as any).cancelAtPeriodEnd || false,
        },
        create: {
          ...u,
          passwordHash,
          membershipStatus: u.membershipStatus as any,
          membershipTier: u.membershipTier as any,
          currentPeriodStart: u.currentPeriodStart,
          currentPeriodEnd: u.currentPeriodEnd,
          cancelAtPeriodEnd: (u as any).cancelAtPeriodEnd || false,
        },
      });
      createdUsers.push(user);
      console.log(`✅ Demo User: ${user.name} (${user.membershipStatus})`);
    }

    // 2. Ensure at least one Bay exists
    let bays = await prisma.bay.findMany();
    if (bays.length === 0) {
      await prisma.bay.create({ data: { name: "Bay 1" } });
      await prisma.bay.create({ data: { name: "Bay 2" } });
      bays = await prisma.bay.findMany();
      console.log("✅ Created default Bays");
    }
    console.log(
      `📍 Found ${bays.length} bay(s) - bookings will be distributed across all bays`,
    );

    // 3. Helper to create bookings
    const createBooking = async (
      user: any,
      daysOffset: number,
      hour: number,
      bayId: number,
      status = "confirmed",
    ) => {
      const targetDate = dayjs().add(daysOffset, "day").startOf("day");
      const startTime = targetDate.hour(hour).minute(0).second(0).toDate();
      const endTime = targetDate.hour(hour).minute(55).second(0).toDate();

      const slot = await prisma.slot.upsert({
        where: {
          startTime_endTime_bayId: {
            startTime,
            endTime,
            bayId,
          },
        },
        update: { status: "booked" },
        create: {
          startTime,
          endTime,
          bayId,
          status: "booked",
        },
      });

      const existingBooking = await prisma.booking.findFirst({
        where: { slots: { some: { id: slot.id } } },
      });

      if (!existingBooking) {
        await prisma.booking.create({
          data: {
            userId: user.id,
            status,
            paymentStatus: "paid",
            bookingTime: new Date(),
            slots: { connect: { id: slot.id } },
          },
        });
        console.log(
          `   📅 Booking created for ${user.name} at ${dayjs(startTime).format("DD/MM HH:mm")}`,
        );
      } else {
        console.log(
          `   ⏭️  Slot at ${dayjs(startTime).format("DD/MM HH:mm")} already booked.`,
        );
      }
    };

    // 4. Generate Bookings for multiple months
    console.log("📅 Generating Bookings...");

    const activeUsers = createdUsers.filter(
      (u) => u.membershipStatus === "ACTIVE",
    );

    // Operating hours: 10am to 10pm (10-22)
    const operatingHours = Array.from({ length: 12 }, (_, i) => i + 10);

    // Generate bookings for each month
    for (let monthIndex = 0; monthIndex < numberOfMonths; monthIndex++) {
      const monthStart = dayjs().add(monthIndex, "month").startOf("month");
      const daysInMonth = monthStart.daysInMonth();

      // Determine month type based on pattern
      let monthType: number;
      if (pattern === "busy") {
        monthType = 0; // All months busy
      } else if (pattern === "mixed") {
        monthType = 1; // All months mixed
      } else if (pattern === "quiet") {
        monthType = 2; // All months quiet
      } else if (pattern === "random") {
        monthType = Math.floor(Math.random() * 3); // 0 = busy, 1 = mixed, 2 = quiet
      } else {
        monthType = monthIndex % 3; // Cycle through: busy (0), mixed (1), quiet (2)
      }

      let monthLabel: string;
      let baseBookingProbability: number;
      let isMixed = false;

      switch (monthType) {
        case 0: // Busy
          monthLabel = "🔥 Busy";
          baseBookingProbability = 0.7;
          break;
        case 1: // Mixed
          monthLabel = "🌤️ Mixed";
          baseBookingProbability = 0.5;
          isMixed = true;
          break;
        case 2: // Quiet
        default:
          monthLabel = "💤 Quiet";
          baseBookingProbability = 0.25;
          break;
      }

      console.log(`\n${monthLabel} Month: ${monthStart.format("MMMM YYYY")}`);

      for (let day = 0; day < daysInMonth; day++) {
        const currentDate = monthStart.add(day, "day");
        const dayOfWeek = currentDate.day();

        // Skip past dates
        if (currentDate.isBefore(dayjs(), "day")) {
          continue;
        }

        // Adjust probability for weekends (higher)
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        let dayProbability = baseBookingProbability;

        if (isWeekend) {
          dayProbability = Math.min(dayProbability * 1.3, 0.95);
        }

        // For mixed months, add more variation day-to-day
        if (isMixed) {
          // Random adjustment between 0.7x and 1.3x
          const variationFactor = 0.7 + Math.random() * 0.6;
          dayProbability = Math.min(dayProbability * variationFactor, 0.95);
        }

        // Create bookings for this day
        for (const hour of operatingHours) {
          // Randomly decide if this slot should be booked based on probability
          if (Math.random() < dayProbability) {
            const randomUser =
              activeUsers[Math.floor(Math.random() * activeUsers.length)];
            const randomBay = bays[Math.floor(Math.random() * bays.length)];
            const daysFromNow = currentDate.diff(dayjs(), "day");

            await createBooking(randomUser, daysFromNow, hour, randomBay.id);
          }
        }
      }
    }

    console.log("\n🎉 Demo Seeding Complete!");
  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  const numberOfMonths = parseInt(process.argv[2], 10) || 2;
  const patternArg = process.argv[3] || "cycle";
  const validPatterns = ["cycle", "random", "busy", "mixed", "quiet"];
  const pattern = validPatterns.includes(patternArg)
    ? (patternArg as "cycle" | "random" | "busy" | "mixed" | "quiet")
    : "cycle";
  seedDemoData(numberOfMonths, pattern);
}
