import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import {
  LogOut, Play, Pause, Award, Clock, Code2, ShieldAlert, AlertCircle,
  Terminal, PlayCircle, Send, CheckCircle, RefreshCcw, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const socket = useSocket();

  // Contest state
  const [contest, setContest] = useState(null);
  const [loadingContest, setLoadingContest] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Problems state
  const [problems, setProblems] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [currentProblemId, setCurrentProblemId] = useState(null);

  // Editor and console state
  const [editorCode, setEditorCode] = useState('');
  const [consoleLogs, setConsoleLogs] = useState('Console initialized. Ready to debug.\n');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [lastSubmissionStats, setLastSubmissionStats] = useState(null); // { passed, total, status }
  const [saveStatus, setSaveStatus] = useState('Saved'); // 'Saved' | 'Saving...' | 'Error'
  const [leftTab, setLeftTab] = useState('description'); // 'description' | 'history'
  const [historySubmissions, setHistorySubmissions] = useState([]);

  const saveTimeoutRef = useRef(null);


  const loadSubmissionHistory = async (problemId) => {
    try {
      const res = await axios.get(`/api/submissions/history?problemId=${problemId}`);
      setHistorySubmissions(res.data.submissions || []);
    } catch (err) {
      console.error('Error fetching submissions history:', err);
    }
  };

  // Fetch active contest and problems
  const loadWorkspace = async () => {
    try {
      const contestRes = await axios.get('/api/contests/active');
      if (contestRes.data && contestRes.data.contest) {
        setContest(contestRes.data.contest);
        calculateTimeRemaining(contestRes.data.contest);

        // Load problems for active contest
        const problemsRes = await axios.get('/api/problems/active');
        const loadedProblems = problemsRes.data.problems || [];
        setProblems(loadedProblems);
        setCurrentProblemId(problemsRes.data.currentProblemId);

        if (loadedProblems.length > 0) {
          setSelectedProblem((prev) => {
            const existing = prev ? loadedProblems.find(p => p.id === prev.id) : null;
            const target = existing || loadedProblems[0];
            loadProblemCode(target.id, target.starter_code);
            loadSubmissionHistory(target.id);
            return target;
          });
        }
      } else {
        setContest(null);
      }
    } catch (err) {
      console.error('Error loading workspace:', err);
      toast.error('Workspace synchronization failed.');
    } finally {
      setLoadingContest(false);
    }
  };

  // Load problem code (check draft first, then starter code)
  const loadProblemCode = async (problemId, starterCode) => {
    try {
      const res = await axios.get(`/api/problems/draft/${problemId}`);
      if (res.data && res.data.draft) {
        setEditorCode(res.data.draft);
      } else {
        setEditorCode(starterCode);
      }
      setSaveStatus('Saved');
    } catch (err) {
      console.error('Error loading draft:', err);
      setEditorCode(starterCode);
    }
  };

  // Debounced autosave
  const triggerAutosave = (code, problemId) => {
    if (!contest || contest.status !== 'active') return;

    setSaveStatus('Saving...');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await axios.post('/api/problems/draft', {
          problemId,
          codeDraft: code
        });
        setSaveStatus('Saved');
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveStatus('Error');
      }
    }, 2000); // 2 seconds debounce
  };

  const handleEditorChange = (value) => {
    setEditorCode(value);
    if (selectedProblem) {
      triggerAutosave(value, selectedProblem.id);
    }
  };

  // Handle problem selection
  const handleProblemSelect = (prob) => {
    if (selectedProblem?.id === prob.id) return;

    // Save current draft before switching if dirty
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      axios.post('/api/problems/draft', {
        problemId: selectedProblem.id,
        codeDraft: editorCode
      }).catch(err => console.error('Save before switch failed:', err));
    }

    setSelectedProblem(prob);
    loadProblemCode(prob.id, prob.starter_code);
    loadSubmissionHistory(prob.id);
    setVerdict(null);
  };

  const calculateTimeRemaining = (currentContest) => {
    if (!currentContest || !['active', 'paused'].includes(currentContest.status)) {
      setTimeRemaining(0);
      return;
    }

    const durationSecs = (parseInt(currentContest.duration_minutes, 10) || 60) * 60;
    let elapsedSecs = parseInt(currentContest.elapsed_seconds, 10) || 0;

    if (currentContest.status === 'active' && currentContest.start_time) {
      const startTime = new Date(currentContest.start_time).getTime();
      const now = new Date().getTime();
      const runningSecs = Math.max(0, Math.floor((now - startTime) / 1000));
      elapsedSecs += runningSecs;
    }

    const remaining = Math.max(0, durationSecs - elapsedSecs);
    setTimeRemaining(remaining);
  };

  useEffect(() => {
    loadWorkspace();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Timer countdown - recalculates wall-clock time remaining every second
  useEffect(() => {
    if (!contest || contest.status !== 'active') return;

    calculateTimeRemaining(contest);

    const interval = setInterval(() => {
      calculateTimeRemaining(contest);
    }, 1000);

    return () => clearInterval(interval);
  }, [contest]);

  // Socket triggers
  useEffect(() => {
    if (!socket) return;

    socket.on('contest_status_changed', (data) => {
      setContest((prev) => {
        const updated = {
          ...(prev || {}),
          id: data.contestId,
          status: data.status,
          start_time: data.startTime,
          duration_minutes: Number(data.durationMinutes),
          elapsed_seconds: Number(data.elapsedSeconds !== undefined ? data.elapsedSeconds : (prev?.elapsed_seconds || 0))
        };

        calculateTimeRemaining(updated);
        return updated;
      });

      toast.success(`Contest state changed: ${data.status.toUpperCase()}`);
      if (data.status === 'active') {
        loadWorkspace();
      }
    });

    return () => {
      socket.off('contest_status_changed');
    };
  }, [socket]);

  // Code editor restrictions: Copy, Paste, Cut prevention
  const handleKeyDown = (e) => {
    // Intercept keyboard event for copy (Ctrl+C), paste (Ctrl+V), cut (Ctrl+X)
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'c' || e.key === 'v' || e.key === 'x') {
        e.preventDefault();
        e.stopPropagation();
        toast.error('Copy, Paste, and Cut are disabled in this contest.', {
          icon: '🔒',
          duration: 2000,
        });
      }
    }
  };

  const handleInterceptClipboard = (e) => {
    e.preventDefault();
    toast.error('Clipboard actions are locked.', { icon: '🔒' });
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Compile and Submit action placeholder
  const handleCodeSubmit = async () => {
    if (!selectedProblem) return;
    setIsSubmitting(true);
    setVerdict(null);
    setConsoleLogs((prev) => prev + `> Submitting solution for "${selectedProblem.title}"...\n`);

    try {
      const res = await axios.post('/api/submissions', {
        problemId: selectedProblem.id,
        sourceCode: editorCode,
      });
      const sub = res.data.submission;
      const status = sub.status;

      setVerdict(status);
      setLastSubmissionStats({
        passed: sub.passed_test_cases || 0,
        total: sub.total_test_cases || 0,
        status: status
      });

      if (status === 'accepted') {
        toast.success('Accepted! Problem Solved!');
        setConsoleLogs((prev) =>
          prev + `\n[VERDICT]: ACCEPTED (100% Correct)\n` +
          `- Test Cases Passed: ${sub.passed_test_cases}/${sub.total_test_cases}\n` +
          `- Execution Time: ${sub.execution_time_ms || 0} ms\n` +
          `- Unlocked next problem. Reloading workspace...\n`
        );
        // Reload workspace to update active/unlocked problems list
        loadWorkspace();
      } else if (status === 'compile_error') {
        toast.error('Compilation Error.');
        setConsoleLogs((prev) =>
          prev + `\n[VERDICT]: COMPILATION ERROR\n` +
          `- Test Cases Passed: 0/${sub.total_test_cases || 0}\n` +
          `------------------------------\n` +
          `${sub.compile_error_log}\n` +
          `------------------------------\n`
        );
      } else {
        const formattedStatus = status.toUpperCase().replace(/_/g, ' ');
        const detailLog = sub.compile_error_log
          ? `- Details: ${sub.compile_error_log}\n`
          : '';
        toast.error(`Verdict: ${formattedStatus}`);
        setConsoleLogs((prev) =>
          prev + `\n[VERDICT]: ${formattedStatus}\n` +
          `- Test Cases Passed: ${sub.passed_test_cases}/${sub.total_test_cases}\n` +
          detailLog +
          `- Execution Time: ${sub.execution_time_ms || 0} ms\n`
        );
      }

    } catch (err) {
      console.error('Submission failed:', err);
      const errorMsg = err.response?.data?.error || 'Execution failed. Judge service may be offline.';
      toast.error(errorMsg);
      setConsoleLogs((prev) => prev + `\n[SYSTEM ERROR]: ${errorMsg}\n`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingContest) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-900 border-t-cyan-400"></div>
        <p className="mt-4 text-sm font-medium tracking-wide text-cyan-400 font-mono">Synchronising workspace...</p>
      </div>
    );
  }

  // Blocker views
  if (!contest) {
    return (
      <div className="relative flex min-h-screen flex-col bg-black text-white">
        <header className="flex justify-between items-center px-8 py-4 border-b border-slate-900 bg-slate-950/40">
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            DebugLab Workspace
          </h1>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg bg-slate-950 border border-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900 transition hover:text-white"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-950/50 border border-cyan-500/20 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
            <AlertCircle size={32} className="animate-pulse" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-3">No Active Contest</h2>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">
            There is currently no active debugging session running. The contest manager must start a contest from the Admin Panel.
          </p>
          <div className="rounded-lg border border-slate-900 bg-slate-950/60 p-4 text-xs text-slate-500 max-w-sm">
            Status updates are broadcasted automatically over local network. Keep this window open.
          </div>
        </main>
      </div>
    );
  }

  if (contest.status === 'paused') {
    return (
      <div className="relative flex min-h-screen flex-col bg-black text-white">
        <header className="flex justify-between items-center px-8 py-4 border-b border-slate-900 bg-slate-950/40">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              DebugLab Workspace
            </h1>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Pause size={12} /> PAUSED
            </span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg bg-slate-950 border border-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900 transition hover:text-white"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-950/50 border border-amber-500/20 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
            <ShieldAlert size={32} className="animate-bounce" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-3">Contest Paused</h2>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">
            The administrators have temporarily paused the contest session. Editor inputs are locked and code execution is suspended.
          </p>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 px-4 py-2.5 bg-slate-950 border border-slate-900 rounded-lg">
            <Clock size={14} className="text-amber-400" />
            <span>Time Remaining Saved: {formatTime(timeRemaining)}</span>
          </div>
        </main>
      </div>
    );
  }

  if (contest.status === 'ended') {
    return (
      <div className="relative flex min-h-screen flex-col bg-black text-white">
        <header className="flex justify-between items-center px-8 py-4 border-b border-slate-900 bg-slate-950/40">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              DebugLab Workspace
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400">
              FINISHED
            </span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg bg-slate-950 border border-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900 transition hover:text-white"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-950/50 border border-cyan-500/20 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
            <Award size={32} />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-3">Contest Finished</h2>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">
            The contest has concluded. Submissions are closed. Ranks are locking.
          </p>
          <div className="rounded-lg border border-slate-900 bg-slate-950/60 p-4 text-xs text-cyan-500 font-mono">
            Thank you for participating!
          </div>
        </main>
      </div>
    );
  }

  // Active Workspace
  return (
    <div className="flex h-screen flex-col bg-black text-white overflow-hidden">
      {/* Top Navbar */}
      <header className="flex justify-between items-center px-8 h-16 border-b border-white/[0.05] bg-slate-900/40 backdrop-blur-md shrink-0 shadow-[0_4px_30px_rgba(0,0,0,0.3)] z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black bg-gradient-to-r from-white via-slate-100 to-cyan-400 bg-clip-text text-transparent">
            DebugLab Workspace
          </h1>
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
            Active
          </span>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-2 shadow-inner ${
          contest?.status === 'paused'
            ? 'border-amber-500/30 bg-amber-500/10'
            : 'border-white/[0.08] bg-white/[0.02]'
        }`}>
          <Clock size={14} className={contest?.status === 'active' ? 'text-cyan-400 animate-pulse' : 'text-amber-400'} />
          <span className={`font-mono text-sm font-black tracking-wider ${
            contest?.status === 'paused' ? 'text-amber-400' : 'text-white'
          }`}>
            {formatTime(timeRemaining)} {contest?.status === 'paused' && '(PAUSED)'}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className={`text-[10px] font-bold font-mono px-2.5 py-1 rounded-lg uppercase tracking-wider ${saveStatus === 'Saved' ? 'text-slate-400 bg-white/[0.03] border border-white/[0.05]' :
            saveStatus === 'Saving...' ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20' :
              'text-red-400 bg-red-500/10 border border-red-500/20'
            }`}>
            {saveStatus}
          </span>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-300">{user?.username}</p>
            <p className="text-[9px] uppercase tracking-wider text-cyan-400 font-bold font-mono">Participant</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] px-3.5 py-2 text-xs text-slate-300 hover:bg-white/[0.08] hover:text-white transition duration-300"
          >
            <LogOut size={12} />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* LEFT COLUMN: Problems List & Statements */}
        <aside className="w-1/3 min-h-0 border-r border-slate-900 bg-slate-950/40 flex flex-col overflow-hidden shrink-0">
          {/* Contest Problems List */}
          <div className="p-4 border-b border-slate-900 bg-slate-950/20">
            <h4 className="text-xs uppercase font-bold tracking-wider text-cyan-400 mb-2">Contest Problems</h4>
            <div className="flex flex-wrap gap-1.5">
              {problems.map((p) => {
                const isSelected = selectedProblem?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleProblemSelect(p)}
                    className={`flex-1 text-center py-2 px-2 text-xs font-bold font-mono rounded border transition ${isSelected
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-cyan-500/50 hover:text-white'
                      }`}
                  >
                    P{p.order_index}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex border-b border-white/[0.05] bg-white/[0.01] shrink-0">
            <button
              onClick={() => setLeftTab('description')}
              className={`flex-1 text-center py-3.5 text-xs uppercase tracking-wider font-bold border-b-2 transition duration-300 ${leftTab === 'description'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/[0.02]'
                : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
            >
              Description
            </button>
            <button
              onClick={() => setLeftTab('history')}
              className={`flex-1 text-center py-3.5 text-xs uppercase tracking-wider font-bold border-b-2 transition duration-300 ${leftTab === 'history'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/[0.02]'
                : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
            >
              Attempts ({historySubmissions.length})
            </button>
          </div>

          {/* Problem Statement, Submission History or Leaderboard */}
          {selectedProblem ? (
            leftTab === 'description' ? (
              <div className="theme-scrollbar flex-1 min-h-0 p-6 overflow-y-auto space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-500 font-mono">Problem {selectedProblem.order_index}</span>
                    <h2 className="text-xl font-black text-white mt-1 leading-tight">{selectedProblem.title}</h2>
                  </div>
                  <span className="text-xs font-bold px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                    {selectedProblem.points} PTS
                  </span>
                </div>

                <div className="flex gap-4 text-[11px] font-mono text-slate-400 border-y border-white/[0.05] py-3">
                  <span>TIME LIMIT: {selectedProblem.time_limit_ms}ms</span>
                  <span>MEMORY LIMIT: {selectedProblem.memory_limit_kb}KB</span>
                </div>

                {/* Description Body */}
                <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line space-y-3 font-sans">
                  {selectedProblem.description}
                </div>
              </div>
            ) : (
              <div className="theme-scrollbar flex-1 min-h-0 p-6 overflow-y-auto space-y-4">
                <h4 className="font-bold text-sm text-slate-200">Submission History</h4>
                {historySubmissions.length === 0 ? (
                  <p className="text-xs text-slate-600 py-4 text-center">No submissions yet for this problem.</p>
                ) : (
                  <div className="space-y-3">
                    {historySubmissions.map((sub, index) => {
                      const isAcc = sub.status === 'accepted';
                      const isCTE = sub.status === 'compile_error';
                      return (
                        <div key={sub.id} className="border border-slate-900 bg-black/40 rounded p-3 text-xs flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded ${isAcc ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                isCTE ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                  'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                {sub.status.toUpperCase().replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(sub.submitted_at).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Passed: {sub.passed_test_cases}/{sub.total_test_cases} cases | Time: {sub.execution_time_ms || 0}ms
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setEditorCode(sub.source_code);
                              toast.success('Loaded code into editor.');
                            }}
                            className="text-[10px] text-cyan-400 hover:underline"
                          >
                            Load Code
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <p className="text-xs text-slate-600">No unlocked problems available.</p>
            </div>
          )}
        </aside>

        {/* RIGHT COLUMN: Code Editor & Console */}
        <section className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-950" onKeyDown={handleKeyDown}>
          {/* Editor Header */}
          <div className="h-10 border-b border-white/[0.05] px-6 flex justify-between items-center bg-slate-900/30 backdrop-blur-md shrink-0">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Code2 size={14} className="text-cyan-400" />
              solution.c
            </span>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider">C (GCC)</span>
          </div>

          {/* Monaco Editor Container */}
          <div
            className="flex-1 min-h-0 relative bg-black"
            onCopy={handleInterceptClipboard}
            onCut={handleInterceptClipboard}
            onPaste={handleInterceptClipboard}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Editor
              height="100%"
              language="c"
              theme="vs-dark"
              value={editorCode}
              onChange={handleEditorChange}
              options={{
                fontSize: 14,
                fontFamily: 'Consolas, monospace',
                minimap: { enabled: false },
                lineNumbers: 'on',
                contextmenu: false,
                dragAndDrop: false,
                copyWithSyntaxHighlighting: false,
                scrollbar: {
                  vertical: 'visible',
                  horizontal: 'visible',
                },
                cursorBlinking: 'smooth',
                formatOnPaste: false,
                autoClosingBrackets: 'always',
                readOnly: false
              }}
            />
          </div>

          {/* CONSOLE / TERMINAL PANEL */}
          <div className="h-64 border-t border-white/[0.05] bg-slate-950/80 flex flex-col overflow-hidden shrink-0">
            <div className="h-11 border-b border-white/[0.05] px-6 flex justify-between items-center bg-slate-900/30 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Terminal size={14} className="text-cyan-400" />
                  Execution Console
                </span>
                {lastSubmissionStats && (
                  <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border transition-all ${
                    lastSubmissionStats.status === 'accepted'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : lastSubmissionStats.status === 'compile_error'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}>
                    Passed: {lastSubmissionStats.passed}/{lastSubmissionStats.total} Cases
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCodeSubmit}
                  disabled={isSubmitting || !selectedProblem}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] px-4 py-1.5 text-xs font-bold text-white hover:scale-[1.01] transition duration-300 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Send size={12} />
                  Submit Code
                </button>
              </div>
            </div>

            <div className="theme-scrollbar flex-1 p-4 font-mono text-xs text-slate-400 overflow-y-auto leading-relaxed whitespace-pre-wrap select-text">
              {consoleLogs}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
