import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";

const TODAY = new Date().toISOString().slice(0, 10);

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    gender: "OTHER",
    birthDate: "",
    city: "Accra",
  });
  const [error, setError] = useState(null);
  const [details, setDetails] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDetails(null);
    try {
      await register({ ...form, birthDate: form.birthDate || undefined });
      navigate("/onboarding");
    } catch (err) {
      setError(err.message);
      if (err.details) setDetails(err.details);
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
          <h2>Create your profile</h2>
          <p className="muted small">Free forever. Upgrade only if you want the extras.</p>

          <form onSubmit={submit} style={{ marginTop: 18 }}>
            <div className="field">
              <label>Full name</label>
              <input
                className="input"
                required
                minLength={2}
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Ama Serwaa"
              />
            </div>

            <div className="grid grid-2">
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
                <label>MoMo number</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0241234567"
                />
              </div>
            </div>

            <div className="grid grid-2">
              <div className="field">
                <label>I am</label>
                <select
                  className="input"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="FEMALE">Woman</option>
                  <option value="MALE">Man</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="field">
                <label>Birth date</label>
                <input
                  className="input"
                  type="date"
                  max={TODAY}
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label>City</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Accra"
              />
            </div>

            <div className="field">
              <label>Password</label>
              <input
                className="input"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 8 characters"
              />
            </div>

            {error && <p className="error-text" style={{ marginBottom: 8 }}>{error}</p>}
            {details &&
              Object.entries(details).map(([field, message]) => (
                <p className="error-text" key={field} style={{ marginBottom: 4 }}>
                  {field}: {message}
                </p>
              ))}

            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>

          <hr />
          <p className="small muted center mb-0">
            Already a member? <Link to="/login" style={{ fontWeight: 700 }}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
