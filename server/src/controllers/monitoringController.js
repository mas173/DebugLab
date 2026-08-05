import * as db from '../db.js';

// Get overall system/contest stats (Admin only)
export async function getSystemStats(req, res) {
  const { contestId } = req.query;
  
  try {
    // Total participants
    const totalUsersRes = await db.query(
      "SELECT COUNT(*)::integer as count FROM users WHERE role = 'participant'"
    );
    const totalParticipants = totalUsersRes.rows[0].count;

    // Online participants
    const onlineUsersRes = await db.query(
      "SELECT COUNT(*)::integer as count FROM participant_status WHERE is_online = TRUE"
    );
    const onlineParticipants = onlineUsersRes.rows[0].count;

    // Total submissions
    let totalSubmissionsQuery = "SELECT COUNT(*)::integer as count FROM submissions";
    let totalSubmissionsParams = [];
    if (contestId) {
      totalSubmissionsQuery = "SELECT COUNT(*)::integer as count FROM submissions s JOIN problems p ON s.problem_id = p.id WHERE p.contest_id = $1";
      totalSubmissionsParams = [contestId];
    }
    const totalSubmissionsRes = await db.query(totalSubmissionsQuery, totalSubmissionsParams);
    const totalSubmissions = totalSubmissionsRes.rows[0].count;

    // Submissions breakdown
    let breakdownQuery = "SELECT status, COUNT(*)::integer as count FROM submissions GROUP BY status";
    let breakdownParams = [];
    if (contestId) {
      breakdownQuery = "SELECT s.status, COUNT(*)::integer as count FROM submissions s JOIN problems p ON s.problem_id = p.id WHERE p.contest_id = $1 GROUP BY s.status";
      breakdownParams = [contestId];
    }
    const breakdownRes = await db.query(breakdownQuery, breakdownParams);
    const breakdown = breakdownRes.rows.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});

    return res.json({
      stats: {
        totalParticipants,
        onlineParticipants,
        totalSubmissions,
        breakdown
      }
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    return res.status(500).json({ error: 'Internal server error fetching system stats.' });
  }
}

// Get all participant activity list (Admin only)
export async function getParticipantsActivity(req, res) {
  try {
    const queryText = `
      SELECT 
        u.id, 
        u.username, 
        COALESCE(ps.is_online, FALSE) as is_online, 
        ps.last_active_at,
        p.title as current_problem_title, 
        p.order_index as current_problem_order
      FROM users u
      LEFT JOIN participant_status ps ON u.id = ps.participant_id
      LEFT JOIN problems p ON ps.current_problem_id = p.id
      WHERE u.role = 'participant'
      ORDER BY u.username ASC
    `;
    const result = await db.query(queryText);
    return res.json({ participants: result.rows });
  } catch (error) {
    console.error('Error fetching participants activity:', error);
    return res.status(500).json({ error: 'Internal server error fetching participants activity.' });
  }
}

// Get live code drafts for a specific participant (Admin only)
export async function getParticipantDrafts(req, res) {
  const { id } = req.params;

  try {
    const result = await db.query(
      "SELECT draft_code FROM participant_status WHERE participant_id = $1",
      [id]
    );

    const draftCode = result.rows.length > 0 ? result.rows[0].draft_code : {};
    return res.json({ draftCode });
  } catch (error) {
    console.error('Error fetching participant drafts:', error);
    return res.status(500).json({ error: 'Internal server error fetching drafts.' });
  }
}
