import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { paymentApi } from "../lib/api.js";
import { pesewas } from "../lib/format.js";
import { IconHeart, IconChat, IconStatus, IconPhone, IconVideo, IconShield, IconGlobe, IconCrown } from "../components/Icons.jsx";

const FEATURES = [
  { Icon: IconHeart, title: "Swipe that means something", body: "A deck filtered by your preferences - age, distance and who you are actually looking for." },
  { Icon: IconChat, title: "Chat the moment you match", body: "Real-time messages with typing indicators and read receipts, powered by WebSockets." },
  { Icon: IconStatus, title: "Status, like WhatsApp", body: "Post a photo, a video or a thought. It disappears after 24 hours and you see who watched." },
  { Icon: IconVideo, title: "Video and voice calls", body: "Talk properly before you meet. Peer-to-peer WebRTC, so calls stay private and smooth." },
  { Icon: IconShield, title: "Built-in safety", body: "Block, report and a moderation queue for our team. Verified badges for real humans." },
  { Icon: IconGlobe, title: "Made for Ghana", body: "Pay with MTN MoMo, Vodafone Cash or AirtelTigo Money. Plans start at 20 pesewas." },
];

const STEPS = [
  "Create your profile in under two minutes - photo, bio, interests.",
  "Swipe through people near you. Like, pass, or send a super like.",
  "When you both like each other it is a match. Say hello instantly.",
  "Share a status, jump on a call, and take it from there.",
];

export default function Landing() {
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    paymentApi
      .plans()
      .then((data) => setPlans(data.plans || []))
      .catch(() => setPlans([]));
  }, []);

  return (
    <div className="landing">
      <nav className="nav-public">
        <div className="logo">
          <span className="logo-mark">❤</span>
          <span className="logo-text">natthesisa</span>
        </div>
        <div className="links">
          <a href="#features" className="desktop-only">Features</a>
          <a href="#how" className="desktop-only">How it works</a>
          <a href="#plans" className="desktop-only">Plans</a>
          <Link to="/login" className="desktop-only">Log in</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
        </div>
      </nav>

      <div className="container">
        <section className="hero">
          <div className="hero-grid">
            <div>
              <span className="pill pill-brand">🇬🇭 Swipe · Match · Chat · Call</span>
              <h1 style={{ marginTop: 16 }}>
                Meet your person on <span className="grad">natthesisa</span>
              </h1>
              <p>
                A dating app built for Ghana. Real profiles nearby, WhatsApp-style statuses, and video
                calls before you ever meet. Plans from 20 pesewas, paid straight from your MoMo wallet.
              </p>
              <div className="hero-actions">
                <Link to="/register" className="btn btn-primary btn-lg">Start matching free</Link>
                <Link to="/login" className="btn btn-lg">I already have an account</Link>
              </div>
              <div className="row small muted" style={{ gap: 16 }}>
                <span>✅ Free to join</span>
                <span>✅ 20 daily likes</span>
                <span>✅ No card needed</span>
              </div>
            </div>

            <div>
              <div className="phone-mock">
                <div className="phone-mock-inner">
                  <img
                    src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=700&q=80"
                    alt="natthesisa member"
                    referrerPolicy="no-referrer"
                  />
                  <div className="phone-mock-overlay">
                    <strong>Nana, 27</strong>
                    <div className="tiny muted">📍 Accra · 3 km away</div>
                    <p className="tiny" style={{ margin: "8px 0 12px" }}>
                      “Architecture by day, highlife playlists by night.”
                    </p>
                    <div className="swipe-actions">
                      <span className="deck-btn small nope">✕</span>
                      <span className="deck-btn small super">⭐</span>
                      <span className="deck-btn small like">♥</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="features">
          <h2>Everything you expect from a dating app</h2>
          <p className="section-lead">
            Plus the things other apps charge a fortune for - statuses and calls live in the free tier.
          </p>
          <div className="grid grid-3" style={{ marginTop: 26 }}>
            {FEATURES.map(({ Icon, title, body }) => (
              <div className="feature" key={title}>
                <div className="emoji">
                  <Icon width={30} height={30} />
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="how">
          <div className="grid grid-2" style={{ alignItems: "start", gap: 34 }}>
            <div>
              <h2>How natthesisa works</h2>
              <p className="section-lead">Four steps, about two minutes.</p>
              <div className="steps" style={{ marginTop: 18 }}>
                {STEPS.map((step) => (
                  <div className="step" key={step}>
                    <span className="num" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card card-soft">
              <IconCrown />
              <h3 style={{ marginTop: 10 }}>Plans that cost less than airtime</h3>
              <p className="muted small">
                Unlock who likes you, more daily likes and video calls. Pay with MTN MoMo, Vodafone
                Cash or AirtelTigo Money - no bank card, no dollar card, no stress.
              </p>
              <div className="stack">
                {(plans.length ? plans : []).map((plan) => (
                  <div className="row-between" key={plan.code}>
                    <div>
                      <strong>{plan.name}</strong>
                      <div className="tiny muted">{plan.tagline}</div>
                    </div>
                    <span className="pill pill-gold">
                      {pesewas(plan.pricePesewas, plan.currency)} / {plan.durationDays}d
                    </span>
                  </div>
                ))}
                {!plans.length && <div className="tiny muted">Loading plans…</div>}
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="plans">
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <h2>Ready to meet someone?</h2>
            <p className="muted">Join free, upgrade only when you want to.</p>
            <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
              <Link to="/register" className="btn btn-primary btn-lg">Create my profile</Link>
              <Link to="/login" className="btn btn-lg">Log in</Link>
            </div>
          </div>
        </section>

        <footer className="footer-public">
          <div className="row-between wrap">
            <div>
              <strong>natthesisa</strong> · Accra, Ghana
            </div>
            <div className="row" style={{ gap: 18 }}>
              <Link to="/login">Log in</Link>
              <Link to="/register">Sign up</Link>
              <span>© {new Date().getFullYear()}</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
