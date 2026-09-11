export const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

export function timeAgo(value) {
  if (!value) return "";
  const date = new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export const clockTime = (value) =>
  new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export const pesewas = (amount, currency = "GHS") => {
  const symbol = currency === "GHS" ? "GH¢" : `${currency} `;
  return `${symbol}${(amount / 100).toFixed(2)}`;
};

export const callDuration = (seconds = 0) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export const NETWORKS = [
  { id: "mtn", label: "MTN MoMo", color: "#ffcb05" },
  { id: "vodafone", label: "Vodafone Cash", color: "#e60000" },
  { id: "airteltigo", label: "AirtelTigo", color: "#1a4fbd" },
];
