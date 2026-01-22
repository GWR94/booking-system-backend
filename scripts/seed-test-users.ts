import prisma from "../src/config/prisma.config";
import bcrypt from "bcrypt";
import dayjs from "dayjs";

async function seedTestUsers() {
  console.log("🌱 Seeding comprehensive test data...");

  try {
    const passwordHash = await bcrypt.hash("testuser", 10);
    const adminPasswordHash = await bcrypt.hash("testadminuser", 10);

    // 1. Create Users
    const usersData = [
      {
        email: "test@example.com",
        name: "Test User",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "PAR",
      },
      {
        email: "premium@example.com",
        name: "Premium User",
        role: "user",
        membershipStatus: "ACTIVE",
        membershipTier: "HOLEINONE",
      },
      {
        email: "admin@example.com",
        name: "Administrator",
        role: "admin",
      },
    ];

    const users = [];
    for (const u of usersData) {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          passwordHash:
            u.email === "admin@example.com" ? adminPasswordHash : passwordHash,
          membershipStatus: u.membershipStatus as any,
          membershipTier: u.membershipTier as any,
          role: u.role,
        },
        create: {
          ...u,
          passwordHash:
            u.email === "admin@example.com" ? adminPasswordHash : passwordHash,
          membershipStatus: u.membershipStatus as any,
          membershipTier: u.membershipTier as any,
        },
      });
      users.push(user);
      console.log(`✅ User: ${user.email}`);
    }

    // 2. Ensure Bays exist
    let bays = await prisma.bay.findMany();
    if (bays.length === 0) {
      await prisma.bay.create({ data: { name: "Bay 1" } });
      bays = await prisma.bay.findMany();
    }
    const bayId = bays[0].id;

    // 3. Helper to create a booking for a user at a specific relative day
    const createBookingForUser = async (
      user: any,
      daysOffset: number,
      hour: number,
    ) => {
      const targetDate = dayjs().add(daysOffset, "day").startOf("day");
      const startTime = targetDate
        .hour(hour)
        .minute(0)
        .second(0)
        .millisecond(0)
        .toDate();
      const endTime = targetDate
        .hour(hour)
        .minute(55)
        .second(0)
        .millisecond(0)
        .toDate();

      // Create or find slot
      const slot = await prisma.slot.upsert({
        where: {
          startTime_endTime_bayId: {
            startTime,
            endTime,
            bayId: bayId!,
          },
        },
        update: { status: "booked" },
        create: {
          startTime,
          endTime,
          bayId: bayId!,
          status: "booked",
        },
      });

      // Check if booking already exists for this slot and user
      const existingBooking = await prisma.booking.findFirst({
        where: {
          userId: user.id,
          slots: { some: { id: slot.id } },
        },
      });

      if (!existingBooking) {
        await prisma.booking.create({
          data: {
            userId: user.id,
            status: "confirmed",
            paymentStatus: "paid",
            slots: {
              connect: { id: slot.id },
            },
          },
        });
      }
    };

    // 4. Create Past and Future bookings for each user
    for (const user of users) {
      if (user.role === "admin") continue;

      // Past booking (yesterday)
      await createBookingForUser(user, -1, 14); // 2 PM yesterday
      console.log(`📅 Created past booking for ${user.email}`);

      // Future booking (tomorrow)
      await createBookingForUser(user, 1, 10); // 10 AM tomorrow
      console.log(`📅 Created future booking for ${user.email}`);

      // Another future booking (in 2 days)
      await createBookingForUser(user, 2, 16); // 4 PM in 2 days
      console.log(`📅 Created another future booking for ${user.email}`);
    }

    console.log("🎉 Seeding complete!");
  } catch (error) {
    console.error("❌ Error seeding data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedTestUsers().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { seedTestUsers };
