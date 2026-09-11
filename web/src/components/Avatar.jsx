import { initials } from "../lib/format.js";

export default function Avatar({ user, size = "", online = false, className = "" }) {
  const src = user?.avatarUrl || user?.photos?.[0];

  return (
    <span style={{ position: "relative", display: "inline-flex", flex: "none" }}>
      {src ? (
        <img
          className={`avatar ${size} ${className}`}
          src={src}
          alt={user?.fullName || "Member"}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className={`avatar avatar-fallback ${size} ${className}`}>
          {initials(user?.fullName || "?")}
        </span>
      )}
      {online && <span className="dot-online" style={{ position: "absolute", right: 2, bottom: 2 }} />}
    </span>
  );
}
