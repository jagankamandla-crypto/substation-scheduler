import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { formatDisplay } from "../format";
import type { Task } from "../types";
import { Banner, PageHeader } from "../components/ui";
import { StatusPills } from "./Dashboard";

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("open");

  useEffect(() => {
    api<Task[]>("/api/tasks")
      .then(setTasks)
      .catch((reason) => setError(errorMessage(reason)));
  }, []);

  const rows = useMemo(() => {
    return tasks
      .filter((task) => {
        if (filter === "open") return task.status !== "completed" && task.status !== "cancelled";
        if (filter === "overdue") return task.overdue;
        if (filter === "unassigned") return !task.assignee_id && task.status !== "completed" && task.status !== "cancelled";
        if (filter === "completed") return task.status === "completed";
        return true;
      })
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.due_on.localeCompare(b.due_on));
  }, [tasks, filter]);

  return (
    <div className="page">
      <PageHeader
        kicker="Planner"
        title="Task queue"
        lede="Assign a technician. The due date stays as calculated."
      />
      {error ? <Banner>{error}</Banner> : null}
      <div className="filters">
        {[
          ["open", "Open"],
          ["overdue", "Overdue"],
          ["unassigned", "Unassigned"],
          ["completed", "Completed"],
        ].map(([value, label]) => (
          <button key={value} type="button" className={filter === value ? "chip on" : "chip"} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>
      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Asset</th>
              <th>Substation</th>
              <th>Type</th>
              <th>Due</th>
              <th>Status</th>
              <th>Technician</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => (
              <tr key={task.id}>
                <td className="mono">
                  <Link to={`/tasks/${task.id}`}>{task.code}</Link>
                </td>
                <td>
                  {task.asset_serial}
                  <div className="muted">{task.asset_name}</div>
                </td>
                <td>{task.substation_name}</td>
                <td>{task.task_type_label}</td>
                <td>{formatDisplay(task.due_on)}</td>
                <td>
                  <StatusPills
                    statusLabel={task.status_label}
                    criticality={task.criticality}
                    criticalityLabel={task.criticality_label}
                    overdue={task.overdue}
                  />
                </td>
                <td>{task.assignee_name ?? "Unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && !error ? <p className="empty">Nothing in this view.</p> : null}
      </div>
    </div>
  );
}
