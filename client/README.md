# DebugLab - Participant Client Portal 💻

The **Client Portal** is the participant-facing web application for DebugLab. It allows users to register, log into assigned contest domains (Debug / Buzzer), view problem statements, edit code with an offline-capable Monaco Editor, submit solutions, track real-time contest timers, and monitor live leaderboards.

---

## 🛠 Tech Stack

- **Framework**: React 19 + Vite 8
- **Editor**: Monaco Editor (`@monaco-editor/react`)
- **Styling**: Tailwind CSS + Lucide Icons
- **Real-Time Engine**: Socket.IO Client (`socket.io-client`)
- **HTTP Client**: Axios
- **Notifications**: React Hot Toast
- **Routing**: React Router DOM 7

---

## 📁 Folder Structure

```
client/
├── src/
│   ├── components/      # UI components (Navbar, Timer, Leaderboard, Editor)
│   ├── context/         # AuthContext & SocketContext providers
│   ├── pages/           # Page views (Login, ContestPage, LeaderboardPage)
│   ├── monacoInit.js    # Offline Monaco editor configuration & language support
│   ├── App.jsx          # Router & layout setup
│   └── main.jsx         # App entry point
├── .env.example         # Client environment variables reference
└── package.json
```

---

## ⚙ Setup & Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Configure the server backend API URL:
   ```env
   VITE_API_URL=http://localhost:5000
   ```
3. Run dev server:
   ```bash
   npm run dev
   ```

---

## 🌟 Key Features

- **Monaco Code Editor**: Configured for C, C++, Python, Java, and JavaScript with custom themes and offline monaco asset caching.
- **WebSocket Synchronization**: Wall-clock timer synchronization with server heartbeat via Socket.IO.
- **Responsive Layout**: Resizable code editor & problem description split panes.
