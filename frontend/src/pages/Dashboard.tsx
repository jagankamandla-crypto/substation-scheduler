import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { useAuth } from "../auth";
import { formatDisplay } from "../format";
import type { Dashboard } from "../types";
import { Banner, CountUp, PageHeader, Pill } from "../components/ui";

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/api/dashboard")
      .then(setData)
      .catch((reason) => setError(errorMessage(reason)));
  }, []);

  if (error) return <Banner>{error}</Banner>;
  if (!data) return <p className="muted">Loading the operating picture…</p>;

  const maxLoad = Math.max(1, ...data.workload.map((row) => row.d90));
  const health = [
    ["1", "Very Poor"],
    ["2", "Poor"],
    ["3", "Fair"],
    ["4", "Good"],
    ["5", "Very Good"],
  ] as const;

  return (
    <div className="page">
      <PageHeader
        kicker={data.compliance.period_label}
        title="Operating picture"
        lede={`As of ${formatDisplay(data.as_of)}. Overdue is a flag, not a status: the task is still open and its due date is before today.`}
        action={
          <div className="head-actions">
            {user?.role === "operations_head" ? (
              <Link className="btn primary" to="/reports">
                Monthly report
              </Link>
            ) : null}
            <Link className={user?.role === "operations_head" ? "btn ghost" : "btn primary"} to="/alerts">
              Review alerts
            </Link>
          </div>
        }
      />
      <section className="kpis">
        <article className="card kpi">
          <span>Compliance</span>
          <strong>{data.compliance.percent == null ? "—" : <CountUp value={data.compliance.percent} suffix="%" />}</strong>
          <small>
            {data.compliance.on_time} of {data.compliance.arrived} preventive tasks that came due were finished on time.
          </small>
        </article>
        <article className="card kpi">
          <span>Open overdue</span>
          <strong className={data.overdue_total ? "bad" : ""}>
            <CountUp value={data.overdue_total} />
          </strong>
          <small>Across every substation and criticality.</small>
        </article>
        <article className="card kpi">
          <span>In service</span>
          <strong>
            <CountUp value={data.counts.in_service} />
          </strong>
          <small>{data.counts.assets} assets on the register.</small>
        </article>
        <article className="card kpi">
          <span>Due in 30 days</span>
          <strong>
            <CountUp value={data.counts.due_30} />
          </strong>
          <small>{data.counts.open_tasks} tasks still open.</small>
        </article>
      </section>
      <p className="formula">{data.compliance.formula}</p>
      <section className="split">
        <article className="card">
          <h2>Overdue by substation</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Substation</th>
                  <th>High</th>
                  <th>Medium</th>
                  <th>Low</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.overdue_by_substation.map((row) => (
                  <tr key={row.code}>
                    <td>
                      <strong>{row.name}</strong>
                      <span className="muted"> {row.region}</span>
                    </td>
                    <td className={row.high ? "num bad" : "num"}>{row.high}</td>
                    <td className="num">{row.medium}</td>
                    <td className="num">{row.low}</td>
                    <td className="num">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="card">
          <h2>Asset health</h2>
          <p className="muted">Latest condition rating on assets still in the fleet.</p>
          <ul className="health">
            {health.map(([key, label]) => (
              <li key={key}>
                <span>
                  {key} · {label}
                </span>
                <b>{data.asset_health[key] ?? 0}</b>
              </li>
            ))}
            <li>
              <span>Not yet rated</span>
              <b>{data.asset_health.unrated ?? 0}</b>
            </li>
          </ul>
        </article>
      </section>
      <article className="card">
        <h2>Workload, next 30 / 60 / 90 days</h2>
        <p className="muted">Counts are cumulative. The 60-day bar includes the next 30 days. Overdue work is listed separately.</p>
        <div className="load-table">
          {data.workload.map((row) => (
            <div className="load-row" key={row.name}>
              <div>
                <strong>{row.name}</strong>
                <span className="muted">{row.overdue ? ` ${row.overdue} overdue` : " None overdue"}</span>
              </div>
              <div className="load-bars" aria-hidden="true">
                <i style={{ width: `${(row.d30 / maxLoad) * 100}%` }} />
                <i className="mid" style={{ width: `${(row.d60 / maxLoad) * 100}%` }} />
                <i className="far" style={{ width: `${(row.d90 / maxLoad) * 100}%` }} />
              </div>
              <span className="mono">
                {row.d30} / {row.d60} / {row.d90}
              </span>
            </div>
          ))}
        </div>
      </article>
      <details className="card questions">
        <summary>Open with the business analyst</summary>
        <ul>
          {data.open_questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function criticalityTone(value: string) {
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  if (value === "low") return "low";
  return "";
}

export function StatusPills({
  statusLabel,
  criticality,
  criticalityLabel,
  overdue,
}: {
  statusLabel: string;
  criticality?: string;
  criticalityLabel?: string;
  overdue?: boolean;
}) {
  return (
    <span className="pills">
      <Pill>{statusLabel}</Pill>
      {criticalityLabel ? <Pill tone={criticalityTone(criticality ?? "")}>{criticalityLabel}</Pill> : null}
      {overdue ? <Pill tone="overdue">Overdue</Pill> : null}
    </span>
  );
}
