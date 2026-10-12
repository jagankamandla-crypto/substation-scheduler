import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Shell } from "./components/Shell";
import { AlertsPage } from "./pages/Alerts";
import { AssetDetailPage } from "./pages/AssetDetail";
import { AssetFormPage } from "./pages/AssetFormPage";
import { AssetsPage } from "./pages/Assets";
import { DashboardPage } from "./pages/Dashboard";
import { MyWorkPage } from "./pages/MyWork";
import { ReportPage } from "./pages/Report";
import { ForgotPasswordPage } from "./pages/ForgotPassword";
import { SignInPage } from "./pages/SignIn";
import { SignUpPage } from "./pages/SignUp";
import { TaskDetailPage } from "./pages/TaskDetail";
import { TasksPage } from "./pages/Tasks";
import type { Role } from "./types";

function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={user.home} replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.home} replace />;
}

export function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        element={
          user ? (
            <Shell />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/dashboard" element={<Guard roles={["operations_head", "asset_manager", "planner"]}><DashboardPage /></Guard>} />
        <Route path="/reports" element={<Guard roles={["operations_head"]}><ReportPage /></Guard>} />
        <Route path="/assets" element={<Guard roles={["operations_head", "asset_manager", "planner"]}><AssetsPage /></Guard>} />
        <Route path="/assets/new" element={<Guard roles={["asset_manager"]}><AssetFormPage /></Guard>} />
        <Route path="/assets/:id/edit" element={<Guard roles={["asset_manager"]}><AssetFormPage /></Guard>} />
        <Route path="/assets/:id" element={<Guard roles={["operations_head", "asset_manager", "planner", "technician"]}><AssetDetailPage /></Guard>} />
        <Route path="/tasks" element={<Guard roles={["operations_head", "planner"]}><TasksPage /></Guard>} />
        <Route path="/tasks/:id" element={<Guard roles={["operations_head", "planner", "technician"]}><TaskDetailPage /></Guard>} />
        <Route path="/my-work" element={<Guard roles={["technician"]}><MyWorkPage /></Guard>} />
        <Route path="/alerts" element={<Guard roles={["operations_head", "asset_manager", "planner"]}><AlertsPage /></Guard>} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
