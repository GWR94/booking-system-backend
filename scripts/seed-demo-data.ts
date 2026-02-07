import prisma from "../src/config/prisma.config";
import bcrypt from "bcrypt";
import dayjs from "dayjs";

/**
 * Script to seed realistic DEMO data for manual Admin Panel testing with configurable months.
 * Usage:
 *   npx ts-node scripts/seed-demo-data.ts [numberOfMonths] [pattern] [monthType]
 *   Example: npx ts-node scripts/seed-demo-data.ts 3 cycle
 *   Example: npx ts-node scripts/seed-demo-data.ts 6 random
 *   Example: npx ts-node scripts/seed-demo-data.ts 2 quiet (2 only quiet months)
 *   Example: npx ts-node scripts/seed-demo-data.ts 5 busy (5 only busy months)
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
      duration: number, // Added duration parameter
      bayId: number,
      status = "confirmed",
    ) => {
      const targetDate = dayjs().add(daysOffset, "day").startOf("day");

      // Calculate start and end times
      const startTime = targetDate.hour(hour).minute(0).second(0).toDate();
      // End time is after 'duration' hours (e.g., 10:00 + 2 hours = 12:00 end time)
      // Note: In the slot logic, a 10:00-10:55 slot effectively "ends" at 11:00 for booking purposes
      const endHour = hour + duration - 1;
      const endTime = targetDate.hour(endHour).minute(55).second(0).toDate();

      // Find or create all slots involved in this booking
      const slotIds: number[] = [];

      for (let i = 0; i < duration; i++) {
        const slotStart = targetDate
          .hour(hour + i)
          .minute(0)
          .second(0)
          .toDate();
        const slotEnd = targetDate
          .hour(hour + i)
          .minute(55)
          .second(0)
          .toDate();

        const slot = await prisma.slot.upsert({
          where: {
            startTime_endTime_bayId: {
              startTime: slotStart,
              endTime: slotEnd,
              bayId,
            },
          },
          update: { status: "booked" },
          create: {
            startTime: slotStart,
            endTime: slotEnd,
            bayId,
            status: "booked",
          },
        });
        slotIds.push(slot.id);
      }

      // Check if any of these slots are already booked by another booking
      const conflictingBooking = await prisma.booking.findFirst({
        where: { slots: { some: { id: { in: slotIds } } } },
      });

      if (!conflictingBooking) {
        await prisma.booking.create({
          data: {
            userId: user.id,
            status,
            paymentStatus: "paid",
            bookingTime: new Date(),
            slots: { connect: slotIds.map((id) => ({ id })) },
          },
        });
        console.log(
          `   📅 Booking created for ${user.name} at ${dayjs(startTime).format("DD/MM HH:mm")} (${duration} slots)`,
        );
      } else {
        console.log(
          `   ⏭️  Slots starting at ${dayjs(startTime).format("DD/MM HH:mm")} overlap with existing booking.`,
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

        // Track booked hours for this specific day/bay combo to prevent overlap
        // Map: BayID -> Set<Hour>
        const bayBookedHours = new Map<number, Set<number>>();
        for (const bay of bays) {
          bayBookedHours.set(bay.id, new Set());
        }

        // Create bookings for this day
        // Iterate through hours, but we might skip some if a multi-slot booking occurs
        let hourIndex = 0;
        while (hourIndex < operatingHours.length) {
          const hour = operatingHours[hourIndex];

          // Randomly decide if we *attempt* a booking starting at this hour
          if (Math.random() < dayProbability) {
            const randomUser =
              activeUsers[Math.floor(Math.random() * activeUsers.length)];
            const randomBay = bays[Math.floor(Math.random() * bays.length)];
            const bookedHoursForBay = bayBookedHours.get(randomBay.id)!;

            // Check if this hour is already booked in this bay (redundant if logic is perfect, but safe)
            if (bookedHoursForBay.has(hour)) {
              hourIndex++;
              continue;
            }

            // Determine Duration (1, 2, or 3 hours)
            // Weighting: 1hr (60%), 2hr (30%), 3hr (10%)
            const rand = Math.random();
            let duration = 1;
            if (rand > 0.6) duration = 2;
            if (rand > 0.9) duration = 3;

            // Truncate duration if it extends past closing time (22:00)
            const remainingHours = operatingHours.length - hourIndex;
            if (duration > remainingHours) {
              duration = remainingHours;
            }

            // Check if ANY of the slots in this duration are already booked
            let isOverlapping = false;
            for (let d = 0; d < duration; d++) {
              if (bookedHoursForBay.has(hour + d)) {
                isOverlapping = true;
                break;
              }
            }

            if (!isOverlapping) {
              const daysFromNow = currentDate.diff(dayjs(), "day");
              await createBooking(
                randomUser,
                daysFromNow,
                hour,
                duration,
                randomBay.id,
              );

              // Mark hours as booked
              for (let d = 0; d < duration; d++) {
                bookedHoursForBay.add(hour + d);
              }
            }
          }

          // We always advance by 1 hour loop-wise, but the 'bookedHours' map handles skipping actual availability.
          // Alternatively, we could advance by `duration` if we were filling sequentially, but here we are simulating random requests arriving.
          hourIndex++;
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
