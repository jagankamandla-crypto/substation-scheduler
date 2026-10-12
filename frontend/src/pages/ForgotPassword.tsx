import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, errorFields, errorMessage } from "../api";
import { useAuth } from "../auth";
import { AuthFrame } from "../components/AuthFrame";
import { Field } from "../components/ui";

export function ForgotPasswordPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.home} replace />;

  async function submit() {
    const nextErrors: Record<string, string> = {};
    if (password.length < 8) nextErrors.password = "Password must be at least 8 characters.";
    if (password !== confirm) nextErrors.confirm = "Passwords do not match.";
    setErrors(nextErrors);
    setError("");
    setDone("");
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try {
      const result = await api<{ detail: string }>("/api/auth/reset-password", {
        method: "POST",
        body: { email, password },
      });
      setDone(result.detail);
      setPassword("");
      setConfirm("");
    } catch (reason) {
      setErrors(errorFields(reason));
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Set a new password."
      lede="No email is sent. If the account already exists, the new password replaces the old one."
    >
      <form
        className="card signin-card"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2>Forgot password</h2>
        <Field label="Email" error={errors.email}>
          <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
        </Field>
        <Field label="New password" error={errors.password}>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password" error={errors.confirm}>
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {done ? <p className="banner good">{done}</p> : null}
        {error && !errors.email && !errors.password ? <p className="form-error">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={busy}>
          Update password
        </button>
        <p className="muted">
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
