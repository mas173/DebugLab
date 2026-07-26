import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create temp directory for compilation
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp', 'submissions');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Execute child process wrapped in a Promise
 */
function execPromise(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr });
    });
  });
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
 * Compiles C source code to a static binary on the host
 */
async function compileSource(sourcePath, binaryPath) {
  // Use static linking so it runs inside alpine without musl/glibc issues
  // If static linking fails on developer system, fall back to standard compile
  const compileCmd = `gcc -static -O2 "${sourcePath}" -o "${binaryPath}"`;
  let result = await execPromise(compileCmd);
  
  if (result.error) {
    console.warn('Static compilation failed, trying standard compilation...');
    const fallbackCmd = `gcc -O2 "${sourcePath}" -o "${binaryPath}"`;
    result = await execPromise(fallbackCmd);
  }
  
  return result;
}

/**
 * Runs a binary inside the Docker sandbox or falls back to host execution
 */
function runSandbox(binaryPath, input, timeLimitMs, memoryLimitKb) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const binaryFilename = path.basename(binaryPath);
    const binaryDir = path.dirname(binaryPath);

    // Default: Docker run command
    // We mount the directory containing the binary, mapping it to /app inside container
    // Disable network, limit cpus, memory and set timeout
    const memoryLimitMb = Math.ceil(memoryLimitKb / 1024);
    
    // Windows vs POSIX docker path conversion
    let volumeMountPath = binaryDir;
    if (isWindows) {
      // Convert E:\foo\bar to /e/foo/bar for docker mounting
      volumeMountPath = binaryDir
        .replace(/^([A-Za-z]):/, (_, letter) => `/${letter.toLowerCase()}`)
        .replace(/\\/g, '/');
    }

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
      '-v', `${volumeMountPath}:/app:ro`,
      '-w', '/app',
      'alpine',
      `./${binaryFilename}`
    ];

    // Fallback: Local host execution command
    const localCmd = binaryPath;
    const localArgs = [];

    // If the host is Windows, we run natively because a Linux Docker container cannot execute a Windows PE (.exe) binary.
    let cmd = isWindows ? localCmd : dockerCmd;
    let args = isWindows ? localArgs : dockerArgs;

    let isFallback = isWindows;

    const executeProcess = (runCmd, runArgs) => {
      const child = spawn(runCmd, runArgs);
      
      let stdout = '';
      let stderr = '';
      let startTime = process.hrtime();
      let timeoutTriggered = false;

      // Handle time limit using standard timeout
      const timer = setTimeout(() => {
        timeoutTriggered = true;
        child.kill('SIGKILL');
      }, timeLimitMs);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        if (runCmd === 'docker' && !isFallback) {
          console.warn('Docker execution failed to start. Falling back to local execution...');
          isFallback = true;
          executeProcess(localCmd, localArgs);
        } else {
          resolve({
            status: 'runtime_error',
            error: err.message,
            timeMs: 0
          });
        }
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        
        // If docker failed (exit code 125, 127 or similar startup issues), fall back
        if (runCmd === 'docker' && code !== 0 && (stderr.includes('docker') || stderr.includes('daemon') || code === 125)) {
          console.warn('Docker daemon not running or mount failed. Falling back to local execution...');
          isFallback = true;
          executeProcess(localCmd, localArgs);
          return;
        }

        const endTime = process.hrtime(startTime);
        const elapsedMs = Math.round((endTime[0] * 1000) + (endTime[1] / 1000000));

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

      // Catch EPIPE/stream errors on child stdin to prevent crashing the main server process
      if (child.stdin) {
        child.stdin.on('error', (err) => {
          console.warn('Child stdin write error (caught to prevent crash):', err.message);
        });

        // Write test case inputs to child process stdin safely
        if (input && child.stdin.writable) {
          child.stdin.write(input);
        }
        if (child.stdin.writable) {
          child.stdin.end();
        }
      }
    };

    executeProcess(cmd, args);
  });
}

/**
 * Standardize output (strip trailing whitespaces/newlines for comparison)
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
 * Orchestrates compiling C code and running test cases inside the sandbox
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
      "SELECT id, input, expected_output, is_hidden FROM test_cases WHERE problem_id = $1 ORDER BY id ASC",
      [problemId]
    );
    const testCases = testCasesRes.rows;

    if (testCases.length === 0) {
      return {
        status: 'accepted',
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

      // Check outputs
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
