# DebugLab - Backend API & Judge Server ⚙

The **Server** powers DebugLab's REST API endpoints, real-time WebSocket communications via Socket.IO, PostgreSQL relational database access, and multi-language code compilation and judge sandbox execution.

---

## 🛠 Tech Stack & Dependencies

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express 5
- **Database**: PostgreSQL (`pg` pool driver)
- **Real-Time**: Socket.IO 4
- **Auth & Security**: JWT (`jsonwebtoken`), Bcrypt, Helmet, Express Rate Limit, CORS
- **Execution & Sandbox**: Node process spawners (`child_process`), multi-language compiler integration (GCC/G++, Python 3, Java, Node.js)

---

## 📁 Folder Structure

```
server/
├── src/
│   ├── config/          # Centralized configuration (env parsing, CORS settings)
│   ├── controllers/     # API route handlers (Auth, Contest, Problem, Submission, User, Monitoring)
│   ├── db/              # Database initialization & SQL schema definitions (`schema.sql`)
│   ├── middleware/      # JWT auth guard, rate limiters, error handling
│   ├── routes/          # Express route definitions
│   ├── services/        # Judge code execution runners & language executors
│   └── index.js         # Express app & Socket.IO server setup
├── temp/                # Temporary directory for code sandbox builds & execution
├── .env.example         # Server environment variables reference
└── package.json
```

---

## ⚙ Environment & Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in database credentials, JWT secret, and origins:
   ```env
   PORT=5000
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=debuglab
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN=30d
   CLIENT_ORIGIN=http://localhost:5173
   ADMIN_ORIGIN=http://localhost:5174
   ```
3. Run dev server with auto-reload (Nodemon):
   ```bash
   npm run dev
   ```

---

## ⚖ Multi-Language Code Judge Sandbox

The judge runner evaluates participant submissions against problem test cases:
1. Receives code submission + target programming language.
2. Writes code into isolated temporary file in `server/temp/`.
3. Compiles code (if C/C++/Java) and executes process with input parameters.
4. Enforces hard execution timeouts to prevent infinite loops.
5. Truncates output to prevent memory overload.
6. Evaluates actual output against expected output test cases and records verdict (`ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `COMPILATION_ERROR`, `RUNTIME_ERROR`).
