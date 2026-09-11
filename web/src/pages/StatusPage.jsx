import { useEffect, useRef, useState } from "react";
import Avatar from "../components/Avatar.jsx";
import Modal from "../components/Modal.jsx";
import StatusViewer from "../components/StatusViewer.jsx";
import { statusApi } from "../lib/api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { timeAgo } from "../lib/format.js";
import { IconPlus, IconCamera } from "../components/Icons.jsx";

const BACKGROUNDS = ["#7c3aed", "#ec4899", "#f59e0b", "#0ea5e9", "#10b981", "#ef4444"];

export default function StatusPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openGroup, setOpenGroup] = useState(null);
  const [composer, setComposer] = useState(false);
  const [caption, setCaption] = useState("");
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await statusApi.feed();
      setFeed(data.feed || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const post = async (event) => {
    event?.preventDefault();
    setBusy(true);
    try {
      await statusApi.createText({ caption, background });
      toast.success("Status posted - it disappears in 24 hours");
      setComposer(false);
      setCaption("");
      setMediaUrl("");
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadMedia = async (file) => {
    const formData = new FormData();
    formData.append("media", file);
    formData.append("caption", caption);
    setBusy(true);
    try {
      await statusApi.create(formData);
      toast.success("Status posted");
      setComposer(false);
      setCaption("");
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const mine = feed.find((group) => group.isMine);
  const others = feed.filter((group) => !group.isMine);

  return (
    <>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Status</h2>
          <div className="tiny muted">Disappears after 24 hours, just like WhatsApp</div>
        </div>
        <button className="btn btn-soft btn-sm" onClick={() => setComposer(true)}>
          <IconPlus width={16} height={16} /> Post
        </button>
      </div>

      {loading ? (
        <div className="loader"><span className="spinner-ring" /></div>
      ) : (
        <>
          <div className="ring-row">
            <button className="ring" onClick={() => setComposer(true)}>
              <span className="circle">
                <span className="add">
                  <IconPlus />
                </span>
              </span>
              <span className="label">Add</span>
            </button>

            {mine && (
              <button className="ring" onClick={() => setOpenGroup(mine)}>
                <span className="circle">
                  <Avatar user={mine.user} className="" />
                </span>
                <span className="label">Your status</span>
              </button>
            )}

            {others.map((group) => (
              <button
                key={group.user.id}
                className={`ring ${group.unseen ? "unseen" : "seen"}`}
                onClick={() => setOpenGroup(group)}
              >
                <span className="circle">
                  <Avatar user={group.user} />
                </span>
                <span className="label">{group.user.fullName.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          {!others.length && (
            <div className="empty-deck">
              <div className="emoji">📸</div>
              <h3>No statuses yet</h3>
              <p className="small">
                Statuses from your matches show up here for 24 hours. Post one and yours will appear at
                the front.
              </p>
            </div>
          )}

          {others.length > 0 && (
            <div className="stack" style={{ marginTop: 10 }}>
              <h4 style={{ marginBottom: 0 }}>Recent</h4>
              {others.map((group) => (
                <button
                  key={group.user.id}
                  className="match-item"
                  style={{ width: "100%", textAlign: "left", color: "inherit" }}
                  onClick={() => setOpenGroup(group)}
                >
                  <Avatar user={group.user} size="avatar-lg" />
                  <div style={{ flex: 1 }}>
                    <div className="name">{group.user.fullName}</div>
                    <span className="preview">{group.items.at(-1).caption || "New status"}</span>
                  </div>
                  <div className="tiny muted">{timeAgo(group.items.at(-1).createdAt)}</div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {openGroup && <StatusViewer group={openGroup} onClose={() => { setOpenGroup(null); load(); }} />}

      {composer && (
      <Modal
        title="Post a status"
        onClose={() => setComposer(false)}
        footer={
          <button className="btn btn-primary btn-block" onClick={post} disabled={busy || !caption.trim()}>
            {busy ? "Posting…" : "Share status"}
          </button>
        }
      >
        <div className="field">
          <label>What is on your mind?</label>
          <textarea
            className="textarea"
            maxLength={300}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Sunset at Labadi hits different today 🌅"
          />
        </div>

        <div className="field">
          <label>Background</label>
          <div className="row" style={{ gap: 8 }}>
            {BACKGROUNDS.map((color) => (
              <button
                key={color}
                onClick={() => setBackground(color)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: color,
                  border: background === color ? "3px solid #fff" : "2px solid transparent",
                }}
                aria-label={color}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <label>Or add a photo / video</label>
          <button className="btn btn-block" onClick={() => fileRef.current?.click()}>
            <IconCamera width={16} height={16} /> Choose from your device
          </button>
          <input
            type="file"
            accept="image/*,video/*"
            ref={fileRef}
            style={{ display: "none" }}
            onChange={(event) => event.target.files?.[0] && uploadMedia(event.target.files[0])}
          />
        </div>

        <div className="field">
          <label>…or paste a media URL</label>
          <div className="row">
            <input
              className="input"
              value={mediaUrl}
              onChange={(event) => setMediaUrl(event.target.value)}
              placeholder="https://…"
            />
            <button
              className="btn"
              onClick={async () => {
                if (!mediaUrl.trim()) return;
                setBusy(true);
                try {
                  await statusApi.createText({
                    caption: caption || "",
                    background,
                    mediaUrl: mediaUrl.trim(),
                  });
                  toast.success("Status posted");
                  setComposer(false);
                  setMediaUrl("");
                  setCaption("");
                  load();
                } catch (error) {
                  toast.error(error.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Add
            </button>
          </div>
        </div>

        <p className="tiny muted mb-0">
          Posting as <strong>{user?.fullName}</strong>. Statuses vanish 24 hours after you post them.
        </p>
      </Modal>
      )}
    </>
  );
}
