import bcrypt from 'bcrypt';
import * as db from '../db.js';

// Get all users (Admin only)
export async function getUsers(req, res) {
  try {
    const result = await db.query(
      `SELECT 
        u.id, 
        u.username, 
        u.role, 
        u.created_at,
        COALESCE(ps.is_online, FALSE) as is_online, 
        ps.last_active_at,
        p.title as current_problem_title, 
        p.order_index as current_problem_order
      FROM users u
      LEFT JOIN participant_status ps ON u.id = ps.participant_id
      LEFT JOIN problems p ON ps.current_problem_id = p.id
      ORDER BY u.created_at DESC`
    );
    return res.json({ users: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Internal server error fetching users.' });
  }
}

// Create a new user with hashed password (Admin only)
export async function createUser(req, res) {
  const { username, password, role } = req.body;

  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
  }
  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  const cleanUsername = username.trim();
  const cleanPassword = password.trim();
  const userRole = role === 'admin' ? 'admin' : 'participant';

  try {
    // Check if user already exists
    const existing = await db.query('SELECT id FROM users WHERE username = $1', [cleanUsername]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    // Hash the password securely with bcrypt
    const passwordHash = await bcrypt.hash(cleanPassword, 10);

    const newUserRes = await db.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
      [cleanUsername, passwordHash, userRole]
    );

    const newUser = newUserRes.rows[0];

    // If created role is participant, insert into participant_status
    if (userRole === 'participant') {
      await db.query(
        'INSERT INTO participant_status (participant_id, is_online) VALUES ($1, FALSE) ON CONFLICT DO NOTHING',
        [newUser.id]
      );
    }

    return res.status(201).json({ user: newUser, message: 'User created successfully.' });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Internal server error creating user.' });
  }
}

// Delete user by ID (Admin only)
export async function deleteUser(req, res) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  if (req.user && req.user.id === id) {
    return res.status(400).json({ error: 'You cannot delete your own admin account.' });
  }

  try {
    const existing = await db.query('SELECT id, username, role FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);

    return res.json({ message: `User ${existing.rows[0].username} deleted successfully.` });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ error: 'Internal server error deleting user.' });
  }
}

// Reset/Update password for a user (Admin only)
export async function updateUserPassword(req, res) {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || typeof newPassword !== 'string' || !newPassword.trim()) {
    return res.status(400).json({ error: 'New password is required.' });
  }

  try {
    const existing = await db.query('SELECT id, username FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const passwordHash = await bcrypt.hash(newPassword.trim(), 10);

    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, id]
    );

    return res.json({ message: `Password updated successfully for ${existing.rows[0].username}.` });
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json({ error: 'Internal server error updating password.' });
  }
}

