import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { errorMessage } from "../api";
import { useAuth } from "../auth";
import { AuthFrame } from "../components/AuthFrame";

const DEMOS = [
  ["rao.ops@grid.example", "Mr. Rao", "Operations Head"],
  ["suresh.asset@grid.example", "Suresh Menon", "Asset Manager"],
  ["lakshmi.planner@grid.example", "Lakshmi Iyer", "Maintenance Planner"],
  ["ramesh.tech@grid.example", "Ramesh Kumar", "Technician"],
  ["divya.tech@grid.example", "Divya Nair", "Technician"],
] as const;

export function SignInPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("rao.ops@grid.example");
  const [password, setPassword] = useState("Demo#2026");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.home} replace />;

  async function submit(nextEmail = email, nextPassword = password) {
    setBusy(true);
    setError("");
    try {
      const account = await login(nextEmail, nextPassword);
      navigate(account.home);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Every asset on its date."
      lede="Plan preventive work, record what the technician found, and see overdue risk before it becomes an outage."
    >
        <form
          className="card signin-card"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <h2>Sign in</h2>
          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn primary" type="submit" disabled={busy}>
            Sign in
          </button>
          <div className="auth-links">
            <Link to="/forgot-password">Forgot password?</Link>
            <Link to="/signup">Create an account</Link>
          </div>
          <p className="muted">Demo password Demo#2026. Fictional people and substations.</p>
          <div className="demo-list">
            {DEMOS.map(([address, name, role]) => (
              <button key={address} type="button" className="demo" disabled={busy} onClick={() => void submit(address, "Demo#2026")}>
                <strong>{name}</strong>
                <span>{role}</span>
              </button>
            ))}
          </div>
        </form>
    </AuthFrame>
  );
}
