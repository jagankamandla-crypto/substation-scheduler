import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../api";
import { useAuth } from "../auth";
import { formatDisplay } from "../format";
import type { Asset } from "../types";
import { Banner, Dialog, PageHeader } from "../components/ui";
import { StatusPills } from "./Dashboard";

export function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    api<Asset>(`/api/assets/${id}`)
      .then(setAsset)
      .catch((reason) => setError(errorMessage(reason)));
  }, [id]);

  async function decommission() {
    if (!asset) return;
    try {
      const next = await api<Asset>(`/api/assets/${asset.id}/decommission`, { method: "POST" });
      setAsset(next);
      setConfirming(false);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  if (error && !asset) return <Banner>{error}</Banner>;
  if (!asset) return <p className="muted">Loading asset…</p>;
  const canWrite = user?.role === "asset_manager" && asset.status !== "decommissioned";
  const canOpenTask = user?.role === "planner" || user?.role === "operations_head" || user?.role === "technician";

  return (
    <div className="page">
      <PageHeader
        kicker={asset.substation_name}
        title={asset.serial}
        lede={asset.name}
        action={
          canWrite ? (
            <Link className="btn primary" to={`/assets/${asset.id}/edit`}>
              Edit asset
            </Link>
          ) : null
        }
      />
      {error && !confirming ? <Banner>{error}</Banner> : null}
      <section className="split">
        <article className="card">
          <StatusPills
            statusLabel={asset.status_label}
            criticality={asset.criticality}
            criticalityLabel={asset.criticality_label}
            overdue={asset.overdue}
          />
          <dl className="facts">
            <div>
              <dt>Type</dt>
              <dd>{asset.asset_type_label}</dd>
            </div>
            <div>
              <dt>Substation</dt>
              <dd>
                {asset.substation_name} · {asset.substation_region}
              </dd>
            </div>
            <div>
              <dt>Voltage</dt>
              <dd>{asset.voltage_kv} kV</dd>
            </div>
            <div>
              <dt>Interval</dt>
              <dd>{asset.interval_days} days</dd>
            </div>
            <div>
              <dt>Installed</dt>
              <dd>{formatDisplay(asset.install_date)}</dd>
            </div>
            <div>
              <dt>Last maintenance</dt>
              <dd>{formatDisplay(asset.last_maintenance_on)}</dd>
            </div>
            <div>
              <dt>Latest condition</dt>
              <dd>{asset.condition_label ? `${asset.latest_condition} · ${asset.condition_label}` : "Not yet rated"}</dd>
            </div>
          </dl>
        </article>
        <article className="card due-panel">
          <p className="kicker">Next due date</p>
          <strong>{formatDisplay(asset.next_due_on)}</strong>
          <p>Calculated from the last maintenance date, or the install date if none is recorded, plus the interval. It cannot be typed over.</p>
          {canWrite ? (
            <button className="btn ghost" type="button" onClick={() => setConfirming(true)}>
              Decommission
            </button>
          ) : null}
          {user?.role === "technician" ? (
            <button className="btn ghost" type="button" onClick={() => navigate("/my-work")}>
              Back to my work
            </button>
          ) : null}
        </article>
      </section>
      <article className="card">
        <h2>Service history</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Type</th>
                <th>Status</th>
                <th>Due</th>
                <th>Completed</th>
                <th>Condition</th>
                <th>Technician</th>
              </tr>
            </thead>
            <tbody>
              {(asset.tasks ?? []).map((task) => (
                <tr key={task.id}>
                  <td className="mono">
                    {canOpenTask ? <Link to={`/tasks/${task.id}`}>{task.code}</Link> : task.code}
                  </td>
                  <td>{task.task_type_label}</td>
                  <td>
                    <StatusPills statusLabel={task.status_label} overdue={task.overdue} />
                  </td>
                  <td>{formatDisplay(task.due_on)}</td>
                  <td>{formatDisplay(task.completed_on)}</td>
                  <td>{task.condition_label ? `${task.condition_rating} · ${task.condition_label}` : "—"}</td>
                  <td>{task.assignee_name ?? "Unassigned"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!asset.tasks?.length ? <p className="empty">No service history is visible for this account.</p> : null}
        </div>
      </article>
      <Dialog
        open={confirming}
        title={`Decommission ${asset.serial}?`}
        description="This cancels every open task. No new preventive or corrective task will be created."
        onClose={() => setConfirming(false)}
      >
        {error ? <Banner>{error}</Banner> : null}
        <div className="dialog-actions">
          <button className="btn ghost" type="button" onClick={() => setConfirming(false)}>
            Keep in service
          </button>
          <button className="btn danger" type="button" onClick={decommission}>
            Decommission asset
          </button>
        </div>
      </Dialog>
    </div>
  );
}
