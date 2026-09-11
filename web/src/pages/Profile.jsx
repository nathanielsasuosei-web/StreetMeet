import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar.jsx";
import Modal from "../components/Modal.jsx";
import { profileApi } from "../lib/api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { IconCamera, IconSettings, IconShield, IconCrown, IconPhone } from "../components/Icons.jsx";

const INTERESTS = ["Music", "Football", "Food", "Travel", "Movies", "Fitness", "Art", "Tech", "Books", "Church", "Gaming", "Dancing"];

export default function Profile() {
  const { user, saveProfile, logout, likes } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    bio: user?.bio || "",
    city: user?.city || "",
    phone: user?.phone || "",
    interests: user?.interests || [],
    lookingFor: user?.lookingFor?.length ? user.lookingFor : ["FEMALE"],
    minAge: user?.minAge || 18,
    maxAge: user?.maxAge || 45,
  });
  const [photos, setPhotos] = useState(user?.photos || []);
  const [photoUrl, setPhotoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const uploadPhoto = async (file) => {
    const formData = new FormData();
    formData.append("photos", file);
    try {
      const data = await profileApi.updateForm(formData);
      setPhotos(data.photos);
      toast.success("Photo added");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const addUrl = async () => {
    if (!photoUrl.trim()) return;
    const next = [...photos, photoUrl.trim()].slice(0, 6);
    try {
      const data = await profileApi.update({ photos: next });
      setPhotos(data.user.photos);
      setPhotoUrl("");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const removePhoto = async (url) => {
    try {
      const data = await profileApi.removePhoto(url);
      setPhotos(data.user.photos);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveProfile({ ...form, minAge: Number(form.minAge), maxAge: Number(form.maxAge) });
      setEditing(false);
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    logout();
    navigate("/");
  };

  return (
    <>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Profile</h2>
        <button className="icon-btn" onClick={() => setEditing(true)}>
          <IconSettings width={18} height={18} />
        </button>
      </div>

      <div className="card center">
        <Avatar user={{ ...user, photos }} size="avatar-xl" className="" />
        <h3 style={{ margin: "12px 0 2px" }}>
          {user?.fullName}
          {user?.age ? `, ${user?.age}` : ""}
          {user?.isPremium ? " 👑" : ""}
        </h3>
        <div className="tiny muted">
          {user?.city || "Ghana"} · {likes.remaining} likes left today
        </div>
        {user?.bio && <p className="small muted" style={{ marginTop: 10 }}>{user.bio}</p>}

        {!!user?.interests?.length && (
          <div className="chips" style={{ justifyContent: "center", marginTop: 6 }}>
            {user.interests.map((interest) => (
              <span className="chip" key={interest}>{interest}</span>
            ))}
          </div>
        )}

        {!user?.isPremium && (
          <Link to="/app/premium" className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>
            <IconCrown width={14} height={14} /> See who likes you - from 20p
          </Link>
        )}
      </div>

      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <div className="card center">
          <strong style={{ fontSize: "1.5rem" }}>{likes.limit}</strong>
          <div className="tiny muted">Daily likes</div>
        </div>
        <div className="card center">
          <strong style={{ fontSize: "1.5rem" }}>{user?.isPremium ? "Gold" : "Free"}</strong>
          <div className="tiny muted">Your plan</div>
        </div>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        <Link to="/app/premium" className="list-item">
          <IconCrown /> <span style={{ flex: 1 }}>Plans & payments</span> <span className="muted">›</span>
        </Link>
        <Link to="/app/status" className="list-item">
          <IconCamera /> <span style={{ flex: 1 }}>My statuses</span> <span className="muted">›</span>
        </Link>
        <div className="list-item">
          <IconPhone /> <span style={{ flex: 1 }}>Mobile money</span>
          <span className="muted small">{user?.phone ? `+${user.phone}` : "not set"}</span>
        </div>
        {user?.role === "ADMIN" && (
          <Link to="/app/admin" className="list-item">
            <IconShield /> <span style={{ flex: 1 }}>Admin dashboard</span> <span className="muted">›</span>
          </Link>
        )}
      </div>

      <button className="btn btn-danger btn-block" style={{ marginTop: 16 }} onClick={signOut}>
        Log out
      </button>

      {/* ------------------------------ edit sheet ------------------------------ */}
      {editing && (
      <Modal
        title="Edit profile"
        onClose={() => setEditing(false)}
        footer={
          <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        }
      >
        <div className="field">
          <label>Photos (up to 6)</label>
          <div className="photo-grid">
            {photos.map((url) => (
              <div className="tile" key={url}>
                <img src={url} alt="your photo" referrerPolicy="no-referrer" />
                <button onClick={() => removePhoto(url)}>✕</button>
              </div>
            ))}
            {photos.length < 6 && (
              <label className="tile add">
                <IconCamera />
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(event) => event.target.files?.[0] && uploadPhoto(event.target.files[0])}
                />
              </label>
            )}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input
              className="input"
              placeholder="…or paste an image URL"
              value={photoUrl}
              onChange={(event) => setPhotoUrl(event.target.value)}
            />
            <button className="btn" onClick={addUrl}>Add</button>
          </div>
        </div>

        <div className="field">
          <label>Name</label>
          <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>

        <div className="field">
          <label>Bio</label>
          <textarea
            className="textarea"
            maxLength={500}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </div>

        <div className="grid grid-2">
          <div className="field">
            <label>City</label>
            <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="field">
            <label>MoMo number</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>

        <div className="field">
          <label>Interests</label>
          <div className="chips">
            {INTERESTS.map((interest) => (
              <button
                type="button"
                key={interest}
                className={`chip ${form.interests.includes(interest) ? "active" : ""}`}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    interests: current.interests.includes(interest)
                      ? current.interests.filter((i) => i !== interest)
                      : [...current.interests, interest].slice(0, 8),
                  }))
                }
              >
                {interest}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Interested in</label>
          <div className="chips">
            {["FEMALE", "MALE", "OTHER"].map((option) => (
              <button
                type="button"
                key={option}
                className={`chip ${form.lookingFor.includes(option) ? "active" : ""}`}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    lookingFor: current.lookingFor.includes(option)
                      ? current.lookingFor.filter((i) => i !== option)
                      : [...current.lookingFor, option],
                  }))
                }
              >
                {option === "FEMALE" ? "Women" : option === "MALE" ? "Men" : "Everyone"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-2">
          <div className="field">
            <label>Min age: {form.minAge}</label>
            <input type="range" min="18" max="80" value={form.minAge} onChange={(e) => setForm({ ...form, minAge: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Max age: {form.maxAge}</label>
            <input type="range" min="18" max="80" value={form.maxAge} onChange={(e) => setForm({ ...form, maxAge: Number(e.target.value) })} />
          </div>
        </div>
      </Modal>
      )}
    </>
  );
}
