import { z } from "zod";

export const VOLTAGES = [11, 33, 66, 132, 220, 400] as const;
export const ASSET_TYPES = [
  ["transformer", "Transformer"],
  ["circuit_breaker", "Circuit breaker"],
  ["switchgear", "Switchgear"],
  ["protection_relay", "Protection relay"],
] as const;
export const CRITICALITIES = [
  ["high", "High"],
  ["medium", "Medium"],
  ["low", "Low"],
] as const;
export const CONDITIONS = [
  [1, "Very Poor"],
  [2, "Poor"],
  [3, "Fair"],
  [4, "Good"],
  [5, "Very Good"],
] as const;

export const SERIAL_MESSAGE = "Serial number already exists. Enter a unique serial number.";
export const SERIAL_REQUIRED = "Serial number is required.";
export const INSTALL_MESSAGE = "Install date cannot be a future date.";
export const INSTALL_REQUIRED = "Install date is required.";
export const HIGH_INTERVAL_MESSAGE =
  "Maintenance interval for High-criticality assets cannot exceed 180 days.";
export const INTERVAL_MESSAGE = "Maintenance interval must be between 30 and 730 days.";
export const VOLTAGE_MESSAGE = "Voltage must be one of 11, 33, 66, 132, 220, or 400 kV.";
export const NAME_REQUIRED = "Asset name is required.";
export const NOTES_MESSAGE = "Work notes are required.";
export const RATING_MESSAGE = "Condition rating must be between 1 and 5.";
export const COMPLETION_FUTURE = "Completion date cannot be a future date.";
export const COMPLETION_BEFORE_CREATED = "Completion date cannot be before the task was created.";
export const COMPLETION_REQUIRED = "Completion date is required.";
export const CM_OPEN_QUESTION =
  "A condition rating of 1 or 2 opens a corrective task at High priority, due 7 days later. That 7-day due date is still an open question with the business analyst.";

export const EDITABLE_ASSET_FIELDS = [
  "serial",
  "name",
  "asset_type",
  "substation_id",
  "voltage_kv",
  "criticality",
  "interval_days",
  "install_date",
] as const;

export type AssetInput = {
  serial: string;
  name: string;
  asset_type: string;
  substation_id: number;
  voltage_kv: number;
  criticality: string;
  interval_days: number;
  install_date: string;
};

export type FieldIssue = { field: string; message: string };

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function nextDueDate(lastMaintenance: string | null, installDate: string, intervalDays: number): string {
  return addDays(lastMaintenance || installDate, intervalDays);
}

export function isOverdue(status: string, dueOn: string, today: string): boolean {
  return status !== "completed" && status !== "cancelled" && dueOn < today;
}

export function opensCorrective(rating: number): boolean {
  return rating <= 2;
}

export function correctiveDueDate(completionDate: string): string {
  return addDays(completionDate, 7);
}

export function canCompleteTask(
  role: string,
  userId: number,
  assigneeId: number | null,
  status: string,
): boolean {
  return role === "technician" && assigneeId === userId && status === "in_progress";
}

export function assetIssues(
  input: AssetInput,
  today: string,
  existingSerials: string[],
  currentSerial?: string,
): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const serial = input.serial.trim();
  const taken = existingSerials.some(
    (item) => item.toLowerCase() === serial.toLowerCase() && item.toLowerCase() !== (currentSerial ?? "").toLowerCase(),
  );
  if (!serial) issues.push({ field: "serial", message: SERIAL_REQUIRED });
  else if (taken) issues.push({ field: "serial", message: SERIAL_MESSAGE });
  if (!input.name.trim()) issues.push({ field: "name", message: NAME_REQUIRED });
  if (!ASSET_TYPES.some(([value]) => value === input.asset_type)) {
    issues.push({ field: "asset_type", message: "Choose an equipment type." });
  }
  if (!input.substation_id) issues.push({ field: "substation_id", message: "Choose a substation." });
  if (!VOLTAGES.includes(input.voltage_kv as (typeof VOLTAGES)[number])) {
    issues.push({ field: "voltage_kv", message: VOLTAGE_MESSAGE });
  }
  if (!CRITICALITIES.some(([value]) => value === input.criticality)) {
    issues.push({ field: "criticality", message: "Choose High, Medium, or Low criticality." });
  }
  const interval = input.interval_days;
  if (!Number.isInteger(interval) || interval < 30 || interval > 730) {
    issues.push({ field: "interval_days", message: INTERVAL_MESSAGE });
  } else if (input.criticality === "high" && interval > 180) {
    issues.push({ field: "interval_days", message: HIGH_INTERVAL_MESSAGE });
  }
  if (!input.install_date) issues.push({ field: "install_date", message: INSTALL_REQUIRED });
  else if (input.install_date > today) issues.push({ field: "install_date", message: INSTALL_MESSAGE });
  return issues;
}

export function completionIssues(
  input: { completion_date: string; notes: string; condition_rating: number | null },
  today: string,
  createdOn: string,
): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (!input.completion_date) issues.push({ field: "completion_date", message: COMPLETION_REQUIRED });
  else {
    if (input.completion_date > today) issues.push({ field: "completion_date", message: COMPLETION_FUTURE });
    if (input.completion_date < createdOn) {
      issues.push({ field: "completion_date", message: COMPLETION_BEFORE_CREATED });
    }
  }
  if (!input.notes.trim()) issues.push({ field: "notes", message: NOTES_MESSAGE });
  const rating = input.condition_rating;
  if (rating == null || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    issues.push({ field: "condition_rating", message: RATING_MESSAGE });
  }
  return issues;
}

const assetShape = {
  serial: z.string(),
  name: z.string(),
  asset_type: z.string(),
  substation_id: z.string(),
  voltage_kv: z.string(),
  criticality: z.string(),
  interval_days: z.string(),
  install_date: z.string(),
};

export function makeAssetSchema(existingSerials: string[], today: string, currentSerial?: string) {
  return z.object(assetShape).superRefine((value, ctx) => {
    const parsed: AssetInput = {
      ...value,
      substation_id: Number(value.substation_id),
      voltage_kv: Number(value.voltage_kv),
      interval_days: Number(value.interval_days),
    };
    for (const issue of assetIssues(parsed, today, existingSerials, currentSerial)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [issue.field], message: issue.message });
    }
  });
}

export function makeCompletionSchema(today: string, createdOn: string) {
  return z
    .object({
      completion_date: z.string(),
      notes: z.string(),
      condition_rating: z.string(),
    })
    .superRefine((value, ctx) => {
      const rating = value.condition_rating === "" ? null : Number(value.condition_rating);
      for (const issue of completionIssues(
        { completion_date: value.completion_date, notes: value.notes, condition_rating: rating },
        today,
        createdOn,
      )) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [issue.field], message: issue.message });
      }
    });
}
