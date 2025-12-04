import dayjs from "dayjs";

interface SlotWithBay {
  id: number;
  startTime: Date | string;
  endTime: Date | string;
  bay: {
    id: number;
    name: string;
  } | null;
}

interface GroupedSlotResult {
  bay: string;
  bayId: number;
  startTime: string;
  endTime: string;
  date: string;
  startTimeISO: string;
  endTimeISO: string;
  slotIds: number[];
}

/**
 * Groups consecutive time slots by bay.
 * If slots are consecutive (one ends when the next starts) and on the same bay,
 * they will be merged into a single grouped slot with a combined time range.
 *
 * @param slots - Array of slots with bay information
 * @returns Array of grouped slots with merged time ranges
 *
 * @example
 * // Input: Bay 1: 15:00-15:55, Bay 1: 16:00-16:55, Bay 1: 17:00-17:55
 * // Output: Bay 1: 15:00-17:55
 */
export const groupSlotsByBay = (slots: SlotWithBay[]): GroupedSlotResult[] => {
  // Filter out slots without bay information
  const validSlots = slots.filter((slot) => slot.bay !== null) as Array<
    SlotWithBay & { bay: { id: number; name: string } }
  >;

  // Sort slots by bay name, then by start time
  const sortedSlots = [...validSlots].sort((a, b) => {
    if (a.bay.name !== b.bay.name) {
      return a.bay.name.localeCompare(b.bay.name);
    }
    return dayjs(a.startTime).diff(dayjs(b.startTime));
  });

  const grouped: GroupedSlotResult[] = [];
  let currentGroup: {
    bay: string;
    bayId: number;
    startTime: string;
    endTime: string;
    date: string;
    startTimeISO: string;
    endTimeISO: string;
    slotIds: number[];
    lastEndTime: dayjs.Dayjs;
  } | null = null;

  for (const slot of sortedSlots) {
    const slotStart = dayjs(slot.startTime);
    const slotEnd = dayjs(slot.endTime);

    if (!currentGroup) {
      // Start a new group
      currentGroup = {
        bay: slot.bay.name,
        bayId: slot.bay.id,
        startTime: slotStart.format("HH:mm"),
        endTime: slotEnd.format("HH:mm"),
        date: slotStart.format("ddd Do MMMM YYYY"),
        startTimeISO: slotStart.toISOString(),
        endTimeISO: slotEnd.toISOString(),
        slotIds: [slot.id],
        lastEndTime: slotEnd,
      };
    } else if (
      currentGroup.bay === slot.bay.name &&
      slotStart.diff(currentGroup.lastEndTime, "minute") <= 5
    ) {
      // Extend the current group
      currentGroup.endTime = slotEnd.format("HH:mm");
      currentGroup.endTimeISO = slotEnd.toISOString();
      currentGroup.slotIds.push(slot.id);
      currentGroup.lastEndTime = slotEnd;
    } else {
      // Save current group and start a new one
      const { lastEndTime, ...groupToSave } = currentGroup;
      grouped.push(groupToSave);
      currentGroup = {
        bay: slot.bay.name,
        bayId: slot.bay.id,
        startTime: slotStart.format("HH:mm"),
        endTime: slotEnd.format("HH:mm"),
        date: slotStart.format("ddd Do MMMM YYYY"),
        startTimeISO: slotStart.toISOString(),
        endTimeISO: slotEnd.toISOString(),
        slotIds: [slot.id],
        lastEndTime: slotEnd,
      };
    }
  }

  if (currentGroup) {
    const { lastEndTime, ...groupToSave } = currentGroup;
    grouped.push(groupToSave);
  }

  return grouped;
};
