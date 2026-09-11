import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SwipeDeck from "../components/SwipeDeck.jsx";
import Modal from "../components/Modal.jsx";
import Avatar from "../components/Avatar.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { useCall } from "../state/CallContext.jsx";
import { discoverApi } from "../lib/api.js";
import { IconBolt, IconCrown, IconVideo } from "../components/Icons.jsx";

export default function Discover() {
  const { user, likes, setLikes } = useAuth();
  const toast = useToast();
  const call = useCall();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [outOfLikes, setOutOfLikes] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await discoverApi.feed(20);
      setProfiles(data.profiles || []);
      if (data.likes) setLikes(data.likes);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [setLikes, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const registerLike = async (profile, superLike) => {
    // Optimistic: remove the card straight away so swiping feels instant
    setProfiles((current) => current.filter((p) => p.id !== profile.id));

    try {
      const data = await discoverApi.like(profile.id, superLike);
      setLikes(data.likes);
      if (data.matched) {
        setMatch({ ...profile, matchId: data.matchId });
        toast.success(`It is a match with ${profile.fullName} 💜`);
      } else if (superLike) {
        toast.success("Super like sent ⭐");
      }
    } catch (error) {
      if (/out of likes/i.test(error.message)) {
        setOutOfLikes(true);
      } else {
        toast.error(error.message);
        setProfiles((current) => [profile, ...current]);
      }
    }
  };

  const registerPass = async (profile) => {
    setProfiles((current) => current.filter((p) => p.id !== profile.id));
    discoverApi.pass(profile.id).catch(() => {});
  };

  return (
    <>
      <div className="row-between" style={{ marginBottom: 6 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Discover</h2>
          <div className="tiny muted">
            {user?.city || "Ghana"} · {likes.remaining} likes left today
          </div>
        </div>
        <Link to="/app/premium" className="btn btn-soft btn-sm">
          <IconCrown width={16} height={16} /> {user?.isPremium ? "Gold" : "Go Gold"}
        </Link>
      </div>

      <div className="row" style={{ marginBottom: 6 }}>
        <div
          style={{
            flex: 1,
            height: 6,
            borderRadius: 6,
            background: "var(--surface-3)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.round((likes.remaining / (likes.limit || 20)) * 100)}%`,
              height: "100%",
              background: "var(--grad)",
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="loader">
          <span className="spinner-ring" />
        </div>
      ) : (
        <SwipeDeck
          profiles={profiles}
          onLike={(profile) => registerLike(profile, false)}
          onSuperLike={(profile) => registerLike(profile, true)}
          onPass={registerPass}
          emptyAction={
            <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
              <button className="btn" onClick={load}>
                <IconBolt width={16} height={16} /> Refresh deck
              </button>
            </div>
          }
        />
      )}

      {/* Match celebration */}
      {match && (
      <Modal
        title="It's a match!"
        onClose={() => setMatch(null)}
        footer={
          <div className="stack">
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                if (!match?.matchId) return;
                call.startCall({ matchId: match.matchId, partner: match, type: "VIDEO" });
                setMatch(null);
              }}
            >
              <IconVideo width={16} height={16} /> Call {match?.fullName?.split(" ")[0]}
            </button>
            <Link to="/app/matches" className="btn btn-block" onClick={() => setMatch(null)}>
              Send a message
            </Link>
            <button className="btn btn-ghost btn-block" onClick={() => setMatch(null)}>
              Keep swiping
            </button>
          </div>
        }
      >
        <div className="center">
          <Avatar user={match} size="avatar-xl" className="" />
          <h3 style={{ marginTop: 12 }}>You and {match.fullName} liked each other</h3>
          <p className="muted small mb-0">
            Say something first - conversations that start within an hour go somewhere.
          </p>
        </div>
      </Modal>
      )}

      {/* Out of likes upsell */}
      {outOfLikes && (
      <Modal
        title="Out of likes for today"
        onClose={() => setOutOfLikes(false)}
        footer={
          <div className="stack">
            <Link to="/app/premium" className="btn btn-primary btn-block">
              See plans from 20p
            </Link>
            <button className="btn btn-ghost btn-block" onClick={() => setOutOfLikes(false)}>
              Come back tomorrow
            </button>
          </div>
        }
      >
        <p className="muted">
          Free accounts get {likes.limit || 20} likes every 24 hours. A natthesisa plan raises that to
          100 a day and unlocks who already likes you - from 20 pesewas.
        </p>
      </Modal>
      )}
    </>
  );
}
