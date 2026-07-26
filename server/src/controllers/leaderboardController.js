import * as db from '../db.js';

export async function getLeaderboard(req, res) {
  try {
    const queryText = `
      SELECT 
        u.id as participant_id,
        u.username,
        COALESCE(COUNT(DISTINCT s.problem_id), 0)::integer as problems_solved,
        COALESCE(SUM(p.points), 0)::integer as score,
        MAX(s.submitted_at) as last_accepted_time
      FROM users u
      LEFT JOIN submissions s ON u.id = s.participant_id AND s.status = 'accepted'
      LEFT JOIN problems p ON s.problem_id = p.id
      WHERE u.role = 'participant'
      GROUP BY u.id, u.username
      ORDER BY score DESC, problems_solved DESC, last_accepted_time ASC NULLS LAST, u.username ASC
    `;
    const result = await db.query(queryText);
    
    // Assign ranks, handling ties if necessary
    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      ...row
    }));

    return res.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({ error: 'Internal server error fetching leaderboard.' });
  }
}
