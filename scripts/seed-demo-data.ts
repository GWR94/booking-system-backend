import prisma from "../src/config/prisma.config";
import bcrypt from "bcrypt";
import dayjs from "dayjs";

/**
 * Script to seed realistic DEMO data for manual Admin Panel testing.
 * Usage: npx ts-node scripts/seed-demo-data.ts
 */
async function seedDemoData() {
  console.log("🌱 Seeding Demo Data...");

  try {
    const passwordHash = await bcrypt.hash("Demo123!", 10);

    // 1. Demo Users
    const demoUsers = [
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
        email: "demo.cancelled@example.com",
        name: "Colin Cancelled",
        role: "user",
        membershipStatus: "CANCELLED",
        membershipTier: null, // Cancelled members lose their tier features immediately in this system
        phone: "07700900003",
      },
      {
        email: "demo.cancelling@example.com",
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
        email: "demo.guest@example.com",
        name: "Gary Guest",
        role: "user",
        // membershipStatus: undefined, // Default is null for users who never subscribed
        membershipTier: null,
        phone: "07700900004",
      },
    ];

    const createdUsers = [];

    for (const u of demoUsers) {
      // Upsert to avoid duplicates if run multiple times
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          // Update details if they changed in the script
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
    const bayId = bays[0].id;

    // 3. Helper to create bookings
    const createBooking = async (
      user: any,
      daysOffset: number,
      hour: number,
      status = "confirmed",
    ) => {
      // Calculate times
      const targetDate = dayjs().add(daysOffset, "day").startOf("day");
      const startTime = targetDate.hour(hour).minute(0).second(0).toDate();
      const endTime = targetDate.hour(hour).minute(55).second(0).toDate();

      // Create Slot
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

      // Create Booking if not exists
      const existingBooking = await prisma.booking.findFirst({
        where: { slots: { some: { id: slot.id } } },
      });

      if (!existingBooking) {
        await prisma.booking.create({
          data: {
            userId: user.id,
            status,
            paymentStatus: "paid",
            bookingTime: new Date(), // Booked now
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

    // 4. Generate Bookings
    console.log("📅 Generating Bookings...");

    const [harry, peter] = createdUsers; // Use the active members primarily

    // Past bookings (History)
    await createBooking(harry, -5, 10);
    await createBooking(peter, -2, 14);

    // Today's bookings
    await createBooking(harry, 0, 18); // 6pm today

    // Future bookings
    await createBooking(peter, 1, 9); // 9am tomorrow
    await createBooking(harry, 3, 12); // 12pm in 3 days
    await createBooking(peter, 7, 10); // 10am next week

    console.log("🎉 Demo Seeding Complete!");
  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  seedDemoData();
}
