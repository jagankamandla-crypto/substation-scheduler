import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { errorFields, errorMessage } from "../api";
import { useAuth } from "../auth";
import { AuthFrame } from "../components/AuthFrame";
import { Field } from "../components/ui";
import type { Role } from "../types";

const ROLES: { value: Role; label: string }[] = [
  { value: "technician", label: "Technician" },
  { value: "planner", label: "Maintenance Planner" },
  { value: "asset_manager", label: "Asset Manager" },
  { value: "operations_head", label: "Operations Head" },
];

export function SignUpPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<Role>("technician");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.home} replace />;

  async function submit() {
    const nextErrors: Record<string, string> = {};
    if (password !== confirm) nextErrors.confirm = "Passwords do not match.";
    if (password.length < 8) nextErrors.password = "Password must be at least 8 characters.";
    setErrors(nextErrors);
    setError("");
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try {
      const account = await register({ full_name: fullName, email, password, role });
      navigate(account.home);
    } catch (reason) {
      setErrors(errorFields(reason));
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Join the roster." lede="Create an account, pick the work you do, and you will land on that role's home screen.">
      <form
        className="card signin-card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2>Create an account</h2>
        <Field label="Full name" error={errors.full_name}>
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" />
        </Field>
        <Field label="Email" error={errors.email}>
          <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
        </Field>
        <Field label="Role" error={errors.role}>
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            {ROLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Password" error={errors.password}>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {error && !errors.email && !errors.full_name && !errors.password && !errors.role ? (
          <p className="form-error">{error}</p>
        ) : null}
        <button className="btn primary" type="submit" disabled={busy}>
          Create account
        </button>
        <p className="muted">
          Already on the roster? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
