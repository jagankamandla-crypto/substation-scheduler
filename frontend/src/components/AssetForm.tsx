import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { ApiError, errorFields, errorMessage } from "../api";
import { formatDisplay } from "../format";
import { ASSET_TYPES, CRITICALITIES, VOLTAGES, makeAssetSchema, nextDueDate } from "../rules";
import type { Substation } from "../types";
import { Field } from "./ui";

export type AssetPayload = {
  serial: string;
  name: string;
  asset_type: string;
  substation_id: number;
  voltage_kv: number;
  criticality: string;
  interval_days: number;
  install_date: string;
};

type FormValues = {
  serial: string;
  name: string;
  asset_type: string;
  substation_id: string;
  voltage_kv: string;
  criticality: string;
  interval_days: string;
  install_date: string;
};

export function AssetForm({
  substations,
  existingSerials,
  today,
  currentSerial,
  lastMaintenance,
  initial,
  submitLabel,
  onSubmit,
}: {
  substations: Substation[];
  existingSerials: string[];
  today: string;
  currentSerial?: string;
  lastMaintenance?: string | null;
  initial?: AssetPayload;
  submitLabel: string;
  onSubmit: (values: AssetPayload) => Promise<void>;
}) {
  const schema = useMemo(
    () => makeAssetSchema(existingSerials, today, currentSerial),
    [existingSerials, today, currentSerial],
  );
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      serial: initial?.serial ?? "",
      name: initial?.name ?? "",
      asset_type: initial?.asset_type ?? "transformer",
      substation_id: String(initial?.substation_id ?? substations[0]?.id ?? ""),
      voltage_kv: String(initial?.voltage_kv ?? substations[0]?.voltage_kv ?? 132),
      criticality: initial?.criticality ?? "medium",
      interval_days: String(initial?.interval_days ?? 90),
      install_date: initial?.install_date ?? "",
    },
  });
  const { register, handleSubmit, watch, setError, reset, formState } = form;

  useEffect(() => {
    if (!initial) return;
    reset({
      serial: initial.serial,
      name: initial.name,
      asset_type: initial.asset_type,
      substation_id: String(initial.substation_id),
      voltage_kv: String(initial.voltage_kv),
      criticality: initial.criticality,
      interval_days: String(initial.interval_days),
      install_date: initial.install_date,
    });
  }, [initial, reset]);

  const install = watch("install_date");
  const interval = Number(watch("interval_days"));
  const preview =
    install && Number.isInteger(interval) && interval > 0
      ? formatDisplay(nextDueDate(lastMaintenance || null, install, interval))
      : "—";

  return (
    <form
      className="form-grid"
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit({
            serial: values.serial.trim(),
            name: values.name.trim(),
            asset_type: values.asset_type,
            substation_id: Number(values.substation_id),
            voltage_kv: Number(values.voltage_kv),
            criticality: values.criticality,
            interval_days: Number(values.interval_days),
            install_date: values.install_date,
          });
        } catch (error) {
          const fields = errorFields(error);
          for (const [field, message] of Object.entries(fields)) {
            if (field in values) setError(field as keyof FormValues, { message });
          }
          if (!Object.keys(fields).length) setError("root", { message: errorMessage(error) });
          if (!(error instanceof ApiError)) setError("root", { message: errorMessage(error) });
        }
      })}
    >
      <Field label="Serial number" error={formState.errors.serial?.message}>
        <input {...register("serial")} autoComplete="off" />
      </Field>
      <Field label="Asset name" error={formState.errors.name?.message}>
        <input {...register("name")} />
      </Field>
      <Field label="Equipment type" error={formState.errors.asset_type?.message}>
        <select {...register("asset_type")}>
          {ASSET_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Substation" error={formState.errors.substation_id?.message}>
        <select {...register("substation_id")}>
          {substations.map((substation) => (
            <option key={substation.id} value={substation.id}>
              {substation.name} · {substation.region}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Voltage" error={formState.errors.voltage_kv?.message}>
        <select {...register("voltage_kv")}>
          {VOLTAGES.map((voltage) => (
            <option key={voltage} value={voltage}>
              {voltage} kV
            </option>
          ))}
        </select>
      </Field>
      <Field label="Criticality" error={formState.errors.criticality?.message}>
        <select {...register("criticality")}>
          {CRITICALITIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Maintenance interval (days)" error={formState.errors.interval_days?.message}>
        <input {...register("interval_days")} inputMode="numeric" />
      </Field>
      <Field label="Install date" error={formState.errors.install_date?.message}>
        <input type="date" {...register("install_date")} />
      </Field>
      <div className="due-lock">
        <span>Next due date</span>
        <strong data-testid="next-due">{preview}</strong>
        <small>Calculated by the system. It cannot be edited.</small>
      </div>
      {formState.errors.root?.message ? <p className="form-error">{formState.errors.root.message}</p> : null}
      <div className="form-actions">
        <button className="btn primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
