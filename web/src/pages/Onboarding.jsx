import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import Avatar from "../components/Avatar.jsx";
import { profileApi } from "../lib/api.js";
import { IconCamera } from "../components/Icons.jsx";

const INTERESTS = ["Music", "Football", "Food", "Travel", "Movies", "Fitness", "Art", "Tech", "Books", "Church", "Gaming", "Dancing"];

export default function Onboarding() {
  const { user, saveProfile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState(user?.photos || []);
  const [photoUrl, setPhotoUrl] = useState("");
  const [bio, setBio] = useState(user?.bio || "");
  const [interests, setInterests] = useState(user?.interests || []);
  const [city, setCity] = useState(user?.city || "Accra");
  const [lookingFor, setLookingFor] = useState(user?.lookingFor || ["FEMALE"]);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(45);
  const [maxDistanceKm, setMaxDistanceKm] = useState(150);
  const [busy, setBusy] = useState(false);

  const addPhotoUrl = () => {
    if (!photoUrl.trim()) return;
    setPhotos((p) => [...p, photoUrl.trim()].slice(0, 6));
    setPhotoUrl("");
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("photos", file);
    formData.append("onboarded", "false");
    try {
      const data = await profileApi.updateForm(formData);
      setPhotos(data.photos);
      toast.success("Photo uploaded");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await saveProfile({
        photos,
        avatarUrl: photos[0] || null,
        bio,
        interests,
        city,
        lookingFor,
        minAge,
        maxAge,
        maxDistanceKm,
        onboarded: true,
      });
      toast.success("Profile ready - happy matching 💜");
      navigate("/app");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    // 0 - photos
    <div key="photos" className="stack">
      <h2>Add your best photos</h2>
      <p className="muted small">Six is plenty. Profiles with photos get far more matches.</p>

      <div className="photo-grid">
        {photos.map((url) => (
          <div className="tile" key={url}>
            <img src={url} alt="your photo" referrerPolicy="no-referrer" />
            <button onClick={() => setPhotos((p) => p.filter((photo) => photo !== url))}>✕</button>
          </div>
        ))}
        {photos.length < 6 && (
          <label className="tile add">
            <IconCamera />
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(event) => event.target.files?.[0] && uploadFile(event.target.files[0])}
            />
          </label>
        )}
      </div>

      <div className="row">
        <input
          className="input"
          placeholder="…or paste an image URL"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
        />
        <button className="btn" onClick={addPhotoUrl}>Add</button>
      </div>
    </div>,

    // 1 - bio
    <div key="bio" className="stack">
      <h2>About you</h2>
      <p className="muted small">Two or three lines is the sweet spot.</p>

      <div className="field">
        <label>Your bio</label>
        <textarea
          className="textarea"
          maxLength={500}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Weekend chef, Arsenal apologist, always down for waakye."
        />
      </div>

      <div className="field">
        <label>City</label>
        <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>

      <div className="field">
        <label>Interests</label>
        <div className="chips">
          {INTERESTS.map((interest) => (
            <button
              type="button"
              key={interest}
              className={`chip ${interests.includes(interest) ? "active" : ""}`}
              onClick={() =>
                setInterests((current) =>
                  current.includes(interest)
                    ? current.filter((i) => i !== interest)
                    : [...current, interest].slice(0, 8)
                )
              }
            >
              {interest}
            </button>
          ))}
        </div>
      </div>
    </div>,

    // 2 - preferences
    <div key="prefs" className="stack">
      <h2>Who should we show you?</h2>
      <p className="muted small">You can change this any time in Settings.</p>

      <div className="field">
        <label>Interested in</label>
        <div className="chips">
          {["FEMALE", "MALE", "OTHER"].map((option) => (
            <button
              type="button"
              key={option}
              className={`chip ${lookingFor.includes(option) ? "active" : ""}`}
              onClick={() =>
                setLookingFor((current) =>
                  current.includes(option) ? current.filter((i) => i !== option) : [...current, option]
                )
              }
            >
              {option === "FEMALE" ? "Women" : option === "MALE" ? "Men" : "Everyone"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="field">
          <label>Min age: {minAge}</label>
          <input type="range" min="18" max="80" value={minAge} onChange={(e) => setMinAge(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>Max age: {maxAge}</label>
          <input type="range" min="18" max="80" value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} />
        </div>
      </div>

      <div className="field">
        <label>Maximum distance: {maxDistanceKm} km</label>
        <input
          type="range"
          min="5"
          max="500"
          step="5"
          value={maxDistanceKm}
          onChange={(e) => setMaxDistanceKm(Number(e.target.value))}
        />
      </div>
    </div>,
  ];

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo">
          <span className="logo-mark">❤</span>
          <span className="logo-text">natthesisa</span>
        </div>

        <div className="card">
          <div className="row" style={{ marginBottom: 18 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 4,
                  marginRight: 6,
                  background: i <= step ? "var(--grad)" : "var(--surface-3)",
                }}
              />
            ))}
          </div>

          {steps[step]}

          <div className="row-between" style={{ marginTop: 22 }}>
            <button className="btn btn-ghost" onClick={() => (step === 0 ? navigate("/app") : setStep(step - 1))}>
              {step === 0 ? "Skip for now" : "Back"}
            </button>
            {step < 2 ? (
              <button className="btn btn-primary" onClick={() => setStep(step + 1)} disabled={step === 0 && !photos.length}>
                Continue
              </button>
            ) : (
              <button className="btn btn-primary" onClick={finish} disabled={busy}>
                {busy ? "Saving…" : "Start matching"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
