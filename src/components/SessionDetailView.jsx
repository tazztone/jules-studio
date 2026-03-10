import React, { useState, useEffect, useRef } from 'react';
import { 
    Activity, Github, GitPullRequest, Clock, ArrowLeft, 
    MessageSquare, FileCode2, RefreshCw, Terminal, 
    Loader2, Play, Check, Code, Trash2, HelpCircle, StickyNote
} from 'lucide-react';
import { StateBadge, fetchJules, Alert, ConfirmDialog, parseSessionId } from './Common';

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
    const [activeTab, setActiveTab] = useState('plan');
    const [chatInput, setChatInput] = useState('');
    const [activities, setActivities] = useState([]);
    const [sessionState, setSessionState] = useState(session.state);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [alertMsg, setAlertMsg] = useState('');
    const [notes, setNotes] = useState(() => localStorage.getItem(`jules_notes_${session.name}`) || '');

    const pollInterval = useRef(null);
    const pollTime = useRef(5000);
    const retryCount = useRef(0);
    const lastNotifiedState = useRef(session.state);

    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    const saveNotes = (val) => {
        setNotes(val);
        localStorage.setItem(`jules_notes_${session.name}`, val);
    };

    const checkNotifications = React.useCallback((newState) => {
        if (newState === lastNotifiedState.current) return;
        
        if (["AWAITING_PLAN_APPROVAL", "COMPLETED"].includes(newState) && Notification.permission === "granted") {
            new Notification(`Jules: Session ${newState === "COMPLETED" ? "Finished" : "Action Required"}`, {
                body: `Session "${session.title || 'Untitled'}" is now ${newState.replace(/_/g, ' ')}.`,
                icon: '/favicon.ico'
            });
        }
        lastNotifiedState.current = newState;
    }, [session.title]);

    const loadActivities = React.useCallback(async () => {
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
            
            checkNotifications(sessRes.state);

            // Success: Reset polling backoff
            if (retryCount.current > 0) {
                retryCount.current = 0;
                pollTime.current = 5000;
            }
        } catch (err) {
            console.error("Error polling activities:", err);
            if (err.message.includes('429')) {
                // Rate limited: Exponential backoff
                retryCount.current += 1;
                pollTime.current = Math.min(60000, pollTime.current * 2);
            } else {
                setAlertMsg(`Failed to load activities: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    }, [apiKey, session.name, checkNotifications]); 

    useEffect(() => {
        let timer;
        const poll = async () => {
            await loadActivities();
            if (['QUEUED', 'PLANNING', 'IN_PROGRESS'].includes(sessionState)) {
                timer = setTimeout(poll, pollTime.current);
            }
        };

        poll();
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [loadActivities, sessionState]);

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
            setAlertMsg(`Error approving plan: ${err.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteSession = async () => {
        setActionLoading(true);
        if (!apiKey) {
            onBack();
            return;
        }
        try {
            await fetchJules(`/v1alpha/${session.name}`, 'DELETE', null, apiKey);
            onBack();
        } catch (err) {
            setAlertMsg(`Error deleting session: ${err.message}`);
        } finally {
            setActionLoading(false);
            setConfirmDelete(false);
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
            setAlertMsg(`Error sending message: ${err.message}`);
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
                <div className="flex gap-2">
                    {outputs.map((out, i) => out.pullRequest ? (
                        <a key={i} href={out.pullRequest.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium border border-gray-700">
                            <Github size={16} /> View Pull Request
                        </a>
                    ) : null)}
                    <button 
                        onClick={() => setConfirmDelete(true)} 
                        disabled={actionLoading}
                        className="bg-red-900/20 hover:bg-red-900/40 text-red-400 p-2 rounded-lg transition-colors border border-red-900/50 disabled:opacity-50"
                        title="Delete Session"
                    >
                        {actionLoading ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                    </button>
                </div>
            </div>

            {alertMsg && <Alert message={alertMsg} onClose={() => setAlertMsg('')} />}

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 mt-4">
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
                            <button 
                                type="submit" 
                                disabled={!chatInput.trim() || actionLoading} 
                                title="Send Message"
                                className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded-md px-3 flex items-center justify-center transition-colors"
                            >
                                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                            </button>
                        </form>
                    </div>

                    {/* Local Notes */}
                    <div className="p-4 bg-gray-900/30 border-t border-gray-800 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <StickyNote size={14} /> My Private Notes (LocalStorage)
                        </div>
                        <textarea 
                            value={notes}
                            onChange={(e) => saveNotes(e.target.value)}
                            placeholder="Add your local thoughts/reminders for this session..."
                            className="w-full h-24 bg-transparent border-none text-sm text-gray-300 placeholder:text-gray-600 focus:ring-0 resize-none"
                        />
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
                                            <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-xl space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-purple-300 font-medium text-sm">Plan Approval Required</h4>
                                                        <p className="text-xs text-purple-400/80 mt-1">Review the steps above. Jules will pause until approved.</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => document.querySelector('input[placeholder*="Send a message"]').focus()} 
                                                            className="flex items-center gap-2 text-gray-400 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
                                                        >
                                                            <HelpCircle size={16} /> Suggest Changes
                                                        </button>
                                                        <button onClick={handleApprovePlan} disabled={actionLoading} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                                                            {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Approve Plan
                                                        </button>
                                                    </div>
                                                </div>
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
                                {/* CLI Pull Snippet */}
                                <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-4 relative overflow-hidden group mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2 text-blue-300 text-sm font-medium">
                                            <Terminal size={16} /> Local Integration
                                        </div>
                                        <button 
                                            onClick={() => navigator.clipboard.writeText(`# Session: "${session.title}"\njules remote pull --session ${parseSessionId(session.name)}`)}
                                            className="text-xs text-blue-400 hover:text-white transition-colors bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20"
                                        >
                                            Copy Command
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -right-2 -bottom-2 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                                            <Code size={48} />
                                        </div>
                                        <pre className="text-[11px] font-mono text-blue-200/80 leading-relaxed overflow-x-auto whitespace-pre">
                                            # Session: &quot;{session.title}&quot;<br/>
                                            jules remote pull --session {parseSessionId(session.name)}
                                        </pre>
                                    </div>
                                </div>

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
            <ConfirmDialog 
                open={confirmDelete}
                title="Delete Session"
                message="Are you sure you want to delete this session? This will permanently remove it from the Jules API. This action cannot be undone."
                confirmLabel={actionLoading ? 'Deleting...' : 'Delete Permanently'}
                onConfirm={handleDeleteSession}
                onCancel={() => setConfirmDelete(false)}
            />
        </div>
    );
};

export default SessionDetailView;
