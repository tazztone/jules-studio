import React, { useState, useEffect, useRef } from 'react';
import {
    Terminal, Github, Activity, CheckCircle, MessageSquare,
    Settings, Play, Plus, Clock, AlertCircle, FileCode2,
    GitPullRequest, LayoutDashboard, Copy, Code, ArrowLeft,
    Check, X, RefreshCw, Loader2
} from 'lucide-react';

const BASE_URL = 'https://jules.googleapis.com';

// --- API HELPER ---
const fetchJules = async (path, method = 'GET', body = null, apiKey) => {
    if (!apiKey) throw new Error("API Key is missing");
    const headers = {
        'x-goog-api-key': apiKey,
        ...(body && { 'Content-Type': 'application/json' })
    };
    const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error (${response.status}): ${errText}`);
    }

    // Handle empty responses (like 200 OK for POST :approvePlan)
    const text = await response.text();
    return text ? JSON.parse(text) : {};
};

// --- MOCK DATA (Mirrors Jules API Schema for Demo Mode) ---
const MOCK_SOURCES = [
    { name: 'sources/src-1', githubRepo: { owner: 'your-org', name: 'frontend-web', isPrivate: true, defaultBranch: 'main', branches: [{ name: 'main' }, { name: 'dev' }] } },
    { name: 'sources/src-2', githubRepo: { owner: 'your-org', name: 'backend-api', isPrivate: true, defaultBranch: 'main', branches: [{ name: 'main' }, { name: 'feature/auth' }] } },
    { name: 'sources/src-3', githubRepo: { owner: 'torvalds', name: 'linux', isPrivate: false, defaultBranch: 'master', branches: [{ name: 'master' }] } }
];

const MOCK_SESSIONS = [
    {
        name: 'sessions/sess-101',
        title: 'Build a Boba Tea ordering page',
        state: 'AWAITING_PLAN_APPROVAL',
        prompt: 'Create a new React component for ordering Boba tea. Include flavor selection and toppings.',
        sourceContext: { source: 'sources/src-1', githubRepoContext: { startingBranch: 'main' } },
        requirePlanApproval: true,
        automationMode: 'AUTO_CREATE_PR',
        createTime: new Date(Date.now() - 3600000).toISOString()
    },
    {
        name: 'sessions/sess-102',
        title: 'Fix auth middleware bug',
        state: 'IN_PROGRESS',
        prompt: 'The JWT middleware is failing on expired tokens instead of refreshing. Please fix.',
        sourceContext: { source: 'sources/src-2', githubRepoContext: { startingBranch: 'dev' } },
        requirePlanApproval: false,
        createTime: new Date(Date.now() - 7200000).toISOString()
    }
];

const MOCK_ACTIVITIES = [
    {
        name: 'sessions/sess-101/activities/act-1', type: 'agentMessaged',
        agentMessaged: { message: "I've analyzed the repository and located the components directory. I will now generate a plan to create the Boba ordering component." },
        createTime: new Date(Date.now() - 3500000).toISOString()
    },
    {
        name: 'sessions/sess-101/activities/act-2', type: 'planGenerated',
        planGenerated: {
            plan: {
                id: 'plan-1',
                steps: [
                    { id: 's1', index: 1, title: 'Create BobaComponent.jsx', description: 'Initialize functional component with state.' },
                    { id: 's2', index: 2, title: 'Add Tailwind styling', description: 'Style the grid layout for the menu items.' }
                ]
            }
        },
        createTime: new Date(Date.now() - 3400000).toISOString()
    },
    {
        name: 'sessions/sess-101/activities/act-3', type: 'progressUpdated',
        artifacts: [
            {
                type: 'BashOutput',
                bashOutput: { command: 'npm run test', stdout: 'PASS src/components/BobaComponent.test.jsx\nTests: 2 passed', exitCode: 0 }
            },
            {
                type: 'ChangeSet',
                changeSet: {
                    source: 'sources/src-1', suggestedCommitMessage: 'feat: add boba tea ordering component',
                    unidiffPatch: `--- a/src/App.jsx\n+++ b/src/App.jsx\n@@ -1,5 +1,6 @@\n import React from 'react';\n+import BobaMenu from './components/BobaMenu';\n \n function App() {\n   return (\n-    <div>Hello World</div>\n+    <div><BobaMenu /></div>\n   );\n }`
                }
            }
        ],
        createTime: new Date(Date.now() - 3300000).toISOString()
    }
];

// --- UTILITY COMPONENTS ---
const Badge = ({ children, color = 'blue' }) => {
    const colors = {
        blue: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
        green: 'bg-green-900/50 text-green-300 border-green-700/50',
        yellow: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50',
        red: 'bg-red-900/50 text-red-300 border-red-700/50',
        gray: 'bg-gray-800 text-gray-300 border-gray-600',
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[color] || colors.gray}`}>
            {children}
        </span>
    );
};

