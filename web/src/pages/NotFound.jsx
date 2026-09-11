import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="auth-card center">
        <div style={{ fontSize: "3rem" }}>💔</div>
        <h2>Page not found</h2>
        <p className="muted small">The link you followed does not exist - but plenty of people do.</p>
        <Link to="/" className="btn btn-primary">Back to natthesisa</Link>
      </div>
    </div>
  );
}
