import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as db from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret_key_12345';
const NODE_ENV = process.env.NODE_ENV || 'development';

export async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      token, // Also send token for clients preferring headers
    });
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
}

export async function logout(req, res) {
  if (req.user && req.user.role === 'participant') {
    try {
      await db.query(
        "UPDATE participant_status SET is_online = FALSE, last_active_at = CURRENT_TIMESTAMP WHERE participant_id = $1",
        [req.user.id]
      );
      
      const io = req.app.get('io');
      if (io) {
        io.to('admin_room').emit('participant_status_changed', {
          id: req.user.id,
          username: req.user.username,
          is_online: false
        });
      }
    } catch (err) {
      console.error('Error setting offline during logout:', err);
    }
  }

  res.clearCookie('token');
  return res.json({ message: 'Logout successful.' });
}

export async function getMe(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  return res.json({ user: req.user });
}

export async function updateSelfPassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || !newPassword.trim()) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  try {
    const userRes = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const user = userRes.rows[0];
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword.trim(), 10);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Error updating self password:', error);
    return res.status(500).json({ error: 'Internal server error updating password.' });
  }
}
