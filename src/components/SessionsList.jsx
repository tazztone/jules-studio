import React, { useState, useEffect, useRef } from 'react';
import { Github, Plus, Loader2, Search, Trash2, ChevronDown, CheckSquare, Square } from 'lucide-react';
import { StateBadge, fetchJules, Alert, ConfirmDialog, parseRepoName } from './Common';

const MOCK_SOURCES = [
    { name: 'sources/src-1', githubRepo: { owner: 'your-org', name: 'frontend-web', isPrivate: true, defaultBranch: 'main', branches: [{ name: 'main' }, { name: 'dev' }] } },
    { name: 'sources/src-2', githubRepo: { owner: 'your-org', name: 'backend-api', isPrivate: true, defaultBranch: 'main', branches: [{ name: 'main' }, { name: 'feature/auth' }] } }
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

const SessionsList = ({ onSelectSession, apiKey }) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [alertMsg, setAlertMsg] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(null); // stores sessionName or 'bulk'
    const [selectedSessions, setSelectedSessions] = useState([]);

    const [sources, setSources] = useState([]);
    const [filter, setFilter] = useState('');
    const [nextPageToken, setNextPageToken] = useState('');

    const [prompt, setPrompt] = useState('');
    const [title, setTitle] = useState('');
    const [source, setSource] = useState('');
    const nextPageTokenRef = useRef('');
    const [branch, setBranch] = useState('main');
    const [automationMode, setAutomationMode] = useState('AUTO_CREATE_PR');
    const [requirePlanApproval, setRequirePlanApproval] = useState(true);
    const [createLoading, setCreateLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(null);

    const loadData = React.useCallback(async (isLoadMore = false) => {
        if (!apiKey) {
            if (!isLoadMore) {
                setSessions(MOCK_SESSIONS);
                setSources(MOCK_SOURCES);
                setSource(MOCK_SOURCES[0]?.name || '');
            }
            setLoading(false);
            return;
        }
        
        setLoading(true);
        try {
            const queryParams = {
                pageSize: 20,
                pageToken: isLoadMore ? nextPageTokenRef.current : undefined,
                filter: filter || undefined
            };

            const sessRes = await fetchJules('/v1alpha/sessions', 'GET', null, apiKey, queryParams);
            const newSessions = sessRes.sessions || [];
            setSessions(prev => isLoadMore ? [...prev, ...newSessions] : newSessions);
            const token = sessRes.nextPageToken || '';
            setNextPageToken(token);
            nextPageTokenRef.current = token;

            if (!isLoadMore) {
                const srcRes = await fetchJules('/v1alpha/sources', 'GET', null, apiKey);
                const fetchedSources = srcRes.sources || [];
                setSources(fetchedSources);
                if (fetchedSources.length > 0 && !source) setSource(fetchedSources[0].name);
            }
        } catch (err) {
            setAlertMsg(String(err.message));
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiKey, filter]); // source and nextPageToken intentionally omitted to avoid loops

    useEffect(() => { loadData(); }, [loadData]);

    const handleDeleteSession = async (sessionName) => {
        setDeleteLoading(sessionName);
        
        try {
            if (apiKey) {
                await fetchJules(`/v1alpha/${sessionName}`, 'DELETE', null, apiKey);
            }
            setSessions(prev => prev.filter(s => s.name !== sessionName));
            setSelectedSessions(prev => prev.filter(id => id !== sessionName));
        } catch (err) {
            setAlertMsg(`Failed to delete session: ${err.message}`);
        } finally {
            setDeleteLoading(null);
            setConfirmDelete(null);
        }
    };

    const handleBulkDelete = async () => {
        setDeleteLoading('bulk');
        try {
            for (const name of selectedSessions) {
                if (apiKey) {
                    await fetchJules(`/v1alpha/${name}`, 'DELETE', null, apiKey);
                }
            }
            setSessions(prev => prev.filter(s => !selectedSessions.includes(s.name)));
            setSelectedSessions([]);
        } catch (err) {
            setAlertMsg(`Failed during bulk delete: ${err.message}`);
        } finally {
            setDeleteLoading(null);
            setConfirmDelete(null);
        }
    };

    const toggleSelect = (name) => {
        setSelectedSessions(prev => 
            prev.includes(name) ? prev.filter(id => id !== name) : [...prev, name]
        );
    };

    const toggleSelectAll = () => {
        if (selectedSessions.length === sessions.length) {
            setSelectedSessions([]);
        } else {
            setSelectedSessions(sessions.map(s => s.name));
        }
    };

    const handleCreateSession = async () => {
        if (!prompt || !source || !branch) {
            setAlertMsg('Prompt, Source, and Branch are required.');
            return;
        }
        setCreateLoading(true);

        if (!apiKey) {
            const newSess = {
                name: `sessions/sess-${Date.now()}`,
                title: title || 'New Local Session',
                state: 'QUEUED',
                prompt,
                sourceContext: { source, githubRepoContext: { startingBranch: branch } },
                automationMode,
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
                automationMode
            };
            await fetchJules('/v1alpha/sessions', 'POST', payload, apiKey);
            await loadData();
            setShowCreate(false);
        } catch (err) {
            setAlertMsg(`Failed to create session: ${err.message}`);
        } finally {
            setCreateLoading(false);
        }
    };

    const selectedSourceData = sources.find(s => s.name === source);
    const availableBranches = selectedSourceData?.githubRepo?.branches || [];
    const defaultBranch = selectedSourceData?.githubRepo?.defaultBranch || 'main';

    const renderHeader = () => (
        <div className="flex justify-between items-center gap-4 mb-6">
            <h2 className="text-2xl font-semibold text-white">{showCreate ? 'Create New Session' : 'Active Sessions'}</h2>
            {!showCreate && (
                <>
                    <div className="flex-1 max-w-md relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                            type="text" 
                            placeholder="Filter sessions (AIP-160)..." 
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && loadData()}
                            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shrink-0">
                        <Plus size={16} /> New Session
                    </button>
                </>
            )}
        </div>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {renderHeader()}
            {alertMsg && <Alert message={alertMsg} onClose={() => setAlertMsg('')} />}

            {showCreate ? (
                <div className="max-w-2xl mx-auto">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-6">
                        <div>
                            <label htmlFor="sessionTitle" className="block text-sm font-medium text-gray-300 mb-2">Session Title (Optional)</label>
                            <input id="sessionTitle" type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none" placeholder="e.g. Implement user login" />
                        </div>
                        <div>
                            <label htmlFor="sessionPrompt" className="block text-sm font-medium text-gray-300 mb-2">Prompt *</label>
                            <textarea id="sessionPrompt" value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none min-h-[100px]" placeholder="Describe the coding task for Jules..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="repoSource" className="block text-sm font-medium text-gray-300 mb-2">Source Repository *</label>
                                <select id="repoSource" value={source} onChange={e => setSource(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none">
                                    {sources.map(s => <option key={s.name} value={s.name}>{String(s.githubRepo?.owner)}/{String(s.githubRepo?.name)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="startBranch" className="block text-sm font-medium text-gray-300 mb-2">Starting Branch *</label>
                                <div className="relative">
                                    <select 
                                        id="startBranch"
                                        value={branch} 
                                        onChange={e => setBranch(e.target.value)} 
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none appearance-none"
                                    >
                                        {availableBranches.length > 0 ? (
                                            availableBranches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)
                                        ) : (
                                            <option value={defaultBranch}>{defaultBranch}</option>
                                        )}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                        <ChevronDown size={16} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label htmlFor="automationMode" className="block text-sm font-medium text-gray-300 mb-2">Automation Mode</label>
                                <select 
                                    id="automationMode"
                                    value={automationMode} 
                                    onChange={e => setAutomationMode(e.target.value)} 
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="AUTO_CREATE_PR">Auto Create PR</option>
                                    <option value="FULLY_AUTOMATED">Fully Automated</option>
                                    <option value="MANUAL">Manual (Local Branch Only)</option>
                                </select>
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
            ) : (
                <div className="space-y-6">
                    <div className="bg-gray-800/30 border border-gray-800 rounded-xl overflow-hidden">
                        {selectedSessions.length > 0 && (
                            <div className="bg-blue-600/10 border-b border-gray-800 p-3 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
                                <div className="text-sm text-blue-300 font-medium ml-2">
                                    {selectedSessions.length} session(s) selected
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setConfirmDelete('bulk')}
                                        className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium border border-red-900/50"
                                    >
                                        <Trash2 size={14} /> Delete Selected
                                    </button>
                                </div>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex items-center justify-center p-12 text-blue-400" data-testid="loading-spinner"><Loader2 className="animate-spin" size={32} /></div>
                        ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-800/50 border-b border-gray-800 text-sm font-medium text-gray-400">
                                            <th className="p-4 w-10">
                                                <button onClick={toggleSelectAll} aria-label="Select All" className="text-gray-500 hover:text-white transition-colors">
                                                    {selectedSessions.length === sessions.length && sessions.length > 0 ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} />}
                                                </button>
                                            </th>
                                            <th className="p-4">Session Title</th>
                                            <th className="p-4">Repository</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4">Created</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {sessions.map(session => (
                                            <tr key={session.name} className={`hover:bg-gray-800/50 transition-colors group ${selectedSessions.includes(session.name) ? 'bg-blue-900/10' : ''}`}>
                                                <td className="p-4">
                                                    <button onClick={() => toggleSelect(session.name)} aria-label={`Select ${session.title || 'Session'}`} className="text-gray-500 hover:text-white transition-colors">
                                                        {selectedSessions.includes(session.name) ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} />}
                                                    </button>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-medium text-white mb-1">{String(session.title || 'Untitled Session')}</div>
                                                    <div className="text-xs text-gray-500 font-mono truncate max-w-xs">{String(session.name)}</div>
                                                </td>
                                                <td className="p-4 text-sm text-gray-300">
                                                    <div className="flex items-center gap-2">
                                                        <Github size={14} className="text-gray-500" /> 
                                                        {parseRepoName(session.sourceContext?.source, sources)}
                                                    </div>
                                                </td>
                                                <td className="p-4"><StateBadge state={session.state} /></td>
                                                <td className="p-4 text-sm text-gray-400">{new Date(session.createTime).toLocaleDateString()}</td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => setConfirmDelete(session.name)} 
                                                            disabled={deleteLoading === session.name}
                                                            className="text-gray-500 hover:text-red-400 transition-colors p-1"
                                                            title="Delete Session"
                                                        >
                                                            {deleteLoading === session.name ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                        </button>
                                                        <button onClick={() => onSelectSession(session)} className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                                                            View Details &rarr;
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {sessions.length === 0 && (
                                            <tr><td colSpan="6" className="p-8 text-center text-gray-500">No sessions found. Create one to get started.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                        )}
                    </div>
                </div>
            )}
            
            <ConfirmDialog 
                open={confirmDelete !== null}
                title={confirmDelete === 'bulk' ? 'Bulk Delete' : 'Delete Session'}
                message={confirmDelete === 'bulk' 
                    ? `Are you sure you want to delete ${selectedSessions.length} sessions? This cannot be undone.` 
                    : 'Are you sure you want to delete this session? This cannot be undone.'}
                confirmLabel={deleteLoading ? (confirmDelete === 'bulk' ? 'Deleting...' : 'Deleting...') : 'Delete'}
                onConfirm={confirmDelete === 'bulk' ? handleBulkDelete : () => handleDeleteSession(confirmDelete)}
                onCancel={() => setConfirmDelete(null)}
            />

            {nextPageToken && !showCreate && (
                <div className="flex justify-center pt-4">
                    <button 
                        onClick={() => loadData(true)} 
                        disabled={loading}
                        className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-lg text-sm font-medium border border-gray-700 flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : null} Load More Sessions
                    </button>
                </div>
            )}
        </div>
    );
};

export default SessionsList;
