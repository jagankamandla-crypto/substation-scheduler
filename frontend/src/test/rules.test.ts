import { describe, expect, it } from "vitest";
import {
  COMPLETION_BEFORE_CREATED,
  COMPLETION_FUTURE,
  EDITABLE_ASSET_FIELDS,
  HIGH_INTERVAL_MESSAGE,
  INSTALL_MESSAGE,
  INTERVAL_MESSAGE,
  NOTES_MESSAGE,
  SERIAL_MESSAGE,
  VOLTAGE_MESSAGE,
  addDays,
  assetIssues,
  canCompleteTask,
  completionIssues,
  correctiveDueDate,
  isOverdue,
  nextDueDate,
  opensCorrective,
} from "../rules";

const today = "2026-10-01";

function issues(overrides: Record<string, unknown> = {}) {
  return Object.fromEntries(
    assetIssues(
      {
        serial: "TRF-10002",
        name: "New transformer",
        asset_type: "transformer",
        substation_id: 1,
        voltage_kv: 132,
        criticality: "medium",
        interval_days: 90,
        install_date: "2026-09-15",
        ...overrides,
      },
      today,
      ["TRF-10001"],
    ).map((issue) => [issue.field, issue.message]),
  );
}

describe("asset rules", () => {
  it("uses the business analyst's serial, install, and high-interval messages", () => {
    expect(issues({ serial: "TRF-10001" }).serial).toBe(SERIAL_MESSAGE);
    expect(issues({ serial: "trf-10001" }).serial).toBe(SERIAL_MESSAGE);
    expect(issues().serial).toBeUndefined();
    expect(issues({ install_date: "2026-10-10" }).install_date).toBe(INSTALL_MESSAGE);
    expect(issues({ install_date: "2026-09-15" }).install_date).toBeUndefined();
    expect(issues({ criticality: "high", interval_days: 365 }).interval_days).toBe(HIGH_INTERVAL_MESSAGE);
    expect(issues({ criticality: "high", interval_days: 180 }).interval_days).toBeUndefined();
  });

  it("accepts the six voltages and the interval bounds", () => {
    expect(issues({ voltage_kv: 500 }).voltage_kv).toBe(VOLTAGE_MESSAGE);
    for (const voltage of [11, 33, 66, 132, 220, 400]) {
      expect(issues({ voltage_kv: voltage }).voltage_kv).toBeUndefined();
    }
    for (const interval of [30, 90, 365, 730]) {
      expect(issues({ interval_days: interval }).interval_days).toBeUndefined();
    }
    expect(issues({ interval_days: 29 }).interval_days).toBe(INTERVAL_MESSAGE);
    expect(issues({ interval_days: 731 }).interval_days).toBe(INTERVAL_MESSAGE);
  });

  it("calculates the next due date and does not offer it as an editable field", () => {
    expect(nextDueDate("2026-01-01", "2020-01-01", 180)).toBe("2026-06-30");
    expect(nextDueDate(null, "2026-01-01", 90)).toBe("2026-04-01");
    expect(EDITABLE_ASSET_FIELDS).not.toContain("next_due_on");
  });
});

describe("task rules", () => {
  it("treats overdue as a flag", () => {
    expect(isOverdue("in_progress", "2026-09-25", today)).toBe(true);
    expect(isOverdue("assigned", "2026-10-05", today)).toBe(false);
    expect(isOverdue("completed", "2026-09-25", today)).toBe(false);
  });

  it("checks completion dates, notes, and the corrective trigger", () => {
    const base = {
      completion_date: "2026-10-01",
      notes: "Preventive maintenance successfully completed",
      condition_rating: 4,
    };
    const messages = (overrides: Partial<typeof base>) =>
      Object.fromEntries(
        completionIssues({ ...base, ...overrides }, today, "2026-09-20").map((issue) => [issue.field, issue.message]),
      );
    expect(messages({ completion_date: "2026-09-28" })).toEqual({});
    expect(messages({ completion_date: "2026-09-15" }).completion_date).toBe(COMPLETION_BEFORE_CREATED);
    expect(messages({ completion_date: "2026-10-05" }).completion_date).toBe(COMPLETION_FUTURE);
    expect(messages({ notes: "  " }).notes).toBe(NOTES_MESSAGE);
    expect(opensCorrective(1)).toBe(true);
    expect(opensCorrective(2)).toBe(true);
    expect(opensCorrective(3)).toBe(false);
    expect(correctiveDueDate("2026-10-01")).toBe("2026-10-08");
    expect(addDays("2026-01-01", 180)).toBe("2026-06-30");
  });

  it("lets only the assigned technician complete an in-progress task", () => {
    expect(canCompleteTask("technician", 7, 7, "in_progress")).toBe(true);
    expect(canCompleteTask("technician", 8, 7, "in_progress")).toBe(false);
    expect(canCompleteTask("planner", 7, 7, "in_progress")).toBe(false);
    expect(canCompleteTask("technician", 7, 7, "assigned")).toBe(false);
  });
});
