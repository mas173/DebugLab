# DebugLab - Admin Dashboard 🛡

The **Admin Dashboard** is the administrative command center for DebugLab. It equips instructors and contest organizers with real-time controls over contest durations, problem creation, test case uploading, complaint ticketing, participant account generation, and system health monitoring.

---

## 🛠 Tech Stack

- **Framework**: React 19 + Vite 8
- **UI Components & Icons**: Tailwind CSS + Lucide React
- **Real-Time Control**: Socket.IO Client (`socket.io-client`)
- **HTTP Client**: Axios
- **Notifications**: React Hot Toast
- **Routing**: React Router DOM 7

---

## 📁 Folder Structure

```
admin/
├── src/
│   ├── components/      # Admin UI elements (Header, Sidebar, DurationModal)
│   ├── context/         # AuthContext & SocketContext
│   ├── pages/           # Admin Dashboard views (Dashboard, Problems, Complaints, Users)
│   ├── App.jsx          # Protected routing for admin roles
│   └── main.jsx         # Entry point
├── .env.example         # Admin environment variables template
└── package.json
```

---

## ⚙ Setup & Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Set backend API endpoint:
   ```env
   VITE_API_URL=http://localhost:5000
   ```
3. Start admin dashboard:
   ```bash
   npm run dev
   ```

---

## 🔑 Administrative Capabilities

- **Real-Time Duration Adjustment**: Live `+ Add` or `- Reduce` duration controls for active/paused contests without resetting state.
- **Problem Set Builder**: Add problem statements, input/output specifications, time limits, memory limits, and sample/hidden test cases.
- **Domain-Based User Management**: Filter, create, and manage `debug_users`, `buzzer_users`, and admin credentials. Bulk user CSV/JSON importer included.
- **Complaint Ticket Management**: Review participant bug complaints, inspect submitted code logs, and transition ticket status.
