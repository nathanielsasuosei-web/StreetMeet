import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";
import { IconPhone, IconStatus, IconVideo } from "../components/Icons.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "demo@natthesisa.app", password: "natthesisa" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(form);
      navigate(user?.onboarded === false ? "/onboarding" : "/app");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo">
          <span className="logo-mark">❤</span>
          <span className="logo-text">natthesisa</span>
        </div>

        <div className="card">
          <h2>Welcome back</h2>
          <p className="muted small">Log in to see who is waiting for you.</p>

          <form onSubmit={submit} style={{ marginTop: 18 }}>
            <div className="field">
              <label>Email</label>
              <input
                className="input"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>

            <div className="field">
              <label>Password</label>
              <input
                className="input"
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>

          <div className="notice" style={{ marginTop: 16 }}>
            <strong>Demo account</strong>
            <div className="tiny muted">demo@natthesisa.app · natthesisa</div>
          </div>

          <hr />
          <p className="small muted center mb-0">
            New here? <Link to="/register" style={{ fontWeight: 700 }}>Create an account</Link>
          </p>
        </div>

        <div className="row small muted" style={{ justifyContent: "center", marginTop: 20, gap: 14 }}>
          <span className="row" style={{ gap: 4 }}><IconPhone width={16} height={16} /> Calls</span>
          <span className="row" style={{ gap: 4 }}><IconStatus width={16} height={16} /> Status</span>
          <span className="row" style={{ gap: 4 }}><IconVideo width={16} height={16} /> Video</span>
        </div>
      </div>
    </div>
  );
}
