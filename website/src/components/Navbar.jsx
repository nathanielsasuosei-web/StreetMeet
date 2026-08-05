import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "15px 30px",
      background: "#111827",
      color: "white"
    }}>
      <h2 style={{ color: "#22c55e" }}>Street Meet</h2>

      <div style={{ display: "flex", gap: "20px" }}>
        <Link to="/">Home</Link>
        <Link to="/matches">Matches</Link>
        <Link to="/messages">Messages</Link>
        <Link to="/status">Status</Link>
        <Link to="/premium">Premium</Link>
        <Link to="/profile">Profile</Link>
      </div>
    </nav>
  );
}

export default Navbar;