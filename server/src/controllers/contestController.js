import * as db from '../db.js';

// Get all contests (Admin only)
export async function getAllContests(req, res) {
  try {
    const result = await db.query('SELECT * FROM contests ORDER BY created_at DESC');
    return res.json({ contests: result.rows });
  } catch (error) {
    console.error('Error fetching contests:', error);
    return res.status(500).json({ error: 'Internal server error fetching contests.' });
  }
}

// Get the currently active/paused contest (Participant access)
export async function getActiveContest(req, res) {
  try {
    // Select the contest that is active or paused. If multiple, get the most recent active one
    const result = await db.query(
      "SELECT id, title, description, status, start_time, duration_minutes FROM contests WHERE status IN ('active', 'paused') ORDER BY start_time DESC LIMIT 1"
    );
    if (result.rows.length === 0) {
      return res.json({ contest: null });
    }
    return res.json({ contest: result.rows[0] });
  } catch (error) {
    console.error('Error fetching active contest:', error);
    return res.status(500).json({ error: 'Internal server error fetching active contest.' });
  }
}

// Create a new contest (Admin only)
export async function createContest(req, res) {
  const { title, description, duration_minutes } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Contest title is required.' });
  }

  const duration = duration_minutes ? parseInt(duration_minutes, 10) : 60;

  try {
    const result = await db.query(
      'INSERT INTO contests (title, description, duration_minutes, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description, duration, 'draft']
    );
    return res.status(201).json({ contest: result.rows[0] });
  } catch (error) {
    console.error('Error creating contest:', error);
    return res.status(500).json({ error: 'Internal server error creating contest.' });
  }
}

// Update a contest (Admin only)
export async function updateContest(req, res) {
  const { id } = req.params;
  const { title, description, duration_minutes } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Contest title is required.' });
  }

  try {
    const check = await db.query('SELECT * FROM contests WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Contest not found.' });
    }

    const duration = duration_minutes ? parseInt(duration_minutes, 10) : check.rows[0].duration_minutes;

    const result = await db.query(
      'UPDATE contests SET title = $1, description = $2, duration_minutes = $3 WHERE id = $4 RETURNING *',
      [title, description, duration, id]
    );

    return res.json({ contest: result.rows[0] });
  } catch (error) {
    console.error('Error updating contest:', error);
    return res.status(500).json({ error: 'Internal server error updating contest.' });
  }
}

// Delete a contest (Admin only)
export async function deleteContest(req, res) {
  const { id } = req.params;

  try {
    const check = await db.query('SELECT * FROM contests WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Contest not found.' });
    }

    await db.query('DELETE FROM contests WHERE id = $1', [id]);
    return res.json({ message: 'Contest deleted successfully.' });
  } catch (error) {
    console.error('Error deleting contest:', error);
    return res.status(500).json({ error: 'Internal server error deleting contest.' });
  }
}

// Update contest status (Admin only, broadcasts real-time lifecycle status shifts)
export async function updateContestStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['draft', 'ready', 'active', 'paused', 'ended'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid contest status.' });
  }

  try {
    const check = await db.query('SELECT * FROM contests WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Contest not found.' });
    }

    const currentContest = check.rows[0];
    let queryText = 'UPDATE contests SET status = $1 ';
    const params = [status, id];

    // If starting the contest for the first time, record the start time
    if (status === 'active' && !currentContest.start_time) {
      queryText += ', start_time = CURRENT_TIMESTAMP ';
    }
    
    // If ending the contest, record end time
    if (status === 'ended' && !currentContest.end_time) {
      queryText += ', end_time = CURRENT_TIMESTAMP ';
    }

    queryText += 'WHERE id = $2 RETURNING *';

    const result = await db.query(queryText, params);
    const updatedContest = result.rows[0];

    // Retrieve Socket.IO instance and broadcast changes to all clients
    const io = req.app.get('io');
    if (io) {
      io.emit('contest_status_changed', {
        contestId: updatedContest.id,
        status: updatedContest.status,
        startTime: updatedContest.start_time,
        durationMinutes: updatedContest.duration_minutes,
      });
    }

    return res.json({ contest: updatedContest });
  } catch (error) {
    console.error('Error updating contest status:', error);
    return res.status(500).json({ error: 'Internal server error updating contest status.' });
  }
}
