import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./state/AuthContext.jsx";
import TabBar from "./components/TabBar.jsx";
import CallOverlay from "./components/CallOverlay.jsx";
import { IconCrown } from "./components/Icons.jsx";

import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import Discover from "./pages/Discover.jsx";
import Matches from "./pages/Matches.jsx";
import Chat from "./pages/Chat.jsx";
import StatusPage from "./pages/StatusPage.jsx";
import Premium from "./pages/Premium.jsx";
import Profile from "./pages/Profile.jsx";
import Admin from "./pages/Admin.jsx";
import NotFound from "./pages/NotFound.jsx";

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loader" style={{ paddingTop: 120 }}>
        <span className="spinner-ring" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function Guest({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/app" replace />;
  return children;
}

/** The logged-in shell: top bar + screens + bottom tabs + call overlay. */
function AppShell() {
  const { user } = useAuth();

  return (
    <div className="device">
      <header className="topbar">
        <NavLink to="/app" className="logo">
          <span className="logo-mark">❤</span>
          <span className="logo-text">natthesisa</span>
        </NavLink>
        <span className="spacer" />
        {user?.isPremium ? (
          <span className="pill pill-gold">👑 Gold</span>
        ) : (
          <NavLink to="/app/premium" className="pill pill-brand">
            <IconCrown width={13} height={13} /> Go Gold
          </NavLink>
        )}
        <NavLink to="/app/profile" className="icon-btn" title="Profile">
          {user?.fullName?.[0]?.toUpperCase() || "?"}
        </NavLink>
      </header>

      <main className="screen">
        <Outlet />
      </main>

      <TabBar />
      <CallOverlay />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Guest><Login /></Guest>} />
      <Route path="/register" element={<Guest><Register /></Guest>} />

      <Route
        path="/onboarding"
        element={
          <Protected>
            <Onboarding />
          </Protected>
        }
      />

      <Route
        path="/app"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<Discover />} />
        <Route path="status" element={<StatusPage />} />
        <Route path="matches" element={<Matches />} />
        <Route path="chat/:matchId" element={<Chat />} />
        <Route path="premium" element={<Premium />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin" element={<Admin />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
