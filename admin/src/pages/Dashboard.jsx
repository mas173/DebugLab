import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import axios from 'axios';
import {
  LogOut, Play, Pause, Award, Clock, Plus, Edit2, Trash2, Database, Users,
  Settings, Save, X, Eye, EyeOff, FileText, ChevronRight, CheckCircle2, RefreshCcw
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const socket = useSocket();

  // Active View Tab: 'controls' | 'problems' | 'participants' | 'leaderboard'
  const [activeTab, setActiveTab] = useState('controls');

  // Contest States
  const [contests, setContests] = useState([]);
  const [selectedContest, setSelectedContest] = useState(null);
  const [showCreateContest, setShowCreateContest] = useState(false);
  const [showEditContest, setShowEditContest] = useState(false);
  const [contestTitle, setContestTitle] = useState('');
  const [contestDesc, setContestDesc] = useState('');
  const [contestDuration, setContestDuration] = useState(60);

  // Problem States
  const [problems, setProblems] = useState([]);
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [editingProblem, setEditingProblem] = useState(null);
  const [probTitle, setProbTitle] = useState('');
  const [probDesc, setProbDesc] = useState('');
  const [probCode, setProbCode] = useState('');
  const [probOrder, setProbOrder] = useState(0);
  const [probTimeLimit, setProbTimeLimit] = useState(2000);
  const [probMemoryLimit, setProbMemoryLimit] = useState(128000);
  const [probPoints, setProbPoints] = useState(100);
  const [problemFormTestCases, setProblemFormTestCases] = useState([]);
  const [problemFormTcInput, setProblemFormTcInput] = useState('');
  const [problemFormTcOutput, setProblemFormTcOutput] = useState('');
  const [problemFormTcIsHidden, setProblemFormTcIsHidden] = useState(true);

  // Test Case States
  const [selectedProblemForTC, setSelectedProblemForTC] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [tcInput, setTcInput] = useState('');
  const [tcOutput, setTcOutput] = useState('');
  const [tcIsHidden, setTcIsHidden] = useState(true);
  const [bulkTcJson, setBulkTcJson] = useState('');
  const [isGeneratingOutput, setIsGeneratingOutput] = useState(false);
  const [isGeneratingOutputTC, setIsGeneratingOutputTC] = useState(false);

  // Leaderboard State
  const [leaderboardList, setLeaderboardList] = useState([]);

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get('/api/leaderboard');
      setLeaderboardList(res.data.leaderboard || []);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    }
  };

  // Stats State
  const [stats, setStats] = useState({ totalParticipants: 0, onlineParticipants: 0, totalSubmissions: 0, breakdown: {} });
  const [actionLogs, setActionLogs] = useState([
    { id: 'init', time: new Date().toLocaleTimeString(), message: 'System orchestration console online.' }
  ]);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/admin/monitoring/stats');
      setStats(res.data.stats || { totalParticipants: 0, onlineParticipants: 0, totalSubmissions: 0, breakdown: {} });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  // Participant Activity States
  const [participantsList, setParticipantsList] = useState([]);
  const [selectedParticipantForModal, setSelectedParticipantForModal] = useState(null);
  const [participantDraftsMap, setParticipantDraftsMap] = useState({});
  const [selectedDraftProblemId, setSelectedDraftProblemId] = useState('');

  const fetchParticipants = async () => {
    try {
      const res = await axios.get('/api/admin/monitoring/participants');
      setParticipantsList(res.data.participants || []);
    } catch (err) {
      console.error('Failed to load participants:', err);
    }
  };

  const openParticipantModal = async (participant) => {
    setSelectedParticipantForModal(participant);
    try {
      const res = await axios.get(`/api/admin/monitoring/participants/${participant.id}/drafts`);
      const drafts = res.data.draftCode || {};
      setParticipantDraftsMap(drafts);

      // Pre-select first problem draft if available
      const keys = Object.keys(drafts);
      if (keys.length > 0) {
        setSelectedDraftProblemId(keys[0]);
      } else {
        setSelectedDraftProblemId('');
      }
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
      toast.error('Failed to fetch participant drafts.');
    }
  };

  const handleExportCSV = () => {
    if (leaderboardList.length === 0) {
      toast.error('No leaderboard entries to export.');
      return;
    }

    const headers = ['Rank', 'Participant ID', 'Problems Solved', 'Total Score', 'Last Accepted Time'];
    const rows = leaderboardList.map((lb) => [
      lb.rank,
      lb.username,
      lb.problems_solved,
      lb.score,
      lb.last_accepted_time ? new Date(lb.last_accepted_time).toISOString() : '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `debugging_contest_leaderboard_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Leaderboard exported successfully as CSV.');
  };

  // Fetch all contests
  const fetchContests = async () => {
    try {
      const res = await axios.get('/api/contests');
      setContests(res.data.contests);
      if (res.data.contests.length > 0) {
        // Default to the first/latest contest
        setSelectedContest(res.data.contests[0]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load contests.');
    }
  };

  // Fetch problems for selected contest
  const fetchProblems = async (contestId) => {
    if (!contestId) return;
    try {
      const res = await axios.get(`/api/problems/admin?contestId=${contestId}`);
      setProblems(res.data.problems);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load problems.');
    }
  };

  useEffect(() => {
    fetchContests();
  }, []);

  useEffect(() => {
    if (selectedContest) {
      fetchProblems(selectedContest.id);
    }
  }, [selectedContest]);

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    } else if (activeTab === 'participants') {
      fetchParticipants();
    } else if (activeTab === 'controls') {
      fetchStats();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join_admin');
    console.log('Emitted join_admin room registration');

    socket.on('leaderboard_dirty', () => {
      fetchLeaderboard();
      fetchStats();
    });
    socket.on('participant_status_changed', (data) => {
      fetchStats();
      setActionLogs(prev => [
        {
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `Participant "${data.username || 'User'}" went ${data.is_online ? 'ONLINE 🟢' : 'OFFLINE 🔴'}`
        },
        ...prev
      ]);
      setParticipantsList(prev => prev.map(p => {
        if (p.id === data.id) {
          return { ...p, is_online: data.is_online, last_active_at: new Date() };
        }
        return p;
      }));
    });
    socket.on('submission_evaluated', (data) => {
      fetchStats();
      setActionLogs(prev => [
        {
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          message: `Submission from "${data.username}": "${data.problem_title}" -> Verdict: ${data.status.toUpperCase()} (${data.passed_cases}/${data.total_cases})`
        },
        ...prev
      ]);
    });
    return () => {
      socket.off('leaderboard_dirty');
      socket.off('participant_status_changed');
      socket.off('submission_evaluated');
    };
  }, [socket]);

  // Handle contest status change
  const handleStatusChange = async (status) => {
    if (!selectedContest) return;
    try {
      const res = await axios.post(`/api/contests/${selectedContest.id}/status`, { status });
      setSelectedContest(res.data.contest);
      // Update in contests list
      setContests(prev => prev.map(c => c.id === res.data.contest.id ? res.data.contest : c));
      toast.success(`Contest status set to: ${status.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update contest status.');
    }
  };

  // Create Contest
  const handleCreateContest = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/contests', {
        title: contestTitle,
        description: contestDesc,
        duration_minutes: contestDuration
      });
      setContests(prev => [res.data.contest, ...prev]);
      setSelectedContest(res.data.contest);
      setShowCreateContest(false);
      setContestTitle('');
      setContestDesc('');
      toast.success('Contest created successfully.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create contest.');
    }
  };

  // Edit/Rename Contest
  const handleUpdateContest = async (e) => {
    e.preventDefault();
    if (!selectedContest) return;
    try {
      const res = await axios.put(`/api/contests/${selectedContest.id}`, {
        title: contestTitle,
        description: contestDesc,
        duration_minutes: contestDuration
      });
      setContests(prev => prev.map(c => c.id === res.data.contest.id ? res.data.contest : c));
      setSelectedContest(res.data.contest);
      setShowEditContest(false);
      setContestTitle('');
      setContestDesc('');
      toast.success('Contest updated successfully.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update contest.');
    }
  };

  // Delete Contest
  const handleDeleteContest = async (id) => {
    if (!window.confirm('Are you sure you want to delete this contest? All problems and submissions will be permanently removed.')) {
      return;
    }
    try {
      await axios.delete(`/api/contests/${id}`);
      setContests(prev => prev.filter(c => c.id !== id));
      if (selectedContest?.id === id) {
        const remaining = contests.filter(c => c.id !== id);
        setSelectedContest(remaining.length > 0 ? remaining[0] : null);
      }
      toast.success('Contest deleted successfully.');
    } catch (err) {
      toast.error('Failed to delete contest.');
    }
  };

  // Create/Update Problem
  const handleSaveProblem = async (e) => {
    e.preventDefault();
    if (!selectedContest) return;

    const hasPendingTestCase = problemFormTcInput !== '' || problemFormTcOutput !== '';
    if (!editingProblem && hasPendingTestCase && problemFormTcOutput === '') {
      toast.error('Expected output is required for the pending test case.');
      return;
    }

    const testCasesToCreate = !editingProblem
      ? [
          ...problemFormTestCases,
          ...(hasPendingTestCase
            ? [{
                input: problemFormTcInput,
                expected_output: problemFormTcOutput,
                is_hidden: problemFormTcIsHidden
              }]
            : [])
        ]
      : [];

    if (!editingProblem && testCasesToCreate.length === 0) {
      toast.error('Add at least one test case before saving the problem.');
      return;
    }

    const payload = {
      contest_id: selectedContest.id,
      title: probTitle,
      description: probDesc,
      starter_code: probCode,
      order_index: probOrder,
      time_limit_ms: probTimeLimit,
      memory_limit_kb: probMemoryLimit,
      points: probPoints
    };

    try {
      if (editingProblem) {
        const res = await axios.put(`/api/problems/admin/${editingProblem.id}`, payload);
        setProblems(prev => prev.map(p => p.id === editingProblem.id ? res.data.problem : p));
        toast.success('Problem updated.');
      } else {
        const res = await axios.post('/api/problems/admin', payload);
        const createdProblem = res.data.problem;
        let uploadedTestCases = 0;
        if (testCasesToCreate.length > 0) {
          try {
            await axios.post(`/api/problems/admin/${createdProblem.id}/testcases/bulk`, {
              testCases: testCasesToCreate.map(({ input, expected_output, is_hidden }) => ({
                input,
                expected_output,
                is_hidden
              }))
            });
            uploadedTestCases = testCasesToCreate.length;
          } catch (testCaseErr) {
            console.error('Problem created, but test-case upload failed:', testCaseErr);
            toast.error('Problem added, but test cases failed to upload.');
          }
        }
        setProblems(prev => [...prev, createdProblem].sort((a, b) => a.order_index - b.order_index));
        if (uploadedTestCases > 0 || testCasesToCreate.length === 0) {
          toast.success(
            uploadedTestCases > 0
              ? `Problem added with ${uploadedTestCases} test case${uploadedTestCases === 1 ? '' : 's'}.`
              : 'Problem added.'
          );
        }
      }
      resetProblemForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save problem.');
    }
  };

  const handleAddProblemFormTestCase = () => {
    if (problemFormTcInput.trim() === '' || problemFormTcOutput.trim() === '') {
      toast.error('Both Stdin input and expected output are required for each test case.');
      return;
    }

    setProblemFormTestCases(prev => [
      ...prev,
      {
        tempId: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        input: problemFormTcInput.trim(),
        expected_output: problemFormTcOutput.trim(),
        is_hidden: problemFormTcIsHidden
      }
    ]);
    setProblemFormTcInput('');
    setProblemFormTcOutput('');
    setProblemFormTcIsHidden(true);
  };

  // Generate expected output by running starter code against the input (problem form)
  const handleGenerateOutput = async () => {
    if (!probCode) {
      toast.error('Enter the starter code first to generate output.');
      return;
    }
    if (problemFormTcInput.trim() === '') {
      toast.error('Enter a valid Stdin input first before generating output.');
      return;
    }
    setIsGeneratingOutput(true);
    try {
      const res = await axios.post('/api/problems/admin/run-code', {
        sourceCode: probCode,
        input: problemFormTcInput,
        timeLimitMs: probTimeLimit,
        memoryLimitKb: probMemoryLimit
      });
      if (res.data.success) {
        setProblemFormTcOutput(res.data.standardizedOutput || res.data.output.trim());
        toast.success('Output generated from starter code.');
      } else {
        toast.error(`Run failed: ${res.data.error || res.data.status}`);
      }
    } catch (err) {
      toast.error('Failed to run code on server.');
    } finally {
      setIsGeneratingOutput(false);
    }
  };

  const handleRemoveProblemFormTestCase = (tempId) => {
    setProblemFormTestCases(prev => prev.filter(tc => tc.tempId !== tempId));
  };

  const resetProblemForm = () => {
    setShowProblemForm(false);
    setEditingProblem(null);
    setProbTitle('');
    setProbDesc('');
    setProbCode('');
    setProbOrder(problems.length + 1);
    setProbTimeLimit(2000);
    setProbMemoryLimit(128000);
    setProbPoints(100);
    setProblemFormTestCases([]);
    setProblemFormTcInput('');
    setProblemFormTcOutput('');
    setProblemFormTcIsHidden(true);
  };

  const handleEditProblem = (prob) => {
    setEditingProblem(prob);
    setProbTitle(prob.title);
    setProbDesc(prob.description);
    setProbCode(prob.starter_code);
    setProbOrder(prob.order_index);
    setProbTimeLimit(prob.time_limit_ms);
    setProbMemoryLimit(prob.memory_limit_kb);
    setProbPoints(prob.points);
    setProblemFormTestCases([]);
    setProblemFormTcInput('');
    setProblemFormTcOutput('');
    setProblemFormTcIsHidden(true);
    setShowProblemForm(true);
  };

  const handleDeleteProblem = async (id) => {
    if (!confirm('Are you sure you want to delete this problem?')) return;
    try {
      await axios.delete(`/api/problems/admin/${id}`);
      setProblems(prev => prev.filter(p => p.id !== id));
      toast.success('Problem deleted.');
    } catch (err) {
      toast.error('Failed to delete problem.');
    }
  };

  // Test Cases management
  const openTestCasesManager = async (prob) => {
    setSelectedProblemForTC(prob);
    try {
      const res = await axios.get(`/api/problems/admin/${prob.id}/testcases`);
      setTestCases(res.data.testCases);
    } catch (err) {
      toast.error('Failed to load test cases.');
    }
  };

  const handleAddTestCase = async (e) => {
    e.preventDefault();
    if (!selectedProblemForTC) return;
    if (tcInput.trim() === '' || tcOutput.trim() === '') {
      toast.error('Both Stdin input and expected output are required.');
      return;
    }
    try {
      const res = await axios.post(`/api/problems/admin/${selectedProblemForTC.id}/testcases`, {
        input: tcInput.trim(),
        expected_output: tcOutput.trim(),
        is_hidden: tcIsHidden
      });
      setTestCases(prev => [...prev, res.data.testCase]);
      setTcInput('');
      setTcOutput('');
      toast.success('Testcase added.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add testcase.');
    }
  };

  // Generate expected output by running starter code (test case manager)
  const handleGenerateOutputTC = async () => {
    if (!selectedProblemForTC) return;
    if (tcInput.trim() === '') {
      toast.error('Enter a valid Stdin input first before generating output.');
      return;
    }
    setIsGeneratingOutputTC(true);
    try {
      const res = await axios.post('/api/problems/admin/run-code', {
        sourceCode: selectedProblemForTC.starter_code,
        input: tcInput,
        timeLimitMs: selectedProblemForTC.time_limit_ms,
        memoryLimitKb: selectedProblemForTC.memory_limit_kb
      });
      if (res.data.success) {
        setTcOutput(res.data.standardizedOutput || res.data.output.trim());
        toast.success('Output generated from starter code.');
      } else {
        toast.error(`Run failed: ${res.data.error || res.data.status}`);
      }
    } catch (err) {
      toast.error('Failed to run code on server.');
    } finally {
      setIsGeneratingOutputTC(false);
    }
  };

  const handleBulkUploadTC = async (e) => {
    e.preventDefault();
    if (!selectedProblemForTC) return;
    try {
      const parsed = JSON.parse(bulkTcJson);
      const res = await axios.post(`/api/problems/admin/${selectedProblemForTC.id}/testcases/bulk`, {
        testCases: parsed
      });
      setTestCases(prev => [...prev, ...res.data.testCases]);
      setBulkTcJson('');
      toast.success(res.data.message || 'Bulk testcases uploaded successfully.');
    } catch (err) {
      toast.error('Failed to upload bulk test cases. Ensure valid JSON list format.');
    }
  };

  const handleDeleteTestCase = async (id) => {
    try {
      await axios.delete(`/api/problems/admin/testcases/${id}`);
      setTestCases(prev => prev.filter(tc => tc.id !== id));
      toast.success('Test case removed.');
    } catch (err) {
      toast.error('Failed to delete testcase.');
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 text-slate-200 overflow-hidden font-sans relative">
      {/* Premium Ambient Light Leaks */}
      <div className="absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none"></div>

      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 border-r border-white/[0.05] bg-slate-900/15 backdrop-blur-md p-6 flex flex-col justify-between shrink-0 z-10 shadow-[4px_0_30px_rgba(0,0,0,0.3)]">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="font-extrabold tracking-tight text-white">DebugLab</h2>
              <span className="text-[9px] uppercase tracking-widest text-indigo-400 font-black font-mono">Console</span>
            </div>
          </div>

          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('controls')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition duration-300 border ${activeTab === 'controls'
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-white border-transparent'
                }`}
            >
              <Clock size={16} />
              Contest Controls
            </button>
            <button
              onClick={() => setActiveTab('problems')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition duration-300 border ${activeTab === 'problems'
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-white border-transparent'
                }`}
            >
              <FileText size={16} />
              Problems Manager
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition duration-300 border ${activeTab === 'participants'
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-white border-transparent'
                }`}
            >
              <Users size={16} />
              Participants
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition duration-300 border ${activeTab === 'leaderboard'
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-white border-transparent'
                }`}
            >
              <Award size={16} />
              Live Leaderboard
            </button>
          </nav>
        </div>

        <div className="border-t border-white/[0.05] pt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-full bg-slate-800 border border-white/[0.08] flex items-center justify-center text-xs font-bold text-slate-300 uppercase">
              {user?.username?.[0] || 'A'}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-300">{user?.username}</p>
              <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Orchestrator</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 justify-center px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.08] text-xs text-slate-400 hover:bg-white/[0.06] hover:text-white transition duration-300"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-900/5 overflow-y-auto z-10">
        <header className="h-16 border-b border-white/[0.05] px-8 flex justify-between items-center bg-slate-900/40 backdrop-blur-md shrink-0 shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider font-mono">Selected Contest:</span>
            {selectedContest ? (
              <select
                value={selectedContest.id}
                onChange={(e) => setSelectedContest(contests.find(c => c.id === e.target.value))}
                className="bg-slate-950 border border-white/[0.08] text-white rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500/80 transition-all duration-300 font-sans"
              >
                {contests.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-semibold text-slate-400">None</span>
            )}
            <button
              onClick={() => {
                setContestTitle('');
                setContestDesc('');
                setContestDuration(60);
                setShowCreateContest(true);
              }}
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-bold"
            >
              <Plus size={12} /> New
            </button>
            {selectedContest && (
              <>
                <button
                  onClick={() => {
                    setContestTitle(selectedContest.title);
                    setContestDesc(selectedContest.description || '');
                    setContestDuration(selectedContest.duration_minutes || 60);
                    setShowEditContest(true);
                  }}
                  className="text-xs text-slate-400 hover:underline flex items-center gap-1 font-bold"
                >
                  <Edit2 size={12} /> Rename
                </button>
                <button
                  onClick={() => handleDeleteContest(selectedContest.id)}
                  className="text-xs text-red-500/80 hover:underline flex items-center gap-1 font-bold"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </>
            )}
          </div>

          {selectedContest && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider font-mono">Status:</span>
              <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-lg uppercase tracking-wider border ${selectedContest.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                  selectedContest.status === 'paused' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                    selectedContest.status === 'ended' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                      'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                {selectedContest.status}
              </span>
            </div>
          )}
        </header>

        <div className="flex-1 p-8">
          {/* TAB 1: CONTEST CONTROLS */}
          {activeTab === 'controls' && selectedContest && (
            <div className="space-y-6 max-w-4xl">
              {/* Overview Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-white/[0.05] bg-slate-900/20 p-5 flex flex-col hover:bg-slate-900/30 hover:scale-[1.01] transition-all duration-300 shadow-lg">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 font-bold">Total Registered</span>
                  <span className="text-3xl font-black text-white mt-1.5">{stats.totalParticipants}</span>
                  <span className="text-[10px] text-slate-500 mt-1">Participants on roster</span>
                </div>
                <div className="rounded-xl border border-white/[0.05] bg-slate-900/20 p-5 flex flex-col hover:bg-slate-900/30 hover:scale-[1.01] transition-all duration-300 shadow-lg">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 font-bold">Active Online</span>
                  <span className="text-3xl font-black text-emerald-400 mt-1.5 flex items-center gap-2">
                    {stats.onlineParticipants}
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Sockets connected now</span>
                </div>
                <div className="rounded-xl border border-white/[0.05] bg-slate-900/20 p-5 flex flex-col hover:bg-slate-900/30 hover:scale-[1.01] transition-all duration-300 shadow-lg">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 font-bold">Submissions Made</span>
                  <span className="text-3xl font-black text-cyan-400 mt-1.5">{stats.totalSubmissions}</span>
                  <span className="text-[10px] text-slate-500 mt-1">Evaluated by judge sandbox</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-900 bg-slate-950/80 p-6">
                <h3 className="text-lg font-bold mb-1 text-white">Contest Status Manager</h3>
                <p className="text-slate-400 text-sm mb-6">Transition the contest session lifecycle state in real-time.</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <button
                    onClick={() => handleStatusChange('ready')}
                    disabled={selectedContest.status === 'ready'}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-900 bg-black/60 hover:bg-slate-900 transition disabled:opacity-40"
                  >
                    <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                      <ChevronRight size={20} className="text-slate-400" />
                    </div>
                    <span className="text-sm font-semibold">Set Ready</span>
                    <span className="text-[10px] text-slate-500 mt-1">Pre-launch login status</span>
                  </button>

                  <button
                    onClick={() => handleStatusChange('active')}
                    disabled={selectedContest.status === 'active'}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-900 bg-black/60 hover:bg-slate-900 transition disabled:opacity-40"
                  >
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3">
                      <Play size={18} className="text-emerald-400" fill="currentColor" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">Start / Resume</span>
                    <span className="text-[10px] text-slate-500 mt-1">Allow submissions & coding</span>
                  </button>

                  <button
                    onClick={() => handleStatusChange('paused')}
                    disabled={selectedContest.status === 'paused'}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-900 bg-black/60 hover:bg-slate-900 transition disabled:opacity-40"
                  >
                    <div className="h-10 w-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
                      <Pause size={18} className="text-amber-400" />
                    </div>
                    <span className="text-sm font-semibold text-amber-400">Pause Contest</span>
                    <span className="text-[10px] text-slate-500 mt-1">Lock editor interface</span>
                  </button>

                  <button
                    onClick={() => handleStatusChange('ended')}
                    disabled={selectedContest.status === 'ended'}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-900 bg-black/60 hover:bg-slate-900 transition disabled:opacity-40"
                  >
                    <div className="h-10 w-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3">
                      <Award size={18} className="text-red-400" />
                    </div>
                    <span className="text-sm font-semibold text-red-400">End Session</span>
                    <span className="text-[10px] text-slate-500 mt-1">Finalize scores & locking</span>
                  </button>
                </div>
              </div>

              {/* Contest Config details */}
              <div className="rounded-xl border border-slate-900 bg-slate-950/80 p-6">
                <h3 className="text-lg font-bold mb-4 text-white">Contest Settings</h3>
                <div className="grid grid-cols-2 gap-6 text-sm">
                  <div>
                    <label className="text-slate-500 block mb-1">Contest Name</label>
                    <p className="font-semibold text-slate-200">{selectedContest.title}</p>
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1">Duration</label>
                    <p className="font-semibold text-slate-200">{selectedContest.duration_minutes} Minutes</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-slate-500 block mb-1">Description</label>
                    <p className="text-slate-400 leading-relaxed">{selectedContest.description || 'No description provided.'}</p>
                  </div>
                </div>
              </div>

              {/* Action Logs Feed */}
              <div className="rounded-xl border border-slate-900 bg-slate-950/80 p-6 flex flex-col h-72">
                <h3 className="text-lg font-bold mb-1 text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
                  Live Action Log Feed
                </h3>
                <p className="text-slate-400 text-xs mb-4 font-sans">Real-time socket events representing participant and submission actions.</p>
                <div className="flex-1 min-h-0 bg-black rounded border border-slate-900 p-4 font-mono text-xs text-slate-400 overflow-y-auto space-y-2 select-text">
                  {actionLogs.length === 0 ? (
                    <div className="text-slate-600 text-center py-12 font-sans">Listening for incoming connections and runs...</div>
                  ) : (
                    actionLogs.map((log) => (
                      <div key={log.id} className="flex gap-2 leading-relaxed">
                        <span className="text-cyan-500 shrink-0">[{log.time}]</span>
                        <span className="text-slate-300">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROBLEMS MANAGER */}
          {activeTab === 'problems' && selectedContest && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white">Problems Configuration</h3>
                  <p className="text-xs text-slate-500">Manage C coding problems ordered by sequential unlock priority.</p>
                </div>
                {!showProblemForm && (
                  <button
                    onClick={() => {
                      setEditingProblem(null);
                      setProbOrder(problems.length + 1);
                      setShowProblemForm(true);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold hover:bg-cyan-500 transition"
                  >
                    <Plus size={16} /> Add Problem
                  </button>
                )}
              </div>

              {showProblemForm ? (
                <form onSubmit={handleSaveProblem} className="rounded-xl border border-slate-900 bg-slate-950/80 p-6 space-y-4 max-w-3xl">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-cyan-400">{editingProblem ? 'Edit Problem' : 'New Problem'}</h4>
                    <button type="button" onClick={resetProblemForm} className="text-slate-400 hover:text-white">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                      <label className="text-xs text-slate-400 font-semibold uppercase">Problem Title</label>
                      <input
                        type="text"
                        value={probTitle}
                        onChange={(e) => setProbTitle(e.target.value)}
                        placeholder="e.g. Debug the Fibonnaci Sequence"
                        className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-sm focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className="text-xs text-slate-400 font-semibold uppercase">Problem Description (Markdown supported)</label>
                      <textarea
                        value={probDesc}
                        onChange={(e) => setProbDesc(e.target.value)}
                        placeholder="Describe the bug in the algorithm..."
                        rows={4}
                        className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-sm focus:outline-none focus:border-cyan-500 font-sans"
                        required
                      />
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className="text-xs text-slate-400 font-semibold uppercase">Buggy Starter Code (C program)</label>
                      <textarea
                        value={probCode}
                        onChange={(e) => setProbCode(e.target.value)}
                        placeholder="#include <stdio.h>..."
                        rows={8}
                        className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-sm font-mono focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-semibold uppercase">Order index (Unlocking sequence)</label>
                      <input
                        type="number"
                        value={probOrder}
                        onChange={(e) => setProbOrder(parseInt(e.target.value, 10))}
                        className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-sm focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-semibold uppercase">Points</label>
                      <input
                        type="number"
                        value={probPoints}
                        onChange={(e) => setProbPoints(parseInt(e.target.value, 10))}
                        className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-sm focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-semibold uppercase">Time Limit (ms)</label>
                      <input
                        type="number"
                        value={probTimeLimit}
                        onChange={(e) => setProbTimeLimit(parseInt(e.target.value, 10))}
                        className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-sm focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-semibold uppercase">Memory Limit (KB)</label>
                      <input
                        type="number"
                        value={probMemoryLimit}
                        onChange={(e) => setProbMemoryLimit(parseInt(e.target.value, 10))}
                        className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-sm focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>
                  </div>

                  {!editingProblem && (
                    <div className="border-t border-slate-900 pt-5 space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h5 className="text-xs font-bold text-cyan-400 uppercase">Initial Test Cases</h5>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Add cases now, or manage them later from the test-case panel.
                          </p>
                        </div>
                        <span className="rounded border border-slate-800 bg-black px-2 py-1 text-[10px] font-mono text-slate-400">
                          {problemFormTestCases.length} queued
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 uppercase font-semibold">Stdin Input</label>
                          <textarea
                            value={problemFormTcInput}
                            onChange={(e) => setProblemFormTcInput(e.target.value)}
                            placeholder="e.g. 5"
                            rows={3}
                            className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-xs font-mono focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 uppercase font-semibold">Expected Stdout</label>
                          <textarea
                            value={problemFormTcOutput}
                            onChange={(e) => setProblemFormTcOutput(e.target.value)}
                            placeholder="e.g. 120"
                            rows={3}
                            className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-xs font-mono focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={problemFormTcIsHidden}
                            onChange={(e) => setProblemFormTcIsHidden(e.target.checked)}
                            className="accent-cyan-500 rounded border-slate-900 bg-black"
                          />
                          Hidden Test Case
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleGenerateOutput}
                            disabled={isGeneratingOutput}
                            className="flex items-center gap-1.5 rounded bg-emerald-900/40 border border-emerald-700/40 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-800/40 transition disabled:opacity-40"
                          >
                            <Play size={10} fill="currentColor" />
                            {isGeneratingOutput ? 'Running...' : 'Generate Output'}
                          </button>
                          <button
                            type="button"
                            onClick={handleAddProblemFormTestCase}
                            className="flex items-center gap-1.5 rounded bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs font-semibold text-cyan-400 hover:bg-slate-800 transition"
                          >
                            <Plus size={12} /> Add Case
                          </button>
                        </div>
                      </div>

                      {problemFormTestCases.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {problemFormTestCases.map((tc, index) => (
                            <div key={tc.tempId} className="flex justify-between items-center rounded border border-slate-900 bg-black/40 p-2.5 text-xs">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-[10px] text-slate-500">Case #{index + 1}</span>
                                  {tc.is_hidden ? (
                                    <span className="flex items-center gap-0.5 text-[9px] text-amber-500 bg-amber-500/5 border border-amber-500/20 px-1 rounded font-mono">
                                      <EyeOff size={8} /> Hidden
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-0.5 text-[9px] text-cyan-500 bg-cyan-500/5 border border-cyan-500/20 px-1 rounded font-mono">
                                      <Eye size={8} /> Public
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 font-mono text-[10px] text-slate-400">
                                  <p className="truncate">In: "{tc.input}"</p>
                                  <p className="truncate">Out: "{tc.expected_output}"</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveProblemFormTestCase(tc.tempId)}
                                className="text-slate-600 hover:text-red-400 p-1 shrink-0"
                                title="Remove queued test case"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={resetProblemForm}
                      className="px-4 py-2 border border-slate-900 rounded bg-slate-950 text-sm text-slate-400 hover:bg-slate-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold flex items-center gap-1.5"
                    >
                      <Save size={16} /> Save Problem
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Problems List */}
                  <div className="rounded-xl border border-slate-900 bg-slate-950/80 p-6 space-y-4">
                    <h4 className="font-bold text-white mb-2">Problems List</h4>
                    {problems.length === 0 ? (
                      <p className="text-xs text-slate-600 py-4 text-center">No problems uploaded. Click "Add Problem" to begin.</p>
                    ) : (
                      <div className="divide-y divide-slate-900">
                        {problems.map((p) => (
                          <div key={p.id} className="py-3 flex justify-between items-center group">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-cyan-500">#{p.order_index}</span>
                                <h5 className="font-bold text-sm text-slate-200">{p.title}</h5>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5">Points: {p.points} | Limits: {p.time_limit_ms}ms / {p.memory_limit_kb}KB</p>
                            </div>
                            <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 transition">
                              <button
                                onClick={() => handleEditProblem(p)}
                                className="p-1.5 hover:text-cyan-400 transition"
                                title="Edit Problem"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => openTestCasesManager(p)}
                                className={`p-1.5 hover:text-cyan-400 transition ${selectedProblemForTC?.id === p.id ? 'text-cyan-400' : ''}`}
                                title="Manage Test Cases"
                              >
                                <Database size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteProblem(p.id)}
                                className="p-1.5 hover:text-red-400 transition"
                                title="Delete Problem"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Test Cases Management */}
                  {selectedProblemForTC ? (
                    <div className="rounded-xl border border-slate-900 bg-slate-950/80 p-6 space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                        <div>
                          <h4 className="font-bold text-white">Test Cases Manager</h4>
                          <span className="text-[10px] text-slate-500">Problem: {selectedProblemForTC.title}</span>
                        </div>
                        <button onClick={() => setSelectedProblemForTC(null)} className="text-slate-400 hover:text-white">
                          <X size={16} />
                        </button>
                      </div>

                      {/* Single Test Case Form */}
                      <form onSubmit={handleAddTestCase} className="space-y-3">
                        <h5 className="text-xs font-bold text-cyan-400 uppercase">Add Test Case</h5>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Stdin Input</label>
                            <textarea
                              value={tcInput}
                              onChange={(e) => setTcInput(e.target.value)}
                              placeholder="e.g. 5"
                              rows={2}
                              className="w-full rounded border border-slate-900 bg-black py-1.5 px-2.5 text-xs font-mono focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 uppercase font-semibold">Expected Stdout</label>
                            <textarea
                              value={tcOutput}
                              onChange={(e) => setTcOutput(e.target.value)}
                              placeholder="e.g. 5\n"
                              rows={2}
                              className="w-full rounded border border-slate-900 bg-black py-1.5 px-2.5 text-xs font-mono focus:outline-none focus:border-cyan-500"
                              required
                            />
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tcIsHidden}
                              onChange={(e) => setTcIsHidden(e.target.checked)}
                              className="accent-cyan-500 rounded border-slate-900 bg-black"
                            />
                            Hidden Test Case
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleGenerateOutputTC}
                              disabled={isGeneratingOutputTC}
                              className="flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 rounded py-1 px-2.5 text-xs font-semibold hover:bg-emerald-800/40 transition disabled:opacity-40"
                            >
                              <Play size={10} fill="currentColor" />
                              {isGeneratingOutputTC ? 'Running...' : 'Generate Output'}
                            </button>
                            <button
                              type="submit"
                              className="bg-cyan-600 hover:bg-cyan-500 text-white rounded py-1 px-3 text-xs font-semibold"
                            >
                              Add Case
                            </button>
                          </div>
                        </div>
                      </form>

                      {/* Bulk upload form */}
                      <form onSubmit={handleBulkUploadTC} className="space-y-3 border-t border-slate-900 pt-4">
                        <h5 className="text-xs font-bold text-cyan-400 uppercase">Bulk Upload (JSON format)</h5>
                        <textarea
                          value={bulkTcJson}
                          onChange={(e) => setBulkTcJson(e.target.value)}
                          placeholder='[\n  { "input": "5", "expected_output": "120", "is_hidden": true }\n]'
                          rows={3}
                          className="w-full rounded border border-slate-900 bg-black py-1.5 px-2.5 text-xs font-mono focus:outline-none focus:border-cyan-500"
                          required
                        />
                        <div className="text-[9px] text-slate-500 leading-normal">
                          Provide an array of objects containing <code>input</code>, <code>expected_output</code>, and optionally <code>is_hidden</code>.
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-cyan-400 rounded py-1 px-3 text-xs font-semibold"
                          >
                            Upload List
                          </button>
                        </div>
                      </form>

                      {/* Test case list */}
                      <div className="border-t border-slate-900 pt-4">
                        <h5 className="text-xs font-bold text-white mb-3">Loaded Cases ({testCases.length})</h5>
                        {testCases.length === 0 ? (
                          <p className="text-[10px] text-slate-600 py-2">No test cases loaded.</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {testCases.map((tc, index) => (
                              <div key={tc.id} className="flex justify-between items-center border border-slate-900 bg-black/40 rounded p-2.5 text-xs">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-[10px] text-slate-500">Case #{index + 1}</span>
                                    {tc.is_hidden ? (
                                      <span className="flex items-center gap-0.5 text-[9px] text-amber-500 bg-amber-500/5 border border-amber-500/20 px-1 rounded font-mono">
                                        <EyeOff size={8} /> Hidden
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-0.5 text-[9px] text-cyan-500 bg-cyan-500/5 border border-cyan-500/20 px-1 rounded font-mono">
                                        <Eye size={8} /> Public
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-4 font-mono text-[10px] text-slate-400">
                                    <p className="truncate">In: "{tc.input}"</p>
                                    <p className="truncate">Out: "{tc.expected_output}"</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteTestCase(tc.id)}
                                  className="text-slate-600 hover:text-red-400 p-1"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-900 border-dashed bg-slate-950/10 flex items-center justify-center text-center p-8">
                      <div>
                        <Database size={24} className="text-slate-700 mx-auto mb-2" />
                        <p className="text-xs text-slate-600">Select a problem to view and manage test cases.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PARTICIPANTS */}
          {activeTab === 'participants' && selectedContest && (
            <div className="rounded-xl border border-slate-900 bg-slate-950/80 p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Participants Listing</h3>
                  <p className="text-slate-400 text-xs mt-0.5">View real-time participant connection statuses and active problem drafts.</p>
                </div>
                <button
                  onClick={fetchParticipants}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-cyan-400 font-semibold transition"
                >
                  <RefreshCcw size={12} /> Sync Statuses
                </button>
              </div>

              {participantsList.length === 0 ? (
                <div className="text-center py-12 text-slate-600 text-xs border border-dashed border-slate-900 rounded-lg bg-black/40">
                  No participants registered. Sign them in from client machines to view connectivity logs.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-900 text-[11px] uppercase tracking-wider text-slate-500 font-mono font-normal">
                        <th className="py-3 px-4 font-normal">Status</th>
                        <th className="py-3 px-4 font-normal">Username / ID</th>
                        <th className="py-3 px-4 font-normal text-center">Active Problem</th>
                        <th className="py-3 px-4 font-normal text-right">Last Sync Ping</th>
                        <th className="py-3 px-4 font-normal text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {participantsList.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-900/20 transition">
                          <td className="py-3.5 px-4">
                            <span className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${p.is_online
                                  ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse'
                                  : 'bg-slate-700'
                                }`} />
                              <span className={`text-xs font-semibold ${p.is_online ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {p.is_online ? 'Online' : 'Offline'}
                              </span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-200">{p.username}</td>
                          <td className="py-3.5 px-4 text-center font-mono text-xs">
                            {p.current_problem_title ? (
                              <span className="text-cyan-400">
                                #{p.current_problem_order} - {p.current_problem_title}
                              </span>
                            ) : (
                              <span className="text-slate-600">None assigned</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-500 text-xs">
                            {p.last_active_at ? new Date(p.last_active_at).toLocaleTimeString() : 'Never'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => openParticipantModal(p)}
                              className="text-xs text-cyan-400 hover:underline hover:text-cyan-300 font-semibold"
                            >
                              Inspect Live Code
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LEADERBOARD */}
          {activeTab === 'leaderboard' && selectedContest && (
            <div className="rounded-xl border border-slate-900 bg-slate-950/80 p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Contest Leaderboard</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Real-time standings of participant scores.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 border border-slate-800 hover:bg-slate-805 text-xs text-emerald-400 font-semibold transition"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={fetchLeaderboard}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-cyan-400 font-semibold transition"
                  >
                    <RefreshCcw size={12} /> Sync Scores
                  </button>
                </div>
              </div>

              {leaderboardList.length === 0 ? (
                <div className="text-center py-12 text-slate-600 text-xs border border-dashed border-slate-900 rounded-lg bg-black/40">
                  No submissions have been evaluated yet. Once grading begins, standings will register here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-900 text-[11px] uppercase tracking-wider text-slate-500 font-mono font-normal">
                        <th className="py-3 px-4 font-normal">Rank</th>
                        <th className="py-3 px-4 font-normal">Participant ID</th>
                        <th className="py-3 px-4 font-normal text-center">Problems Solved</th>
                        <th className="py-3 px-4 font-normal text-right">Total Score</th>
                        <th className="py-3 px-4 font-normal text-right">Last Accepted Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {leaderboardList.map((row) => {
                        const isTop3 = row.rank <= 3;
                        return (
                          <tr key={row.participant_id} className="hover:bg-slate-900/20 transition">
                            <td className="py-3.5 px-4 font-mono font-bold">
                              {isTop3 ? (
                                <span className={`flex items-center gap-1 text-sm ${row.rank === 1 ? 'text-yellow-500' :
                                    row.rank === 2 ? 'text-slate-400' :
                                      'text-amber-600'
                                  }`}>
                                  🏆 {row.rank}
                                </span>
                              ) : (
                                <span>{row.rank}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-200">{row.username}</td>
                            <td className="py-3.5 px-4 text-center font-mono font-bold text-cyan-400">{row.problems_solved}</td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-white">{row.score} pts</td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                              {row.last_accepted_time
                                ? new Date(row.last_accepted_time).toLocaleTimeString()
                                : '-'
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* CREATE CONTEST DIALOG MODAL */}
      {showCreateContest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-900 bg-slate-950 p-6 shadow-[0_0_50px_rgba(6,182,212,0.08)]">
            <div className="flex justify-between items-center mb-6 border-b border-slate-900 pb-3">
              <h3 className="text-lg font-bold text-cyan-400">Create New Contest</h3>
              <button onClick={() => setShowCreateContest(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateContest} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase">Contest Title</label>
                <input
                  type="text"
                  value={contestTitle}
                  onChange={(e) => setContestTitle(e.target.value)}
                  placeholder="e.g. ACM Debugging Fall 2026"
                  className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase">Description</label>
                <textarea
                  value={contestDesc}
                  onChange={(e) => setContestDesc(e.target.value)}
                  placeholder="Enter details about rules and guidelines..."
                  rows={3}
                  className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-sm focus:outline-none focus:border-cyan-500 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase">Duration (Minutes)</label>
                <input
                  type="number"
                  value={contestDuration}
                  onChange={(e) => setContestDuration(parseInt(e.target.value, 10))}
                  className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateContest(false)}
                  className="px-4 py-2 border border-slate-900 rounded bg-slate-950 text-sm text-slate-400 hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} /> Create Contest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CONTEST DIALOG MODAL */}
      {showEditContest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-900 bg-slate-950 p-6 shadow-[0_0_50px_rgba(6,182,212,0.08)]">
            <div className="flex justify-between items-center mb-6 border-b border-slate-900 pb-3">
              <h3 className="text-lg font-bold text-cyan-400">Rename / Edit Contest</h3>
              <button onClick={() => setShowEditContest(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateContest} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase">Contest Title</label>
                <input
                  type="text"
                  value={contestTitle}
                  onChange={(e) => setContestTitle(e.target.value)}
                  placeholder="e.g. ACM Debugging Fall 2026"
                  className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase">Description</label>
                <textarea
                  value={contestDesc}
                  onChange={(e) => setContestDesc(e.target.value)}
                  placeholder="Enter details about rules and guidelines..."
                  rows={3}
                  className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-sm focus:outline-none focus:border-cyan-500 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-semibold uppercase">Duration (Minutes)</label>
                <input
                  type="number"
                  value={contestDuration}
                  onChange={(e) => setContestDuration(parseInt(e.target.value, 10))}
                  className="w-full rounded border border-slate-900 bg-black py-2 px-3 text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditContest(false)}
                  className="px-4 py-2 border border-slate-900 rounded bg-slate-950 text-sm text-slate-400 hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT PARTICIPANT LIVE CODE MODAL */}
      {selectedParticipantForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-900 bg-slate-950 p-6 shadow-[0_0_50px_rgba(6,182,212,0.1)] flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 border-b border-slate-900 pb-3 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-cyan-400">Inspect Live Code: {selectedParticipantForModal.username}</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-sans">View active code drafts in progress.</p>
              </div>
              <button
                onClick={() => {
                  setSelectedParticipantForModal(null);
                  setParticipantDraftsMap({});
                }}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Problem Draft selector tab bar */}
            <div className="flex gap-2 border-b border-slate-900 pb-3 shrink-0 overflow-x-auto">
              {problems.map((prob) => {
                const hasDraft = !!participantDraftsMap[prob.id];
                return (
                  <button
                    key={prob.id}
                    onClick={() => setSelectedDraftProblemId(prob.id)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold border transition shrink-0 ${selectedDraftProblemId === prob.id
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                        : hasDraft
                          ? 'bg-slate-900 border-slate-800 text-slate-300'
                          : 'bg-black/40 border-transparent text-slate-600'
                      }`}
                  >
                    #{prob.order_index} {prob.title} {hasDraft && '✏️'}
                  </button>
                );
              })}
            </div>

            {/* Code Draft viewer panel */}
            <div className="flex-1 min-h-0 overflow-y-auto mt-4 rounded border border-slate-900 bg-black p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap select-text">
              {selectedDraftProblemId ? (
                participantDraftsMap[selectedDraftProblemId] ? (
                  <pre className="leading-relaxed">{participantDraftsMap[selectedDraftProblemId]}</pre>
                ) : (
                  <div className="text-center py-20 text-slate-600 font-sans">
                    No code draft has been saved yet by the participant for this problem.
                  </div>
                )
              ) : (
                <div className="text-center py-20 text-slate-600 font-sans">
                  Select a problem tab above to view the participant's active draft code.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-900 mt-4 shrink-0">
              <button
                onClick={() => {
                  setSelectedParticipantForModal(null);
                  setParticipantDraftsMap({});
                }}
                className="px-4 py-2 border border-slate-900 rounded bg-slate-950 text-xs text-slate-400 hover:bg-slate-900"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
