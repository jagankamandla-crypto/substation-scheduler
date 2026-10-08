import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { useAuth } from "../auth";
import { formatDisplay } from "../format";
import type { Task } from "../types";
import { Banner, PageHeader } from "../components/ui";
import { StatusPills } from "./Dashboard";

type Alerts = { as_of: string; high_count: number; total: number; tasks: Task[] };

export function AlertsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Alerts | null>(null);
  const [error, setError] = useState("");
  const [highOnly, setHighOnly] = useState(true);

  useEffect(() => {
    api<Alerts>("/api/alerts")
      .then(setData)
      .catch((reason) => setError(errorMessage(reason)));
  }, []);

  const tasks = (data?.tasks ?? []).filter((task) => !highOnly || task.criticality === "high");

  return (
    <div className="page">
      <PageHeader
        kicker="In the app only"
        title="Alerts"
        lede="Overdue high-criticality work for the morning review. Nothing is emailed."
      />
      {error ? <Banner>{error}</Banner> : null}
      {data ? (
        <div className="filters">
          <button type="button" className={highOnly ? "chip on" : "chip"} onClick={() => setHighOnly(true)}>
            High criticality · {data.high_count}
          </button>
          <button type="button" className={!highOnly ? "chip on" : "chip"} onClick={() => setHighOnly(false)}>
            All overdue · {data.total}
          </button>
        </div>
      ) : (
        <p className="muted">Loading alerts…</p>
      )}
      <div className="alert-list">
        {tasks.map((task) => {
          const to = user?.role === "asset_manager" ? `/assets/${task.asset_id}` : `/tasks/${task.id}`;
          return (
            <Link className="card alert" key={task.id} to={to}>
              <div>
                <span className="mono">{task.code}</span>
                <strong>
                  {task.asset_serial} · {task.asset_name}
                </strong>
                <p>
                  {task.substation_name} · due {formatDisplay(task.due_on)} · {task.days_overdue} days overdue
                </p>
              </div>
              <StatusPills
                statusLabel={task.status_label}
                criticality={task.criticality}
                criticalityLabel={task.criticality_label}
                overdue
              />
            </Link>
          );
        })}
        {data && !tasks.length ? <p className="empty">No overdue tasks in this view.</p> : null}
      </div>
    </div>
  );
}
