# VS Code setup

Everything here is already committed in the repository — open
`natthesisa.code-workspace` and VS Code will pick it up.

---

## 1. Open the workspace

```bash
cd natthesisa
code natthesisa.code-workspace
```

Why a workspace and not just the folder: one window, three projects (`backend`, `web`,
`mobile`), each with its own terminal and settings — but shared extensions and tasks.

## 2. Install the recommended extensions

VS Code will show a pop-up: **"Do you want to install the recommended extensions?"** →
**Install all**. Or from the terminal:

```bash
code --install-extension esbenp.prettier-vscode dbaeumer.vscode-eslint expo.vscode-expo-tools humao.rest-client eamodio.gitlens ms-vscode.vscode-node-debug
```

| Extension | What it does for you |
| --- | --- |
| Prettier | Formats code on save — no more style arguments |
| ESLint | Underlines bugs while you type |
| Expo Tools | Debug the mobile app from VS Code |
| REST Client | Send HTTP requests from a `.http` file (see below) |
| GitLens | Inline "who changed this line and when" |

## 3. Settings that are already applied

`.vscode/settings.json`:

- **Format on save** with Prettier
- **80-character ruler**, 2-space tabs, LF line endings (fixes Windows/Linux mix-ups)
- Search ignores `node_modules`, `dist`, `.git`
- Files are trimmed of trailing whitespace on save
- `editor.stickyScroll`, bracket pair colouring and auto-imports on

## 4. Run everything with one shortcut

`Ctrl/Cmd + Shift + B` → **Run All (API + Web)** starts both dev servers in split terminals.

Tasks (`.vscode/tasks.json`):

| Task | Command |
| --- | --- |
| Run API | `npm run dev` in `backend/` |
| Run Web | `npm run dev` in `web/` |
| Run Mobile | `npm start` in `mobile/` |
| DB: migrate | `npm run db:migrate` |
| DB: studio | `npm run db:studio` |
| DB: seed | `npm run seed` |
| Build web | `npm run build` |

## 5. Debugging

Press **F5** and pick:

- **Debug API** — launches `backend/src/server.js` with the inspector attached; breakpoints
  in controllers work.
- **Attach to API** — attaches to a running nodemon process on port 9229
  (start it with `npm run dev:debug`).

Put a red dot next to a line in `backend/src/controllers/payments.controller.js`, press F5,
initiate a payment — execution stops and you can inspect `req.body`, `plan`, `result`.

## 6. Testing the API without leaving the editor

Create `backend/api.http` (git-ignored) and use the **REST Client** extension:

```http
@base = http://localhost:5000
@token = paste-your-jwt-here

### Register
POST {{base}}/api/auth/register
Content-Type: application/json

{ "fullName": "Ama", "email": "ama@example.com", "password": "natthesisa", "gender": "FEMALE" }

### Discover feed
GET {{base}}/api/discover/feed?limit=5
Authorization: Bearer {{token}}

### Plans
GET {{base}}/api/payments/plans
```

Click **Send Request** above each block.

## 7. Handy shortcuts

| Shortcut | Action |
| --- | --- |
| `` Ctrl+` `` | Toggle terminal |
| `Ctrl+Shift+B` | Run build task (all dev servers) |
| `F5` | Start debugging |
| `Ctrl+P` | Quick file open (type the file name) |
| `Ctrl+Shift+F` | Search across all three projects |
| `Ctrl+Shift+E` | Explorer |
| `Alt+Click` | Multiple cursors |

## 8. Recommended layout while developing

```
┌───────────────────────────────────────────────┬──────────────────┐
│ Editor: web/src/pages/Discover.jsx            │ Browser preview  │
│                                               │ localhost:5173   │
├───────────────────────────────────────────────┴──────────────────┤
│ TERMINAL: backend (nodemon)   │ TERMINAL: web (vite)  │ PROBLEMS  │
└──────────────────────────────────────────────────────────────────┘
```

Right-click the terminal tab → **Split Terminal** to see both servers at once.
