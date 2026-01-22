import { Request, Response, NextFunction } from "express";
import {
  getAllUsers,
  getAllBookings,
  createAdminBooking,
  createSlot,
  updateSlot,
  deleteSlot,
} from "./admin.controller";
import { prisma } from "@config";

jest.mock("@config", () => ({
  __esModule: true,
  prisma: {
    user: {
      findMany: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    slot: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
  default: {
    prisma: {
      user: {
        findMany: jest.fn(),
      },
      booking: {
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      slot: {
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    },
  },
}));

describe("Admin Controller", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {};
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe("getAllUsers", () => {
    it("should return all users with bookings", async () => {
      const mockUsers = [{ id: 1, name: "Test User", bookings: [] }];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      await getAllUsers(req as Request, res as Response, next);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        include: {
          bookings: {
            include: {
              slots: {
                include: {
                  bay: true,
                },
              },
            },
          },
        },
        orderBy: { id: "asc" },
      });
      expect(res.json).toHaveBeenCalledWith(mockUsers);
    });
  });

  describe("getAllBookings", () => {
    it("should return all bookings with relations", async () => {
      const mockBookings = [{ id: 1, user: { id: 1 }, slots: [{ id: 1 }] }];
      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);
      (prisma.booking.count as jest.Mock).mockResolvedValue(1);

      req.query = {};
      await getAllBookings(req as Request, res as Response, next);

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          user: true,
          slots: {
            include: {
              bay: true,
            },
          },
        },
        orderBy: { bookingTime: "desc" },
        skip: 0,
        take: 10,
      });
      expect(res.json).toHaveBeenCalledWith({
        data: mockBookings,
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
    });
  });

  describe("createAdminBooking", () => {
    it("should create admin booking successfully", async () => {
      req.body = { slotIds: [1] };
      (req as any).currentUser = { id: 1 };
      (prisma.slot.findMany as jest.Mock).mockResolvedValue([
        { id: 1, status: "available" },
      ]);
      const mockBooking = { id: 1, status: "confirmed - local" };
      (prisma.booking.create as jest.Mock).mockResolvedValue(mockBooking);

      await createAdminBooking(req as Request, res as Response, next);

      expect(prisma.slot.findMany).toHaveBeenCalled();
      expect(prisma.booking.create).toHaveBeenCalled();
      expect(prisma.slot.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: "booked" },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "Admin booking created successfully",
        booking: mockBooking,
      });
    });
  });

  describe("createSlot", () => {
    it("should create a slot", async () => {
      req.body = {
        startTime: "2023-01-01T10:00:00Z",
        endTime: "2023-01-01T11:00:00Z",
        bay: 1,
      };
      const mockSlot = { id: 1, ...req.body };
      (prisma.slot.create as jest.Mock).mockResolvedValue(mockSlot);

      await createSlot(req as Request, res as Response, next);

      expect(prisma.slot.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "Slot created successfully",
        slot: mockSlot,
      });
    });
  });

  describe("updateSlot", () => {
    it("should update a slot", async () => {
      req.params = { id: "1" };
      req.body = {
        startTime: "2023-01-01T10:00:00Z",
        endTime: "2023-01-01T11:00:00Z",
        status: "booked",
        bay: { id: 1 },
      };
      const mockSlot = { id: 1, ...req.body };
      (prisma.slot.update as jest.Mock).mockResolvedValue(mockSlot);

      await updateSlot(req as Request, res as Response, next);

      expect(prisma.slot.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: "Slot updated successfully",
        slot: mockSlot,
      });
    });
  });

  describe("deleteSlot", () => {
    it("should delete a slot", async () => {
      req.params = { id: "1" };
      (prisma.slot.delete as jest.Mock).mockResolvedValue({ id: 1 });

      await deleteSlot(req as Request, res as Response, next);

      expect(prisma.slot.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(res.json).toHaveBeenCalledWith({
        message: "Slot deleted successfully",
      });
    });
  });
});
