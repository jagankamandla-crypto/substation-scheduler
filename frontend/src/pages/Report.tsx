import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { formatDisplay, todayISO } from "../format";
import type { Task } from "../types";
import { Banner, CountUp, PageHeader, Pill } from "../components/ui";

type Counts = {
  arrived: number;
  on_time: number;
  late: number;
  open: number;
  percent: number | null;
};

type ReportTask = Task & { outcome: "on_time" | "late" | "open"; outcome_label: string };

type Report = {
  as_of: string;
  month: string;
  period_label: string;
  formula: string;
  summary: Counts;
  due_later: number;
  by_substation: {
    code: string;
    name: string;
    region: string;
    high: Counts;
    medium: Counts;
    low: Counts;
    total: Counts;
  }[];
  tasks: ReportTask[];
  later_tasks: Task[];
};

function percentLabel(value: number | null) {
  return value == null ? "—" : `${value}%`;
}

function ratio(counts: Counts) {
  if (!counts.arrived) return "—";
  return `${counts.on_time}/${counts.arrived}`;
}

export function ReportPage() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setError("");
    api<Report>(`/api/reports/compliance?month=${month}`)
      .then(setData)
      .catch((reason) => setError(errorMessage(reason)));
  }, [month]);

  const tasks = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.tasks;
    return data.tasks.filter((task) => task.outcome === filter);
  }, [data, filter]);

  return (
    <div className="page report">
      <PageHeader
        kicker="Operations Head"
        title="Monthly compliance"
        lede="Preventive tasks whose due date has arrived. On time means completed on or before that date. Overdue work from earlier months stays on the dashboard."
        action={
          <div className="head-actions no-print">
            <label className="field month-field">
              <span>Month</span>
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            </label>
            <button className="btn ghost" type="button" onClick={() => window.print()}>
              Print
            </button>
          </div>
        }
      />
      {error ? <Banner>{error}</Banner> : null}
      {!data && !error ? <p className="muted">Loading the report…</p> : null}
      {data ? (
        <>
          <p className="formula">
            {data.period_label}, as of {formatDisplay(data.as_of)}. {data.formula}
          </p>
          <section className="kpis">
            <article className="card kpi">
              <span>Compliance</span>
              <strong>{data.summary.percent == null ? "—" : <CountUp value={data.summary.percent} suffix="%" />}</strong>
              <small>
                {data.summary.on_time} of {data.summary.arrived} finished on time.
              </small>
            </article>
            <article className="card kpi">
              <span>On time</span>
              <strong>
                <CountUp value={data.summary.on_time} />
              </strong>
              <small>Completed on or before the due date.</small>
            </article>
            <article className="card kpi">
              <span>Late</span>
              <strong>
                <CountUp value={data.summary.late} />
              </strong>
              <small>Completed after the due date.</small>
            </article>
            <article className="card kpi">
              <span>Still open</span>
              <strong className={data.summary.open ? "bad" : ""}>
                <CountUp value={data.summary.open} />
              </strong>
              <small>Came due and is not completed.</small>
            </article>
          </section>
          <article className="card">
            <h2>By substation and criticality</h2>
            <p className="muted">High, Medium, and Low show on-time visits over visits that came due.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Substation</th>
                    <th>Came due</th>
                    <th>On time</th>
                    <th>Late</th>
                    <th>Still open</th>
                    <th>Compliance</th>
                    <th>High</th>
                    <th>Medium</th>
                    <th>Low</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_substation.map((row) => (
                    <tr key={row.code}>
                      <td>
                        <strong>{row.name}</strong>
                        <div className="muted">{row.region}</div>
                      </td>
                      <td className="num">{row.total.arrived}</td>
                      <td className="num">{row.total.on_time}</td>
                      <td className="num">{row.total.late}</td>
                      <td className={row.total.open ? "num bad" : "num"}>{row.total.open}</td>
                      <td className="num">{percentLabel(row.total.percent)}</td>
                      <td className="mono">{ratio(row.high)}</td>
                      <td className="mono">{ratio(row.medium)}</td>
                      <td className="mono">{ratio(row.low)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="card">
            <div className="report-head">
              <h2>Tasks that came due</h2>
              <div className="filters no-print">
                {[
                  ["all", "All"],
                  ["open", "Still open"],
                  ["late", "Late"],
                  ["on_time", "On time"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={filter === value ? "chip on" : "chip"}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Asset</th>
                    <th>Substation</th>
                    <th>Due</th>
                    <th>Completed</th>
                    <th>Technician</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td className="mono">
                        <Link to={`/tasks/${task.id}`}>{task.code}</Link>
                      </td>
                      <td>
                        {task.asset_serial}
                        <div className="muted">{task.asset_name}</div>
                      </td>
                      <td>{task.substation_name}</td>
                      <td>{formatDisplay(task.due_on)}</td>
                      <td>{formatDisplay(task.completed_on)}</td>
                      <td>{task.assignee_name ?? "Unassigned"}</td>
                      <td>
                        <Pill tone={task.outcome === "on_time" ? "good" : task.outcome === "late" ? "late" : "overdue"}>
                          {task.outcome_label}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!tasks.length ? <p className="empty">No preventive task came due in this view.</p> : null}
            </div>
          </article>
          {data.due_later ? (
            <details className="card">
              <summary>
                {data.due_later} preventive {data.due_later === 1 ? "task is" : "tasks are"} due later in {data.period_label}
              </summary>
              <p className="muted">These are not in the compliance percentage yet. Their due date has not arrived.</p>
              <ul className="later-list">
                {data.later_tasks.map((task) => (
                  <li key={task.id}>
                    <span className="mono">{task.code}</span> {task.asset_serial} · {task.substation_name} · due{" "}
                    {formatDisplay(task.due_on)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
