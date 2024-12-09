import { Request, Response } from "express";
import prisma from "../config/prisma-client";
import dayjs from "dayjs";

// Create a new slot (admin only)
export const createSlot = async (req: Request, res: Response) => {
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
    console.error("Error creating slot:", error);
    res.status(500).json({ message: "Error creating slot" });
  }
};

// Retrieve all available slots
export const getSlots = async (req: Request, res: Response) => {
  const { from, to } = req.query;
  try {
    if (!from || isNaN(Date.parse(from as string))) {
      return res
        .status(400)
        .json({ error: 'A valid "from" date is required', from });
    }

    if (!to || isNaN(Date.parse(to as string))) {
      return res
        .status(400)
        .json({ error: 'A valid "to" date is required', to });
    }

    const slots = await prisma.slot.findMany({
      where: {
        startTime: {
          lte: to as string,
          gte: from as string,
        },
      }, // Only fetch available slots
      orderBy: { startTime: "asc" },
    });
    res.json(slots);
  } catch (error) {
    console.error("Error retrieving slots:", error);
    res.status(500).json({ message: "Error retrieving slots", error });
  }
};

export const getUniqueSlot = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const slot = await prisma.slot.findUnique({
      where: { id: parseInt(id, 10) },
    });
    if (!slot)
      return res
        .status(404)
        .json({ message: "Slot doesn't exist", error: "NOT_FOUND" });

    return res.json({ slot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err, message: "Error finding slot" });
  }
};

// Update an existing slot (admin only)
export const updateSlot = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { startTime, endTime, status, bay } = req.body;
  if (!startTime || !endTime || !status)
    return res
      .status(400)
      .json({ error: "Invalid startTime, endTime or status" });
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
    console.error("Error updating slot:", error);
    res.status(500).json({ message: "Error updating slot" });
  }
};

// Delete a slot (admin only)
export const deleteSlot = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.slot.delete({
      where: { id: parseInt(id, 10) },
    });
    res.json({ message: "Slot deleted successfully" });
  } catch (error) {
    console.error("Error deleting slot:", error);
    res.status(500).json({ message: "Error deleting slot" });
  }
};
