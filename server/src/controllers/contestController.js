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

// Get the currently active/paused/ready contest (Participant access)
export async function getActiveContest(req, res) {
  try {
    // Select the contest that is active, paused, or ready. Priority: active > paused > ready
    const result = await db.query(
      `SELECT id, title, description, status, start_time, duration_minutes, elapsed_seconds 
       FROM contests 
       WHERE status IN ('active', 'paused', 'ready') 
       ORDER BY 
         CASE status 
           WHEN 'active' THEN 1 
           WHEN 'paused' THEN 2 
           WHEN 'ready' THEN 3 
           ELSE 4 
         END, 
         created_at DESC 
       LIMIT 1`
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
      'INSERT INTO contests (title, description, duration_minutes, elapsed_seconds, status) VALUES ($1, $2, $3, 0, $4) RETURNING *',
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

    // Reject activation if another contest is already active or paused
    if (['active', 'paused'].includes(status)) {
      const activeCheck = await db.query(
        "SELECT id, title FROM contests WHERE status IN ('active', 'paused') AND id != $1 LIMIT 1",
        [id]
      );
      if (activeCheck.rows.length > 0) {
        return res.status(400).json({
          error: `Cannot activate/pause. Contest "${activeCheck.rows[0].title}" is currently active or paused. End or reset it first.`
        });
      }
    }

    let newElapsed = parseInt(currentContest.elapsed_seconds, 10) || 0;

    // If currently active and transitioning out of active (e.g. to paused or ended),
    // calculate actual seconds elapsed during this active run
    if (currentContest.status === 'active' && currentContest.start_time) {
      const now = new Date();
      const started = new Date(currentContest.start_time);
      const diffSecs = Math.max(0, Math.floor((now - started) / 1000));
      newElapsed += diffSecs;
    }

    let queryText = '';
    let params = [];

    if (status === 'active') {
      // If moving to active from draft/ready/ended, start fresh with 0 elapsed seconds
      if (['draft', 'ready', 'ended'].includes(currentContest.status)) {
        newElapsed = 0;
      }
      queryText = 'UPDATE contests SET status = $1, elapsed_seconds = $2, start_time = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *';
      params = [status, newElapsed, id];
    } else if (status === 'paused') {
      queryText = 'UPDATE contests SET status = $1, elapsed_seconds = $2, start_time = NULL WHERE id = $3 RETURNING *';
      params = [status, newElapsed, id];
    } else if (status === 'ended') {
      queryText = 'UPDATE contests SET status = $1, elapsed_seconds = $2, end_time = COALESCE(end_time, CURRENT_TIMESTAMP) WHERE id = $3 RETURNING *';
      params = [status, newElapsed, id];
    } else if (status === 'draft' || status === 'ready') {
      // Resetting to draft or ready wipes elapsed time & start_time
      queryText = 'UPDATE contests SET status = $1, elapsed_seconds = 0, start_time = NULL, end_time = NULL WHERE id = $2 RETURNING *';
      params = [status, id];
    }

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
        elapsedSeconds: updatedContest.elapsed_seconds,
      });
    }

    return res.json({ contest: updatedContest });
  } catch (error) {
    console.error('Error updating contest status:', error);
    return res.status(500).json({ error: 'Internal server error updating contest status.' });
  }
}

// Add extra duration (in minutes) to an ongoing or paused contest (Admin only)
export async function addContestTime(req, res) {
  const { id } = req.params;
  const { minutes } = req.body;

  const additionalMinutes = parseInt(minutes, 10);
  if (isNaN(additionalMinutes) || additionalMinutes <= 0) {
    return res.status(400).json({ error: 'Valid positive minutes value is required.' });
  }

  try {
    const check = await db.query('SELECT * FROM contests WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Contest not found.' });
    }

    const currentContest = check.rows[0];
    const newDuration = (currentContest.duration_minutes || 60) + additionalMinutes;

    const result = await db.query(
      'UPDATE contests SET duration_minutes = $1 WHERE id = $2 RETURNING *',
      [newDuration, id]
    );

    const updatedContest = result.rows[0];

    const io = req.app.get('io');
    if (io) {
      io.emit('contest_status_changed', {
        contestId: updatedContest.id,
        status: updatedContest.status,
        startTime: updatedContest.start_time,
        durationMinutes: updatedContest.duration_minutes,
        elapsedSeconds: updatedContest.elapsed_seconds,
      });
    }

    return res.json({
      contest: updatedContest,
      message: `Added ${additionalMinutes} minutes to contest duration.`
    });
  } catch (error) {
    console.error('Error adding contest time:', error);
    return res.status(500).json({ error: 'Internal server error adding contest time.' });
  }
}
