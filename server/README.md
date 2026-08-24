# DebugLab - Backend API & Judge Server ⚙

The **Server** powers DebugLab's REST API endpoints, real-time WebSocket communications via Socket.IO, PostgreSQL relational database access, and multi-language code compilation and judge sandbox execution.

---

## 🛠 Tech Stack & Dependencies

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express 5
- **Database**: PostgreSQL (`pg` pool driver)
- **Real-Time**: Socket.IO 4
- **Auth & Security**: JWT (`jsonwebtoken`), Bcrypt, Helmet, Express Rate Limit, CORS
- **Execution & Sandbox**: Docker (`alpine` container runner), Node process spawners (`child_process`), multi-language compiler integration (GCC/G++, Python 3, Java, Node.js)

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
├── bulk_import_users.js # Bulk user import script
├── users.txt            # Username input file for bulk import
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

## 🐳 Docker Code Judge Sandbox

The judge runner (`src/services/judgeService.js`) evaluates participant submissions against problem test cases in an isolated Docker sandbox environment:

1. **Submission Reception**: Accepts source code submission + target language (C, C++, Python, Java, JavaScript).
2. **Temporary File Setup**: Writes code into an isolated file inside `server/temp/`.
3. **Containerized Execution**: Runs compilation/execution commands inside a spawned **Docker container** (`alpine` image):
   - `--memory=256m`: Restricts container RAM usage.
   - `--pids-limit=64`: Prevents thread or process fork bombs.
   - `--security-opt=no-new-privileges:true`: Restricts privilege escalation.
   - `--rm`: Ensures containers are immediately purged after execution.
4. **Native Host Fallback**: If Docker daemon is unavailable, uninstalled, or fails to spawn, `judgeService.js` catches the error and gracefully falls back to native host binary execution.
5. **Verdict Evaluation**: Compares stdout against test case expected output and records verdict (`ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `COMPILATION_ERROR`, `RUNTIME_ERROR`).

Make sure Docker is installed and pull the required image:
```bash
docker pull alpine
```

---

## 👥 Bulk User Import Script (`bulk_import_users.js`)

DebugLab provides a standalone CLI script to batch-import student/participant user accounts into PostgreSQL.

### Usage:
1. List target usernames (one per line) in `server/users.txt`:
   ```txt
   USER-101
   USER-102
   USER-103
   ```
2. Execute the import script:
   ```bash
   npm run import-users
   ```

### Implementation & Security Details:
- **Default Credentials**: Sets initial password to `user1234` for all imported accounts.
- **Bcrypt Hash Optimization**: Pre-computes the bcrypt password hash **once** before entering the loop, preventing excessive CPU consumption during mass imports.
- **Transaction Atomicity**: Encapsulated within PostgreSQL `BEGIN` / `COMMIT` / `ROLLBACK` blocks.
- **Duplicate Prevention**: Queries existing database entries and skips already registered usernames with a warning log.
- **Status Record Provisioning**: Automatically populates corresponding entries in the `participant_status` table for every created user.
