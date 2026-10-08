import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { errorFields, errorMessage } from "../api";
import { formatDisplay } from "../format";
import { CM_OPEN_QUESTION, CONDITIONS, makeCompletionSchema, opensCorrective } from "../rules";
import { Field } from "./ui";

type FormValues = {
  completion_date: string;
  notes: string;
  condition_rating: string;
};

export function CompletionForm({
  createdOn,
  dueOn,
  today,
  onSubmit,
}: {
  createdOn: string;
  dueOn: string;
  today: string;
  onSubmit: (values: { completion_date: string; notes: string; condition_rating: number }) => Promise<void>;
}) {
  const schema = useMemo(() => makeCompletionSchema(today, createdOn), [today, createdOn]);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { completion_date: today, notes: "", condition_rating: "" },
  });
  const rating = Number(form.watch("condition_rating"));
  const poor = Number.isInteger(rating) && opensCorrective(rating);

  return (
    <form
      className="stack"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await onSubmit({
            completion_date: values.completion_date,
            notes: values.notes.trim(),
            condition_rating: Number(values.condition_rating),
          });
        } catch (error) {
          const fields = errorFields(error);
          for (const [field, message] of Object.entries(fields)) {
            if (field in values) form.setError(field as keyof FormValues, { message });
          }
          if (!Object.keys(fields).length) form.setError("root", { message: errorMessage(error) });
        }
      })}
    >
      <div className="due-lock">
        <span>Due date</span>
        <strong>{formatDisplay(dueOn)}</strong>
        <small>Calculated. Assignment does not change it.</small>
      </div>
      <Field label="Completion date" error={form.formState.errors.completion_date?.message}>
        <input type="date" {...form.register("completion_date")} />
      </Field>
      <Field label="Work notes" error={form.formState.errors.notes?.message}>
        <textarea rows={4} {...form.register("notes")} placeholder="What was inspected, found, and left in service." />
      </Field>
      <fieldset className="ratings">
        <legend>Condition after the visit</legend>
        {CONDITIONS.map(([value, label]) => (
          <label key={value}>
            <input type="radio" value={value} {...form.register("condition_rating")} />
            <span>
              {value} · {label}
            </span>
          </label>
        ))}
        {form.formState.errors.condition_rating?.message ? (
          <small className="field-error">{form.formState.errors.condition_rating.message}</small>
        ) : null}
      </fieldset>
      <p className={poor ? "callout warn" : "callout"}>{CM_OPEN_QUESTION}</p>
      {form.formState.errors.root?.message ? <p className="form-error">{form.formState.errors.root.message}</p> : null}
      <button className="btn primary" type="submit">
        Mark complete
      </button>
    </form>
  );
}
