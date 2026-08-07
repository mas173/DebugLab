import * as db from '../db.js';

export async function getLeaderboard(req, res) {
  const { contestId } = req.query;

  try {
    let targetContestId = contestId;

    // If contestId is not provided, default to the active/paused contest if one exists
    if (!targetContestId) {
      const activeContestRes = await db.query(
        "SELECT id FROM contests WHERE status IN ('active', 'paused') ORDER BY start_time DESC LIMIT 1"
      );
      if (activeContestRes.rows.length > 0) {
        targetContestId = activeContestRes.rows[0].id;
      }
    }

    if (!targetContestId) {
      return res.json({ leaderboard: [], contestId: null });
    }

    let queryText = `
      WITH distinct_solved AS (
        SELECT 
          s.participant_id,
          s.problem_id,
          p.points,
          MIN(s.submitted_at) as first_accepted_at
        FROM submissions s
        JOIN problems p ON s.problem_id = p.id
        WHERE s.status = 'accepted'
    `;

    const queryParams = [];
    if (targetContestId) {
      queryParams.push(targetContestId);
      queryText += ` AND p.contest_id = $${queryParams.length}`;
    }

    queryText += `
        GROUP BY s.participant_id, s.problem_id, p.points
      )
      SELECT 
        u.id as participant_id,
        u.username,
        COALESCE(COUNT(ds.problem_id), 0)::integer as problems_solved,
        COALESCE(SUM(ds.points), 0)::integer as score,
        MAX(ds.first_accepted_at) as last_accepted_time
      FROM users u
      LEFT JOIN distinct_solved ds ON u.id = ds.participant_id
      WHERE u.role = 'participant'
      GROUP BY u.id, u.username
      ORDER BY 
        score DESC, 
        problems_solved DESC, 
        last_accepted_time ASC NULLS LAST, 
        u.username ASC
    `;

    const result = await db.query(queryText, queryParams);
    
    // Assign ranks based on calculated order
    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      ...row
    }));

    return res.json({ leaderboard, contestId: targetContestId || null });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({ error: 'Internal server error fetching leaderboard.' });
  }
}
