import { NavLink } from "react-router-dom";
import { IconHome, IconChat, IconStatus, IconUser, IconCrown } from "./Icons.jsx";

const TABS = [
  { to: "/app", label: "Discover", Icon: IconHome, end: true },
  { to: "/app/status", label: "Status", Icon: IconStatus },
  { to: "/app/matches", label: "Matches", Icon: IconChat },
  { to: "/app/premium", label: "Plans", Icon: IconCrown },
  { to: "/app/profile", label: "Profile", Icon: IconUser },
];

export default function TabBar({ unread = 0 }) {
  return (
    <nav className="tabbar">
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>
          <span style={{ position: "relative" }}>
            <Icon />
            {label === "Matches" && unread > 0 && <span className="badge">{unread}</span>}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
