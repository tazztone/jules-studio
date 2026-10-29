import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import SessionsList from './components/SessionsList';
import SessionDetailView from './components/SessionDetailView';
import SourcesView from './components/SourcesView';
import CliRecipesView from './components/CliRecipesView';
import SettingsView from './components/SettingsView';

// Helper component to handle Session Detail routing
const SessionDetailWrapper = ({ apiKey }) => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    
    // In a real app, we'd fetch the session details here or via a context
    // For now, we'll pass the name and mock data will handle the rest
    const session = { name: `sessions/${sessionId}`, title: sessionId.startsWith('sess-') ? '' : sessionId };

    return <SessionDetailView session={session} onBack={() => navigate('/sessions')} apiKey={apiKey} />;
};

export default function App() {
    const [apiKey, setApiKey] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const savedKey = localStorage.getItem('jules_api_key');
        if (savedKey) setApiKey(savedKey);
    }, []);

    return (
        <div className="flex h-screen bg-[#0A0A0B] text-gray-100 font-sans selection:bg-blue-500/30">
            <Sidebar />

            <main className="flex-1 overflow-y-auto p-8 lg:p-12">
                <div className="max-w-6xl mx-auto h-full">
                    {/* Sunset & Deprecation Warning Banner */}
                    <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-amber-400 mt-0.5 shrink-0" size={20} />
                                <div>
                                    <p className="font-semibold text-white">Google Jules Deprecation Notice</p>
                                    <p className="text-sm text-amber-200/90 mt-0.5">
                                        Google Jules winds down on <strong>December 31, 2026</strong>. Read-only mode begins <strong>November 11, 2026</strong>.
                                        Migrate workflows to <strong>Google Antigravity</strong> and backup data before shutdown.
                                    </p>
                                </div>
                            </div>
                            <Link 
                                to="/cli" 
                                className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg border border-amber-500/30 whitespace-nowrap transition-colors font-medium self-end sm:self-center"
                            >
                                Export Guide
                            </Link>
                        </div>
                    </div>

                    <Routes>
                        <Route path="/" element={<Navigate to="/sessions" replace />} />
                        
                        <Route path="/sessions" element={
                            <SessionsList 
                                apiKey={apiKey} 
                                onSelectSession={(session) => {
                                    const id = session.name.split('/').pop();
                                    navigate(`/sessions/${id}`);
                                }} 
                            />
                        } />
                        
                        <Route path="/sessions/:sessionId" element={<SessionDetailWrapper apiKey={apiKey} />} />
                        
                        <Route path="/sources" element={<SourcesView apiKey={apiKey} />} />
                        
                        <Route path="/cli" element={<CliRecipesView />} />
                        
                        <Route path="/settings" element={<SettingsView apiKey={apiKey} setApiKey={setApiKey} />} />
                        
                        <Route path="*" element={<Navigate to="/sessions" replace />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}
