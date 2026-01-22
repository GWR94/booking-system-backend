import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Response, NextFunction } from "express";
import { getSlots } from "./slot.controller";
import { prisma } from "@config";

describe("Slot Controller", () => {
  let req: any;
  let res: any;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it("should retrieve slots by multiple IDs", async () => {
    req.query.ids = "1,2,3";
    const mockSlots = [{ id: 1 }, { id: 2 }, { id: 3 }];

    (prisma.slot.findMany as any).mockResolvedValue(mockSlots);

    await getSlots(req, res, next);

    expect(prisma.slot.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [1, 2, 3] },
      },
      orderBy: { startTime: "asc" },
    });
    expect(res.json).toHaveBeenCalledWith(mockSlots);
  });

  it("should return 400 if 'from' date is missing when not using IDs", async () => {
    req.query.to = "2025-05-20";

    await getSlots(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'A valid "from" date is required' }),
    );
  });

  it("should return 400 if 'to' date is missing when not using IDs", async () => {
    req.query.from = "2025-05-20";

    await getSlots(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'A valid "to" date is required' }),
    );
  });

  it("should retrieve available slots in a date range", async () => {
    req.query.from = "2025-05-20T10:00:00Z";
    req.query.to = "2025-05-20T12:00:00Z";
    const mockSlots = [{ id: 10, startTime: "2025-05-20T11:00:00Z" }];

    (prisma.slot.findMany as any).mockResolvedValue(mockSlots);

    await getSlots(req, res, next);

    expect(prisma.slot.findMany).toHaveBeenCalledWith({
      where: {
        startTime: {
          lte: "2025-05-20T12:00:00Z",
          gte: "2025-05-20T10:00:00Z",
        },
        status: "available",
      },
      orderBy: { startTime: "asc" },
    });
    expect(res.json).toHaveBeenCalledWith(mockSlots);
  });

  it("should handle errors by calling next", async () => {
    req.query.from = "2025-05-20T10:00:00Z";
    req.query.to = "2025-05-20T12:00:00Z";
    const error = new Error("Database error");

    (prisma.slot.findMany as any).mockRejectedValue(error);

    await getSlots(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
