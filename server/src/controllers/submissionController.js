import * as db from '../db.js';
import { judgeSubmission } from '../services/judgeService.js';

// Simple in-memory queue to serialize code judging and prevent CPU/RAM exhaustion
const queue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const task = queue.shift();
  const { submissionId, sourceCode, problemId, timeLimitMs, memoryLimitKb, resolve, reject } = task;

  try {
    console.log(`[Queue] Processing submission ${submissionId}...`);
    
    // Update status to compiling
    await db.query(
      "UPDATE submissions SET status = 'compiling' WHERE id = $1",
      [submissionId]
    );

    // Call the judge service
    const verdict = await judgeSubmission(submissionId, sourceCode, problemId, timeLimitMs, memoryLimitKb);
    
    console.log(`[Queue] Judge finished for ${submissionId} with status: ${verdict.status}`);

    // Update submission record in DB
    const updateResult = await db.query(
      `UPDATE submissions 
       SET status = $1, compile_error_log = $2, passed_test_cases = $3, total_test_cases = $4, execution_time_ms = $5
       WHERE id = $6 RETURNING *`,
      [
        verdict.status,
        verdict.compileErrorLog,
        verdict.passedCases,
        verdict.totalCases,
        verdict.timeMs,
        submissionId
      ]
    );

    const savedSubmission = updateResult.rows[0];

    // If accepted, check unlocking logic
    if (verdict.status === 'accepted') {
      const participantId = savedSubmission.participant_id;

      // Get current problem index details
      const problemCheck = await db.query('SELECT contest_id, order_index FROM problems WHERE id = $1', [problemId]);
      if (problemCheck.rows.length > 0) {
        const { contest_id, order_index } = problemCheck.rows[0];

        // Fetch user's current status
        const statusCheck = await db.query(
          'SELECT current_problem_id FROM participant_status WHERE participant_id = $1',
          [participantId]
        );

        if (statusCheck.rows.length > 0 && statusCheck.rows[0].current_problem_id === problemId) {
          // Find next problem
          const nextProblemResult = await db.query(
            'SELECT id, title FROM problems WHERE contest_id = $1 AND order_index > $2 ORDER BY order_index ASC LIMIT 1',
            [contest_id, order_index]
          );

          if (nextProblemResult.rows.length > 0) {
            const nextProblem = nextProblemResult.rows[0];
            await db.query(
              'UPDATE participant_status SET current_problem_id = $1 WHERE participant_id = $2',
              [nextProblem.id, participantId]
            );
            console.log(`[Unlock] Unlocked problem "${nextProblem.title}" for participant ${participantId}`);
          } else {
            // No next problem, user finished the contest
            await db.query(
              'UPDATE participant_status SET current_problem_id = NULL WHERE participant_id = $2',
              [participantId]
            );
            console.log(`[Unlock] Participant ${participantId} finished all contest problems!`);
          }
        }
      }
    }

    resolve(savedSubmission);
  } catch (error) {
    console.error(`[Queue] Error processing submission ${submissionId}:`, error);
    // Mark as runtime error/failed
    await db.query(
      "UPDATE submissions SET status = 'runtime_error', compile_error_log = $1 WHERE id = $2",
      [`Judge Engine internal failure: ${error.message}`, submissionId]
    );
    reject(error);
  } finally {
    isProcessing = false;
    // Process next item
    setTimeout(processQueue, 50);
  }
}

function enqueueSubmission(task) {
  return new Promise((resolve, reject) => {
    queue.push({ ...task, resolve, reject });
    processQueue();
  });
}

// --- CONTROLLER HANDLERS ---

// Create code submission
export async function createSubmission(req, res) {
  const participantId = req.user.id;
  const { problemId, sourceCode } = req.body;

  if (!problemId || !sourceCode) {
    return res.status(400).json({ error: 'Required fields: problemId, sourceCode.' });
  }

  try {
    // 1. Verify contest is active
    const problemCheck = await db.query(
      `SELECT p.*, c.status as contest_status 
       FROM problems p 
       JOIN contests c ON p.contest_id = c.id 
       WHERE p.id = $1`,
      [problemId]
    );

    if (problemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Problem not found.' });
    }

    const problem = problemCheck.rows[0];
    if (problem.contest_status !== 'active') {
      return res.status(403).json({ error: 'Submissions are blocked. Contest is not active.' });
    }

    // 2. Create database record
    const insertResult = await db.query(
      `INSERT INTO submissions (participant_id, problem_id, source_code, status) 
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [participantId, problemId, sourceCode]
    );
    const submission = insertResult.rows[0];

    // 3. Enqueue grading task
    console.log(`[Submit] Enqueuing submission ${submission.id}...`);
    const gradedSubmission = await enqueueSubmission({
      submissionId: submission.id,
      sourceCode,
      problemId,
      timeLimitMs: problem.time_limit_ms,
      memoryLimitKb: problem.memory_limit_kb
    });

    // 4. Trigger socket updates
    const io = req.app.get('io');
    if (io) {
      // Broadcast to admin room for monitoring
      io.to('admin_room').emit('submission_evaluated', {
        id: gradedSubmission.id,
        participant_id: gradedSubmission.participant_id,
        username: req.user.username,
        problem_id: gradedSubmission.problem_id,
        problem_title: problem.title,
        status: gradedSubmission.status,
        passed_cases: gradedSubmission.passed_test_cases,
        total_cases: gradedSubmission.total_test_cases,
        execution_time_ms: gradedSubmission.execution_time_ms,
        submitted_at: gradedSubmission.submitted_at
      });

      // Broadcast leaderboard updates (will be processed in Phase 7)
      io.emit('leaderboard_dirty');
    }

    return res.json({ submission: gradedSubmission });

  } catch (error) {
    console.error('Error creating submission:', error);
    return res.status(500).json({ error: 'Internal server error processing submission.' });
  }
}

// Get participant submission history (limited to self unless Admin)
export async function getSubmissionHistory(req, res) {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { problemId } = req.query;

  try {
    let queryText = `
      SELECT s.*, p.title as problem_title, u.username 
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      JOIN users u ON s.participant_id = u.id
    `;
    const params = [];

    if (userRole === 'participant') {
      queryText += ' WHERE s.participant_id = $1';
      params.push(userId);
      
      if (problemId) {
        queryText += ' AND s.problem_id = $2';
        params.push(problemId);
      }
    } else {
      // Admin can view all
      if (problemId) {
        queryText += ' WHERE s.problem_id = $1';
        params.push(problemId);
      }
    }

    queryText += ' ORDER BY s.submitted_at DESC';
    const result = await db.query(queryText, params);
    return res.json({ submissions: result.rows });
  } catch (error) {
    console.error('Error fetching submissions history:', error);
    return res.status(500).json({ error: 'Internal server error fetching submission history.' });
  }
}
