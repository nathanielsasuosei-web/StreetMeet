import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "../components/Avatar.jsx";
import { matchApi, discoverApi } from "../lib/api.js";
import { useToast } from "../state/ToastContext.jsx";
import { timeAgo } from "../lib/format.js";
import { IconCrown, IconVideo, IconPhone } from "../components/Icons.jsx";

export default function Matches() {
  const toast = useToast();
  const [matches, setMatches] = useState([]);
  const [likers, setLikers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("matches");

  useEffect(() => {
    Promise.all([matchApi.list(), discoverApi.likers()])
      .then(([matchData, likeData]) => {
        setMatches(matchData.matches || []);
        setLikers(likeData);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [toast]);

  return (
    <>
      <div className="row-between" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Matches</h2>
        <Link to="/app/premium" className="btn btn-soft btn-sm">
          <IconCrown width={16} height={16} /> Go Gold
        </Link>
      </div>

      <div className="chips" style={{ marginBottom: 16 }}>
        <button className={`chip ${tab === "matches" ? "active" : ""}`} onClick={() => setTab("matches")}>
          Conversations {matches.length ? `(${matches.length})` : ""}
        </button>
        <button className={`chip ${tab === "likes" ? "active" : ""}`} onClick={() => setTab("likes")}>
          Likes you {likers?.count ? `(${likers.count})` : ""}
        </button>
      </div>

      {loading ? (
        <div className="loader"><span className="spinner-ring" /></div>
      ) : tab === "matches" ? (
        <div className="stack">
          {matches.length === 0 && (
            <div className="empty-deck">
              <div className="emoji">💬</div>
              <h3>No matches yet</h3>
              <p className="small">Go and like a few profiles - they will show up here the moment they like you back.</p>
              <Link to="/app" className="btn btn-primary btn-sm">Start swiping</Link>
            </div>
          )}

          {matches.map(({ id, partner, lastMessage, lastMessageAt, createdAt }) => (
            <Link to={`/app/chat/${id}`} key={id} className="match-item">
              <Avatar user={partner} size="avatar-lg" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">
                  {partner.fullName}
                  {partner.age ? `, ${partner.age}` : ""}
                  {partner.isPremium ? " 👑" : ""}
                </div>
                <span className="preview">
                  {lastMessage
                    ? `${lastMessage.fromMe ? "You: " : ""}${
                        lastMessage.mediaType !== "TEXT"
                          ? lastMessage.mediaType === "IMAGE"
                            ? "📷 Photo"
                            : lastMessage.mediaType === "VIDEO"
                              ? "🎥 Video"
                              : "🎤 Audio"
                          : lastMessage.body
                      }`
                    : `Matched ${timeAgo(createdAt)}`}
                </span>
              </div>
              <div className="right" style={{ textAlign: "right" }}>
                <div className="tiny muted">{timeAgo(lastMessage?.createdAt || lastMessageAt)}</div>
                <div className="row" style={{ gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
                  <span className="pill">Chat</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="stack">
          {!likers?.premium && (
            <div className="notice">
              🔒 {likers?.count || 0} people like you. Go Gold from 20 pesewas to see who they are -
              and match instantly.
            </div>
          )}

          <div className="grid grid-2">
            {(likers?.likers || []).map((liker) => (
              <div className="card center" key={liker.id}>
                <Avatar user={liker} size="avatar-lg" />
                <strong style={{ display: "block", marginTop: 8 }}>
                  {liker.fullName}
                  {liker.age ? `, ${liker.age}` : ""}
                </strong>
                <div className="tiny muted">{liker.city || "Ghana"}</div>
                <div className="row" style={{ justifyContent: "center", marginTop: 10, gap: 8 }}>
                  {liker.blurred ? (
                    <Link to="/app/premium" className="btn btn-primary btn-sm">
                      <IconCrown width={14} height={14} /> Reveal
                    </Link>
                  ) : (
                    <>
                      <Link to="/app" className="btn btn-sm">
                        <IconVideo width={14} height={14} /> Like back
                      </Link>
                      <Link to="/app" className="btn btn-ghost btn-sm">
                        <IconPhone width={14} height={14} />
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!likers?.likers?.length && (
            <div className="empty-deck">
              <div className="emoji">🤍</div>
              <h3>No likes yet</h3>
              <p className="small">Keep swiping - your first admirer is closer than you think.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
