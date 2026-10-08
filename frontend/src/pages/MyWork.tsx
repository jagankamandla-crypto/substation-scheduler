import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api";
import { formatDisplay } from "../format";
import type { Task } from "../types";
import { Banner, PageHeader } from "../components/ui";
import { StatusPills } from "./Dashboard";

export function MyWorkPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Task[]>("/api/tasks")
      .then(setTasks)
      .catch((reason) => setError(errorMessage(reason)));
  }, []);

  const open = tasks.filter((task) => task.status !== "completed" && task.status !== "cancelled");
  const overdue = open.filter((task) => task.overdue);
  const upcoming = open.filter((task) => !task.overdue);
  const done = tasks.filter((task) => task.status === "completed").slice(0, 6);

  return (
    <div className="page">
      <PageHeader
        kicker="Technician"
        title="My work"
        lede="Only tasks assigned to you. Update them here, including on a tablet."
      />
      {error ? <Banner>{error}</Banner> : null}
      <section>
        <h2>Overdue</h2>
        <WorkCards tasks={overdue} empty="Nothing assigned to you is overdue." />
      </section>
      <section>
        <h2>Upcoming</h2>
        <WorkCards tasks={upcoming} empty="No upcoming tasks." />
      </section>
      <section>
        <h2>Recently completed</h2>
        <WorkCards tasks={done} empty="No completed visits yet." />
      </section>
    </div>
  );
}

function WorkCards({ tasks, empty }: { tasks: Task[]; empty: string }) {
  if (!tasks.length) return <p className="empty">{empty}</p>;
  return (
    <div className="work-grid">
      {tasks.map((task) => (
        <article className="card work-card" key={task.id}>
          <div className="work-top">
            <span className="mono">{task.code}</span>
            <StatusPills statusLabel={task.status_label} criticality={task.criticality} criticalityLabel={task.criticality_label} overdue={task.overdue} />
          </div>
          <h3>
            {task.asset_serial}
            <small>{task.asset_name}</small>
          </h3>
          <p>
            {task.substation_name} · due {formatDisplay(task.due_on)}
          </p>
          <p className="muted">{task.task_type_label}</p>
          <Link className="btn primary" to={`/tasks/${task.id}`}>
            Open
          </Link>
        </article>
      ))}
    </div>
  );
}