const StateBadge = ({ state }) => {
    const map = {
        'QUEUED': { color: 'gray', label: 'Queued' },
        'PLANNING': { color: 'blue', label: 'Planning' },
        'AWAITING_PLAN_APPROVAL': { color: 'yellow', label: 'Needs Approval' },
        'IN_PROGRESS': { color: 'blue', label: 'In Progress' },
        'COMPLETED': { color: 'green', label: 'Completed' },
        'FAILED': { color: 'red', label: 'Failed' },
    };
    const stringState = String(state || 'Unknown');
    const config = map[stringState] || { color: 'gray', label: stringState };
    return <Badge color={config.color}>{String(config.label)}</Badge>;
};

// --- MAIN VIEWS ---

const SourcesView = ({ apiKey }) => {
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!apiKey) {
            setSources(MOCK_SOURCES);
            setLoading(false);
            return;
        }

        setLoading(true);
        fetchJules('/v1alpha/sources', 'GET', null, apiKey)
            .then(res => setSources(res.sources || []))
            .catch(err => setError(String(err.message)))
            .finally(() => setLoading(false));
    }, [apiKey]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-white">Connected Repositories</h2>
                <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium">
                    <Plus size={16} /> Connect GitHub App
                </button>
            </div>

            {error && <div className="bg-red-900/20 text-red-400 p-4 rounded-lg border border-red-900/50">{error}</div>}

            {loading ? (
                <div className="flex items-center justify-center h-48 text-blue-400"><Loader2 className="animate-spin" size={32} /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sources.map((src) => (
                        <div key={src.name} className="bg-gray-800/50 border border-gray-700 p-5 rounded-xl hover:border-gray-500 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <Github className="text-gray-400" size={24} />
                                    <div>
                                        <h3 className="text-white font-medium">{String(src.githubRepo?.owner)} / {String(src.githubRepo?.name)}</h3>
                                        <p className="text-xs text-gray-400 truncate max-w-[150px]" title={src.name}>{String(src.name)}</p>
                                    </div>
                                </div>
                                <Badge color={src.githubRepo?.isPrivate ? 'gray' : 'green'}>
                                    {src.githubRepo?.isPrivate ? 'Private' : 'Public'}
                                </Badge>
                            </div>
                            <div className="space-y-2 mt-4 pt-4 border-t border-gray-700/50">
                                <div className="text-xs text-gray-400 flex items-center justify-between">
                                    <span>Default Branch:</span>
                                    <span className="font-mono bg-gray-900 px-2 py-1 rounded text-gray-300">{String(src.githubRepo?.defaultBranch || '')}</span>
                                </div>
                                <div className="text-xs text-gray-400 flex items-center justify-between">
                                    <span>Active Branches:</span>
                                    <span>{src.githubRepo?.branches?.length || 0}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const DiffViewer = ({ patch }) => {
    if (!patch) return null;
    const lines = typeof patch === 'string' ? patch.split('\n') : [];
    return (
        <div className="font-mono text-sm bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
            {lines.map((line, i) => {
                let colorClass = "text-gray-300";
                let bgClass = "bg-transparent";
                if (line.startsWith('+')) { colorClass = "text-green-400"; bgClass = "bg-green-900/20"; }
                else if (line.startsWith('-')) { colorClass = "text-red-400"; bgClass = "bg-red-900/20"; }
                else if (line.startsWith('@@')) colorClass = "text-blue-400";

                return (
                    <div key={i} className={`px-4 py-0.5 whitespace-pre-wrap ${colorClass} ${bgClass}`}>
                        {String(line || ' ')}
                    </div>
                );
            })}
        </div>
    );
};

const SessionDetailView = ({ session, onBack, apiKey }) => {
    const [activeTab, setActiveTab] = useState('timeline');
    const [chatInput, setChatInput] = useState('');
    const [activities, setActivities] = useState([]);
    const [sessionState, setSessionState] = useState(session.state);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const pollInterval = useRef(null);

    const loadActivities = async () => {
        if (!apiKey) {
            setActivities(MOCK_ACTIVITIES);
            setLoading(false);
            return;
        }
        try {
            const sessRes = await fetchJules(`/v1alpha/${session.name}`, 'GET', null, apiKey);
            setSessionState(sessRes.state);

            const actRes = await fetchJules(`/v1alpha/${session.name}/activities`, 'GET', null, apiKey);
            setActivities(actRes.activities || []);
        } catch (err) {
            console.error("Error polling activities:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadActivities();
        if (apiKey && ['QUEUED', 'PLANNING', 'IN_PROGRESS'].includes(sessionState)) {
            pollInterval.current = setInterval(loadActivities, 5000);
        }
        return () => clearInterval(pollInterval.current);
    }, [apiKey, session.name, sessionState]);

    const handleApprovePlan = async () => {
        setActionLoading(true);
        if (!apiKey) {
            setSessionState('IN_PROGRESS');
            setActivities(prev => [...prev, { name: `act-${Date.now()}`, type: 'userMessaged', userMessaged: { message: "Plan approved. Please proceed." }, createTime: new Date().toISOString() }]);
            setActionLoading(false);
            return;
        }

        try {
            await fetchJules(`/v1alpha/${session.name}:approvePlan`, 'POST', {}, apiKey);
            await loadActivities();
        } catch (err) {
            alert(`Error approving plan: ${err.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        const msg = chatInput;
        setChatInput('');
        setActionLoading(true);

        if (!apiKey) {
            setActivities(prev => [...prev, { name: `act-${Date.now()}`, type: 'userMessaged', userMessaged: { message: msg }, createTime: new Date().toISOString() }]);
            setActionLoading(false);
            return;
        }

        try {
            await fetchJules(`/v1alpha/${session.name}:sendMessage`, 'POST', { message: msg }, apiKey);
            await loadActivities();
        } catch (err) {
            alert(`Error sending message: ${err.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    const planActivity = activities.findLast(a => a.type === 'planGenerated' || !!a.planGenerated);
    const artifactActivities = activities.filter(a => a.artifacts && a.artifacts.length > 0);
    const outputs = session.outputs || [];

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors p-2 -ml-2 rounded-lg hover:bg-gray-800">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
                            {String(session.title || 'Untitled Session')}
                            <StateBadge state={sessionState} />
                        </h2>
                        <div className="flex gap-4 mt-2 text-sm text-gray-400">
                            <span className="flex items-center gap-1"><Github size={14} /> {String(session.sourceContext?.source?.split('/').pop() || '')}</span>
                            <span className="flex items-center gap-1"><GitPullRequest size={14} /> {String(session.sourceContext?.githubRepoContext?.startingBranch || '')}</span>
                            <span className="flex items-center gap-1"><Clock size={14} /> {new Date(session.createTime).toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>
                {outputs.map((out, i) => out.pullRequest ? (
                    <a key={i} href={out.pullRequest.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium border border-gray-700">
                        <Github size={16} /> View Pull Request
                    </a>
                ) : null)}
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
                {/* Left Column: Timeline & Chat */}
                <div className="flex flex-col bg-gray-800/30 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="p-4 bg-gray-800/50 border-b border-gray-800 font-medium text-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity size={18} className="text-blue-400" /> Activity Timeline
                        </div>
                        {loading ? <Loader2 size={16} className="text-gray-500 animate-spin" /> : null}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {activities.length === 0 && !loading ? (
                            <div className="text-gray-500 text-sm text-center py-8">No activities recorded yet.</div>
                        ) : activities.map((act, i) => (
                            <div key={act.name || i} className="flex gap-4">
                                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0 border border-gray-700">
                                    {act.type === 'userMessaged' ? <MessageSquare size={14} className="text-blue-400" /> :
                                        act.type === 'planGenerated' ? <FileCode2 size={14} className="text-purple-400" /> :
                                            act.type === 'progressUpdated' ? <RefreshCw size={14} className="text-green-400" /> :
                                                <Terminal size={14} className="text-gray-400" />}
                                </div>
                                <div className="flex-1 bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{String(act.type)}</span>
                                        <span className="text-xs text-gray-500">{new Date(act.createTime).toLocaleTimeString()}</span>
                                    </div>
                                    {act.agentMessaged && <p className="text-gray-200 text-sm leading-relaxed">{String(act.agentMessaged.message)}</p>}
                                    {act.userMessaged && <p className="text-blue-200 text-sm leading-relaxed">{String(act.userMessaged.message)}</p>}
                                    {act.planGenerated && (
                                        <div className="text-sm text-gray-300">Generated a plan with {act.planGenerated.plan?.steps?.length || 0} steps. <button onClick={() => setActiveTab('plan')} className="text-purple-400 hover:underline">View Plan</button></div>
                                    )}
                                    {act.artifacts && (
                                        <div className="text-sm text-gray-300">Generated {act.artifacts.length} artifacts. <button onClick={() => setActiveTab('artifacts')} className="text-green-400 hover:underline">View Artifacts</button></div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Chat Input */}
                    <div className="p-4 bg-gray-800/50 border-t border-gray-800">
                        <form onSubmit={handleSendMessage} className="relative">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                disabled={actionLoading}
                                placeholder="Send a message to Jules..."
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                            />
                            <button type="submit" disabled={actionLoading || !chatInput.trim()} className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded-md px-3 flex items-center justify-center transition-colors">
                                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Column: Workspace Tabs */}
                <div className="flex flex-col bg-gray-800/30 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="flex border-b border-gray-800 bg-gray-800/50">
                        <button onClick={() => setActiveTab('plan')} className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'plan' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                            Plan & Review
                        </button>
                        <button onClick={() => setActiveTab('artifacts')} className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'artifacts' ? 'border-green-500 text-green-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
                            Artifacts & Code
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {activeTab === 'plan' && (
                            <div className="space-y-6">
                                {planActivity ? (
                                    <>
                                        <div className="space-y-3">
                                            {planActivity.planGenerated.plan?.steps?.map((step, idx) => (
                                                <div key={step.id || idx} className="bg-gray-800/80 p-4 rounded-lg border border-gray-700">
                                                    <h4 className="text-white font-medium mb-1">Step {step.index}: {String(step.title)}</h4>
                                                    <p className="text-sm text-gray-400">{String(step.description)}</p>
                                                </div>
                                            ))}
                                        </div>
                                        {sessionState === 'AWAITING_PLAN_APPROVAL' && (
                                            <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-xl flex items-center justify-between">
                                                <div>
                                                    <h4 className="text-purple-300 font-medium text-sm">Plan Approval Required</h4>
                                                    <p className="text-xs text-purple-400/80 mt-1">Review the steps above. Jules will pause until approved.</p>
                                                </div>
                                                <button onClick={handleApprovePlan} disabled={actionLoading} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                                                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Approve Plan
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                                        <Activity size={48} className="opacity-20" />
                                        <p>No plan generated yet.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'artifacts' && (
                            <div className="space-y-6">
                                {artifactActivities.length > 0 ? artifactActivities.flatMap(a => a.artifacts || []).map((art, idx) => (
                                    <div key={idx} className="space-y-2">
                                        <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                            {art.type === 'ChangeSet' ? <FileCode2 size={16} /> : <Terminal size={16} />}
                                            {String(art.type)}
                                        </h4>
                                        {art.type === 'ChangeSet' && <DiffViewer patch={art.changeSet?.unidiffPatch} />}
                                        {art.type === 'BashOutput' && (
                                            <div className="bg-gray-950 p-4 rounded-lg font-mono text-sm border border-gray-800 text-gray-300 whitespace-pre-wrap">
                                                <div className="text-gray-500 mb-2">$ {String(art.bashOutput?.command || '')}</div>
                                                {String(art.bashOutput?.stdout || '')}
                                                <div className="mt-2 text-xs text-green-500">Exit Code: {String(art.bashOutput?.exitCode)}</div>
                                            </div>
                                        )}
                                        {art.type === 'Media' && (
                                            <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 flex justify-center">
                                                <img src={`data:${art.media?.mimeType};base64,${art.media?.data}`} alt="Generated Media" className="max-w-full rounded" />
                                            </div>
                                        )}
                                    </div>
                                )) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                                        <Code size={48} className="opacity-20" />
                                        <p>No artifacts generated yet.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SessionsList = ({ onSelectSession, apiKey }) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [error, setError] = useState('');

    const [sources, setSources] = useState([]);

    const [prompt, setPrompt] = useState('');
    const [title, setTitle] = useState('');
    const [source, setSource] = useState('');
    const [branch, setBranch] = useState('main');
    const [requirePlanApproval, setRequirePlanApproval] = useState(true);
    const [createLoading, setCreateLoading] = useState(false);

    const loadData = async () => {
        if (!apiKey) {
            setSessions(MOCK_SESSIONS);
            setSources(MOCK_SOURCES);
            setSource(MOCK_SOURCES[0]?.name || '');
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const sessRes = await fetchJules('/v1alpha/sessions', 'GET', null, apiKey);
            setSessions(sessRes.sessions || []);

            const srcRes = await fetchJules('/v1alpha/sources', 'GET', null, apiKey);
            setSources(srcRes.sources || []);
            if (srcRes.sources?.length > 0) setSource(srcRes.sources[0].name);
        } catch (err) {
            setError(String(err.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [apiKey]);

    const handleCreateSession = async () => {
        if (!prompt || !source || !branch) return alert('Prompt, Source, and Branch are required.');
        setCreateLoading(true);

        if (!apiKey) {
            const newSess = {
                name: `sessions/sess-${Date.now()}`,
                title: title || 'New Local Session',
                state: 'QUEUED',
                prompt,
                sourceContext: { source, githubRepoContext: { startingBranch: branch } },
                createTime: new Date().toISOString()
            };
            setSessions([newSess, ...sessions]);
            setShowCreate(false);
            setCreateLoading(false);
            return;
        }

        try {
            const payload = {
                prompt,
                ...(title && { title }),
                sourceContext: { source, githubRepoContext: { startingBranch: branch } },
                requirePlanApproval,
                automationMode: 'AUTO_CREATE_PR'
            };
            await fetchJules('/v1alpha/sessions', 'POST', payload, apiKey);
            await loadData();
            setShowCreate(false);
        } catch (err) {
            alert(`Failed to create session: ${err.message}`);
        } finally {
            setCreateLoading(false);
        }
    };

    if (showCreate) {
        return (
            <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></button>
                    <h2 className="text-2xl font-semibold text-white">Create New Session</h2>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Session Title (Optional)</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none" placeholder="e.g. Implement user login" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Prompt *</label>
                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none min-h-[100px]" placeholder="Describe the coding task for Jules..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Source Repository *</label>
                            <select value={source} onChange={e => setSource(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none">
                                {sources.map(s => <option key={s.name} value={s.name}>{String(s.githubRepo?.owner)}/{String(s.githubRepo?.name)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Starting Branch *</label>
                            <input type="text" value={branch} onChange={e => setBranch(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
                        <div>
                            <div className="text-white font-medium">Require Plan Approval</div>
                            <div className="text-sm text-gray-400">Jules will pause and ask for your approval before writing code.</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={requirePlanApproval} onChange={e => setRequirePlanApproval(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    <div className="pt-4 border-t border-gray-700/50 flex justify-end gap-3">
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleCreateSession} disabled={createLoading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                            {createLoading ? <Loader2 size={16} className="animate-spin" /> : null} Create Session
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-white">Active Sessions</h2>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium">
                    <Plus size={16} /> New Session
                </button>
            </div>

            {error && <div className="bg-red-900/20 text-red-400 p-4 rounded-lg border border-red-900/50">{error}</div>}

            <div className="bg-gray-800/30 border border-gray-800 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center p-12 text-blue-400"><Loader2 className="animate-spin" size={32} /></div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-800/50 border-b border-gray-800 text-sm font-medium text-gray-400">
                                <th className="p-4">Session Title</th>
                                <th className="p-4">Repository</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Created</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {sessions.map(session => (
                                <tr key={session.name} className="hover:bg-gray-800/50 transition-colors group">
                                    <td className="p-4">
                                        <div className="font-medium text-white mb-1">{String(session.title || 'Untitled Session')}</div>
                                        <div className="text-xs text-gray-500 font-mono truncate max-w-xs">{String(session.name)}</div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-300">
                                        <div className="flex items-center gap-2"><Github size={14} className="text-gray-500" /> {String(session.sourceContext?.source?.split('/').pop() || '')}</div>
                                    </td>
                                    <td className="p-4"><StateBadge state={session.state} /></td>
                                    <td className="p-4 text-sm text-gray-400">{new Date(session.createTime).toLocaleDateString()}</td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => onSelectSession(session)} className="text-blue-400 hover:text-blue-300 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                            View Details &rarr;
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {sessions.length === 0 && (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No sessions found. Create one to get started.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

const CliRecipesView = () => {
    const recipes = [
        {
            title: "Batch Issue Delegation",
            desc: "Read a local TODO.md and spin up a Jules session for each line automatically.",
            code: `cat TODO.md | while read -r task; do\n  jules remote new --repo . --session "$task" --require-approval\ndone`
        },
        {
            title: "Triage with Gemini & Jules",
            desc: "Use GitHub CLI and Gemini to pick the most urgent issue, then delegate it to Jules.",
            code: `ISSUE_TITLE=$(gh issue list --json title | jq -r '.[0].title')\njules remote new --repo . --session "Fix issue: $ISSUE_TITLE" --auto-create-pr`
        },
        {
            title: "Fetch Artifacts to IDE",
            desc: "Pull down the code patches from a completed session into your local working tree.",
            code: `jules remote pull --session "sessions/sess-103" --apply-patch`
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-semibold text-white mb-2">CLI Recipe Builder</h2>
                <p className="text-gray-400 text-sm">Automate Jules locally using the <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">jules</code> CLI combined with standard Unix tools.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {recipes.map((r, i) => (
                    <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-gray-500 transition-colors">
                        <h3 className="text-lg font-medium text-white mb-2">{r.title}</h3>
                        <p className="text-sm text-gray-400 mb-4 h-10">{r.desc}</p>
                        <div className="relative">
                            <pre className="bg-gray-950 p-4 rounded-lg text-sm font-mono text-green-400 overflow-x-auto border border-gray-800">{r.code}</pre>
                            <button
                                onClick={() => navigator.clipboard.writeText(r.code)}
                                className="absolute top-2 right-2 p-1.5 bg-gray-800 text-gray-400 hover:text-white rounded border border-gray-700 transition-colors"
                                title="Copy to clipboard"
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SettingsView = ({ apiKey, setApiKey }) => (
    <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-2xl font-semibold text-white mb-6">Settings & Authentication</h2>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Jules API Key (<code className="text-xs">x-goog-api-key</code>)</label>
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                        setApiKey(e.target.value);
                        localStorage.setItem('jules_api_key', e.target.value);
                    }}
                    placeholder="AIzaSy..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none font-mono"
                />
                <p className="text-xs text-gray-500 mt-2">Required for actual API calls. If left empty, the app falls back to Demo Mode using mock data.</p>
            </div>
            {!apiKey && (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 flex gap-3">
                    <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={18} />
                    <div>
                        <h4 className="text-blue-300 text-sm font-medium mb-1">Demo Mode Active</h4>
                        <p className="text-xs text-blue-400/80 leading-relaxed">
                            Because no API key is provided, you are currently viewing mock data. Enter your key above to trigger actual live calls to the Jules API endpoints.
                        </p>
                    </div>
                </div>
            )}
        </div>
    </div>
);

// --- MAIN APP LAYOUT ---

export default function App() {
    const [apiKey, setApiKey] = useState('');
    const [activeNav, setActiveNav] = useState('sessions');
    const [selectedSession, setSelectedSession] = useState(null);

    useEffect(() => {
        const savedKey = localStorage.getItem('jules_api_key');
        if (savedKey) setApiKey(savedKey);
    }, []);

    const navItems = [
        { id: 'sessions', label: 'Sessions' },
        { id: 'sources', label: 'Sources' },
        { id: 'cli', label: 'CLI Recipes' },
        { id: 'settings', label: 'Settings' },
    ];

    const renderNavIcon = (id, active) => {
        const cls = active ? 'text-blue-500' : 'text-gray-500';
        switch (id) {
            case 'sessions': return <LayoutDashboard size={18} className={cls} />;
            case 'sources': return <Github size={18} className={cls} />;
            case 'cli': return <Terminal size={18} className={cls} />;
            case 'settings': return <Settings size={18} className={cls} />;
            default: return null;
        }
    };

    const renderContent = () => {
        if (selectedSession) return <SessionDetailView session={selectedSession} onBack={() => setSelectedSession(null)} apiKey={apiKey} />;
        switch (activeNav) {
            case 'sources': return <SourcesView apiKey={apiKey} />;
            case 'sessions': return <SessionsList onSelectSession={setSelectedSession} apiKey={apiKey} />;
            case 'cli': return <CliRecipesView />;
            case 'settings': return <SettingsView apiKey={apiKey} setApiKey={setApiKey} />;
            default: return <SessionsList apiKey={apiKey} />;
        }
    };

    return (
        <div className="flex h-screen bg-[#0A0A0B] text-gray-100 font-sans selection:bg-blue-500/30">
            {/* Sidebar Navigation */}
            <aside className="w-64 border-r border-gray-800 bg-[#0F0F11] flex flex-col z-20">
                <div className="p-6">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
                            <Terminal size={18} className="text-white" />
                        </div>
                        <span className="font-bold text-lg tracking-tight">Jules Studio</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-2 space-y-1">
                    {navItems.map(item => {
                        const isActive = activeNav === item.id && !selectedSession;
                        return (
                            <button
                                key={item.id}
                                onClick={() => { setActiveNav(item.id); setSelectedSession(null); }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                        ? 'bg-blue-600/10 text-blue-400'
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                    }`}
                            >
                                {renderNavIcon(item.id, isActive)}
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-800">
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                            <div className={`w-2 h-2 rounded-full ${apiKey ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500 animate-pulse'}`}></div>
                            {apiKey ? 'API Live' : 'Demo Mode'}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex-1 overflow-y-auto p-8 relative z-10">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
}