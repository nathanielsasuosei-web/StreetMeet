# natthesisa — website

The React + Vite front end: marketing landing page plus the full app experience in the
browser (discover, matches, chat, status, calls, premium, admin). It is also a PWA, so
Android offers "Install app".

```bash
npm install
npm run dev        # http://localhost:5173  (proxies /api to :5000)
npm run build      # production build into dist/
npm run preview    # serve the production build
```

## Structure

```
src/
  lib/api.js          every API call in one place
  lib/socket.js       Socket.IO client
  lib/webrtc.js       RTCPeerConnection helper
  state/              AuthContext, CallContext, ToastContext
  components/         Avatar, SwipeDeck, CallOverlay, StatusViewer, TabBar, icons
  pages/              Landing, Login, Register, Onboarding, Discover, Matches,
                      Chat, Status, Premium, Profile, Admin
  styles.css          the whole design system (change --brand to re-skin)
```

Environment: `VITE_API_URL` (only needed for the dev proxy target, default
`http://127.0.0.1:5000`). In production the site calls `/api` on its own origin, which
Vercel/Netlify proxy to the API.
