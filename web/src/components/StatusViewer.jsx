import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import { statusApi } from "../lib/api.js";
import { timeAgo } from "../lib/format.js";

const SECONDS_PER_STATUS = 6;

/** Full-screen WhatsApp-style status player. */
export default function StatusViewer({ group, onClose }) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [viewers, setViewers] = useState(null);
  const timer = useRef(null);

  const items = useMemo(() => group?.items ?? [], [group]);
  const current = items[index];
  const isMine = group?.isMine;

  const go = (step) => {
    setProgress(0);
    setIndex((i) => {
      const nextIndex = i + step;
      if (nextIndex < 0) return 0;
      if (nextIndex >= items.length) {
        onClose();
        return i;
      }
      return nextIndex;
    });
  };

  // Auto-advance
  useEffect(() => {
    if (!current) return undefined;
    timer.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          go(1);
          return 0;
        }
        return p + 100 / (SECONDS_PER_STATUS * 10);
      });
    }, 100);
    return () => clearInterval(timer.current);
  }, [index, current]);

  // Mark as seen (owner only sees the viewer list)
  useEffect(() => {
    if (!current || isMine || current.seenByMe) return;
    statusApi.view(current.id).catch(() => {});
  }, [current, isMine]);

  useEffect(() => {
    if (isMine && current) {
      statusApi
        .viewers(current.id)
        .then((data) => setViewers(data.viewers))
        .catch(() => setViewers([]));
    }
  }, [isMine, current]);

  if (!current) return null;

  return (
    <div className="status-viewer">
      <div className="bars">
        {items.map((item, i) => (
          <div key={item.id} className="bar">
            <span
              style={{
                width: i < index ? "100%" : i === index ? `${progress}%` : "0%",
                transition: "width 0.1s linear",
              }}
            />
          </div>
        ))}
      </div>

      <div className="row-between" style={{ padding: "10px 16px" }}>
        <div className="row">
          <Avatar user={group.user} size="avatar-sm" />
          <div>
            <strong style={{ fontSize: "0.92rem" }}>{isMine ? "You" : group.user.fullName}</strong>
            <div className="tiny muted">{timeAgo(current.createdAt)}</div>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="status-stage" onClick={() => go(1)}>
        {current.mediaType === "TEXT" ? (
          <div className="bg" style={{ background: current.background }} />
        ) : (
          <div className="bg" style={{ background: "#0b0713" }} />
        )}

        <div className="content">
          {current.mediaType === "IMAGE" && current.mediaUrl && (
            <img src={current.mediaUrl} alt="status" />
          )}
          {current.mediaType === "VIDEO" && current.mediaUrl && (
            <video src={current.mediaUrl} autoPlay loop muted playsInline style={{ maxHeight: "62vh" }} />
          )}
          {current.caption && <p className="status-caption">{current.caption}</p>}
        </div>
      </div>

      <div style={{ padding: "10px 18px calc(18px + env(safe-area-inset-bottom, 0px))" }}>
        {isMine ? (
          <div className="row small muted">
            👁️ {viewers ? viewers.length : current.viewCount} view{current.viewCount === 1 ? "" : "s"}
            {viewers?.length ? (
              <span> · {viewers.slice(0, 3).map((v) => v.user.fullName.split(" ")[0]).join(", ")}</span>
            ) : null}
          </div>
        ) : (
          <button
            className="btn btn-soft btn-block"
            onClick={() => {
              statusApi.view(current.id).catch(() => {});
              window.location.href = `/app/matches`;
            }}
          >
            Reply to {group.user.fullName.split(" ")[0]}
          </button>
        )}
      </div>
    </div>
  );
}
