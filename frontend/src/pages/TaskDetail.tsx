import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api";
import { useAuth } from "../auth";
import { formatDisplay } from "../format";
import { todayISO } from "../format";
import type { CompleteResult, Task, User } from "../types";
import { CompletionForm } from "../components/CompletionForm";
import { Banner, Dialog, Field, PageHeader } from "../components/ui";
import { StatusPills } from "./Dashboard";

export function TaskDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [technicianId, setTechnicianId] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    return api<Task>(`/api/tasks/${id}`).then(setTask);
  }

  useEffect(() => {
    load().catch((reason) => setError(errorMessage(reason)));
    if (user?.role === "planner") {
      api<User[]>("/api/technicians")
        .then((rows) => {
          setTechnicians(rows);
          setTechnicianId(String(rows[0]?.id ?? ""));
        })
        .catch((reason) => setError(errorMessage(reason)));
    }
    // eslint is not configured; reload when the route id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.role]);

  async function assign() {
    if (!task) return;
    setBusy(true);
    setError("");
    try {
      setTask(await api<Task>(`/api/tasks/${task.id}/assign`, { method: "POST", body: { technician_id: Number(technicianId) } }));
      setAssignOpen(false);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!task) return;
    setBusy(true);
    setError("");
    try {
      setTask(await api<Task>(`/api/tasks/${task.id}/start`, { method: "POST" }));
      setStartOpen(false);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  if (error && !task) return <Banner>{error}</Banner>;
  if (!task || !user) return <p className="muted">Loading task…</p>;
  const mine = user.role === "technician" && task.assignee_id === user.id;

  return (
    <div className="page">
      <PageHeader
        kicker={`${task.task_type_label} · ${task.substation_name}`}
        title={task.code}
        lede={`${task.asset_serial} · ${task.asset_name}`}
      />
      {error && !assignOpen && !startOpen ? <Banner>{error}</Banner> : null}
      {result?.note && !resultOpen ? <Banner tone={result.corrective ? "note" : "good"}>{result.note}</Banner> : null}
      <section className="split">
        <article className="card">
          <StatusPills
            statusLabel={task.status_label}
            criticality={task.criticality}
            criticalityLabel={task.criticality_label}
            overdue={task.overdue}
          />
          <dl className="facts">
            <div>
              <dt>Due date</dt>
              <dd>
                {formatDisplay(task.due_on)}
                {task.overdue ? ` · ${task.days_overdue} days` : ""}
              </dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{task.priority_label}</dd>
            </div>
            <div>
              <dt>Technician</dt>
              <dd>{task.assignee_name ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDisplay(task.created_on)}</dd>
            </div>
            <div>
              <dt>Asset</dt>
              <dd>
                <Link to={`/assets/${task.asset_id}`}>{task.asset_serial}</Link>
                <div className="muted">
                  {task.voltage_kv} kV · {task.asset_status_label}
                </div>
              </dd>
            </div>
          </dl>
          {task.notes ? (
            <div className="notes">
              <span>Work notes</span>
              <p>{task.notes}</p>
              {task.condition_label ? (
                <p>
                  Condition {task.condition_rating} · {task.condition_label}
                </p>
              ) : null}
            </div>
          ) : null}
          {task.spawned_reason ? <p className="callout">{task.spawned_reason}</p> : null}
          {result?.next_preventive ? (
            <p className="callout">
              Next preventive task {result.next_preventive.code} is due {formatDisplay(result.next_preventive.due_on)}. It is
              unassigned until the planner picks a technician.
            </p>
          ) : null}
          {result?.corrective ? (
            <p className="callout warn">
              Corrective task {result.corrective.code} is due {formatDisplay(result.corrective.due_on)}, priority High.
            </p>
          ) : null}
        </article>
        <div className="stack">
          {user.role === "operations_head" ? (
            <article className="card">
              <h2>Review only</h2>
              <p>Assignment belongs to the planner. Completion belongs to the assigned technician.</p>
            </article>
          ) : null}
          {user.role === "planner" && (task.status === "scheduled" || task.status === "assigned") ? (
            <article className="card">
              <h2>Assign</h2>
              <p className="muted">The due date stays {formatDisplay(task.due_on)}.</p>
              <button className="btn primary" type="button" onClick={() => setAssignOpen(true)}>
                Assign technician
              </button>
            </article>
          ) : null}
          {mine && task.status === "assigned" ? (
            <article className="card">
              <h2>Start work</h2>
              <p>Starting marks the asset under maintenance.</p>
              <button className="btn primary" type="button" onClick={() => setStartOpen(true)}>
                Start work
              </button>
            </article>
          ) : null}
          {mine && task.status === "in_progress" ? (
            <article className="card">
              <h2>Complete the visit</h2>
              <p className="muted">Record the date, notes, and a condition rating from 1 to 5.</p>
              <button className="btn primary" type="button" onClick={() => setCompleteOpen(true)}>
                Complete visit
              </button>
            </article>
          ) : null}
        </div>
      </section>
      <Dialog
        open={assignOpen}
        title="Assign technician"
        description={`The due date stays ${formatDisplay(task.due_on)}.`}
        onClose={() => setAssignOpen(false)}
      >
        {error ? <Banner>{error}</Banner> : null}
        <Field label="Technician">
          <select value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.full_name}
              </option>
            ))}
          </select>
        </Field>
        <div className="dialog-actions">
          <button className="btn ghost" type="button" onClick={() => setAssignOpen(false)}>
            Cancel
          </button>
          <button className="btn primary" type="button" disabled={busy || !technicianId} onClick={assign}>
            Assign
          </button>
        </div>
      </Dialog>
      <Dialog
        open={startOpen}
        title="Start this visit?"
        description="The asset will be marked under maintenance until the visit is completed."
        onClose={() => setStartOpen(false)}
      >
        {error ? <Banner>{error}</Banner> : null}
        <div className="dialog-actions">
          <button className="btn ghost" type="button" onClick={() => setStartOpen(false)}>
            Not yet
          </button>
          <button className="btn primary" type="button" disabled={busy} onClick={start}>
            Start work
          </button>
        </div>
      </Dialog>
      <Dialog
        open={completeOpen}
        title="Complete the visit"
        description={`${task.code} · due ${formatDisplay(task.due_on)}`}
        wide
        onClose={() => setCompleteOpen(false)}
      >
        <CompletionForm
          createdOn={task.created_on}
          dueOn={task.due_on}
          today={todayISO()}
          onSubmit={async (values) => {
            const outcome = await api<CompleteResult>(`/api/tasks/${task.id}/complete`, {
              method: "POST",
              body: values,
            });
            setResult(outcome);
            setTask(outcome.task);
            setCompleteOpen(false);
            setResultOpen(true);
          }}
        />
      </Dialog>
      <Dialog
        open={resultOpen && result !== null}
        title="Visit recorded"
        description={result?.note ?? undefined}
        onClose={() => setResultOpen(false)}
      >
        {result?.next_preventive ? (
          <p className="callout">
            Next preventive task {result.next_preventive.code} is due {formatDisplay(result.next_preventive.due_on)}. It is
            unassigned until the planner picks a technician.
          </p>
        ) : null}
        {result?.corrective ? (
          <p className="callout warn">
            Corrective task {result.corrective.code} is due {formatDisplay(result.corrective.due_on)}, priority High.
          </p>
        ) : null}
        <div className="dialog-actions">
          <button className="btn primary" type="button" onClick={() => setResultOpen(false)}>
            Done
          </button>
        </div>
      </Dialog>
    </div>
  );
}
