# Heyoo — Real-Time Chat App

A modern chat application with rooms and DMs, real-time messaging via Socket.IO, and a clean, theme-aware UI.

**Stack**: React (client) + Express/Socket.IO/MongoDB (server)

## Dependencies

### Client
- `react` 18
- `react-dom` 18
- `react-scripts` 5
- `socket.io-client` 4
- `axios`
- `lucide-react` (icons)
- `ajv`

### Server
- `express`
- `socket.io`
- `mongoose`
- `cors`
- `dotenv`
- `bcryptjs`
- `jsonwebtoken`
- `nodemon` (dev only)

## Prerequisites

- Windows
- Node.js (LTS recommended, 18+)
- npm (bundled with Node)
- MongoDB Community Server (running locally)

## Setup

### Server
From the project root:
```bash
cd server
npm install
```

Optional `.env` (defaults work):
```
MONGODB_URI=mongodb://localhost:27017/chatapp
CLIENT_ORIGIN=http://localhost:3000
PORT=5000
```

### Client
From the project root:
```bash
cd client
npm install
```

## Run (Windows)

### One-Click Launch
Double-click `start.bat` to start both server and client:
- Backend: http://localhost:5000
- Frontend: http://localhost:3000

### Manual Launch (Two Terminals)
**Terminal 1** — Backend:
```bash
cd server
npm run dev
```

**Terminal 2** — Frontend:
```bash
cd client
npm start
```

## File Structure

### Root
- **`start.bat`** — Windows launcher; starts server and client
- **`.gitignore`** — excludes node_modules, env, build outputs, and outdated docs

### `server/`
- **`server.js`** — Express + Socket.IO API and events, MongoDB models inline
  - Auth: `POST /api/auth/register`
  - Rooms: `GET /api/rooms`, `POST /api/rooms`, `POST /api/rooms/join`, rename/delete, search
  - Messages: `GET /api/messages/:room`, `POST /api/rooms/send-message`
  - DMs: direct messaging (socket + REST)
  - **Security**: room membership verified for fetching/sending; private rooms require admin approval
- **`package.json`** — scripts (`start`, `dev`) and dependencies
- **`models/`, `routes/`, `controllers/`** — placeholders for future structure

### `client/`
- **`package.json`** — scripts (`start`, `build`, `test`) and dependencies
- **`public/index.html`** — app shell
- **`src/`**
  - **`App.js`** — app shell, socket setup, room/DM loading
  - **`api.js`** — `API_BASE` configuration
  - **`index.js`** — React entry point
  - **`context/`**
    - `ChatContext.js` — global state (user, rooms, DMs, messages)
    - `ThemeContext.js`, `useTheme.js` — light/dark theme management
  - **`components/`**
    - `Header.js` — app bar ("Heyoo" branding)
    - `Sidebar.js` — rooms/DM list, search, create room
    - `ChatWindow.js` — chat UI; welcome screen if no room/DM selected
    - `CreateRoom.js`, `RoomDetails.js`, `UserProfile.js`, `Friends.js`, `UserMenu.js`, etc.
  - **`pages/`**
    - `LoginPage.js` — login/register UI
  - **`styles/`** — component CSS (light/dark aware)

## Troubleshooting

### MongoDB not running
Start it in a terminal: `mongod`

### Port 5000 in use
Stop existing Node processes or set a different `PORT` and update the client proxy.

### Access denied (403) on messages
Join the room first; private rooms need admin approval.

### Blank chat header
Expected for new accounts — join a room or open a DM.
