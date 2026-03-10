import React, { useState, useEffect, useRef } from 'react';
import { Github, Plus, Loader2 } from 'lucide-react';
import { Badge, fetchJules } from './Common';

const MOCK_SOURCES = [
    { name: 'sources/src-1', githubRepo: { owner: 'your-org', name: 'frontend-web', isPrivate: true, defaultBranch: 'main', branches: [{ name: 'main' }, { name: 'dev' }] } },
    { name: 'sources/src-2', githubRepo: { owner: 'your-org', name: 'backend-api', isPrivate: true, defaultBranch: 'main', branches: [{ name: 'main' }, { name: 'feature/auth' }] } },
    { name: 'sources/src-3', githubRepo: { owner: 'torvalds', name: 'linux', isPrivate: false, defaultBranch: 'master', branches: [{ name: 'master' }] } }
];

const SourcesView = ({ apiKey }) => {
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [nextPageToken, setNextPageToken] = useState('');
    const nextPageTokenRef = useRef('');

    const loadSources = React.useCallback(async (isLoadMore = false) => {
        if (!apiKey) {
            setSources(MOCK_SOURCES);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const queryParams = {
                pageSize: 12,
                pageToken: isLoadMore ? nextPageTokenRef.current : undefined
            };
            const res = await fetchJules('/v1alpha/sources', 'GET', null, apiKey, queryParams);
            const newSources = res.sources || [];
            setSources(prev => isLoadMore ? [...prev, ...newSources] : newSources);
            const token = res.nextPageToken || '';
            setNextPageToken(token);
            nextPageTokenRef.current = token;
        } catch (err) {
            setError(String(err.message));
        } finally {
            setLoading(false);
        }
    }, [apiKey]); // nextPageToken intentionally omitted

    useEffect(() => {
        loadSources();
    }, [loadSources]);

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
                <div className="flex items-center justify-center h-48 text-blue-400" data-testid="loading-spinner"><Loader2 className="animate-spin" size={32} /></div>
            ) : sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-gray-800/30 border border-gray-700 border-dashed rounded-xl text-gray-500 space-y-4">
                    <Github size={48} className="opacity-20" />
                    <p>No repositories connected yet.</p>
                </div>
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
                                <div className="pt-2">
                                    <button 
                                        onClick={async () => {
                                            if (window.confirm('Disconnect this repository?')) {
                                                try {
                                                    await fetchJules(`/v1alpha/${src.name}`, 'DELETE', null, apiKey);
                                                    loadSources();
                                                } catch (err) {
                                                    setError(err.message);
                                                }
                                            }
                                        }}
                                        title="Disconnect Repository"
                                        className="w-full text-xs text-red-400 hover:text-red-300 transition-colors py-2 border border-red-900/30 rounded bg-red-900/10 hover:bg-red-900/20"
                                    >
                                        Disconnect Repository
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {nextPageToken && (
                <div className="flex justify-center pt-8">
                    <button 
                        onClick={() => loadSources(true)} 
                        disabled={loading}
                        className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-lg text-sm font-medium border border-gray-700 flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : null} Load More Repos
                    </button>
                </div>
            )}
        </div>
    );
};

export default SourcesView;
