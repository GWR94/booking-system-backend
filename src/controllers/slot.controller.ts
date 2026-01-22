import { NextFunction, Request, Response } from "express";
import { prisma } from "@config";

// Retrieve all available slots
export const getSlots = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { from, to, ids } = req.query;
  try {
    if (ids) {
      const idsArray = (ids as string).split(",").map((id) => parseInt(id, 10));
      const slots = await prisma.slot.findMany({
        where: {
          id: { in: idsArray },
        },
        orderBy: { startTime: "asc" },
      });
      res.json(slots);
      return;
    }

    if (!from || isNaN(Date.parse(from as string))) {
      res.status(400).json({ error: 'A valid "from" date is required', from });
      return;
    }

    if (!to || isNaN(Date.parse(to as string))) {
      res.status(400).json({ error: 'A valid "to" date is required', to });
      return;
    }

    const slots = await prisma.slot.findMany({
      where: {
        startTime: {
          lte: to as string,
          gte: from as string,
        },
        status: "available",
      }, // Only fetch available slots
      orderBy: { startTime: "asc" },
    });
    res.json(slots);
  } catch (error) {
    next(error);
  }
};
