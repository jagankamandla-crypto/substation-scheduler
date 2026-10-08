import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Bell,
  Boxes,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth";
import { ThemeToggle } from "../theme";
import type { Role } from "../types";
import { Dialog } from "./ui";

const LINKS: { to: string; label: string; roles: Role[]; icon: LucideIcon }[] = [
  { to: "/dashboard", label: "Dashboard", roles: ["operations_head", "asset_manager", "planner"], icon: LayoutDashboard },
  { to: "/reports", label: "Compliance report", roles: ["operations_head"], icon: FileBarChart },
  { to: "/assets", label: "Asset register", roles: ["operations_head", "asset_manager", "planner"], icon: Boxes },
  { to: "/tasks", label: "Task queue", roles: ["operations_head", "planner"], icon: ClipboardList },
  { to: "/my-work", label: "My work", roles: ["technician"], icon: Wrench },
  { to: "/alerts", label: "Alerts", roles: ["operations_head", "asset_manager", "planner"], icon: Bell },
];

const SIDEBAR_KEY = "gridline.sidebar";

export function Shell() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "collapsed");
  const [signingOut, setSigningOut] = useState(false);
  if (!user) return null;
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "open");
      return next;
    });
  }

  return (
    <div className={collapsed ? "app collapsed" : "app"}>
      <aside className="sidebar">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <div className="brand-copy">
            <strong>GRIDLINE</strong>
            <small>Asset & maintenance</small>
          </div>
          <button
            type="button"
            className="icon-btn light collapse-btn"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <CollapseIcon size={18} />
          </button>
        </div>
        <nav>
          {LINKS.filter((link) => link.roles.includes(user.role)).map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                title={link.label}
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="nav-label">{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <ThemeToggle compact={collapsed} />
          <div className="user-card">
            <div className="user-copy">
              <strong>{user.full_name}</strong>
              <span>{user.role_label}</span>
            </div>
            <button type="button" className="btn ghost light" onClick={() => setSigningOut(true)}>
              <LogOut size={16} />
              <span className="nav-label">Sign out</span>
            </button>
            <small className="fine">Fictional data. No live SCADA.</small>
          </div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
      <Dialog
        open={signingOut}
        title="Sign out?"
        description="You will return to the sign-in screen."
        onClose={() => setSigningOut(false)}
      >
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={() => setSigningOut(false)}>
            Stay signed in
          </button>
          <button type="button" className="btn primary" onClick={logout}>
            Sign out
          </button>
        </div>
      </Dialog>
    </div>
  );
}
