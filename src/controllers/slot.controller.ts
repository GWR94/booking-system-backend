import { NextFunction, Request, Response } from "express";
import prisma from "../config/prisma-client";

// Create a new slot (admin only)
export const createSlot = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { startTime, endTime, status = "available", bay } = req.body;

  try {
    const slot = await prisma.slot.create({
      data: {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status,
        bayId: bay as number,
      },
    });

    res.status(201).json({ message: "Slot created successfully", slot });
  } catch (error) {
    next(error);
  }
};

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

export const getUniqueSlot = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const slot = await prisma.slot.findUnique({
      where: { id: parseInt(id, 10) },
    });
    if (!slot) {
      res
        .status(404)
        .json({ message: "Slot doesn't exist", error: "NOT_FOUND" });
      return;
    }
    res.json({ slot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err, message: "Error finding slot" });
  }
};

// Update an existing slot (admin only)
export const updateSlot = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const { startTime, endTime, status, bay } = req.body;
  if (!startTime || !endTime || !status) {
    res.status(400).json({ error: "Invalid startTime, endTime or status" });
    return;
  }
  try {
    const slot = await prisma.slot.update({
      where: { id: parseInt(id, 10) },
      data: {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status,
        bayId: bay.id,
      },
    });

    res.json({ message: "Slot updated successfully", slot });
  } catch (error) {
    next(error);
  }
};

// Delete a slot (admin only)
export const deleteSlot = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;

  try {
    await prisma.slot.delete({
      where: { id: parseInt(id, 10) },
    });
    res.json({ message: "Slot deleted successfully" });
  } catch (error) {
    next(error);
  }
};
