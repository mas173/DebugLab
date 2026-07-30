import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

import initializeDatabase from './dbInit.js';
import * as db from './db.js';

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  process.env.ADMIN_ORIGIN,
].filter(Boolean);

// Enable Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without Origin (Postman, curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

import authRoutes from './routes/authRoutes.js';
import contestRoutes from './routes/contestRoutes.js';
import problemRoutes from './routes/problemRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import monitoringRoutes from './routes/monitoringRoutes.js';
import userRoutes from './routes/userRoutes.js';

// Basic test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin/monitoring', monitoringRoutes);
app.use('/api/admin/users', userRoutes);

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const list = {};
  cookieHeader.split(';').forEach((c) => {
    const parts = c.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

// Socket.IO Authentication Middleware
io.use((socket, next) => {
  let token = null;

  // Prioritize token passed explicitly in auth payload or headers over shared cookies
  if (socket.handshake.auth && socket.handshake.auth.token) {
    const rawToken = socket.handshake.auth.token;
    if (rawToken.startsWith('Bearer ')) {
      token = rawToken.split(' ')[1];
    } else {
      token = rawToken;
    }
  } else if (socket.handshake.headers.authorization) {
    const parts = socket.handshake.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookies(cookieHeader);
    token = cookies.token;
  }

  if (!token) {
    return next();
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret_key_12345';
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next();
  }
});

// Track active connections per participant to avoid multi-tab race conditions
const activeConnections = new Map(); // userId -> Set of socketIds

// Real-Time Socket Connection Handling
io.on('connection', async (socket) => {
  console.log(`Socket connected: ${socket.id} (Authenticated: ${!!socket.user})`);

  // Mark participant online in database
  if (socket.user && socket.user.role === 'participant') {
    const userId = socket.user.id;
    if (!activeConnections.has(userId)) {
      activeConnections.set(userId, new Set());
    }
    activeConnections.get(userId).add(socket.id);

    // Only update DB and broadcast ONCE (when the first tab connects)
    if (activeConnections.get(userId).size === 1) {
      try {
        await db.query(
          "UPDATE participant_status SET is_online = TRUE, last_active_at = CURRENT_TIMESTAMP WHERE participant_id = $1",
          [userId]
        );
        // Broadcast online status change to admin room
        io.to('admin_room').emit('participant_status_changed', {
          id: userId,
          username: socket.user.username,
          is_online: true
        });
      } catch (err) {
        console.error('Error marking participant online:', err);
      }
    }
  }

  socket.on('join_contest', (contestId) => {
    socket.join(`contest_${contestId}`);
    console.log(`Socket ${socket.id} joined contest_${contestId}`);
  });

  socket.on('join_admin', () => {
    socket.join('admin_room');
    console.log(`Socket ${socket.id} joined admin_room`);
  });

  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`);

    // Mark participant offline in database
    if (socket.user && socket.user.role === 'participant') {
      const userId = socket.user.id;
      let shouldMarkOffline = false;

      if (activeConnections.has(userId)) {
        activeConnections.get(userId).delete(socket.id);
        if (activeConnections.get(userId).size === 0) {
          activeConnections.delete(userId);
          shouldMarkOffline = true;
        }
      } else {
        shouldMarkOffline = true;
      }

      if (shouldMarkOffline) {
        try {
          await db.query(
            "UPDATE participant_status SET is_online = FALSE, last_active_at = CURRENT_TIMESTAMP WHERE participant_id = $1",
            [userId]
          );
          // Broadcast offline status change to admin room
          io.to('admin_room').emit('participant_status_changed', {
            id: userId,
            username: socket.user.username,
            is_online: false
          });
        } catch (err) {
          console.error('Error marking participant offline:', err);
        }
      }
    }
  });
});

// Start Server after Database Initialization
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Run database migrations/seeding
    await initializeDatabase();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Could not start server:', error);
    process.exit(1);
  }
}

// Share Socket.IO instance globally
app.set('io', io);

startServer();
