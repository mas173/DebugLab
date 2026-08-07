import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create temp directory for compilation inside workspace
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp', 'submissions');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const DOCKER_IMAGE = 'alpine';
const DOCKER_STARTUP_GRACE_MS = 3000;

/**
 * Standardize output (strip trailing line whitespace and normalize CRLF/LF)
 */
function standardize(str) {
  if (str === null || str === undefined) return '';
  return str
    .toString()
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Clean up temp files
 */
function cleanupFiles(...filepaths) {
  for (const fp of filepaths) {
    if (fp && fs.existsSync(fp)) {
      try {
        fs.unlinkSync(fp);
      } catch (err) {
        console.error(`Failed to delete temp file: ${fp}`, err);
      }
    }
  }
}

/**
 * Compiles C source code on the host
 */
function compileSource(sourcePath, binaryPath) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const compileCmd = `gcc -O2 "${sourcePath}" -o "${binaryPath}"`;

    exec(compileCmd, { timeout: 10000 }, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr });
    });
  });
}

/**
 * Executes a binary natively on host with timeout enforcement
 */
function runHostExecution(binaryPath, input, timeLimitMs) {
  return new Promise((resolve) => {
    const startTime = process.hrtime();
    let stdout = '';
    let stderr = '';
    let timeoutTriggered = false;

    const child = spawn(binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const timer = setTimeout(() => {
      timeoutTriggered = true;
      try { child.kill('SIGKILL'); } catch (e) {}
    }, timeLimitMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        status: 'runtime_error',
        error: `Host process execution error: ${err.message}`,
        timeMs: 0,
        stdout,
        stderr
      });
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const endTime = process.hrtime(startTime);
      const elapsedMs = Math.round((endTime[0] * 1000) + (endTime[1] / 1000000));

      if (timeoutTriggered || signal === 'SIGKILL') {
        return resolve({
          status: 'time_limit_exceeded',
          timeMs: timeLimitMs,
          stdout,
          stderr
        });
      }

      if (code !== 0) {
        return resolve({
          status: 'runtime_error',
          timeMs: elapsedMs,
          stdout,
          stderr,
          exitCode: code
        });
      }

      resolve({
        status: 'success',
        timeMs: elapsedMs,
        stdout,
        stderr
      });
    });

    if (input !== null && input !== undefined) {
      try {
        const inputStr = input.toString();
        child.stdin.write(inputStr);
        if (!inputStr.endsWith('\n')) {
          child.stdin.write('\n');
        }
      } catch (e) {}
    }
    try { child.stdin.end(); } catch (e) {}
  });
}

/**
 * Runs a binary inside Docker sandbox with automatic native host fallback
 */
function runSandbox(binaryPath, input, timeLimitMs, memoryLimitKb) {
  return new Promise(async (resolve) => {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      const hostRes = await runHostExecution(binaryPath, input, timeLimitMs);
      return resolve(hostRes);
    }

    const binaryFilename = path.basename(binaryPath);
    const binaryDir = path.dirname(binaryPath);
    const memoryLimitMb = Math.max(16, Math.ceil(memoryLimitKb / 1024));

    const dockerCmd = 'docker';
    const dockerArgs = [
      'run',
      '--rm',
      '-i',
      '--network', 'none',
      '--memory', `${memoryLimitMb}m`,
      '--memory-swap', `${memoryLimitMb}m`,
      '--cpus', '0.5',
      '--pids-limit', '50',
      '-v', `${binaryDir}:/app:ro`,
      '-w', '/app',
      DOCKER_IMAGE,
      `./${binaryFilename}`
    ];

    let stdout = '';
    let stderr = '';
    let startTime = process.hrtime();
    let timeoutTriggered = false;

    let child;
    try {
      child = spawn(dockerCmd, dockerArgs);
    } catch (err) {
      console.warn('Docker spawn failed, falling back to host execution:', err.message);
      const hostRes = await runHostExecution(binaryPath, input, timeLimitMs);
      return resolve(hostRes);
    }

    const timeoutMs = timeLimitMs + DOCKER_STARTUP_GRACE_MS;
    const timer = setTimeout(() => {
      timeoutTriggered = true;
      try { child.kill('SIGKILL'); } catch (e) {}
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', async (err) => {
      clearTimeout(timer);
      console.warn('Docker execution error, falling back to host execution:', err.message);
      const hostRes = await runHostExecution(binaryPath, input, timeLimitMs);
      return resolve(hostRes);
    });

    child.on('close', async (code) => {
      clearTimeout(timer);
      const endTime = process.hrtime(startTime);
      const elapsedMs = Math.round((endTime[0] * 1000) + (endTime[1] / 1000000));

      // If Docker container failed to run (e.g. mount error, daemon unavailable, exit code 125, 127, 126)
      if (code === 125 || code === 127 || code === 126 || stderr.includes('mounts denied') || stderr.includes('no such file')) {
        console.warn(`Docker sandbox returned code ${code}. Falling back to host execution...`);
        const hostRes = await runHostExecution(binaryPath, input, timeLimitMs);
        return resolve(hostRes);
      }

      if (timeoutTriggered) {
        return resolve({
          status: 'time_limit_exceeded',
          timeMs: timeLimitMs,
          stdout,
          stderr
        });
      }

      if (code !== 0) {
        return resolve({
          status: 'runtime_error',
          timeMs: elapsedMs,
          stdout,
          stderr,
          exitCode: code
        });
      }

      resolve({
        status: 'success',
        timeMs: elapsedMs,
        stdout,
        stderr
      });
    });

    if (input !== null && input !== undefined) {
      try {
        const inputStr = input.toString();
        child.stdin.write(inputStr);
        if (!inputStr.endsWith('\n')) {
          child.stdin.write('\n');
        }
      } catch (e) {}
    }
    try { child.stdin.end(); } catch (e) {}
  });
}

