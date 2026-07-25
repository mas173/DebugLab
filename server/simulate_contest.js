// Run simulation against localhost server (make sure server is running on port 5000)
const BASE_URL = 'http://localhost:5000/api';

// Lightweight wrapper around native Node.js fetch to simulate axios requests with zero external dependencies
async function apiCall(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, config);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err = new Error(`Request failed: ${res.status}`);
    err.response = { status: res.status, data: errorData };
    throw err;
  }

  return await res.json();
}

async function runSimulation() {
  console.log('=== DEBUGGING CONTEST ENGINE SIMULATION ===');

  try {
    // 1. Health check
    console.log('\n[TEST 1] Verifying server health check...');
    const health = await apiCall('GET', '/health');
    console.log('Server Status:', health);

    // 2. Authentication Test
    console.log('\n[TEST 2] Authenticating default Admin user...');
    const adminLoginRes = await apiCall('POST', '/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    const adminToken = adminLoginRes.token;
    console.log('Admin logged in. Token:', adminToken.slice(0, 20) + '...');

    // 3. Contest creation and activation
    console.log('\n[TEST 3] Fetching contests list...');
    const contestsRes = await apiCall('GET', '/contests', null, adminToken);
    let contest = contestsRes.contests[0];

    if (!contest) {
      console.log('No contests found. Creating a test contest...');
      const createContestRes = await apiCall('POST', '/contests', {
        title: 'Simulation Test Contest',
        description: 'Automated simulation contest run.',
        duration_minutes: 60
      }, adminToken);
      contest = createContestRes.contest;
    }

    console.log(`Using Contest: "${contest.title}" | Status: ${contest.status}`);

    if (contest.status !== 'active') {
      console.log('Setting contest status to "active"...');
      const statusRes = await apiCall('POST', `/contests/${contest.id}/status`, { status: 'active' }, adminToken);
      contest = statusRes.contest;
      console.log('Contest status set to active.');
    }

    // 4. Create Problems & Test cases
    console.log('\n[TEST 4] Fetching problems...');
    const problemsRes = await apiCall('GET', `/problems/admin?contestId=${contest.id}`, null, adminToken);
    let problem = problemsRes.problems[0];

    if (!problem) {
      console.log('No problems found. Creating a test problem...');
      const createProblemRes = await apiCall('POST', '/problems/admin', {
        contest_id: contest.id,
        title: 'Square of Number',
        description: 'Read an integer and print its square value.',
        starter_code: '#include <stdio.h>\nint main() {\n  int n;\n  // Bug: wrong scanf format or calculation\n  scanf("%d", &n);\n  printf("%d\\n", n * n);\n  return 0;\n}',
        order_index: 1,
        time_limit_ms: 2000,
        memory_limit_kb: 128000,
        points: 100
      }, adminToken);
      problem = createProblemRes.problem;
      console.log('Created problem:', problem.title);

      console.log('Adding a public test case...');
      await apiCall('POST', `/problems/admin/${problem.id}/testcases`, {
        input: '4',
        expected_output: '16',
        is_hidden: false
      }, adminToken);

      console.log('Adding a hidden testcase...');
      await apiCall('POST', `/problems/admin/${problem.id}/testcases`, {
        input: '9',
        expected_output: '81',
        is_hidden: true
      }, adminToken);
      console.log('Test cases uploaded.');
    } else {
      console.log(`Using Problem: "${problem.title}"`);
    }

    // 5. Participant workspace simulation
    console.log('\n[TEST 5] Authenticating a participant...');
    let participantToken;
    try {
      const userLoginRes = await apiCall('POST', '/auth/login', {
        username: 'USER-101',
        password: 'userpassword'
      });
      participantToken = userLoginRes.token;
    } catch (err) {
      console.log('USER-101 login failed. Ensure users are seeded by dbInit.js');
      return;
    }

    console.log('Participant authenticated.');

    // 6. Submit compile error code
    console.log('\n[TEST 6] Submitting code with compilation error...');
    const badCode = `
      #include <stdio.h>
      int main() {
        invalid_c_code_force_compilation_error
      }
    `;
    const badSubRes = await apiCall('POST', '/submissions', {
      problemId: problem.id,
      sourceCode: badCode
    }, participantToken);
    console.log('Verdict received:', badSubRes.submission.status);
    console.log('Compile Log length:', badSubRes.submission.compile_error_log?.length || 0);

    // 7. Submit correct code
    console.log('\n[TEST 7] Submitting correct solution code...');
    const goodCode = `
      #include <stdio.h>
      int main() {
        int n;
        if (scanf("%d", &n) == 1) {
          printf("%d\\n", n * n);
        }
        return 0;
      }
    `;
    const goodSubRes = await apiCall('POST', '/submissions', {
      problemId: problem.id,
      sourceCode: goodCode
    }, participantToken);
    console.log('Verdict received:', goodSubRes.submission.status);
    console.log('Passed test cases:', `${goodSubRes.submission.passed_test_cases}/${goodSubRes.submission.total_test_cases}`);

    // 8. Verify Leaderboard
    console.log('\n[TEST 8] Fetching leaderboard standings...');
    const lbRes = await apiCall('GET', '/leaderboard', null, participantToken);
    console.log('Leaderboard Listing:');
    console.table(lbRes.leaderboard);

    console.log('\n=== SIMULATION PASSED SUCCESSFULLY ===');

  } catch (error) {
    console.error('\n=== SIMULATION FAILED ===');
    if (error.response) {
      console.error('Error Details:', error.response.status, error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

runSimulation();
