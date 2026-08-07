import * as db from '../db.js';
import { runCode } from '../services/judgeService.js';

// --- PROBLEMS ADMIN ACTIONS ---

// Get all problems for a contest (detailed, for Admin)
export async function getContestProblemsAdmin(req, res) {
  const { contestId } = req.query;
  if (!contestId) {
    return res.status(400).json({ error: 'contestId is required.' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM problems WHERE contest_id = $1 ORDER BY order_index ASC',
      [contestId]
    );
    return res.json({ problems: result.rows });
  } catch (error) {
    console.error('Error fetching admin problems:', error);
    return res.status(500).json({ error: 'Internal server error fetching problems.' });
  }
}

// Create a new problem (Admin only)
export async function createProblem(req, res) {
  const {
    contest_id,
    title,
    description,
    starter_code,
    order_index,
    time_limit_ms,
    memory_limit_kb,
    points,
  } = req.body;

  if (!contest_id || !title || !description || !starter_code) {
    return res.status(400).json({ error: 'Required fields: contest_id, title, description, starter_code.' });
  }

  const orderIndex = order_index !== undefined ? parseInt(order_index, 10) : 0;
  const timeLimit = time_limit_ms ? parseInt(time_limit_ms, 10) : 2000;
  const memoryLimit = memory_limit_kb ? parseInt(memory_limit_kb, 10) : 128000;
  const pts = points ? parseInt(points, 10) : 100;

  try {
    const result = await db.query(
      `INSERT INTO problems (contest_id, title, description, starter_code, order_index, time_limit_ms, memory_limit_kb, points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [contest_id, title, description, starter_code, orderIndex, timeLimit, memoryLimit, pts]
    );
    return res.status(201).json({ problem: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') { // unique constraint violation
      return res.status(400).json({ error: 'A problem with this order index already exists in this contest.' });
    }
    console.error('Error creating problem:', error);
    return res.status(500).json({ error: 'Internal server error creating problem.' });
  }
}

// Update a problem (Admin only)
export async function updateProblem(req, res) {
  const { id } = req.params;
  const {
    title,
    description,
    starter_code,
    order_index,
    time_limit_ms,
    memory_limit_kb,
    points,
  } = req.body;

  try {
    const check = await db.query('SELECT * FROM problems WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Problem not found.' });
    }

    const current = check.rows[0];
    const newTitle = title || current.title;
    const newDesc = description || current.description;
    const newCode = starter_code || current.starter_code;
    const newOrder = order_index !== undefined ? parseInt(order_index, 10) : current.order_index;
    const newTime = time_limit_ms ? parseInt(time_limit_ms, 10) : current.time_limit_ms;
    const newMemory = memory_limit_kb ? parseInt(memory_limit_kb, 10) : current.memory_limit_kb;
    const newPoints = points ? parseInt(points, 10) : current.points;

    const result = await db.query(
      `UPDATE problems 
       SET title = $1, description = $2, starter_code = $3, order_index = $4, time_limit_ms = $5, memory_limit_kb = $6, points = $7
       WHERE id = $8 RETURNING *`,
      [newTitle, newDesc, newCode, newOrder, newTime, newMemory, newPoints, id]
    );

    return res.json({ problem: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A problem with this order index already exists in this contest.' });
    }
    console.error('Error updating problem:', error);
    return res.status(500).json({ error: 'Internal server error updating problem.' });
  }
}

// Delete a problem (Admin only)
export async function deleteProblem(req, res) {
  const { id } = req.params;

  try {
    const check = await db.query('SELECT * FROM problems WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Problem not found.' });
    }

    await db.query('DELETE FROM problems WHERE id = $1', [id]);
    return res.json({ message: 'Problem deleted successfully.' });
  } catch (error) {
    console.error('Error deleting problem:', error);
    return res.status(500).json({ error: 'Internal server error deleting problem.' });
  }
}


// --- TEST CASES ACTIONS ---

// Get all test cases for a problem (Admin only)
export async function getProblemTestCases(req, res) {
  const { problemId } = req.params;

  if (!problemId || problemId === 'undefined') {
    return res.status(400).json({ error: 'Valid problemId is required.' });
  }

  try {
    const result = await db.query(
      'SELECT id, problem_id, input, expected_output, is_hidden, created_at FROM test_cases WHERE problem_id = $1 ORDER BY created_at ASC',
      [problemId]
    );
    return res.json({ testCases: result.rows });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid problem ID format.' });
    }
    console.error('Error fetching test cases:', error);
    return res.status(500).json({ error: 'Internal server error fetching test cases.' });
  }
}

// Create a single test case (Admin only)
export async function createTestCase(req, res) {
  const { problemId } = req.params;
  const { input, expected_output, is_hidden } = req.body;

  if (input === undefined || expected_output === undefined) {
    return res.status(400).json({ error: 'input and expected_output are required.' });
  }

  const trimmedInput = typeof input === 'string' ? input.trim() : String(input).trim();
  const trimmedOutput = typeof expected_output === 'string' ? expected_output.trim() : String(expected_output).trim();

  if (trimmedInput === '' || trimmedOutput === '') {
    return res.status(400).json({ error: 'Test case input and expected output cannot be empty or whitespace only.' });
  }

  const isHidden = is_hidden !== undefined ? !!is_hidden : true;

  try {
    const result = await db.query(
      'INSERT INTO test_cases (problem_id, input, expected_output, is_hidden) VALUES ($1, $2, $3, $4) RETURNING *',
      [problemId, trimmedInput, trimmedOutput, isHidden]
    );
    return res.status(201).json({ testCase: result.rows[0] });
  } catch (error) {
    console.error('Error creating test case:', error);
    return res.status(500).json({ error: 'Internal server error creating testcase.' });
  }
}

// Delete a test case (Admin only)
export async function deleteTestCase(req, res) {
  const { id } = req.params;

  try {
    const check = await db.query('SELECT * FROM test_cases WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Test case not found.' });
    }

    await db.query('DELETE FROM test_cases WHERE id = $1', [id]);
    return res.json({ message: 'Test case deleted successfully.' });
  } catch (error) {
    console.error('Error deleting test case:', error);
    return res.status(500).json({ error: 'Internal server error deleting test case.' });
  }
}

// Bulk upload test cases from JSON or file structure (Admin only)
export async function uploadBulkTestCases(req, res) {
  const { problemId } = req.params;
  const { testCases } = req.body; // Expecting an array of { input, expected_output, is_hidden }

  if (!Array.isArray(testCases) || testCases.length === 0) {
    return res.status(400).json({ error: 'Invalid input. Expecting a non-empty array of testCases.' });
  }

  try {
    // Verify problem exists
    const check = await db.query('SELECT * FROM problems WHERE id = $1', [problemId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Problem not found.' });
    }

    const insertedTestCases = [];
    
    // Perform inserts in a single transaction
    await db.query('BEGIN');
    for (const tc of testCases) {
      if (tc.input === undefined || tc.expected_output === undefined) {
        throw new Error('All test cases must contain input and expected_output.');
      }
      const trimmedInput = typeof tc.input === 'string' ? tc.input.trim() : String(tc.input).trim();
      const trimmedOutput = typeof tc.expected_output === 'string' ? tc.expected_output.trim() : String(tc.expected_output).trim();

      if (trimmedInput === '' || trimmedOutput === '') {
        throw new Error('Test case input and expected output cannot be empty or whitespace only.');
      }

      const isHidden = tc.is_hidden !== undefined ? !!tc.is_hidden : true;
      const result = await db.query(
        'INSERT INTO test_cases (problem_id, input, expected_output, is_hidden) VALUES ($1, $2, $3, $4) RETURNING *',
        [problemId, trimmedInput, trimmedOutput, isHidden]
      );
      insertedTestCases.push(result.rows[0]);
    }
    await db.query('COMMIT');

    return res.status(201).json({
      message: `Successfully uploaded ${insertedTestCases.length} test cases.`,
      testCases: insertedTestCases
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error bulk uploading test cases:', error);
    return res.status(400).json({ error: error.message || 'Error uploading test cases.' });
  }
}


// --- PARTICIPANT PROBLEM ACTIONS ---

// Get active contest problems for the participant
// Automatically restricts problems based on participant unlocking progress
export async function getContestProblemsParticipant(req, res) {
  const participantId = req.user.id;

  try {
    // 1. Find active contest
    const activeContestResult = await db.query(
      "SELECT id FROM contests WHERE status = 'active' ORDER BY start_time DESC LIMIT 1"
    );
    if (activeContestResult.rows.length === 0) {
      return res.json({ problems: [] });
    }
    const contestId = activeContestResult.rows[0].id;

    // 2. Find participant status or create one
    let statusResult = await db.query(
      'SELECT current_problem_id FROM participant_status WHERE participant_id = $1',
      [participantId]
    );

    let currentProblemId = null;

    if (statusResult.rows.length === 0) {
      // Find the first problem (lowest order_index)
      const firstProblemResult = await db.query(
        'SELECT id FROM problems WHERE contest_id = $1 ORDER BY order_index ASC LIMIT 1',
        [contestId]
      );
      
      if (firstProblemResult.rows.length > 0) {
        currentProblemId = firstProblemResult.rows[0].id;
        // Insert participant status row
        await db.query(
          'INSERT INTO participant_status (participant_id, current_problem_id, is_online, last_active_at) VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP)',
          [participantId, currentProblemId]
        );
      }
    } else {
      currentProblemId = statusResult.rows[0].current_problem_id;
      // If current_problem_id is null (means all solved) or let's double check
      if (!currentProblemId) {
        // Find if there is any problem at all
        const firstProblemResult = await db.query(
          'SELECT id FROM problems WHERE contest_id = $1 ORDER BY order_index ASC LIMIT 1',
          [contestId]
        );
        if (firstProblemResult.rows.length > 0) {
          // If no problem was locked yet, set it to the first
          currentProblemId = firstProblemResult.rows[0].id;
          await db.query(
            'UPDATE participant_status SET current_problem_id = $1 WHERE participant_id = $2',
            [currentProblemId, participantId]
          );
        }
      }
    }

    // 3. Fetch ALL problems for the active contest with participant's solved status
    const problemsResult = await db.query(
      `SELECT p.id, p.title, p.description, p.starter_code, p.order_index, p.time_limit_ms, p.memory_limit_kb, p.points,
              EXISTS (
                SELECT 1 FROM submissions s 
                WHERE s.problem_id = p.id 
                  AND s.participant_id = $1 
                  AND s.status = 'accepted'
              ) AS is_solved
       FROM problems p
       WHERE p.contest_id = $2
       ORDER BY p.order_index ASC`,
      [participantId, contestId]
    );

    return res.json({
      problems: problemsResult.rows,
      currentProblemId,
    });
  } catch (error) {
    console.error('Error fetching participant problems:', error);
    return res.status(500).json({ error: 'Internal server error fetching problems.' });
  }
}

// Upload file test cases (Multer memory parse)
export async function uploadTestCaseFiles(req, res) {
  const { problemId } = req.params;
  const { is_hidden } = req.body;

  if (!req.files || !req.files.input || !req.files.expected_output) {
    return res.status(400).json({ error: 'Please upload both input and expected_output text files.' });
  }

  try {
    // Verify problem exists
    const check = await db.query('SELECT * FROM problems WHERE id = $1', [problemId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Problem not found.' });
    }

    const inputContent = req.files.input[0].buffer.toString('utf8');
    const outputContent = req.files.expected_output[0].buffer.toString('utf8');
    const isHidden = is_hidden !== undefined ? is_hidden === 'true' : true;

    const result = await db.query(
      'INSERT INTO test_cases (problem_id, input, expected_output, is_hidden) VALUES ($1, $2, $3, $4) RETURNING *',
      [problemId, inputContent, outputContent, isHidden]
    );

    return res.status(201).json({
      message: 'Test case uploaded successfully.',
      testCase: result.rows[0],
    });
  } catch (error) {
    console.error('Error uploading test case files:', error);
    return res.status(500).json({ error: 'Internal server error uploading files.' });
  }
}

// Save draft code (autosave)
export async function saveDraft(req, res) {
  const participantId = req.user.id;
  const { problemId, codeDraft } = req.body;

  if (!problemId || codeDraft === undefined) {
    return res.status(400).json({ error: 'Required fields: problemId, codeDraft.' });
  }

  try {
    // Verify contest is active
    const contestResult = await db.query(
      "SELECT status FROM contests WHERE id = (SELECT contest_id FROM problems WHERE id = $1 LIMIT 1)",
      [problemId]
    );

    if (contestResult.rows.length === 0 || contestResult.rows[0].status !== 'active') {
      return res.status(403).json({ error: 'Cannot save draft. Contest is not active.' });
    }

    await db.query(
      `INSERT INTO participant_status (participant_id, draft_code, last_active_at)
       VALUES ($1, jsonb_build_object($2::text, $3::text), CURRENT_TIMESTAMP)
       ON CONFLICT (participant_id) 
       DO UPDATE SET draft_code = jsonb_set(COALESCE(participant_status.draft_code, '{}'::jsonb), ARRAY[$2::text], to_jsonb($3::text)), last_active_at = CURRENT_TIMESTAMP`,
      [participantId, problemId, codeDraft]
    );

    return res.json({ success: true, message: 'Draft saved.' });
  } catch (error) {
    console.error('Error saving draft:', error);
    return res.status(500).json({ error: 'Internal server error saving draft.' });
  }
}

// Get draft code
export async function getDraft(req, res) {
  const participantId = req.user.id;
  const { problemId } = req.params;

  try {
    const result = await db.query(
      "SELECT draft_code->>$1::text AS draft FROM participant_status WHERE participant_id = $2",
      [problemId, participantId]
    );

    const draft = result.rows.length > 0 ? result.rows[0].draft : null;
    return res.json({ draft });
  } catch (error) {
    console.error('Error fetching draft:', error);
    return res.status(500).json({ error: 'Internal server error fetching draft.' });
  }
}

// --- ADMIN: RUN & VERIFY CODE ---

// Compile and run C code against a single input (Admin only)
// Used to generate/verify expected outputs for test cases
export async function runCodeHandler(req, res) {
  const { sourceCode, input, timeLimitMs, memoryLimitKb } = req.body;

  if (!sourceCode) {
    return res.status(400).json({ error: 'sourceCode is required.' });
  }

  try {
    const result = await runCode(
      sourceCode,
      input || '',
      timeLimitMs || 2000,
      memoryLimitKb || 128000
    );
    return res.json(result);
  } catch (error) {
    console.error('Error running code:', error);
    return res.status(500).json({ error: 'Internal server error running code.' });
  }
}
