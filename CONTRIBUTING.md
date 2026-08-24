# Contributing to DebugLab 🤝

Thank you for your interest in contributing to **DebugLab**! We welcome contributions from developers, designers, open-source enthusiasts, and competitive programmers. 

This document outlines guidelines, code conventions, workflow steps, and best practices to make contributing as smooth as possible.

---

## 📜 Code of Conduct

We are committed to providing a welcoming, inclusive, and respectful community for everyone.
- Treat fellow contributors with kindness, empathy, and respect.
- Provide constructive feedback on pull requests and code reviews.
- Focus on what is best for the project and community.

---

## 🚀 How Can I Contribute?

### 1. Reporting Bugs 🐛
If you encounter a bug or unexpected behavior:
- Check existing [GitHub Issues](https://github.com/mas173/DebugLab/issues) to avoid duplicate reports.
- If not reported, open a new issue using the **Bug Report** format.
- Include details:
  - **Operating System** & Browser version.
  - **Steps to reproduce** the bug.
  - **Expected vs Actual behavior**.
  - Terminal logs, error stack traces, or screenshots if applicable.

### 2. Suggesting Features 💡
Enhancements and feature requests are always welcome!
- Search existing issues to confirm it hasn't been proposed yet.
- Clearly describe the use case, why the feature is beneficial, and how it should work.

### 3. Submitting Code (Pull Requests) 🛠
Whether fixing typos in documentation or building major backend features, we welcome PRs!

---

## 🛠 Development Workflow

### Step 1: Fork & Clone
1. **Fork** the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/debuglab.git
   cd debuglab
   ```

### Step 2: Set Up Environment
Install all workspace dependencies and configure `.env` files:
```bash
npm install
cd client && npm install && cd ..
cd admin && npm install && cd ..
cd server && npm install && cd ..

# Setup environment templates
cp client/.env.example client/.env
cp admin/.env.example admin/.env
cp server/.env.example server/.env
```

### Step 3: Create a Feature Branch
Use descriptive branch names with appropriate prefixes:
- `feat/name-of-feature` (new features)
- `fix/description-of-fix` (bug fixes)
- `docs/updating-readme` (documentation changes)
- `refactor/clean-up-code` (code refactoring)
- `test/add-unit-tests` (adding/updating tests)

```bash
git checkout -b feat/add-contest-timer-alert
```

### Step 4: Make Changes & Test
- Run `npm run dev` in the root workspace to run the server, client, and admin applications simultaneously.
- Test your changes thoroughly across participant client, admin panel, and backend server endpoints.
- Ensure linting passes without errors (`npm run lint` in client/admin).

### Step 5: Commit Changes
Follow clear, concise, conventional commit message formats:
```bash
# Examples:
git commit -m "feat(client): add real-time sound notification on contest submission"
git commit -m "fix(server): resolve race condition in contest duration reduction controller"
git commit -m "docs: update API route table in README.md"
```

### Step 6: Push & Open a Pull Request
1. Push your branch to your GitHub fork:
   ```bash
   git push origin feat/add-contest-timer-alert
   ```
2. Go to the original **DebugLab** repository on GitHub.
3. Click **New Pull Request**.
4. Fill out the PR template:
   - Explain the purpose of your changes.
   - Mention any related issue numbers (e.g. `Fixes #42`).
   - Include screenshots or GIFs for UI/UX modifications.

---

## 🎨 Coding & Architectural Standards

- **JavaScript / React**:
  - Follow modern ES6+ syntax and functional React components with Hooks.
  - Keep components modular, focused, and reusable.
  - Avoid inline CSS where reusable utility classes or design system variables exist.
- **Node.js / Express Backend**:
  - Keep controllers lean; delegate judge code execution logic to `src/services/`.
  - Maintain parameterized SQL queries when interacting with PostgreSQL to prevent SQL injection vulnerabilities.
  - Always validate request bodies and parameters using middleware.
- **Environment & Secrets Security**:
  - Never commit credentials, private keys, database passwords, or `.env` files.
  - Use `.env.example` to declare new environment variable keys when adding new features.

---

## 🔒 Security Vulnerabilities

If you discover a security vulnerability within DebugLab, please **do not open a public issue**. Instead, send a private security email to the project maintainers or open a draft security advisory on GitHub.

---

Thank you for helping make DebugLab better for everyone! 🎉
