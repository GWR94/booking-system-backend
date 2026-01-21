import { describe, it, expect } from "@jest/globals";
import { groupSlotsByBay } from "./group-slots";

describe("groupSlotsByBay", () => {
  it("should group slots by bay ID", () => {
    const slots = [
      {
        id: 1,
        bayId: 101,
        startTime: new Date(),
        bay: { id: 101, name: "Bay 1" },
      },
      {
        id: 2,
        bayId: 102,
        startTime: new Date(),
        bay: { id: 102, name: "Bay 2" },
      },
      {
        id: 3,
        bayId: 101,
        startTime: new Date(),
        bay: { id: 101, name: "Bay 1" },
      },
    ] as any;

    const grouped = groupSlotsByBay(slots);

    expect(grouped).toBeInstanceOf(Array);
    expect(grouped).toHaveLength(2);

    const bay1Group = grouped.find((g) => g.bayId === 101);
    const bay2Group = grouped.find((g) => g.bayId === 102);

    expect(bay1Group).toBeDefined();
    expect(bay1Group!.slotIds).toHaveLength(2);
    expect(bay2Group).toBeDefined();
    expect(bay2Group!.slotIds).toHaveLength(1);
  });
});