/**
 * Orchestrates compiling C code and running test cases inside the judge engine
 */
export async function judgeSubmission(submissionId, sourceCode, problemId, timeLimitMs, memoryLimitKb) {
  const uuid = uuidv4();
  const sourcePath = path.join(TEMP_DIR, `${uuid}.c`);
  const binaryPath = path.join(TEMP_DIR, process.platform === 'win32' ? `${uuid}.exe` : uuid);

  try {
    // 1. Write code draft to file
    fs.writeFileSync(sourcePath, sourceCode);

    // 2. Compile source code
    const compilation = await compileSource(sourcePath, binaryPath);
    if (compilation.error) {
      return {
        status: 'compile_error',
        compileErrorLog: compilation.stderr || compilation.stdout || 'Compilation failed.'
      };
    }

    // 3. Fetch test cases from database
    const testCasesRes = await db.query(
      "SELECT id, input, expected_output, is_hidden FROM test_cases WHERE problem_id = $1 ORDER BY created_at ASC, id ASC",
      [problemId]
    );
    const testCases = testCasesRes.rows;

    if (testCases.length === 0) {
      return {
        status: 'runtime_error',
        compileErrorLog: 'Judge configuration error: no test cases are configured for this problem.',
        passedCases: 0,
        totalCases: 0,
        timeMs: 0
      };
    }

    let passedCases = 0;
    let maxTimeMs = 0;

    // 4. Run each test case sequentially
    for (const tc of testCases) {
      const run = await runSandbox(binaryPath, tc.input, timeLimitMs, memoryLimitKb);
      
      if (run.status === 'time_limit_exceeded') {
        return {
          status: 'time_limit_exceeded',
          passedCases,
          totalCases: testCases.length,
          timeMs: timeLimitMs
        };
      }

      if (run.status === 'runtime_error') {
        return {
          status: 'runtime_error',
          compileErrorLog: run.error || run.stderr || 'Runtime error.',
          passedCases,
          totalCases: testCases.length,
          timeMs: run.timeMs
        };
      }

      // Compare outputs using output standardization
      const actualOut = standardize(run.stdout);
      const expectedOut = standardize(tc.expected_output);

      if (actualOut !== expectedOut) {
        return {
          status: 'wrong_answer',
          passedCases,
          totalCases: testCases.length,
          timeMs: Math.max(maxTimeMs, run.timeMs)
        };
      }

      passedCases++;
      maxTimeMs = Math.max(maxTimeMs, run.timeMs);
    }

    // All test cases passed!
    return {
      status: 'accepted',
      passedCases,
      totalCases: testCases.length,
      timeMs: maxTimeMs
    };

  } catch (err) {
    console.error(`Submission ${submissionId} judge system error:`, err);
    return {
      status: 'runtime_error',
      compileErrorLog: err.message,
      passedCases: 0,
      totalCases: 0,
      timeMs: 0
    };
  } finally {
    // 5. Cleanup temporary workspace files
    cleanupFiles(sourcePath, binaryPath);
  }
}

/**
 * Compiles and runs C code against a single input.
 * Used by admin to verify / auto-generate expected outputs for test cases.
 */
export async function runCode(sourceCode, input, timeLimitMs = 2000, memoryLimitKb = 128000) {
  const uuid = uuidv4();
  const sourcePath = path.join(TEMP_DIR, `${uuid}.c`);
  const binaryPath = path.join(TEMP_DIR, process.platform === 'win32' ? `${uuid}.exe` : uuid);

  try {
    fs.writeFileSync(sourcePath, sourceCode);

    const compilation = await compileSource(sourcePath, binaryPath);
    if (compilation.error) {
      return {
        success: false,
        status: 'compile_error',
        output: '',
        error: compilation.stderr || compilation.stdout || 'Compilation failed.'
      };
    }

    const run = await runSandbox(binaryPath, input, timeLimitMs, memoryLimitKb);

    if (run.status === 'success') {
      return {
        success: true,
        status: 'success',
        output: run.stdout,
        standardizedOutput: standardize(run.stdout),
        timeMs: run.timeMs,
        error: ''
      };
    }

    return {
      success: false,
      status: run.status,
      output: run.stdout || '',
      error: run.stderr || run.error || `Execution failed with status: ${run.status}`
    };
  } catch (err) {
    return {
      success: false,
      status: 'error',
      output: '',
      error: err.message
    };
  } finally {
    cleanupFiles(sourcePath, binaryPath);
  }
}
